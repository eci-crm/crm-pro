import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// ── Column Definitions with expected format ──────────────────────────────
// Each column has: aliases (for auto-matching), required flag, and format description

const PROPOSAL_COLUMNS: Record<string, {
  aliases: string[]
  required: boolean
  format: string
  example: string
  group: 'proposal' | 'client' | 'lookup'
}> = {
  name: {
    aliases: ['proposal name', 'proposal', 'title', 'project name', 'project title'],
    required: true,
    format: 'Any text — the name/title of the proposal or tender',
    example: 'IT Infrastructure Upgrade',
    group: 'proposal',
  },
  rfpNumber: {
    aliases: ['rfp number', 'rfp', 'rfp #', 'rfp#', 'tender number', 'tender no', 'tender #', 'tender', 'ref no', 'reference'],
    required: false,
    format: 'Any text — RFP or tender reference number',
    example: 'RFP-2025-001',
    group: 'proposal',
  },
  clientName: {
    aliases: ['client', 'client name', 'organization', 'company', 'customer', 'organisation'],
    required: true,
    format: 'Text — name of the client/organization. If not found in CRM, it will be auto-created.',
    example: 'Pakistan Telecommunication Company (PTCL)',
    group: 'client',
  },
  clientAddress: {
    aliases: ['client address', 'address', 'location', 'city', 'office address'],
    required: false,
    format: 'Any text — client address or city (used when auto-creating new clients)',
    example: 'Islamabad',
    group: 'client',
  },
  clientStatus: {
    aliases: ['client status'],
    required: false,
    format: '"Active" or "Inactive" — client status (used when auto-creating new clients, default: Active)',
    example: 'Active',
    group: 'client',
  },
  assignedMemberName: {
    aliases: ['assigned to', 'assigned member', 'team member', 'member', 'owner', 'assigned', 'responsible'],
    required: false,
    format: 'Exact name of an existing team member in the CRM',
    example: 'Ahmed Khan',
    group: 'lookup',
  },
  value: {
    aliases: ['value', 'amount', 'value (pkr)', 'pkr', 'price', 'cost', 'budget', 'proposal value', 'total value'],
    required: false,
    format: 'Numeric value (e.g., 1500000 or 1,500,000) — proposal value in PKR',
    example: '1500000',
    group: 'proposal',
  },
  status: {
    aliases: ['status', 'proposal status', 'stage', 'state'],
    required: false,
    format: 'One of: Submitted, In Process, In Evaluation, Pending, Won (default: In Process)',
    example: 'In Process',
    group: 'proposal',
  },
  thematicAreas: {
    aliases: ['thematic area', 'thematic areas', 'sector', 'category', 'categories', 'domain', 'area'],
    required: false,
    format: 'Comma-separated names of thematic areas. If not found, they will be auto-created.',
    example: 'IT & Technology, Healthcare',
    group: 'lookup',
  },
  winningChances: {
    aliases: ['winning chances', 'probability', 'win chance', 'chances', 'win probability', 'likelihood'],
    required: false,
    format: 'One of: Low, Medium, High (default: empty)',
    example: 'Medium',
    group: 'proposal',
  },
  focalPerson: {
    aliases: ['focal person', 'contact person', 'poc', 'point of contact', 'contact'],
    required: false,
    format: 'Any text — the contact/focal person name',
    example: 'Muhammad Ali',
    group: 'proposal',
  },
  followUpDate: {
    aliases: ['follow up date', 'follow-up date', 'followup date', 'follow up', 'next follow up', 'next follow-up'],
    required: false,
    format: 'Date in format: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY',
    example: '2025-07-15',
    group: 'proposal',
  },
  deadline: {
    aliases: ['deadline', 'due date', 'closing date', 'submission deadline', 'last date'],
    required: false,
    format: 'Date in format: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY',
    example: '2025-06-30',
    group: 'proposal',
  },
  submissionDate: {
    aliases: ['submission date', 'submitted date', 'submitted on', 'date submitted', 'submission'],
    required: false,
    format: 'Date in format: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY',
    example: '2025-06-15',
    group: 'proposal',
  },
  remarks: {
    aliases: ['remarks', 'notes', 'description', 'comments', 'details', 'observation'],
    required: false,
    format: 'Any text — additional notes or remarks',
    example: 'Urgent deadline, requires senior review',
    group: 'proposal',
  },
}

const VALID_STATUSES = ['Submitted', 'In Process', 'In Evaluation', 'Pending', 'Won']
const VALID_CLIENT_STATUSES = ['Active', 'Inactive']
const VALID_WINNING_CHANCES = ['Low', 'Medium', 'High']

// ── Types ────────────────────────────────────────────────────────────────

interface RowError {
  row: number
  column: string
  value: string
  message: string
  expectedFormat: string
}

interface ParsedRow {
  row: number
  data: Record<string, string>
  errors: RowError[]
  warnings: string[]
  info: string[]
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
  clientsCreated: number
  thematicAreasCreated: string[]
}

// ── Helper Functions ─────────────────────────────────────────────────────

function normalizeHeader(header: string): string {
  return header.toString().toLowerCase().trim().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ')
}

function matchColumn(excelHeader: string): string | null {
  const normalized = normalizeHeader(excelHeader)

  // Score-based matching: prefer exact matches, then longer alias matches (more specific)
  interface MatchCandidate {
    field: string
    score: number
    alias: string
    matchType: 'exact' | 'normalizedContainsAlias' | 'aliasContainsNormalized'
  }

  const candidates: MatchCandidate[] = []

  for (const [field, config] of Object.entries(PROPOSAL_COLUMNS)) {
    for (const alias of config.aliases) {
      // Exact match — highest priority
      if (normalized === alias) {
        candidates.push({ field, score: 1000, alias, matchType: 'exact' })
        continue
      }

      // Normalized header contains the full alias (e.g. "client name" contains "client name")
      // Score proportional to alias length to prefer more specific matches
      if (normalized.includes(alias)) {
        candidates.push({ field, score: 100 + alias.length, alias, matchType: 'normalizedContainsAlias' })
        continue
      }

      // Alias contains normalized (e.g. "proposal name" contains "name")
      // Only allow if normalized is reasonably close to alias length (at least 50% of alias)
      // and normalized is at least 2 chars to avoid single-char false matches
      if (alias.includes(normalized) && normalized.length >= 2 && normalized.length >= alias.length * 0.5) {
        candidates.push({ field, score: 50 + (normalized.length / alias.length) * 50, alias, matchType: 'aliasContainsNormalized' })
      }
    }
  }

  if (candidates.length === 0) return null

  // Sort by score descending — best match wins
  candidates.sort((a, b) => b.score - a.score)

  return candidates[0].field
}

function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null
  const trimmed = value.trim()

  // Try ISO / native parse
  const isoDate = Date.parse(trimmed)
  if (!isNaN(isoDate)) {
    const d = new Date(isoDate)
    if (d.getFullYear() >= 1990 && d.getFullYear() <= 2040) return d
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmy) {
    const day = parseInt(dmy[1])
    const month = parseInt(dmy[2]) - 1
    let year = parseInt(dmy[3])
    if (year < 100) year += 2000
    const d = new Date(year, month, day)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d
  }

  // Try DD MMM YY(YY) (e.g. 15-Jun-2025)
  const mmm = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{2,4})$/i)
  if (mmm) {
    const day = parseInt(mmm[1])
    const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(mmm[2].toLowerCase())
    if (mi !== -1) {
      let year = parseInt(mmm[3])
      if (year < 100) year += 2000
      return new Date(year, mi, day)
    }
  }

  // Try YYYY/MM/DD
  const ymd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) {
    const year = parseInt(ymd[1])
    const month = parseInt(ymd[2]) - 1
    const day = parseInt(ymd[3])
    const d = new Date(year, month, day)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) return d
  }

  return null
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return 0
  const cleaned = value.toString().replace(/[,，\s₨Rs.PKRAEDaed]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function normalizeStatus(value: string): string | null {
  if (!value || value.trim() === '') return 'In Process'
  const v = value.trim()
  for (const status of VALID_STATUSES) {
    if (v.toLowerCase() === status.toLowerCase()) return status
  }
  const map: Record<string, string> = {
    submitted: 'Submitted',
    inprocess: 'In Process',
    'in process': 'In Process',
    wip: 'In Process',
    progress: 'In Process',
    evaluation: 'In Evaluation',
    evaluating: 'In Evaluation',
    review: 'In Evaluation',
    pending: 'Pending',
    hold: 'Pending',
    won: 'Won',
    awarded: 'Won',
    success: 'Won',
    approved: 'Won',
    lost: 'Pending',
    rejected: 'Pending',
  }
  for (const [key, status] of Object.entries(map)) {
    if (v.toLowerCase().includes(key)) return status
  }
  return null
}

function normalizeClientStatus(value: string): string | null {
  if (!value || value.trim() === '') return 'Active'
  const v = value.trim().toLowerCase()
  for (const status of VALID_CLIENT_STATUSES) {
    if (v === status.toLowerCase()) return status
  }
  if (['active', 'yes', 'true', '1', 'enabled', 'on'].includes(v)) return 'Active'
  if (['inactive', 'no', 'false', '0', 'disabled', 'off', 'deactivated'].includes(v)) return 'Inactive'
  return null
}

function normalizeWinningChances(value: string): string {
  if (!value || value.trim() === '') return ''
  const v = value.trim().toLowerCase()
  const map: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    med: 'Medium',
    moderate: 'Medium',
    high: 'High',
    strong: 'High',
    good: 'High',
    best: 'High',
  }
  for (const [key, val] of Object.entries(map)) {
    if (v === key || v.includes(key)) return val
  }
  return value.trim()
}

function getDisplayColumnName(field: string): string {
  const col = PROPOSAL_COLUMNS[field]
  if (!col) return field
  // Return the first alias capitalized
  return col.aliases[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── POST: Consolidated Import ────────────────────────────────────────────

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
        { error: 'The uploaded file is empty. Please ensure your Excel/CSV file has data rows with headers in the first row.' },
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

    // Check required columns
    const mappedFields = Object.values(columnMap)
    const missingRequired: string[] = []
    for (const [field, config] of Object.entries(PROPOSAL_COLUMNS)) {
      if (config.required && !mappedFields.includes(field)) {
        missingRequired.push(getDisplayColumnName(field))
      }
    }

    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingRequired.join(', ')}. Please add these columns to your file and try again.`,
          missingColumns: missingRequired,
          columnMapping: columnMap,
          unmatchedHeaders,
        },
        { status: 400 }
      )
    }

    // Fetch reference data
    const allClients = await db.client.findMany({ select: { id: true, name: true } })
    const allMembers = await db.teamMember.findMany({ select: { id: true, name: true, isActive: true } })
    const allThematicAreas = await db.thematicArea.findMany({ select: { id: true, name: true } })

    const clientMap = new Map(allClients.map(c => [c.name.toLowerCase().trim(), c.id]))
    const memberMap = new Map(allMembers.filter(m => m.isActive).map(m => [m.name.toLowerCase().trim(), m.id]))
    const thematicAreaMap = new Map(allThematicAreas.map(t => [t.name.toLowerCase().trim(), t.id]))

    const result: ImportResult = {
      total: rows.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      rowDetails: [],
      createdIds: [],
      clientsCreated: 0,
      thematicAreasCreated: [],
    }

    // Track auto-created items within this import to avoid duplicates
    const newClientIds = new Map<string, string>() // lowercase name → id
    const newThematicAreaIds = new Map<string, string>() // lowercase name → id

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const rowNum = i + 2 // Excel row number (1-based, +1 for header)
      const rowErrors: RowError[] = []
      const rowWarnings: string[] = []
      const rowInfo: string[] = []
      const mappedData: Record<string, string> = {}

      // Map all columns
      for (const [excelHeader, field] of Object.entries(columnMap)) {
        const rawValue = rawRow[excelHeader]
        mappedData[field] = rawValue !== undefined && rawValue !== null ? String(rawValue) : ''
      }

      // ── Validate: Proposal Name (required) ──
      const name = (mappedData['name'] || '').toString().trim()
      if (!name) {
        const colDef = PROPOSAL_COLUMNS['name']
        rowErrors.push({
          row: rowNum,
          column: getDisplayColumnName('name'),
          value: '',
          message: 'Proposal Name is required but this cell is empty.',
          expectedFormat: colDef.format,
        })
      } else if (name.length > 500) {
        const colDef = PROPOSAL_COLUMNS['name']
        rowErrors.push({
          row: rowNum,
          column: getDisplayColumnName('name'),
          value: name.substring(0, 50) + '...',
          message: `Proposal Name is too long (${name.length} characters). Maximum is 500 characters.`,
          expectedFormat: colDef.format,
        })
      }

      // ── Validate: Client (required) — auto-create if not found ──
      const clientName = (mappedData['clientName'] || '').toString().trim()
      const clientAddress = (mappedData['clientAddress'] || '').toString().trim()
      const clientStatusRaw = (mappedData['clientStatus'] || '').toString().trim()

      let clientId = ''

      if (!clientName) {
        const colDef = PROPOSAL_COLUMNS['clientName']
        rowErrors.push({
          row: rowNum,
          column: getDisplayColumnName('clientName'),
          value: '',
          message: 'Client Name is required but this cell is empty.',
          expectedFormat: colDef.format,
        })
      } else {
        // Try exact match in existing clients
        clientId = clientMap.get(clientName.toLowerCase().trim()) || ''

        // Try exact match in newly created clients during this import
        if (!clientId) {
          clientId = newClientIds.get(clientName.toLowerCase().trim()) || ''
        }

        // Try partial match in existing clients (min 3 chars, 60% length ratio)
        if (!clientId) {
          const cl = clientName.toLowerCase().trim()
          if (cl.length >= 3) {
            let bestMatch = ''
            let bestScore = 0
            let bestId = ''
            for (const [n, id] of clientMap.entries()) {
              if (n.includes(cl) || cl.includes(n)) {
                const shorter = Math.min(n.length, cl.length)
                const longer = Math.max(n.length, cl.length)
                const score = shorter / longer
                if (score >= 0.4 && score > bestScore) {
                  bestScore = score
                  bestMatch = n
                  bestId = id
                }
              }
            }
            if (bestId) {
              clientId = bestId
              const matchName = allClients.find(c => c.id === bestId)?.name || bestMatch
              rowWarnings.push(`Client "${clientName}" was matched to "${matchName}" (partial match). Verify this is correct.`)
            }
          }
        }

        // Auto-create client if not found
        if (!clientId) {
          // Validate client status if provided
          let resolvedClientStatus = 'Active'
          if (clientStatusRaw) {
            const normalized = normalizeClientStatus(clientStatusRaw)
            if (!normalized) {
              const colDef = PROPOSAL_COLUMNS['clientStatus']
              rowErrors.push({
                row: rowNum,
                column: getDisplayColumnName('clientStatus'),
                value: clientStatusRaw,
                message: `Invalid client status "${clientStatusRaw}". A new client "${clientName}" needs to be created, but the status is not recognized.`,
                expectedFormat: colDef.format,
              })
            } else {
              resolvedClientStatus = normalized
            }
          }

          // Create client — auto-create even if other fields have errors (don't cascade)
          if (rowErrors.length === 0 || rowErrors.every(e => e.column !== getDisplayColumnName('clientName'))) {
            try {
              const newClient = await db.client.create({
                data: {
                  name: clientName,
                  address: clientAddress || '',
                  status: resolvedClientStatus,
                },
              })
              clientId = newClient.id
              clientMap.set(clientName.toLowerCase().trim(), newClient.id)
              newClientIds.set(clientName.toLowerCase().trim(), newClient.id)
              result.clientsCreated++
              rowInfo.push(`New client "${clientName}" was automatically created.`)
            } catch (dbError) {
              rowErrors.push({
                row: rowNum,
                column: getDisplayColumnName('clientName'),
                value: clientName,
                message: `Failed to auto-create client "${clientName}": ${dbError instanceof Error ? dbError.message : 'Database error'}`,
                expectedFormat: PROPOSAL_COLUMNS['clientName'].format,
              })
            }
          }
        }
      }

      // ── Validate: Assigned To (optional — non-blocking, just warn) ──
      const memberName = (mappedData['assignedMemberName'] || '').toString().trim()
      let assignedMemberId = ''

      if (memberName) {
        assignedMemberId = memberMap.get(memberName.toLowerCase().trim()) || ''
        if (!assignedMemberId) {
          // Try partial match (min 3 chars, 60% length ratio)
          const ml = memberName.toLowerCase().trim()
          if (ml.length >= 3) {
            let bestMatch = ''
            let bestScore = 0
            let bestId = ''
            for (const [n, id] of memberMap.entries()) {
              if (n.includes(ml) || ml.includes(n)) {
                const shorter = Math.min(n.length, ml.length)
                const longer = Math.max(n.length, ml.length)
                const score = shorter / longer
                if (score >= 0.4 && score > bestScore) {
                  bestScore = score
                  bestMatch = n
                  bestId = id
                }
              }
            }
            if (bestId) {
              assignedMemberId = bestId
              const matchName = allMembers.find(m => m.id === bestId)?.name || bestMatch
              rowWarnings.push(`Assigned member "${memberName}" matched to "${matchName}" (partial match).`)
            }
          }
        }
        // Non-blocking: just warn if not found, don't block the entire row
        if (!assignedMemberId) {
          const suggestions = allMembers
            .filter(m => m.isActive && m.name.toLowerCase().includes(memberName.toLowerCase().substring(0, Math.min(3, memberName.length))))
            .map(m => m.name)
            .slice(0, 3)
          rowWarnings.push(
            `Assigned To: Team member "${memberName}" not found in CRM and was skipped.${suggestions.length > 0 ? ` Available: ${suggestions.join(', ')}` : ' No active team members found.'} You can assign later by editing the proposal.`
          )
        }
      }

      // ── Validate: Value (optional) ──
      const valueRaw = (mappedData['value'] || '').toString()
      let value = 0
      if (valueRaw.trim()) {
        const parsed = parseNumber(valueRaw)
        if (parsed === null) {
          const colDef = PROPOSAL_COLUMNS['value']
          rowErrors.push({
            row: rowNum,
            column: getDisplayColumnName('value'),
            value: valueRaw,
            message: `"${valueRaw}" is not a valid number. Remove currency symbols, commas, or text.`,
            expectedFormat: colDef.format,
          })
        } else {
          value = parsed
        }
      }

      // ── Validate: Status (optional) ──
      const statusRaw = (mappedData['status'] || '').toString().trim()
      let status = 'In Process'
      if (statusRaw) {
        const normalized = normalizeStatus(statusRaw)
        if (!normalized) {
          const colDef = PROPOSAL_COLUMNS['status']
          rowErrors.push({
            row: rowNum,
            column: getDisplayColumnName('status'),
            value: statusRaw,
            message: `"${statusRaw}" is not a recognized status.`,
            expectedFormat: colDef.format,
          })
        } else {
          status = normalized
          if (normalized !== statusRaw && statusRaw.toLowerCase() !== normalized.toLowerCase()) {
            rowWarnings.push(`Status "${statusRaw}" was auto-corrected to "${normalized}".`)
          }
        }
      }

      // ── Validate: Winning Chances (optional) ──
      const winningChancesRaw = (mappedData['winningChances'] || '').toString().trim()
      let winningChances = ''
      if (winningChancesRaw) {
        winningChances = normalizeWinningChances(winningChancesRaw)
        if (!VALID_WINNING_CHANCES.includes(winningChances)) {
          const colDef = PROPOSAL_COLUMNS['winningChances']
          rowWarnings.push(
            `Winning Chances "${winningChancesRaw}" was saved as-is but may not be a standard value. ${colDef.format}`
          )
        }
      }

      // ── Validate: Deadline (optional) ──
      const deadlineRaw = (mappedData['deadline'] || '').toString()
      let deadline: Date | null = null
      if (deadlineRaw.trim()) {
        deadline = parseDate(deadlineRaw)
        if (!deadline) {
          const colDef = PROPOSAL_COLUMNS['deadline']
          rowErrors.push({
            row: rowNum,
            column: getDisplayColumnName('deadline'),
            value: deadlineRaw,
            message: `"${deadlineRaw}" is not a recognizable date format.`,
            expectedFormat: colDef.format,
          })
        }
      }

      // ── Validate: Submission Date (optional) ──
      const submissionDateRaw = (mappedData['submissionDate'] || '').toString()
      let submissionDate: Date | null = null
      if (submissionDateRaw.trim()) {
        submissionDate = parseDate(submissionDateRaw)
        if (!submissionDate) {
          const colDef = PROPOSAL_COLUMNS['submissionDate']
          rowErrors.push({
            row: rowNum,
            column: getDisplayColumnName('submissionDate'),
            value: submissionDateRaw,
            message: `"${submissionDateRaw}" is not a recognizable date format.`,
            expectedFormat: colDef.format,
          })
        }
      }

      // ── Validate: Thematic Areas (optional) — auto-create if not found ──
      const areasRaw = (mappedData['thematicAreas'] || '').toString().trim()
      const thematicAreaIds: string[] = []
      if (areasRaw) {
        const areaNames = areasRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
        for (const areaName of areaNames) {
          let areaId = thematicAreaMap.get(areaName.toLowerCase()) || ''

          // Check newly created areas
          if (!areaId) {
            areaId = newThematicAreaIds.get(areaName.toLowerCase()) || ''
          }

          // Partial match existing (min 3 chars, 40% length ratio)
          if (!areaId) {
            const al = areaName.toLowerCase()
            if (al.length >= 3) {
              let bestMatch = ''
              let bestScore = 0
              let bestId = ''
              for (const [n, id] of thematicAreaMap.entries()) {
                if (n.includes(al) || al.includes(n)) {
                  const shorter = Math.min(n.length, al.length)
                  const longer = Math.max(n.length, al.length)
                  const score = shorter / longer
                  if (score >= 0.4 && score > bestScore) {
                    bestScore = score
                    bestMatch = n
                    bestId = id
                  }
                }
              }
              if (bestId) {
                areaId = bestId
                const matchName = allThematicAreas.find(t => t.id === bestId)?.name || bestMatch
                rowWarnings.push(`Thematic area "${areaName}" matched to "${matchName}" (partial match).`)
              }
            }
          }

          // Auto-create if not found
          if (!areaId) {
            try {
              const newArea = await db.thematicArea.create({
                data: {
                  name: areaName,
                  color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
                  sortOrder: allThematicAreas.length + result.thematicAreasCreated.length,
                },
              })
              areaId = newArea.id
              thematicAreaMap.set(areaName.toLowerCase(), newArea.id)
              newThematicAreaIds.set(areaName.toLowerCase(), newArea.id)
              result.thematicAreasCreated.push(newArea.id)
              rowInfo.push(`New thematic area "${areaName}" was automatically created.`)
            } catch {
              rowWarnings.push(`Thematic area "${areaName}" could not be auto-created (may already exist). Skipping it.`)
            }
          }

          if (areaId) {
            thematicAreaIds.push(areaId)
          }
        }
      }

      // Other fields
      const focalPerson = (mappedData['focalPerson'] || '').toString().trim()
      const remarks = (mappedData['remarks'] || '').toString().trim()
      const rfpNumber = (mappedData['rfpNumber'] || '').toString().trim()

      // ── Validate: Follow Up Date (optional) ──
      const followUpDateRaw = (mappedData['followUpDate'] || '').toString()
      let followUpDate: Date | null = null
      if (followUpDateRaw.trim()) {
        followUpDate = parseDate(followUpDateRaw)
        if (!followUpDate) {
          const colDef = PROPOSAL_COLUMNS['followUpDate']
          rowErrors.push({
            row: rowNum,
            column: getDisplayColumnName('followUpDate'),
            value: followUpDateRaw,
            message: `"${followUpDateRaw}" is not a recognizable date format.`,
            expectedFormat: colDef.format,
          })
        }
      }

      // Build parsed row for response
      const parsedRow: ParsedRow = {
        row: rowNum,
        data: {
          name,
          rfpNumber,
          clientName,
          clientAddress,
          assignedMemberName: memberName,
          value: String(value),
          status,
          thematicAreas: areasRaw,
          winningChances,
          focalPerson,
          followUpDate: followUpDate ? followUpDate.toISOString().split('T')[0] : '',
          deadline: deadline ? deadline.toISOString().split('T')[0] : '',
          submissionDate: submissionDate ? submissionDate.toISOString().split('T')[0] : '',
          remarks,
        },
        errors: rowErrors,
        warnings: rowWarnings,
        info: rowInfo,
        valid: rowErrors.length === 0,
      }
      result.rowDetails.push(parsedRow)

      // ── Create proposal if no errors ──
      if (rowErrors.length === 0 && clientId) {
        try {
          const proposal = await db.proposal.create({
            data: {
              name,
              rfpNumber,
              clientId,
              assignedMemberId,
              value,
              status,
              winningChances,
              focalPerson,
              followUpDate,
              remarks,
              deadline,
              submissionDate,
              thematicAreas:
                thematicAreaIds.length > 0
                  ? { create: thematicAreaIds.map((id) => ({ thematicAreaId: id })) }
                  : undefined,
            },
          })
          result.success++
          result.createdIds.push(proposal.id)
        } catch (error) {
          result.failed++
          const errorMsg = error instanceof Error ? error.message : 'Database error'
          rowErrors.push({
            row: rowNum,
            column: 'Database',
            value: name,
            message: `Failed to save proposal: ${errorMsg}`,
            expectedFormat: 'Contact your administrator if this persists.',
          })
          parsedRow.errors = rowErrors
          parsedRow.valid = false
        }
      } else {
        result.failed++
      }
    }

    // Build message
    const parts: string[] = []
    parts.push(`${result.success} of ${result.total} proposal${result.total !== 1 ? 's' : ''} imported`)
    if (result.clientsCreated > 0) parts.push(`${result.clientsCreated} new client${result.clientsCreated !== 1 ? 's' : ''} auto-created`)
    if (result.thematicAreasCreated.length > 0) parts.push(`${result.thematicAreasCreated.length} new thematic area${result.thematicAreasCreated.length !== 1 ? 's' : ''} auto-created`)
    if (result.failed > 0) parts.push(`${result.failed} row${result.failed !== 1 ? 's' : ''} with errors`)

    return NextResponse.json({
      ...result,
      columnMapping: columnMap,
      unmatchedHeaders,
      message: `Import complete: ${parts.join(', ')}.`,
    })
  } catch (error) {
    console.error('[Proposal Import] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process import: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// ── GET: Download Template ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    if (searchParams.get('download') === 'template') {
      // Fetch reference data for template examples
      const clients = await db.client.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
      const members = await db.teamMember.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } })
      const thematicAreas = await db.thematicArea.findMany({ select: { name: true }, orderBy: { sortOrder: 'asc' } })

      const wb = XLSX.utils.book_new()

      // Sheet 1: Proposals (consolidated template)
      const templateData = [
        {
          'Proposal Name': 'IT Infrastructure Upgrade',
          'RFP Number': 'RFP-2025-001',
          'Client Name': clients[0]?.name || 'ABC Corporation',
          'Client Address': 'Islamabad',
          'Client Status': 'Active',
          'Assigned To': members[0]?.name || 'Team Member Name',
          'Value (PKR)': 1500000,
          'Status': 'In Process',
          'Thematic Areas': thematicAreas[0]?.name || 'IT & Technology',
          'Winning Chances': 'Medium',
          'Focal Person': 'Muhammad Ali',
          'Follow Up Date': '2025-07-15',
          'Deadline': '2025-06-30',
          'Submission Date': '2025-06-15',
          'Remarks': 'Sample proposal remarks',
        },
        {
          'Proposal Name': '(Add your proposals below — delete sample rows)',
          'RFP Number': '',
          'Client Name': clients[1]?.name || '',
          'Client Address': '',
          'Client Status': '',
          'Assigned To': members[1]?.name || '',
          'Value (PKR)': '',
          'Status': 'Submitted',
          'Thematic Areas': thematicAreas.length > 1 ? thematicAreas[1].name : '',
          'Winning Chances': 'High',
          'Focal Person': '',
          'Follow Up Date': '',
          'Deadline': '',
          'Submission Date': '',
          'Remarks': '',
        },
        {
          'Proposal Name': 'New Client Example (will be auto-created)',
          'RFP Number': 'RFP-2025-002',
          'Client Name': 'Brand New Organization',
          'Client Address': 'Lahore',
          'Client Status': 'Active',
          'Assigned To': '',
          'Value (PKR)': 750000,
          'Status': 'Pending',
          'Thematic Areas': 'New Sector Name',
          'Winning Chances': '',
          'Focal Person': '',
          'Follow Up Date': '',
          'Deadline': '2025-07-31',
          'Submission Date': '',
          'Remarks': 'This client and sector will be created automatically',
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)

      // Set column widths
      ws['!cols'] = [
        { wch: 45 }, // Proposal Name
        { wch: 18 }, // RFP Number
        { wch: 40 }, // Client Name
        { wch: 25 }, // Client Address
        { wch: 12 }, // Client Status
        { wch: 22 }, // Assigned To
        { wch: 15 }, // Value
        { wch: 14 }, // Status
        { wch: 35 }, // Thematic Areas
        { wch: 15 }, // Winning Chances
        { wch: 20 }, // Focal Person
        { wch: 18 }, // Follow Up Date
        { wch: 15 }, // Deadline
        { wch: 18 }, // Submission Date
        { wch: 40 }, // Remarks
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Proposals')

      // Sheet 2: Column Instructions
      const instructions = Object.entries(PROPOSAL_COLUMNS).map(([field, config]) => ({
        'Column Name': getDisplayColumnName(field),
        'Required': config.required ? 'YES' : 'No',
        'Auto-Created': config.group === 'client' || config.group === 'lookup' ? 'Yes — auto-created if not found' : 'No',
        'Description': config.format,
        'Example': config.example,
      }))

      const wsInstructions = XLSX.utils.json_to_sheet(instructions)
      wsInstructions['!cols'] = [
        { wch: 22 }, // Column Name
        { wch: 10 }, // Required
        { wch: 38 }, // Auto-Created
        { wch: 65 }, // Description
        { wch: 40 }, // Example
      ]
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

      // Sheet 3: Valid Values Reference
      const validValues = [
        { 'Field': 'Status (Proposal)', 'Valid Values': VALID_STATUSES.join(', '), 'Default': 'In Process' },
        { 'Field': 'Winning Chances', 'Valid Values': VALID_WINNING_CHANCES.join(', '), 'Default': '(empty)' },
        { 'Field': 'Client Status', 'Valid Values': VALID_CLIENT_STATUSES.join(', '), 'Default': 'Active (used when auto-creating)' },
        { 'Field': 'Date Fields (Deadline, Submission Date, Follow Up Date)', 'Valid Values': 'YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY', 'Example': '2025-06-30 or 30/06/2025' },
        { 'Field': 'Value Format', 'Valid Values': 'Numbers only, commas optional', 'Example': '1500000 or 1,500,000' },
        { 'Field': 'Thematic Areas', 'Valid Values': 'Comma-separated names, auto-created if not found', 'Example': 'IT, Healthcare, Education' },
        { 'Field': 'Existing Clients', 'Valid Values': clients.map(c => c.name).join(', ') || 'No clients yet', 'Default': '(none)' },
        { 'Field': 'Existing Team Members', 'Valid Values': members.map(m => m.name).join(', ') || 'No members yet', 'Default': '(none)' },
        { 'Field': 'Existing Thematic Areas', 'Valid Values': thematicAreas.map(t => t.name).join(', ') || 'No areas yet', 'Default': '(none)' },
      ]

      const wsValues = XLSX.utils.json_to_sheet(validValues)
      wsValues['!cols'] = [
        { wch: 22 }, // Field
        { wch: 70 }, // Valid Values
        { wch: 35 }, // Default
      ]
      XLSX.utils.book_append_sheet(wb, wsValues, 'Valid Values')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="crm_import_template.xlsx"',
        },
      })
    }

    return NextResponse.json({
      message: 'POST to this endpoint to import proposals. GET /template to download the Excel template.',
      supportedFormats: ['.xlsx', '.xls', '.csv'],
      maxFileSize: '10 MB',
      columns: Object.keys(PROPOSAL_COLUMNS),
      features: [
        'Auto-creates new clients if not found in CRM',
        'Auto-creates new thematic areas if not found',
        'Smart column matching (recognizes many header variations)',
        'Date format detection (YYYY-MM-DD, DD/MM/YYYY, etc.)',
        'Partial name matching for clients and team members',
        'Row-by-row error reporting with exact field and format guidance',
      ],
    })
  } catch (error) {
    console.error('[Import Template] Error:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
