'use client'

import React, { useCallback, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Search, Pencil, Trash2, FileText, Filter, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string
  name: string
  status: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface Proposal {
  id: string
  name: string
  rfpNumber: string
  clientId: string
  client: Client
  assignedMemberId: string
  assignedMember: TeamMember | null
  value: number
  status: string
  remarks: string
  deadline: string | null
  submissionDate: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Submitted', 'In Process', 'In Evaluation', 'Pending', 'Won'] as const

const STATUS_COLORS: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  'In Process': 'bg-amber-100 text-amber-800 border-amber-200',
  'In Evaluation': 'bg-purple-100 text-purple-800 border-purple-200',
  Pending: 'bg-slate-100 text-slate-700 border-slate-200',
  Won: 'bg-green-100 text-green-800 border-green-200',
}

// ── Zod Schema ──────────────────────────────────────────────────────────────

const proposalSchema = z.object({
  name: z.string().min(1, 'Proposal name is required'),
  rfpNumber: z.string().optional().default(''),
  clientId: z.string().min(1, 'Client is required'),
  assignedMemberId: z.string().optional().default(''),
  value: z.number().min(0).optional().default(0),
  status: z.string().optional().default('In Process'),
  remarks: z.string().optional().default(''),
  deadline: z.date().nullable().optional(),
  submissionDate: z.date().nullable().optional(),
})

type ProposalFormValues = z.infer<typeof proposalSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPKR(value: number): string {
  return `PKR ${new Intl.NumberFormat('en-PK').format(value)}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(new Date(dateStr), 'dd MMM yyyy')
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const queryClient = useQueryClient()

  // ── Filter State ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()

  // ── Dialog State ────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null)

  // ── Debounced search ────────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('')

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // ── Query: Clients ──────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Failed to fetch clients')
      return res.json()
    },
  })

  // ── Query: Team Members ─────────────────────────────────────────────────
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['team-list'],
    queryFn: async () => {
      const res = await fetch('/api/team')
      if (!res.ok) throw new Error('Failed to fetch team members')
      return res.json()
    },
  })

  // ── Query: Proposals ────────────────────────────────────────────────────
  const {
    data: proposals = [],
    isLoading,
    isError,
  } = useQuery<Proposal[]>({
    queryKey: ['proposals', debouncedSearch, clientFilter, statusFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (clientFilter) params.set('clientId', clientFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (startDate) params.set('startDate', format(startDate, 'yyyy-MM-dd'))
      if (endDate) params.set('endDate', format(endDate, 'yyyy-MM-dd'))
      const res = await fetch(`/api/proposals?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch proposals')
      return res.json()
    },
  })

  // ── Mutation: Create / Update ───────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: ProposalFormValues) => {
      const payload = {
        ...data,
        deadline: data.deadline ? format(data.deadline, 'yyyy-MM-dd') : null,
        submissionDate: data.submissionDate ? format(data.submissionDate, 'yyyy-MM-dd') : null,
      }
      if (editingProposal) {
        const res = await fetch(`/api/proposals/${editingProposal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to update proposal')
        }
        return res.json()
      } else {
        const res = await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create proposal')
        }
        return res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      toast.success(editingProposal ? 'Proposal updated successfully' : 'Proposal created successfully')
      closeDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Something went wrong')
    },
  })

  // ── Mutation: Delete ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete proposal')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] })
      toast.success('Proposal deleted successfully')
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Failed to delete proposal')
    },
  })

  // ── Form ────────────────────────────────────────────────────────────────
  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      name: '',
      rfpNumber: '',
      clientId: '',
      assignedMemberId: '',
      value: 0,
      status: 'In Process',
      remarks: '',
      deadline: null,
      submissionDate: null,
    },
  })

  // ── Handlers ────────────────────────────────────────────────────────────
  const openCreateDialog = useCallback(() => {
    setEditingProposal(null)
    form.reset({
      name: '',
      rfpNumber: '',
      clientId: '',
      assignedMemberId: '',
      value: 0,
      status: 'In Process',
      remarks: '',
      deadline: null,
      submissionDate: null,
    })
    setDialogOpen(true)
  }, [form])

  const openEditDialog = useCallback(
    (proposal: Proposal) => {
      setEditingProposal(proposal)
      form.reset({
        name: proposal.name,
        rfpNumber: proposal.rfpNumber,
        clientId: proposal.clientId,
        assignedMemberId: proposal.assignedMemberId || '',
        value: proposal.value,
        status: proposal.status,
        remarks: proposal.remarks,
        deadline: proposal.deadline ? new Date(proposal.deadline) : null,
        submissionDate: proposal.submissionDate ? new Date(proposal.submissionDate) : null,
      })
      setDialogOpen(true)
    },
    [form]
  )

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setEditingProposal(null)
  }, [])

  const onSubmit = useCallback(
    (data: ProposalFormValues) => {
      saveMutation.mutate(data)
    },
    [saveMutation]
  )

  const clearFilters = useCallback(() => {
    setSearch('')
    setClientFilter('')
    setStatusFilter('')
    setStartDate(undefined)
    setEndDate(undefined)
  }, [])

  const hasActiveFilters = search || clientFilter || statusFilter || startDate || endDate

  // ── Client / Team maps for display ──────────────────────────────────────
  const clientMap = React.useMemo(() => {
    const map = new Map<string, string>()
    clients.forEach((c) => map.set(c.id, c.name))
    return map
  }, [clients])

  const teamMap = React.useMemo(() => {
    const map = new Map<string, string>()
    teamMembers.forEach((m) => map.set(m.id, m.name))
    return map
  }, [teamMembers])

  // ── Watch values for controlled select in form ──────────────────────────
  const watchedClientId = form.watch('clientId')
  const watchedMemberId = form.watch('assignedMemberId')
  const watchedStatus = form.watch('status')

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Proposal Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, track and manage your business proposals and tenders
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Proposal
        </Button>
      </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search proposals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Client Filter */}
            <Select value={clientFilter} onValueChange={(val) => setClientFilter(val === '__all__' ? '' : val)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val === '__all__' ? '' : val)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left font-normal',
                      !startDate && 'text-slate-400'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {startDate ? format(startDate, 'dd MMM yy') : 'Start Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left font-normal',
                      !endDate && 'text-slate-400'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {endDate ? format(endDate, 'dd MMM yy') : 'End Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filter result count */}
          <div className="mt-3">
            <span className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{proposals.length}</span>{' '}
              {proposals.length === 1 ? 'proposal' : 'proposals'}
              {hasActiveFilters ? ' (filtered)' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Proposals Table (Desktop) ──────────────────────────────────── */}
      {isLoading ? (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600 font-medium">Failed to load proposals</p>
            <p className="text-red-500 text-sm mt-1">Please try again later</p>
          </CardContent>
        </Card>
      ) : proposals.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
                <FileText className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-700">No proposals found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or clear them to see all proposals.'
                    : 'Create your first proposal to get started.'}
                </p>
              </div>
              {!hasActiveFilters && (
                <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Proposal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="border-slate-200 hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Proposal Name</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">RFP/Tender #</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned To</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Value (PKR)</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Deadline</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id} className="group">
                      <TableCell className="font-medium text-slate-900 max-w-[220px] truncate">
                        {proposal.name}
                      </TableCell>
                      <TableCell className="text-slate-600 font-mono text-xs">
                        {proposal.rfpNumber || '—'}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {proposal.client?.name || '—'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {proposal.assignedMember?.name || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900">
                        {formatPKR(proposal.value)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'border text-xs font-medium px-2 py-0.5',
                            STATUS_COLORS[proposal.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {formatDate(proposal.deadline)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEditDialog(proposal)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget(proposal)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {proposals.map((proposal) => (
              <Card key={proposal.id} className="border-slate-200 overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 truncate">{proposal.name}</h3>
                      {proposal.rfpNumber && (
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{proposal.rfpNumber}</p>
                      )}
                    </div>
                    <Badge
                      className={cn(
                        'border text-xs font-medium px-2 py-0.5 shrink-0',
                        STATUS_COLORS[proposal.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                      )}
                    >
                      {proposal.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs block">Client</span>
                      <span className="text-slate-800 font-medium">{proposal.client?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Assigned To</span>
                      <span className="text-slate-800 font-medium">{proposal.assignedMember?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Value</span>
                      <span className="text-slate-800 font-medium">{formatPKR(proposal.value)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Deadline</span>
                      <span className="text-slate-800 font-medium">{formatDate(proposal.deadline)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => openEditDialog(proposal)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteTarget(proposal)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Add / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {editingProposal ? 'Edit Proposal' : 'Add New Proposal'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {editingProposal
                ? 'Update the proposal details below.'
                : 'Fill in the details to create a new proposal.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Proposal Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                Proposal Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter proposal name"
                {...form.register('name')}
                className="h-9"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* RFP / Tender Number */}
            <div className="space-y-1.5">
              <Label htmlFor="rfpNumber" className="text-sm font-medium text-slate-700">
                RFP / Tender Number
              </Label>
              <Input
                id="rfpNumber"
                placeholder="e.g. RFP-2025-001"
                {...form.register('rfpNumber')}
                className="h-9"
              />
            </div>

            {/* Client & Assigned Member - side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Client <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watchedClientId}
                  onValueChange={(val) => form.setValue('clientId', val, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && (
                  <p className="text-xs text-red-500">{form.formState.errors.clientId.message}</p>
                )}
              </div>

              {/* Assigned Team Member */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Assigned Team Member
                </Label>
                <Select
                  value={watchedMemberId || '__none__'}
                  onValueChange={(val) => form.setValue('assignedMemberId', val === '__none__' ? '' : val)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.role && m.role !== 'Member' ? `(${m.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Value & Status - side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Proposal Value */}
              <div className="space-y-1.5">
                <Label htmlFor="value" className="text-sm font-medium text-slate-700">
                  Proposal Value (PKR)
                </Label>
                <Input
                  id="value"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  {...form.register('value', { valueAsNumber: true })}
                  className="h-9"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Status
                </Label>
                <Select
                  value={watchedStatus || 'In Process'}
                  onValueChange={(val) => form.setValue('status', val)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="text-sm font-medium text-slate-700">
                Remarks
              </Label>
              <Textarea
                id="remarks"
                placeholder="Add any remarks or notes..."
                rows={3}
                {...form.register('remarks')}
                className="resize-none"
              />
            </div>

            {/* Deadline & Submission Date - side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Deadline */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Deadline
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 w-full justify-start text-left font-normal',
                        !form.getValues('deadline') && 'text-slate-400'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {form.getValues('deadline')
                        ? format(new Date(form.getValues('deadline')!), 'dd MMM yyyy')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.getValues('deadline') || undefined}
                      onSelect={(date) => form.setValue('deadline', date || null)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Submission Date */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Submission Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 w-full justify-start text-left font-normal',
                        !form.getValues('submissionDate') && 'text-slate-400'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {form.getValues('submissionDate')
                        ? format(new Date(form.getValues('submissionDate')!), 'dd MMM yyyy')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.getValues('submissionDate') || undefined}
                      onSelect={(date) => form.setValue('submissionDate', date || null)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Dialog Footer */}
            <DialogFooter className="pt-4 border-t border-slate-100 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingProposal ? (
                  'Save Changes'
                ) : (
                  'Create Proposal'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be
              undone and will permanently remove the proposal from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
