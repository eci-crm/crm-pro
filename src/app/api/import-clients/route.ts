import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// ── Column mapping: Excel header → internal field ──────────────────────────
const CLIENT_COLUMNS: Record<string, string[]> = {
  name: ['name', 'client name', 'organization', 'company', 'customer', 'organisation', 'client'],
  address: ['address', 'location', 'city', 'address line', 'office address'],
  status: ['status', 'client status', 'active', 'inactive', 'state'],
}

const VALID_STATUSES = ['Active', 'Inactive']

interface RowError {
  row: number
  column: string
  value: string
  message: string
}

interface ParsedRow {
  row: number
  data: Record<string, string>
  errors: RowError[]
  warnings: string[]
  valid: boolean
}

interface ImportResult {
  total: number
  success: number
  failed: number
  skipped: number
  errors: RowError[]
  rowDetails: ParsedRow[]
  createdIds: string[]
}

function normalizeHeader(header: string): string {
  return header.toString().toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
}

function matchColumn(excelHeader: string): string | null {
  const normalized = normalizeHeader(excelHeader)
  for (const [field, aliases] of Object.entries(CLIENT_COLUMNS)) {
    for (const alias of aliases) {
      if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
        return field
      }
    }
  }
  return null
}

function normalizeStatus(value: string): string | null {
  if (!value || value.trim() === '') return 'Active'
  const v = value.trim().toLowerCase()

  for (const status of VALID_STATUSES) {
    if (v === status.toLowerCase()) return status
  }

  if (['active', 'yes', 'true', '1', 'enabled', 'on'].includes(v)) return 'Active'
  if (['inactive', 'no', 'false', '0', 'disabled', 'off', 'deactivated'].includes(v)) return 'Inactive'

  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded. Please select an Excel (.xlsx) or CSV file.' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ]
    if (!validTypes.includes(file.type) && !['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      )
    }

    // Parse the file
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'The uploaded file is empty. Please ensure your Excel/CSV file has data rows.' },
        { status: 400 }
      )
    }

    // Detect column mapping from headers
    const excelHeaders = Object.keys(rows[0])
    const columnMap: Record<string, string> = {}
    const unmatchedHeaders: string[] = []

    for (const header of excelHeaders) {
      const field = matchColumn(header)
      if (field) {
        columnMap[header] = field
      } else {
        unmatchedHeaders.push(header)
      }
    }

    if (!columnMap && Object.keys(rows[0]).length === 0) {
      return NextResponse.json(
        { error: 'Could not read any columns from the file. Make sure the first row contains column headers.' },
        { status: 400 }
      )
    }

    const hasNameColumn = Object.values(columnMap).includes('name')

    // Fetch existing clients to avoid duplicates
    const existingClients = await db.client.findMany({ select: { id: true, name: true } })
    const existingNames = new Set(existingClients.map(c => c.name.toLowerCase().trim()))

    const result: ImportResult = {
      total: rows.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      rowDetails: [],
      createdIds: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const rowNum = i + 2
      const rowErrors: RowError[] = []
      const rowWarnings: string[] = []
      const mappedData: Record<string, string> = {}

      for (const [excelHeader, field] of Object.entries(columnMap)) {
        const rawValue = rawRow[excelHeader]
        mappedData[field] = rawValue !== undefined && rawValue !== null ? String(rawValue) : ''
      }

      // ── Validate: Name (required) ──
      const name = (mappedData['name'] || '').toString().trim()
      if (!name) {
        if (!hasNameColumn) {
          rowErrors.push({
            row: rowNum,
            column: 'Client Name',
            value: '(column not found)',
            message: 'Required column "Client Name" or "Name" is missing from the file.',
          })
        } else {
          rowErrors.push({
            row: rowNum,
            column: 'Client Name',
            value: '',
            message: 'Client Name is required but this row is empty.',
          })
        }
      } else if (existingNames.has(name.toLowerCase())) {
        rowWarnings.push(`Client "${name}" already exists and will be skipped (duplicate).`)
      }

      // ── Validate: Status (optional) ──
      const statusRaw = (mappedData['status'] || '').toString().trim()
      let status = 'Active'
      if (statusRaw) {
        const normalized = normalizeStatus(statusRaw)
        if (!normalized) {
          rowErrors.push({
            row: rowNum,
            column: 'Status',
            value: statusRaw,
            message: `Invalid status "${statusRaw}". Allowed values are: Active, Inactive.`,
          })
        } else {
          status = normalized
        }
      }

      const address = (mappedData['address'] || '').toString().trim()

      const parsedRow: ParsedRow = {
        row: rowNum,
        data: { name, address, status },
        errors: rowErrors,
        warnings: rowWarnings,
        valid: rowErrors.length === 0,
      }

      result.rowDetails.push(parsedRow)

      if (rowErrors.length === 0) {
        // Skip duplicates
        if (existingNames.has(name.toLowerCase())) {
          result.skipped++
          continue
        }

        try {
          const client = await db.client.create({
            data: { name, address, status },
          })
          result.success++
          result.createdIds.push(client.id)
          existingNames.add(name.toLowerCase()) // Prevent duplicates within same import
        } catch (error) {
          result.failed++
          const errorMsg = error instanceof Error ? error.message : 'Database error'
          rowErrors.push({
            row: rowNum,
            column: 'Database',
            value: name,
            message: `Failed to save: ${errorMsg}`,
          })
          parsedRow.errors = rowErrors
          parsedRow.valid = false
        }
      } else {
        result.failed++
      }
    }

    return NextResponse.json({
      ...result,
      columnMapping: columnMap,
      unmatchedHeaders,
      message: `Import complete: ${result.success} of ${result.total} clients imported successfully.${result.failed > 0 ? ` ${result.failed} rows had errors and were skipped.` : ''}${result.skipped > 0 ? ` ${result.skipped} duplicates were skipped.` : ''}`,
    })
  } catch (error) {
    console.error('[Client Import] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process import: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// GET /api/clients/import/template — Generate a blank template
export async function GET() {
  try {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Clients
    const templateData = [
      { 'Client Name': 'Pakistan Telecommunication Company (PTCL)', 'Address': 'Islamabad', 'Status': 'Active' },
      { 'Client Name': '(Add your clients below)', 'Address': 'City name', 'Status': 'Active' },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')

    // Sheet 2: Instructions
    const instructions = [
      { 'Column': 'Client Name', 'Required': 'YES', 'Description': 'Full name of the client organization', 'Example': 'PTCL, NBP, WAPDA', 'Valid Values': 'Any text (unique)' },
      { 'Column': 'Address', 'Required': 'No', 'Description': 'Office address or city', 'Example': 'Islamabad', 'Valid Values': 'Any text' },
      { 'Column': 'Status', 'Required': 'No', 'Description': 'Whether the client is active or inactive', 'Example': 'Active', 'Valid Values': 'Active, Inactive (default: Active)' },
    ]

    const wsInstructions = XLSX.utils.json_to_sheet(instructions)
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="client_import_template.xlsx"',
      },
    })
  } catch (error) {
    console.error('[Client Import Template] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}
