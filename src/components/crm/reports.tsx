'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Download,
  Printer,
  ChevronDown,
  Filter,
  SlidersHorizontal,
  Tags,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type ReportType = 'clients' | 'proposals' | 'summary' | 'thematic'

interface ClientReportData {
  id: string
  name: string
  status: string
  proposals: { id: string; name: string; status: string; value: number }[]
  _count?: { proposals: number }
}

interface ProposalReportData {
  id: string
  name: string
  rfpNumber: string
  clientId: string
  value: number
  status: string
  deadline: string | null
  submissionDate: string | null
  client: { id: string; name: string }
  assignedMember: { id: string; name: string } | null
}

interface StatusGroup {
  count: number
  totalValue: number
}

interface ClientGroup {
  count: number
  totalValue: number
  clientName: string
}

interface ClientReportResponse {
  type: string
  totalRecords: number
  summary: {
    totalClients: number
    activeClients: number
    inactiveClients: number
    totalProposalValue: number
  }
  data: ClientReportData[]
}

interface ProposalReportResponse {
  type: string
  totalRecords: number
  summary: {
    totalProposals: number
    totalValue: number
    byStatus: Record<string, StatusGroup>
    byClient: Record<string, ClientGroup>
  }
  data: ProposalReportData[]
}

interface SummaryReportResponse {
  type: string
  totalRecords: number
  summary: {
    clients: { total: number; active: number }
    proposals: {
      total: number
      filtered: number
      totalFilteredValue: number
      byStatus: Record<string, StatusGroup>
    }
  }
  data: ProposalReportData[]
}

interface ThematicAreaSummaryItem {
  id: string
  name: string
  color: string
  proposalCount: number
  totalValue: number
}

interface ThematicAreaGroup {
  count: number
  totalValue: number
  wonCount: number
  wonValue: number
  areaName: string
  areaColor: string
}

interface ThematicReportResponse {
  type: string
  totalRecords: number
  summary: {
    totalAreas: number
    totalProposals: number
    totalValue: number
    totalWon: number
    wonValue: number
    winRate: string
    byArea: Record<string, ThematicAreaGroup>
  }
  data: {
    areas: ThematicAreaSummaryItem[]
    proposals: ProposalReportData[]
  }
}

type ReportResponse = ClientReportResponse | ProposalReportResponse | SummaryReportResponse | ThematicReportResponse

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Won':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    case 'Submitted':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/20'
    case 'In Process':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    case 'In Evaluation':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
    case 'Pending':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    case 'Active':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    case 'Inactive':
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
]

const STATUS_COLORS: Record<string, string> = {
  Won: '#10b981',
  Submitted: '#0ea5e9',
  'In Process': '#f59e0b',
  'In Evaluation': '#a855f7',
  Pending: '#f97316',
}

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) {
    toast.error('No data to export')
    return
  }
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? ''
          return `"${String(val).replace(/"/g, '""')}"`
        })
        .join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exported successfully')
}

// ── Report Type Selector ───────────────────────────────────────────────────

const reportTypes: {
  id: ReportType
  label: string
  description: string
  icon: React.ElementType
}[] = [
  {
    id: 'summary',
    label: 'Summary Report',
    description: 'High-level analytics with visual charts',
    icon: TrendingUp,
  },
  {
    id: 'clients',
    label: 'Client Report',
    description: 'Overview of all clients and their proposal activity',
    icon: Users,
  },
  {
    id: 'proposals',
    label: 'Proposal Report',
    description: 'Detailed proposals with filtering and metrics',
    icon: FileText,
  },
  {
    id: 'thematic',
    label: 'Thematic Area Report',
    description: 'Proposals organized by thematic areas with performance',
    icon: Tags,
  },
]

function ReportTypeSelector({
  selected,
  onSelect,
}: {
  selected: ReportType
  onSelect: (type: ReportType) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {reportTypes.map((type) => {
        const Icon = type.icon
        const isActive = selected === type.id
        return (
          <Card
            key={type.id}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-md',
              isActive
                ? 'border-primary ring-2 ring-primary/20 shadow-md'
                : 'hover:border-primary/40'
            )}
            onClick={() => onSelect(type.id)}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isActive ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {type.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ── Filter Panel ───────────────────────────────────────────────────────────

function FilterPanel({
  reportType,
  filters,
  onFiltersChange,
  onGenerate,
  isGenerating,
}: {
  reportType: ReportType
  filters: {
    clientId: string
    status: string
    startDate: string
    endDate: string
    thematicAreaId: string
  }
  onFiltersChange: (filters: { clientId: string; status: string; startDate: string; endDate: string; thematicAreaId: string }) => void
  onGenerate: () => void
  isGenerating: boolean
}) {
  const [open, setOpen] = useState(true)

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-filter'],
    queryFn: async () => {
      const res = await fetch('/api/clients')
      if (!res.ok) return []
      return res.json()
    },
  })

  const { data: thematicAreas = [] } = useQuery({
    queryKey: ['thematic-areas-for-filter'],
    queryFn: async () => {
      const res = await fetch('/api/thematic-areas')
      if (!res.ok) return []
      return res.json()
    },
    enabled: reportType === 'thematic' || reportType === 'summary',
  })

  const showClientFilter = reportType === 'proposals' || reportType === 'thematic'
  const showStatusFilter = reportType === 'proposals' || reportType === 'thematic'
  const showThematicFilter = reportType === 'thematic'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Filters
            </span>
            {(filters.clientId || filters.status || filters.startDate || filters.endDate || filters.thematicAreaId) && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 pt-4 pb-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {showClientFilter && (
                <div className="space-y-2">
                  <Label htmlFor="filter-client">Client</Label>
                  <Select
                    value={filters.clientId}
                    onValueChange={(v) =>
                      onFiltersChange({ ...filters, clientId: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showStatusFilter && (
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(v) =>
                      onFiltersChange({ ...filters, status: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Submitted">Submitted</SelectItem>
                      <SelectItem value="In Process">In Process</SelectItem>
                      <SelectItem value="In Evaluation">In Evaluation</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Won">Won</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showThematicFilter && (
                <div className="space-y-2">
                  <Label htmlFor="filter-thematic">Thematic Area</Label>
                  <Select
                    value={filters.thematicAreaId}
                    onValueChange={(v) =>
                      onFiltersChange({ ...filters, thematicAreaId: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {thematicAreas.map((a: { id: string; name: string; color: string }) => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: a.color }}
                            />
                            {a.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="filter-start">Start Date</Label>
                <Input
                  id="filter-start"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, startDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-end">End Date</Label>
                <Input
                  id="filter-end"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 pb-2">
              <Button onClick={onGenerate} disabled={isGenerating}>
                <Filter className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  onFiltersChange({
                    clientId: '',
                    status: '',
                    startDate: '',
                    endDate: '',
                    thematicAreaId: '',
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Client Report View ─────────────────────────────────────────────────────

function ClientReportView({ data }: { data: ClientReportResponse }) {
  const csvData = useMemo(() => {
    return data.data.map((c) => ({
      Name: c.name,
      Status: c.status,
      'Proposal Count': c.proposals?.length ?? c._count?.proposals ?? 0,
      'Total Value': c.proposals?.reduce((sum, p) => sum + p.value, 0) ?? 0,
    }))
  }, [data])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Clients</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{data.summary.totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Active Clients</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{data.summary.activeClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Inactive Clients</p>
            <p className="mt-1 text-2xl font-bold text-muted-foreground">{data.summary.inactiveClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Proposal Value</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(data.summary.totalProposalValue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Client Details</CardTitle>
            <CardDescription>{data.totalRecords} client{data.totalRecords !== 1 ? 's' : ''} found</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(csvData, 'client-report.csv')}>
              <Download className="mr-2 h-3.5 w-3.5" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Proposals</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((client) => {
                  const proposalCount = client.proposals?.length ?? client._count?.proposals ?? 0
                  const totalValue = client.proposals?.reduce((sum, p) => sum + p.value, 0) ?? 0
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(client.status)}>{client.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{proposalCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(totalValue)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">
                    {data.data.reduce((sum, c) => sum + (c.proposals?.length ?? c._count?.proposals ?? 0), 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.summary.totalProposalValue)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Proposal Report View ───────────────────────────────────────────────────

function ProposalReportView({ data }: { data: ProposalReportResponse }) {
  const csvData = useMemo(() => {
    return data.data.map((p) => ({
      Name: p.name,
      'RFP Number': p.rfpNumber || '—',
      Client: p.client?.name || '—',
      'Assigned To': p.assignedMember?.name || '—',
      Status: p.status,
      Value: p.value,
      Deadline: p.deadline ? formatDate(p.deadline) : '—',
      'Submission Date': p.submissionDate ? formatDate(p.submissionDate) : '—',
    }))
  }, [data])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Proposals</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{data.summary.totalProposals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Value</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(data.summary.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Clients</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{Object.keys(data.summary.byClient).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Proposal Details</CardTitle>
            <CardDescription>{data.totalRecords} proposal{data.totalRecords !== 1 ? 's' : ''} found</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(csvData, 'proposal-report.csv')}>
              <Download className="mr-2 h-3.5 w-3.5" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{proposal.name}</p>
                        {proposal.rfpNumber && <p className="text-xs text-muted-foreground">{proposal.rfpNumber}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{proposal.client?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(proposal.value)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-muted-foreground">{formatDate(proposal.deadline)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.summary.totalValue)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Summary Report View ────────────────────────────────────────────────────

const summaryPieConfig = {
  value: { label: 'Proposals' },
  submitted: { label: 'Submitted', color: '#0ea5e9' },
  inProcess: { label: 'In Process', color: '#f59e0b' },
  inEvaluation: { label: 'In Evaluation', color: '#a855f7' },
  pending: { label: 'Pending', color: '#f97316' },
  won: { label: 'Won', color: '#10b981' },
} satisfies ChartConfig

const summaryBarConfig = {
  value: { label: 'Value ($)' },
  submitted: { label: 'Submitted', color: '#0ea5e9' },
  inProcess: { label: 'In Process', color: '#f59e0b' },
  inEvaluation: { label: 'In Evaluation', color: '#a855f7' },
  pending: { label: 'Pending', color: '#f97316' },
  won: { label: 'Won', color: '#10b981' },
} satisfies ChartConfig

const clientBreakdownConfig = {
  value: { label: 'Value ($)' },
  count: { label: 'Count' },
} satisfies ChartConfig

function SummaryReportView({ data }: { data: SummaryReportResponse }) {
  const byStatus = data.summary.proposals.byStatus
  const statusEntries = Object.entries(byStatus)

  const pieData = statusEntries.map(([status, group]) => ({
    name: status,
    value: group.count,
    fill: STATUS_COLORS[status] || CHART_COLORS[0],
  }))

  const valueBarData = statusEntries.map(([status, group]) => ({
    status,
    value: group.totalValue,
    fill: STATUS_COLORS[status] || CHART_COLORS[0],
  }))

  const clientEntries = Object.entries(
    (data as ProposalReportResponse).summary?.byClient || {}
  )
  const clientBarData = clientEntries
    .map(([, group]: [string, ClientGroup]) => ({
      name: group.clientName?.length > 15 ? group.clientName.slice(0, 15) + '…' : group.clientName,
      value: group.totalValue,
      count: group.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const csvData = useMemo(() => {
    return data.data.map((p) => ({
      Name: p.name,
      Client: p.client?.name || '—',
      'Assigned To': p.assignedMember?.name || '—',
      Status: p.status,
      Value: p.value,
      Deadline: p.deadline ? formatDate(p.deadline) : '—',
    }))
  }, [data])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Clients</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{data.summary.clients.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Active Clients</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{data.summary.clients.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Proposals</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{data.summary.proposals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Value</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(data.summary.proposals.totalFilteredValue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposals by Status</CardTitle>
            <CardDescription>Distribution of proposals across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ChartContainer config={summaryPieConfig} className="mx-auto h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No proposal data available</div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: entry.fill }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Value by Status</CardTitle>
            <CardDescription>Revenue breakdown across proposal statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {valueBarData.length > 0 ? (
              <ChartContainer config={summaryBarConfig} className="h-[280px] w-full">
                <BarChart data={valueBarData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {valueBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No value data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Client Breakdown</CardTitle>
            <CardDescription>Top clients by proposal value</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(csvData, 'summary-report.csv')}>
              <Download className="mr-2 h-3.5 w-3.5" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientBarData.length > 0 ? (
            <ChartContainer config={clientBreakdownConfig} className="h-[300px] w-full">
              <BarChart data={clientBarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">No client data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Thematic Area Report View ──────────────────────────────────────────────

const thematicPieConfig = {
  value: { label: 'Proposals' },
} satisfies ChartConfig

const thematicBarConfig = {
  value: { label: 'Value ($)' },
  wonValue: { label: 'Won Value ($)' },
} satisfies ChartConfig

function ThematicReportView({ data }: { data: ThematicReportResponse }) {
  const { summary } = data
  const areas = data.data.areas

  // Pie data: proposals per area
  const pieData = areas.map((a) => ({
    name: a.name.length > 18 ? a.name.slice(0, 18) + '…' : a.name,
    value: a.proposalCount,
    fill: a.color,
  }))

  // Bar data: total value and won value per area
  const barData = areas
    .map((a) => ({
      name: a.name.length > 15 ? a.name.slice(0, 15) + '…' : a.name,
      value: a.totalValue,
      wonValue: summary.byArea[a.id]?.wonValue ?? 0,
      fill: a.color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const csvData = useMemo(() => {
    return data.data.proposals.map((p) => ({
      Name: p.name,
      'RFP Number': p.rfpNumber || '—',
      Client: p.client?.name || '—',
      'Assigned To': p.assignedMember?.name || '—',
      Status: p.status,
      Value: p.value,
      Deadline: p.deadline ? formatDate(p.deadline) : '—',
    }))
  }, [data])

  const areasCsvData = useMemo(() => {
    return areas.map((a) => ({
      'Thematic Area': a.name,
      'Proposal Count': a.proposalCount,
      'Total Value': a.totalValue,
      'Won Count': summary.byArea[a.id]?.wonCount ?? 0,
      'Won Value': summary.byArea[a.id]?.wonValue ?? 0,
    }))
  }, [areas, summary.byArea])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Thematic Areas</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalAreas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Proposals</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalProposals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Value</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(summary.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.winRate}%</p>
            <p className="text-xs text-muted-foreground">
              {summary.totalWon} won / {formatCurrency(summary.wonValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart - Proposals by Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposals by Thematic Area</CardTitle>
            <CardDescription>Distribution of proposals across thematic areas</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ChartContainer config={thematicPieConfig} className="mx-auto h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No thematic area data available</div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: entry.fill }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - Value by Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Thematic Area</CardTitle>
            <CardDescription>Total vs won value for each area</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ChartContainer config={thematicBarConfig} className="h-[280px] w-full">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Total Value" />
                  <Bar dataKey="wonValue" fill="#10b981" radius={[4, 4, 0, 0]} name="Won Value" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">No value data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Area Breakdown Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">Thematic Area Breakdown</CardTitle>
            <CardDescription>Performance metrics by thematic area</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV(areasCsvData, 'thematic-areas-report.csv')}>
              <Download className="mr-2 h-3.5 w-3.5" />Areas CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(csvData, 'thematic-proposals-report.csv')}>
              <Download className="mr-2 h-3.5 w-3.5" />Proposals CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-3.5 w-3.5" />Print
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thematic Area</TableHead>
                  <TableHead className="text-right">Proposals</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Won Value</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => {
                  const areaStats = summary.byArea[area.id]
                  const winRate = areaStats && areaStats.count > 0
                    ? ((areaStats.wonCount / areaStats.count) * 100).toFixed(0)
                    : '—'
                  return (
                    <TableRow key={area.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color }} />
                          <span className="font-medium">{area.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{area.proposalCount}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(area.totalValue)}</TableCell>
                      <TableCell className="text-right">{areaStats?.wonCount ?? 0}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">{formatCurrency(areaStats?.wonValue ?? 0)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={
                          winRate !== '—' && parseInt(winRate) >= 50
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }>
                          {winRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{summary.totalProposals}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(summary.totalValue)}</TableCell>
                  <TableCell className="text-right font-semibold">{summary.totalWon}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(summary.wonValue)}</TableCell>
                  <TableCell className="text-right font-semibold">{summary.winRate}%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Detail */}
      {data.data.proposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposal Details</CardTitle>
            <CardDescription>
              {data.data.proposals.length} proposal{data.data.proposals.length !== 1 ? 's' : ''} across all thematic areas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposal</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{proposal.name}</p>
                          {proposal.rfpNumber && <p className="text-xs text-muted-foreground">{proposal.rfpNumber}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{proposal.client?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(proposal.status)}>{proposal.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(proposal.value)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-muted-foreground">{formatDate(proposal.deadline)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Reports Page ──────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('summary')
  const [filters, setFilters] = useState({
    clientId: '',
    status: '',
    startDate: '',
    endDate: '',
    thematicAreaId: '',
  })
  const [generated, setGenerated] = useState(false)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', reportType)
    if (filters.clientId && filters.clientId !== 'all') params.set('clientId', filters.clientId)
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (filters.thematicAreaId && filters.thematicAreaId !== 'all') params.set('thematicAreaId', filters.thematicAreaId)
    return params.toString()
  }, [reportType, filters])

  const {
    data: reportData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<ReportResponse>({
    queryKey: ['report', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/reports?${queryParams}`)
      if (!res.ok) throw new Error('Failed to generate report')
      return res.json()
    },
    enabled: generated,
  })

  const handleGenerate = () => {
    setGenerated(true)
    refetch()
  }

  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type)
    setGenerated(false)
    setFilters({ clientId: '', status: '', startDate: '', endDate: '', thematicAreaId: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      </div>

      <ReportTypeSelector selected={reportType} onSelect={handleReportTypeChange} />

      <FilterPanel
        reportType={reportType}
        filters={filters}
        onFiltersChange={setFilters}
        onGenerate={handleGenerate}
        isGenerating={isFetching}
      />

      {isLoading || isFetching ? (
        <ReportSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Failed to load report data</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !generated ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Select a report type and click &quot;Generate Report&quot; to get started.
            </p>
          </CardContent>
        </Card>
      ) : reportData?.type === 'clients' ? (
        <ClientReportView data={reportData as ClientReportResponse} />
      ) : reportData?.type === 'proposals' ? (
        <ProposalReportView data={reportData as ProposalReportResponse} />
      ) : reportData?.type === 'thematic' ? (
        <ThematicReportView data={reportData as ThematicReportResponse} />
      ) : reportData?.type === 'summary' ? (
        <SummaryReportView data={reportData as SummaryReportResponse} />
      ) : null}
    </div>
  )
}
