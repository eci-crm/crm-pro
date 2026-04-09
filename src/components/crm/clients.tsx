'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string
  name: string
  address: string
  status: string
  createdAt: string
  updatedAt: string
  _count: { proposals: number }
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const clientFormSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  address: z.string(),
  status: z.enum(['Active', 'Inactive']),
})

type ClientFormValues = z.infer<typeof clientFormSchema>

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchClients(search: string, status: string): Promise<Client[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status && status !== 'all') params.set('status', status)

  const res = await fetch(`/api/clients?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch clients')
  return res.json()
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-5 w-36" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24" />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function CardSkeleton() {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sort Icon ───────────────────────────────────────────────────────────────

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: 'name' | 'createdAt'
  sortField: 'name' | 'createdAt'
  sortDir: 'asc' | 'desc'
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
  }
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 h-3.5 w-3.5 text-blue-600" />
  ) : (
    <ArrowDown className="ml-1 h-3.5 w-3.5 text-blue-600" />
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'Active'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
      }
    >
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
          status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      {status}
    </Badge>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Building2 className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-base font-semibold text-foreground">No clients found</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search or filter criteria to find what you\'re looking for.'
          : 'Get started by adding your first client using the button above.'}
      </p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClientsPage() {
  const queryClient = useQueryClient()

  // ── State ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Query ────────────────────────────────────────────────────────────────
  const {
    data: clients = [],
    isLoading,
    isError,
  } = useQuery<Client[]>({
    queryKey: ['clients', search, statusFilter],
    queryFn: () => fetchClients(search, statusFilter),
  })

  // ── Derived / Sorted ─────────────────────────────────────────────────────
  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name)
        return sortDir === 'asc' ? cmp : -cmp
      }
      const cmp =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [clients, sortField, sortDir])

  const hasFilters = search.length > 0 || statusFilter !== 'all'

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { name: '', address: '', status: 'Active' },
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create client')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created successfully')
      closeDialog()
    },
    onError: (err) => toast.error(err.message || 'Failed to create client'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: ClientFormValues
    }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update client')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client updated successfully')
      closeDialog()
    },
    onError: (err) => toast.error(err.message || 'Failed to update client'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete client')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted successfully')
      setDeleteTarget(null)
    },
    onError: (err) => toast.error(err.message || 'Failed to delete client'),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openCreateDialog() {
    setEditingClient(null)
    form.reset({ name: '', address: '', status: 'Active' })
    setDialogOpen(true)
  }

  function openEditDialog(client: Client) {
    setEditingClient(client)
    form.reset({
      name: client.name,
      address: client.address,
      status: client.status as 'Active' | 'Inactive',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingClient(null)
    form.reset()
  }

  function onSubmit(data: ClientFormValues) {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  function handleSort(field: 'name' | 'createdAt') {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Client Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your client relationships and contact information
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-blue-600 text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* ─── Search & Filter Bar ──────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {sortedClients.length} result
                {sortedClients.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Error Banner ─────────────────────────────────────────────────── */}
      {isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Failed to load clients. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Desktop Table ───────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 hidden md:block">
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/40">
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center font-semibold">
                      Client Name
                      <SortIcon
                        field="name"
                        sortField={sortField}
                        sortDir={sortDir}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Proposals</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center font-semibold">
                      Created Date
                      <SortIcon
                        field="createdAt"
                        sortField={sortField}
                        sortDir={sortDir}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton />
                ) : sortedClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState hasFilters={hasFilters} />
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedClients.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30">
                            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-foreground">
                            {client.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {client.address || '\u2014'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={client.status} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {client._count.proposals}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(client.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(client)}
                            className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit {client.name}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(client)}
                            className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">
                              Delete {client.name}
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Mobile Cards ────────────────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : sortedClients.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <EmptyState hasFilters={hasFilters} />
            </CardContent>
          </Card>
        ) : (
          sortedClients.map((client) => (
            <Card
              key={client.id}
              className="border-slate-200 dark:border-slate-800"
            >
              <CardContent className="p-4 space-y-3">
                {/* Top: Name + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {client.name}
                      </p>
                      {client.address && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {client.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={client.status} />
                </div>

                {/* Bottom: Meta + Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums dark:bg-slate-800">
                        {client._count.proposals}
                      </span>
                      proposal{client._count.proposals !== 1 ? 's' : ''}
                    </span>
                    <span>{format(new Date(client.createdAt), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(client)}
                      className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(client)}
                      className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ─── Add / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? 'Update the client information below.'
                : 'Fill in the details to create a new client.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Client Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Acme Corporation"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 123 Business Ave, Suite 100"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingClient
                      ? 'Update Client'
                      : 'Create Client'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">
                  {deleteTarget?.name}
                </span>
                ? This action cannot be undone and will also remove all
                associated proposals.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-200 dark:focus-visible:ring-red-800"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
