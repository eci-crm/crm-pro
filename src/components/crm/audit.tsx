'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, subDays } from 'date-fns'
import {
  Shield,
  Search,
  Filter,
  X,
  Download,
  RefreshCw,
  Clock,
  User,
  FileText,
  Users,
  Tag,
  Settings,
  FolderOpen,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  entityName: string
  details: string
  userId: string
  userName: string
  userRole: string
  userAgent: string
  ipAddress: string
  createdAt: string
}

interface AuditStats {
  actionStats: { action: string; count: number }[]
  entityTypeStats: { entityType: string; count: number }[]
  activityTimeline: Record<string, number>
}

interface AuditResponse {
  logs: AuditLogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: AuditStats
}

// ── Constants ──────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: 'CREATE', label: 'Create', icon: Plus, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'UPDATE', label: 'Update', icon: Pencil, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'DELETE', label: 'Delete', icon: Trash2, color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'LOGIN', label: 'Login', icon: LogIn, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'LOGOUT', label: 'Logout', icon: LogOut, color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'IMPORT', label: 'Import', icon: Upload, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'EXPORT', label: 'Export', icon: Download, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'BULK_CREATE', label: 'Bulk Create', icon: Plus, color: 'bg-teal-100 text-teal-700 border-teal-200' },
]

const ENTITY_TYPE_OPTIONS = [
  { value: 'Proposal', label: 'Proposals', icon: FileText },
  { value: 'Client', label: 'Clients', icon: Users },
  { value: 'TeamMember', label: 'Team Members', icon: User },
  { value: 'ThematicArea', label: 'Thematic Areas', icon: Tag },
  { value: 'Setting', label: 'Settings', icon: Settings },
  { value: 'Resource', label: 'Resources', icon: FolderOpen },
]

function getActionConfig(action: string) {
  return ACTION_OPTIONS.find(a => a.value === action) || {
    value: action,
    label: action,
    icon: Activity,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  }
}

function getEntityTypeIcon(entityType: string) {
  const found = ENTITY_TYPE_OPTIONS.find(e => e.value === entityType)
  return found ? found.icon : Activity
}

function getEntityTypeLabel(entityType: string) {
  const found = ENTITY_TYPE_OPTIONS.find(e => e.value === entityType)
  return found ? found.label : entityType
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) {
    return `Today, ${format(date, 'h:mm a')}`
  }
  if (isYesterday(date)) {
    return `Yesterday, ${format(date, 'h:mm a')}`
  }
  if (isThisWeek(date)) {
    return format(date, 'EEE, h:mm a')
  }
  return format(date, 'dd MMM yyyy, h:mm a')
}

function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

function exportAuditCSV(logs: AuditLogEntry[], filename: string) {
  if (!logs.length) {
    toast.error('No data to export')
    return
  }
  const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Details', 'User', 'Role', 'IP Address']
  const csv = [
    headers.join(','),
    ...logs.map((log) =>
      [
        new Date(log.createdAt).toISOString(),
        log.action,
        log.entityType,
        log.entityName,
        `"${log.details.replace(/"/g, '""')}"`,
        log.userName,
        log.userRole,
        log.ipAddress,
      ].join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Exported ${logs.length} audit log entries`)
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AuditTrailPage() {
  // ── Filter State ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [page, setPage] = useState(1)
  const limit = 50

  // ── Debounced search ────────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when filters change (called from handlers, not effects)
  // ── Quick Date Presets ─────────────────────────────────────────────────
  const setQuickDate = useCallback((preset: string) => {
    setPage(1)
    const now = new Date()
    switch (preset) {
      case 'today':
        setStartDate(now)
        setEndDate(now)
        break
      case '7d':
        setStartDate(subDays(now, 7))
        setEndDate(now)
        break
      case '30d':
        setStartDate(subDays(now, 30))
        setEndDate(now)
        break
      case '90d':
        setStartDate(subDays(now, 90))
        setEndDate(now)
        break
      case 'all':
        setStartDate(undefined)
        setEndDate(undefined)
        break
    }
  }, [])

  // ── Fetch Audit Logs ───────────────────────────────────────────────────
  const { data, isLoading, isError, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', debouncedSearch, actionFilter, entityTypeFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (actionFilter) params.set('action', actionFilter)
      if (entityTypeFilter) params.set('entityType', entityTypeFilter)
      if (startDate) params.set('startDate', format(startDate, 'yyyy-MM-dd'))
      if (endDate) params.set('endDate', format(endDate, 'yyyy-MM-dd'))
      params.set('page', String(page))
      params.set('limit', String(limit))
      const res = await fetch(`/api/audit?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      return res.json()
    },
  })

  const logs = data?.logs || []
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 0 }
  const stats = data?.stats

  const clearFilters = useCallback(() => {
    setSearch('')
    setActionFilter('')
    setEntityTypeFilter('')
    setStartDate(undefined)
    setEndDate(undefined)
    setPage(1)
  }, [])

  const hasActiveFilters = search || actionFilter || entityTypeFilter || startDate || endDate

  // ── Summary Stats Cards ────────────────────────────────────────────────
  const totalLogs = pagination.total
  const loginsToday = stats?.actionStats?.find(s => s.action === 'LOGIN')?.count ?? 0
  const activeEntities = stats?.entityTypeStats?.length ?? 0
  const topAction = stats?.actionStats?.[0]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Audit Trail
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track all user actions and system changes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAuditCSV(logs, `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`)}
            disabled={!logs.length}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ──────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Activity className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Events</p>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-7 w-16" /> : totalLogs.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <LogIn className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Logins</p>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-7 w-16" /> : loginsToday.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Tag className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Entity Types</p>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-7 w-8" /> : activeEntities}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <ArrowUpDown className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Top Action</p>
                <div className="text-lg font-bold text-foreground capitalize">
                  {isLoading ? <Skeleton className="h-7 w-20" /> : topAction ? `${topAction.action.toLowerCase()} (${topAction.count})` : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Activity Breakdown (Horizontal Stats) ──────────────────────── */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* By Action */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground">By Action</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {stats.actionStats.map((s) => {
                  const config = getActionConfig(s.action)
                  return (
                    <Badge key={s.action} variant="outline" className={cn('text-xs font-medium', config.color)}>
                      {s.action} <span className="ml-1 font-bold">{s.count}</span>
                    </Badge>
                  )
                })}
                {!stats.actionStats.length && (
                  <span className="text-xs text-muted-foreground">No data yet</span>
                )}
              </div>
            </CardContent>
          </Card>
          {/* By Entity */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground">By Entity Type</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {stats.entityTypeStats.map((s) => {
                  const label = getEntityTypeLabel(s.entityType)
                  return (
                    <Badge key={s.entityType} variant="secondary" className="text-xs font-medium">
                      {label} <span className="ml-1 font-bold">{s.count}</span>
                    </Badge>
                  )
                })}
                {!stats.entityTypeStats.length && (
                  <span className="text-xs text-muted-foreground">No data yet</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700 ml-auto">
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val === '__all__' ? '' : val); setPage(1) }}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity Type Filter */}
            <Select value={entityTypeFilter} onValueChange={(val) => { setEntityTypeFilter(val === '__all__' ? '' : val); setPage(1) }}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Entity Types</SelectItem>
                {ENTITY_TYPE_OPTIONS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'h-9 w-full justify-start text-left font-normal',
                    !startDate && 'text-slate-400'
                  )}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5" />
                  {startDate ? format(startDate, 'dd MMM yy') : 'Start Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setPage(1) }} />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'h-9 w-full justify-start text-left font-normal',
                    !endDate && 'text-slate-400'
                  )}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5" />
                  {endDate ? format(endDate, 'dd MMM yy') : 'End Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setPage(1) }} />
              </PopoverContent>
            </Popover>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Today', val: 'today' },
                { label: '7d', val: '7d' },
                { label: '30d', val: '30d' },
                { label: 'All', val: 'all' },
              ].map((preset) => (
                <Button
                  key={preset.val}
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2.5 text-xs text-slate-600 hover:bg-slate-100"
                  onClick={() => setQuickDate(preset.val)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Filter result count */}
          <div className="mt-3">
            <span className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {logs.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700">
                {pagination.total.toLocaleString()}
              </span>{' '}
              events
              {hasActiveFilters ? ' (filtered)' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Audit Log Table ────────────────────────────────────────────── */}
      {isLoading ? (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Failed to load audit logs</p>
            <p className="text-red-500 text-sm mt-1">Please try again later</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
                <Shield className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-700">No audit events found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or clear them to see all events.'
                    : 'Audit events will appear here as users interact with the system.'}
                </p>
              </div>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" className="mt-2">
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="border-slate-200 hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider w-[170px]">Timestamp</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider w-[100px]">Action</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">Entity Type</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Entity / Details</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider w-[150px]">User</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider w-[130px]">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const actionConfig = getActionConfig(log.action)
                      const ActionIcon = actionConfig.icon
                      const EntityIcon = getEntityTypeIcon(log.entityType)
                      return (
                        <TableRow key={log.id} className="group hover:bg-slate-50/80">
                          <TableCell className="text-slate-700">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs font-medium cursor-default">
                                  {formatTimestamp(log.createdAt)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{formatRelativeTime(log.createdAt)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('border text-[11px] font-medium px-2 py-0.5', actionConfig.color)}>
                              <ActionIcon className="h-3 w-3 mr-1" />
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <EntityIcon className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-xs font-medium">{getEntityTypeLabel(log.entityType)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              {log.entityName && (
                                <p className="text-sm font-medium text-slate-900 truncate max-w-[250px]">
                                  {log.entityName}
                                </p>
                              )}
                              {log.details && (
                                <p className="text-xs text-slate-500 truncate max-w-[300px]">
                                  {log.details}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                                <User className="h-3 w-3 text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">
                                  {log.userName || 'System'}
                                </p>
                                {log.userRole && (
                                  <p className="text-[10px] text-slate-400">{log.userRole}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500 font-mono">
                              {log.ipAddress || '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile/Tablet Cards */}
          <div className="lg:hidden space-y-2">
            {logs.map((log) => {
              const actionConfig = getActionConfig(log.action)
              const ActionIcon = actionConfig.icon
              const EntityIcon = getEntityTypeIcon(log.entityType)
              return (
                <Card key={log.id} className="border-slate-200 overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={cn('border text-[10px] font-medium px-1.5 py-0 shrink-0', actionConfig.color)}>
                          <ActionIcon className="h-2.5 w-2.5 mr-0.5" />
                          {log.action}
                        </Badge>
                        <div className="flex items-center gap-1 text-slate-600">
                          <EntityIcon className="h-3 w-3" />
                          <span className="text-[11px] font-medium">{getEntityTypeLabel(log.entityType)}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>

                    {log.entityName && (
                      <p className="text-sm font-medium text-slate-900 truncate">{log.entityName}</p>
                    )}
                    {log.details && (
                      <p className="text-xs text-slate-500 line-clamp-2">{log.details}</p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="h-3 w-3" />
                        <span className="text-[11px] font-medium">{log.userName || 'System'}</span>
                        {log.userRole && (
                          <span className="text-[10px] text-slate-400">({log.userRole})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i
                    } else {
                      pageNum = pagination.page - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
