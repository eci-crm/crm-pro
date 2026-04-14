'use client'

import React, { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Download,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  UserPlus,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ── Types ──────────────────────────────────────────────────────────────────

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
  columnMapping?: Record<string, string>
  unmatchedHeaders?: string[]
  missingColumns?: string[]
  clientsCreated?: number
  thematicAreasCreated?: string[]
  message?: string
  error?: string
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'proposals' | 'clients'
  title: string
  description: string
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ImportDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
}: ImportDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const apiEndpoint = `/api/import-${type}`
  const templateEndpoint = `/api/import-${type}?download=template`

  // ── Download Template ──────────────────────────────────────────────────
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await fetch(templateEndpoint)
      if (!res.ok) throw new Error('Failed to download template')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'proposals' ? 'crm_import_template.xlsx' : 'client_import_template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Template downloaded successfully')
    } catch {
      toast.error('Failed to download template. Please try again.')
    }
  }, [templateEndpoint, type])

  // ── File Selection ────────────────────────────────────────────────────
  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 10 MB.')
      return
    }
    setFile(selectedFile)
    setResult(null)
    setGlobalError(null)
  }, [])

  // ── Drag & Drop ───────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) handleFileSelect(droppedFile)
    },
    [handleFileSelect]
  )

  // ── Import ────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!file) return

    setImporting(true)
    setResult(null)
    setGlobalError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      })

      const data: ImportResult = await res.json()

      if (!res.ok) {
        if (data.missingColumns && data.missingColumns.length > 0) {
          setGlobalError(`${data.error}`)
          setResult({ ...data, total: 0, success: 0, failed: 0, skipped: 0, errors: [], rowDetails: [], createdIds: [], clientsCreated: 0, thematicAreasCreated: [] })
        } else {
          setGlobalError(data.error || 'Import failed')
        }
        return
      }

      setResult(data)

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: [type] })
      if (data.clientsCreated && data.clientsCreated > 0) {
        queryClient.invalidateQueries({ queryKey: ['clients'] })
      }

      if (data.success > 0) {
        toast.success(
          `${data.success} ${type === 'proposals' ? 'proposal' : 'client'}${data.success > 1 ? 's' : ''} imported successfully!`,
          { duration: 4000 }
        )
      }

      if (data.failed > 0) {
        toast.error(`${data.failed} row${data.failed > 1 ? 's' : ''} had errors and were not imported.`, {
          duration: 6000,
        })
      }
    } catch {
      setGlobalError('Network error. Please check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }, [file, apiEndpoint, type, queryClient])

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFile(null)
    setResult(null)
    setGlobalError(null)
    setExpandedRows(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Close ─────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    handleReset()
    onOpenChange(false)
  }, [handleReset, onOpenChange])

  const toggleRow = (rowNum: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowNum)) next.delete(rowNum)
      else next.add(rowNum)
      return next
    })
  }

  // ── Column Mapping Display ────────────────────────────────────────────
  const ColumnMappingSection = () => {
    if (!result?.columnMapping) return null
    const entries = Object.entries(result.columnMapping)

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700">
          Detected Column Mapping
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {entries.map(([excel, field]) => (
            <div key={excel} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-[11px]">
                {excel}
              </Badge>
              <span className="text-slate-400">→</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                {field}
              </Badge>
            </div>
          ))}
          {result.unmatchedHeaders && result.unmatchedHeaders.length > 0 && (
            <div className="col-span-1 sm:col-span-2">
              <p className="text-[11px] text-amber-600 mt-1">
                Unrecognized columns (ignored): {result.unmatchedHeaders.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Auto-Created Items Summary ────────────────────────────────────────
  const AutoCreatedSection = () => {
    if (!result) return null
    const hasAutoCreated = (result.clientsCreated && result.clientsCreated > 0) ||
      (result.thematicAreasCreated && result.thematicAreasCreated.length > 0)
    if (!hasAutoCreated) return null

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Auto-Created Items</h4>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
          {result.clientsCreated && result.clientsCreated > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <UserPlus className="h-4 w-4 shrink-0" />
              <span>
                <strong>{result.clientsCreated}</strong> new client{result.clientsCreated !== 1 ? 's' : ''} automatically created
              </span>
            </div>
          )}
          {result.thematicAreasCreated && result.thematicAreasCreated.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <Tag className="h-4 w-4 shrink-0" />
              <span>
                <strong>{result.thematicAreasCreated.length}</strong> new thematic area{result.thematicAreasCreated.length !== 1 ? 's' : ''} automatically created
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Missing Columns Error ─────────────────────────────────────────────
  const MissingColumnsSection = () => {
    if (!result?.missingColumns || result.missingColumns.length === 0) return null
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Missing Required Columns</p>
            <p className="text-xs text-red-600 mt-1">
              Your file is missing these required columns. Please add them and try again:
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.missingColumns.map((col) => (
            <Badge key={col} variant="outline" className="bg-red-100 text-red-800 border-red-300 font-medium">
              {col}
            </Badge>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100"
          onClick={handleDownloadTemplate}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download Template to See All Columns
        </Button>
      </div>
    )
  }

  // ── Results Section ───────────────────────────────────────────────────
  const ResultsSection = () => {
    if (!result) return null

    const hasErrors = result.failed > 0 && result.rowDetails.some(r => !r.valid)
    const hasWarnings = result.rowDetails.some(r => r.warnings.length > 0)
    const hasInfo = result.rowDetails.some(r => r.info.length > 0)

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{result.success}</div>
            <div className="text-xs text-emerald-600 font-medium">Imported</div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{result.failed}</div>
            <div className="text-xs text-red-600 font-medium">Errors</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{result.total}</div>
            <div className="text-xs text-slate-500 font-medium">Total Rows</div>
          </div>
        </div>

        {/* Auto-Created Summary */}
        <AutoCreatedSection />

        {/* Skipped Info */}
        {result.skipped > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {result.skipped} duplicate row{result.skipped > 1 ? 's' : ''} were skipped.
          </div>
        )}

        {/* Missing Columns */}
        <MissingColumnsSection />

        {/* Column Mapping */}
        <ColumnMappingSection />

        {/* Info Messages */}
        {hasInfo && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Auto-Create Details</h4>
            <ScrollArea className="max-h-[150px] rounded-md border border-emerald-100">
              <div className="p-2 space-y-1">
                {result.rowDetails
                  .filter((row) => row.info.length > 0)
                  .map((row) =>
                    row.info.map((info, idx) => (
                      <div
                        key={`${row.row}-info-${idx}`}
                        className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1.5"
                      >
                        <Info className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                        <span>
                          <span className="font-medium">Row {row.row}:</span> {info}
                        </span>
                      </div>
                    ))
                  )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Row Error Details */}
        {hasErrors && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">
              Error Details ({result.failed} row{result.failed > 1 ? 's' : ''})
            </h4>
            <ScrollArea className="max-h-[350px] rounded-md border border-slate-200">
              <div className="p-2 space-y-2">
                {result.rowDetails
                  .filter((row) => !row.valid && row.errors.length > 0)
                  .map((row) => (
                    <RowErrorCard
                      key={row.row}
                      row={row}
                      expanded={expandedRows.has(row.row)}
                      onToggle={() => toggleRow(row.row)}
                    />
                  ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Warnings</h4>
            <ScrollArea className="max-h-[200px] rounded-md border border-amber-100">
              <div className="p-2 space-y-1">
                {result.rowDetails
                  .filter((row) => row.warnings.length > 0)
                  .map((row) =>
                    row.warnings.map((warning, idx) => (
                      <div
                        key={`${row.row}-warn-${idx}`}
                        className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5"
                      >
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                        <span>
                          <span className="font-medium">Row {row.row}:</span> {warning}
                        </span>
                      </div>
                    ))
                  )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* All Success */}
        {!hasErrors && result.success > 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            All {result.success} {type === 'proposals' ? 'proposal' : 'client'}
            {result.success > 1 ? 's' : ''} imported successfully!
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  const isConsolidated = type === 'proposals'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-1">
          {/* Step 1: Download Template + Info */}
          {!file && !result && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-medium text-blue-900">
                      Step 1: Download the Template
                    </h4>
                    <p className="text-xs text-blue-700">
                      Download the Excel template to see the exact column names and format expected.
                      It includes sample data, an Instructions sheet with all valid values, and a reference sheet.
                    </p>
                    {isConsolidated && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-blue-800">Smart features:</p>
                        <ul className="text-[11px] text-blue-700 space-y-0.5 ml-1">
                          <li className="flex items-center gap-1.5">
                            <UserPlus className="h-3 w-3" />
                            New clients are auto-created if not found in CRM
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Tag className="h-3 w-3" />
                            New thematic areas are auto-created if not found
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Info className="h-3 w-3" />
                            Column headers are smart-matched (variations accepted)
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <Separator />

              {/* Upload Area */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">
                  Step 2: Upload Your File
                </h4>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                    dragOver
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload
                    className={cn(
                      'h-10 w-10 mx-auto mb-3',
                      dragOver ? 'text-blue-500' : 'text-slate-400'
                    )}
                  />
                  <p className="text-sm font-medium text-slate-700">
                    {dragOver ? 'Drop your file here' : 'Click to upload or drag & drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .xlsx, .xls, .csv (max 10 MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0]
                    if (selected) handleFileSelect(selected)
                  }}
                />
              </div>
            </div>
          )}

          {/* File Selected - Ready to Import */}
          {file && !result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReset()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> The system will auto-detect your column headers and map them to the correct fields.
                  {isConsolidated && (
                    <> If a client or thematic area is not found, it will be automatically created.</>
                  )}
                </p>
              </div>

              {globalError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                  {globalError}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {result && <ResultsSection />}
        </div>

        <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
          {result ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Import Another File
              </Button>
              <Button
                onClick={handleClose}
                className={cn(
                  'text-white',
                  result.failed === 0
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-700 hover:bg-slate-800'
                )}
              >
                {result.failed === 0 ? 'Done' : 'Close'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || importing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {type === 'proposals' ? 'Proposals' : 'Clients'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Row Error Card ──────────────────────────────────────────────────────────

function RowErrorCard({
  row,
  expanded,
  onToggle,
}: {
  row: ParsedRow
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        'border-red-200 bg-red-50',
        expanded ? 'ring-1 ring-red-200' : ''
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-xs font-medium text-red-800">
            Row {row.row}
          </span>
          <span className="text-xs text-red-500">
            — {row.errors.length} error{row.errors.length > 1 ? 's' : ''}
          </span>
          {row.data.name && (
            <span className="text-xs text-slate-500 truncate max-w-[180px]">
              ({row.data.name})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {/* Expanded Error Details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-red-100">
          {/* Data Preview */}
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Row Data
            </p>
            <div className="bg-white rounded border border-red-100 p-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                {Object.entries(row.data).map(([key, value]) => {
                  if (!value) return null
                  const hasError = row.errors.some(
                    (e) =>
                      e.column.toLowerCase().replace(/\s/g, '') ===
                      key.toLowerCase().replace(/\s/g, '')
                  )
                  return (
                    <div key={key} className="flex items-start gap-1.5">
                      <span
                        className={cn(
                          'font-medium shrink-0',
                          hasError ? 'text-red-600' : 'text-slate-500'
                        )}
                      >
                        {key}:
                      </span>
                      <span
                        className={cn(
                          'truncate',
                          hasError
                            ? 'text-red-700 bg-red-50 px-1 rounded'
                            : 'text-slate-700'
                        )}
                      >
                        {value || '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Error List */}
          <div>
            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">
              What&apos;s Wrong &amp; How to Fix
            </p>
            <div className="space-y-1.5">
              {row.errors.map((error, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs bg-white rounded border border-red-100 p-2.5"
                >
                  <X className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-mono">
                        {error.column}
                      </Badge>
                      {error.value && error.value !== '(column not found)' && (
                        <span className="text-slate-500">
                          Your value: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-red-700">{error.value}</code>
                        </span>
                      )}
                    </div>
                    <p className="text-red-800 font-medium">
                      {error.message}
                    </p>
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-slate-50 rounded px-2 py-1">
                      <span className="font-semibold shrink-0">Expected format:</span>
                      <span>{error.expectedFormat}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
