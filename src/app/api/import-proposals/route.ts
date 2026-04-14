import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// ── Column mapping: Excel header → internal field ──────────────────────────
const PROPOSAL_COLUMNS: Record<string, string[]> = {
  name: ['name', 'proposal name', 'proposal', 'title', 'project name', 'project title'],
  rfpNumber: ['rfp number', 'rfp', 'rfp #', 'rfp#', 'tender number', 'tender no', 'tender #', 'tender', 'ref no', 'reference'],
  clientName: ['client', 'client name', 'organization', 'company', 'customer', 'organisation'],
  assignedMemberName: ['assigned to', 'assigned member', 'team member', 'member', 'owner', 'assigned', 'responsible'],
  value: ['value', 'amount', 'value (pkr)', 'pkr', 'price', 'cost', 'budget', 'proposal value', 'total value'],
  status: ['status', 'proposal status', 'stage', 'state'],
  remarks: ['remarks', 'notes', 'description', 'comments', 'details', 'observation'],
  deadline: ['deadline', 'due date', 'closing date', 'submission deadline', 'last date'],
  submissionDate: ['submission date', 'submitted date', 'submitted on', 'date submitted', 'submission'],
  thematicAreas: ['thematic area', 'thematic areas', 'sector', 'category', 'categories', 'domain', 'area'],
  winningChances: ['winning chances', 'probability', 'win chance', 'chances', 'win probability', 'likelihood'],
  focalPerson: ['focal person', 'contact person', 'poc', 'point of contact', 'contact'],
}

const VALID_STATUSES = ['Submitted', 'In Process', 'In Evaluation', 'Pending', 'Won']
const VALID_WINNING_CHANCES = ['Low', 'Medium', 'High']

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
  for (const [field, aliases] of Object.entries(PROPOSAL_COLUMNS)) {
    for (const alias of aliases) {
      if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) return field
    }
  }
  return null
}

function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null
  const trimmed = value.trim()
  const isoDate = Date.parse(trimmed)
  if (!isNaN(isoDate)) { const d = new Date(isoDate); if (d.getFullYear() >= 2000 && d.getFullYear() <= 2035) return d }
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmy) { const day = parseInt(dmy[1]); const month = parseInt(dmy[2]) - 1; let year = parseInt(dmy[3]); if (year < 100) year += 2000; const d = new Date(year, month, day); if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d }
  const mmm = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{2,4})$/i)
  if (mmm) { const day = parseInt(mmm[1]); const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(mmm[2].toLowerCase()); if (mi !== -1) { let year = parseInt(mmm[3]); if (year < 100) year += 2000; return new Date(year, mi, day) } }
  return null
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return 0
  const cleaned = value.toString().replace(/[,，\s₨Rs.PKRAED]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function normalizeStatus(value: string): string | null {
  if (!value || value.trim() === '') return 'In Process'
  const v = value.trim()
  for (const status of VALID_STATUSES) { if (v.toLowerCase() === status.toLowerCase()) return status }
  const map: Record<string, string> = { submitted:'Submitted', inprocess:'In Process', 'in process':'In Process', wip:'In Process', progress:'In Process', evaluation:'In Evaluation', evaluating:'In Evaluation', review:'In Evaluation', pending:'Pending', hold:'Pending', won:'Won', awarded:'Won', success:'Won', approved:'Won', lost:'Pending', rejected:'Pending' }
  for (const [key, status] of Object.entries(map)) { if (v.toLowerCase().includes(key)) return status }
  return null
}

function normalizeWinningChances(value: string): string {
  if (!value || value.trim() === '') return ''
  const v = value.trim().toLowerCase()
  const map: Record<string, string> = { low:'Low', medium:'Medium', med:'Medium', moderate:'Medium', avg:'Average', average:'Average', high:'High', strong:'High', good:'High', best:'High' }
  for (const [key, val] of Object.entries(map)) { if (v === key || v.includes(key)) return val }
  return value.trim()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded. Please select an Excel (.xlsx) or CSV file.' }, { status: 400 })
    const ext = file.name.split('.').pop()?.toLowerCase()
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv','application/csv']
    if (!validTypes.includes(file.type) && !['xlsx','xls','csv'].includes(ext || '')) return NextResponse.json({ error: 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    if (rows.length === 0) return NextResponse.json({ error: 'The uploaded file is empty. Please ensure your Excel/CSV file has data rows.' }, { status: 400 })

    const excelHeaders = Object.keys(rows[0])
    const columnMap: Record<string, string> = {}
    const unmatchedHeaders: string[] = []
    for (const header of excelHeaders) { const field = matchColumn(header); if (field) columnMap[header] = field; else unmatchedHeaders.push(header) }
    if (!columnMap && Object.keys(rows[0]).length === 0) return NextResponse.json({ error: 'Could not read any columns from the file. Make sure the first row contains column headers.' }, { status: 400 })
    const hasNameColumn = Object.values(columnMap).includes('name')
    const hasClientColumn = Object.values(columnMap).includes('clientName')

    const allClients = await db.client.findMany({ select: { id: true, name: true } })
    const allMembers = await db.teamMember.findMany({ where: { isActive: true }, select: { id: true, name: true } })
    const allThematicAreas = await db.thematicArea.findMany({ select: { id: true, name: true } })
    const clientMap = new Map(allClients.map(c => [c.name.toLowerCase().trim(), c.id]))
    const memberMap = new Map(allMembers.map(m => [m.name.toLowerCase().trim(), m.id]))
    const thematicAreaMap = new Map(allThematicAreas.map(t => [t.name.toLowerCase().trim(), t.id]))

    const result: ImportResult = { total: rows.length, success: 0, failed: 0, skipped: 0, errors: [], rowDetails: [], createdIds: [] }

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]; const rowNum = i + 2; const rowErrors: RowError[] = []; const rowWarnings: string[] = []; const mappedData: Record<string, string> = {}
      for (const [excelHeader, field] of Object.entries(columnMap)) { const rawValue = rawRow[excelHeader]; mappedData[field] = rawValue !== undefined && rawValue !== null ? String(rawValue) : '' }

      const name = (mappedData['name'] || '').toString().trim()
      if (!name) { if (!hasNameColumn) { rowErrors.push({ row: rowNum, column: 'Proposal Name', value: '(column not found)', message: 'Required column "Proposal Name" is missing from the file.' }) } else { rowErrors.push({ row: rowNum, column: 'Proposal Name', value: '', message: 'Proposal Name is required but this row is empty.' }) } }

      const clientName = (mappedData['clientName'] || '').toString().trim()
      let clientId = ''
      if (!clientName) { if (!hasClientColumn) { rowErrors.push({ row: rowNum, column: 'Client', value: '(column not found)', message: 'Required column "Client" is missing from the file.' }) } else { rowErrors.push({ row: rowNum, column: 'Client', value: '', message: 'Client is required but this row is empty.' }) } }
      else {
        clientId = clientMap.get(clientName.toLowerCase().trim()) || ''
        if (!clientId) { for (const [n, id] of clientMap.entries()) { if (n.includes(clientName.toLowerCase().trim()) || clientName.toLowerCase().trim().includes(n)) { clientId = id; rowWarnings.push(`Client "${clientName}" was matched to "${n}" (partial match)`); break } } }
        if (!clientId) { const suggestions = allClients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase().substring(0, 5))).map(c => c.name).slice(0, 3); rowErrors.push({ row: rowNum, column: 'Client', value: clientName, message: `Client "${clientName}" not found.${suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : ' Please create this client first or check the spelling.'}` }) }
      }

      const memberName = (mappedData['assignedMemberName'] || '').toString().trim()
      let assignedMemberId = ''
      if (memberName) { assignedMemberId = memberMap.get(memberName.toLowerCase().trim()) || ''; if (!assignedMemberId) { for (const [n, id] of memberMap.entries()) { if (n.includes(memberName.toLowerCase().trim()) || memberName.toLowerCase().trim().includes(n)) { assignedMemberId = id; rowWarnings.push(`Member "${memberName}" matched to "${n}" (partial match)`); break } } } if (!assignedMemberId) { const suggestions = allMembers.filter(m => m.name.toLowerCase().includes(memberName.toLowerCase().substring(0, 3))).map(m => m.name).slice(0, 3); rowErrors.push({ row: rowNum, column: 'Assigned To', value: memberName, message: `Team member "${memberName}" not found.${suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : ' This member may be inactive.'}` }) } }

      const valueRaw = (mappedData['value'] || '').toString(); let value = 0
      if (valueRaw.trim()) { const parsed = parseNumber(valueRaw); if (parsed === null) { rowErrors.push({ row: rowNum, column: 'Value', value: valueRaw, message: `Invalid number "${valueRaw}". Use a plain number.` }) } else { value = parsed } }

      const statusRaw = (mappedData['status'] || '').toString().trim(); let status = 'In Process'
      if (statusRaw) { const normalized = normalizeStatus(statusRaw); if (!normalized) { rowErrors.push({ row: rowNum, column: 'Status', value: statusRaw, message: `Invalid status "${statusRaw}". Allowed: ${VALID_STATUSES.join(', ')}.` }) } else { status = normalized; if (normalized !== statusRaw && statusRaw.toLowerCase() !== normalized.toLowerCase()) rowWarnings.push(`Status "${statusRaw}" auto-corrected to "${normalized}"`) } }

      const winningChancesRaw = (mappedData['winningChances'] || '').toString().trim(); let winningChances = ''
      if (winningChancesRaw) { winningChances = normalizeWinningChances(winningChancesRaw); if (winningChances && !VALID_WINNING_CHANCES.includes(winningChances)) rowWarnings.push(`Winning chances "${winningChancesRaw}" set as-is (not Low/Medium/High)`) }

      const deadlineRaw = (mappedData['deadline'] || '').toString(); let deadline: Date | null = null
      if (deadlineRaw.trim()) { deadline = parseDate(deadlineRaw); if (!deadline) rowErrors.push({ row: rowNum, column: 'Deadline', value: deadlineRaw, message: `Invalid date "${deadlineRaw}". Use DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD.` }) }

      const submissionDateRaw = (mappedData['submissionDate'] || '').toString(); let submissionDate: Date | null = null
      if (submissionDateRaw.trim()) { submissionDate = parseDate(submissionDateRaw); if (!submissionDate) rowErrors.push({ row: rowNum, column: 'Submission Date', value: submissionDateRaw, message: `Invalid date "${submissionDateRaw}". Use DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD.` }) }

      const areasRaw = (mappedData['thematicAreas'] || '').toString().trim(); const thematicAreaIds: string[] = []
      if (areasRaw) { const areaNames = areasRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean); for (const areaName of areaNames) { let areaId = thematicAreaMap.get(areaName.toLowerCase()) || ''; if (!areaId) { for (const [n, id] of thematicAreaMap.entries()) { if (n.includes(areaName.toLowerCase()) || areaName.toLowerCase().includes(n)) { areaId = id; break } } } if (areaId) thematicAreaIds.push(areaId); else rowWarnings.push(`Thematic area "${areaName}" not found. Available: ${allThematicAreas.map(t => t.name).join(', ')}`) } }

      const focalPerson = (mappedData['focalPerson'] || '').toString().trim()
      const remarks = (mappedData['remarks'] || '').toString().trim()
      const rfpNumber = (mappedData['rfpNumber'] || '').toString().trim()

      const parsedRow: ParsedRow = { row: rowNum, data: { name, clientName, assignedMemberName: memberName, value: String(value), status, remarks, focalPerson, rfpNumber, deadline: deadline ? deadline.toISOString().split('T')[0] : '', submissionDate: submissionDate ? submissionDate.toISOString().split('T')[0] : '', thematicAreas: areasRaw, winningChances }, errors: rowErrors, warnings: rowWarnings, valid: rowErrors.length === 0 }
      result.rowDetails.push(parsedRow)

      if (rowErrors.length === 0) {
        try {
          const proposal = await db.proposal.create({ data: { name, rfpNumber, clientId, assignedMemberId, value, status, remarks, deadline, submissionDate, winningChances, focalPerson, thematicAreas: thematicAreaIds.length > 0 ? { create: thematicAreaIds.map(id => ({ thematicAreaId: id })) } : undefined } })
          result.success++; result.createdIds.push(proposal.id)
        } catch (error) {
          result.failed++; const errorMsg = error instanceof Error ? error.message : 'Database error'; rowErrors.push({ row: rowNum, column: 'Database', value: name, message: `Failed to save: ${errorMsg}` }); parsedRow.errors = rowErrors; parsedRow.valid = false
        }
      } else { result.failed++ }
    }

    return NextResponse.json({ ...result, columnMapping: columnMap, unmatchedHeaders, message: `Import complete: ${result.success} of ${result.total} proposals imported.${result.failed > 0 ? ` ${result.failed} rows had errors.` : ''}` })
  } catch (error) {
    console.error('[Proposal Import] Error:', error)
    return NextResponse.json({ error: 'Failed to process import: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 })
  }
}

// GET /api/import-proposals — Template download if URL ends with /template, otherwise return info
export async function GET(request: NextRequest) {
  try {
    const { pathname } = new URL(request.url)

    if (pathname.endsWith('/template')) {
      // Generate and download Excel template
      const clients = await db.client.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
      const members = await db.teamMember.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } })
      const thematicAreas = await db.thematicArea.findMany({ select: { name: true }, orderBy: { sortOrder: 'asc' } })

      const wb = XLSX.utils.book_new()
      const templateData = [
        { 'Proposal Name': 'IT Infrastructure Upgrade', 'RFP Number': 'RFP-2025-001', 'Client': clients[0]?.name || 'Client Name', 'Assigned To': members[0]?.name || 'Team Member Name', 'Value (PKR)': 1500000, 'Status': 'In Process', 'Thematic Area': thematicAreas[0]?.name || 'IT & Technology', 'Winning Chances': 'Medium', 'Focal Person': 'Contact Name', 'Deadline': '2025-06-30', 'Submission Date': '2025-06-15', 'Remarks': 'Sample proposal remarks' },
        { 'Proposal Name': '(Add your proposals below)', 'RFP Number': '', 'Client': clients[1]?.name || '', 'Assigned To': members[1]?.name || '', 'Value (PKR)': '', 'Status': 'Submitted', 'Thematic Area': thematicAreas[1]?.name || '', 'Winning Chances': 'High', 'Focal Person': '', 'Deadline': '', 'Submission Date': '', 'Remarks': '' },
      ]
      const ws = XLSX.utils.json_to_sheet(templateData)
      XLSX.utils.book_append_sheet(wb, ws, 'Proposals')

      const instructions = [
        { 'Column': 'Proposal Name', 'Required': 'YES', 'Description': 'Name of the proposal/tender', 'Example': 'IT Infrastructure Upgrade', 'Valid Values': 'Any text' },
        { 'Column': 'RFP Number', 'Required': 'No', 'Description': 'RFP or Tender reference number', 'Example': 'RFP-2025-001', 'Valid Values': 'Any text' },
        { 'Column': 'Client', 'Required': 'YES', 'Description': 'Must match an existing client name in CRM', 'Example': 'See list', 'Valid Values': clients.map(c => c.name).join(', ') || 'N/A' },
        { 'Column': 'Assigned To', 'Required': 'No', 'Description': 'Must match an existing team member name', 'Example': 'See list', 'Valid Values': members.map(m => m.name).join(', ') || 'N/A' },
        { 'Column': 'Value (PKR)', 'Required': 'No', 'Description': 'Proposal value in PKR (numbers only)', 'Example': '1500000', 'Valid Values': 'Numeric value' },
        { 'Column': 'Status', 'Required': 'No', 'Description': 'Current status', 'Example': 'In Process', 'Valid Values': VALID_STATUSES.join(', ') },
        { 'Column': 'Thematic Area', 'Required': 'No', 'Description': 'Category/sector (comma for multiple)', 'Example': 'IT, Healthcare', 'Valid Values': thematicAreas.map(t => t.name).join(', ') || 'N/A' },
        { 'Column': 'Winning Chances', 'Required': 'No', 'Description': 'Estimated probability', 'Example': 'Medium', 'Valid Values': 'Low, Medium, High' },
        { 'Column': 'Focal Person', 'Required': 'No', 'Description': 'Contact person', 'Example': 'John Doe', 'Valid Values': 'Any text' },
        { 'Column': 'Deadline', 'Required': 'No', 'Description': 'Proposal deadline date', 'Example': '2025-06-30', 'Valid Values': 'YYYY-MM-DD or DD/MM/YYYY' },
        { 'Column': 'Submission Date', 'Required': 'No', 'Description': 'Date submitted', 'Example': '2025-06-15', 'Valid Values': 'YYYY-MM-DD or DD/MM/YYYY' },
        { 'Column': 'Remarks', 'Required': 'No', 'Description': 'Additional notes', 'Example': 'Urgent deadline', 'Valid Values': 'Any text' },
      ]
      const wsInstructions = XLSX.utils.json_to_sheet(instructions)
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="proposal_import_template.xlsx"',
        },
      })
    }

    return NextResponse.json({
      message: 'POST to this endpoint to import proposals. GET /template to download the Excel template.',
      supportedFormats: ['.xlsx', '.xls', '.csv'],
      maxFileSize: '10 MB',
      columns: Object.keys(PROPOSAL_COLUMNS),
    })
  } catch (error) {
    console.error('[Import Template] Error:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
