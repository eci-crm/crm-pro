'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Building2,
  Upload,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  GripVertical,
  LayoutDashboard,
  FileText,
  CalendarDays,
  FolderOpen,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCrmStore } from '@/lib/store'

// ── Types ──────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  updatedAt: string
  _count?: { proposals: number }
}

interface CrmSection {
  id: string
  name: string
  icon: LucideIcon
}

const CRM_SECTIONS: CrmSection[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', name: 'Clients', icon: Users },
  { id: 'proposals', name: 'Proposals', icon: FileText },
  { id: 'calendar', name: 'Calendar', icon: CalendarDays },
  { id: 'resources', name: 'Resources', icon: FolderOpen },
  { id: 'reports', name: 'Reports', icon: BarChart3 },
  { id: 'settings', name: 'Settings', icon: Settings },
]

const ROLE_OPTIONS = ['Admin', 'Manager', 'Member', 'Viewer'] as const

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'Admin':
      return 'default'
    case 'Manager':
      return 'secondary'
    default:
      return 'outline'
  }
}

// ── Sortable Item ──────────────────────────────────────────────────────────

function SortableSectionItem({ section }: { section: CrmSection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = section.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-4 transition-shadow ${
        isDragging ? 'shadow-lg opacity-80' : 'shadow-sm hover:shadow-md'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground">{section.name}</span>
    </div>
  )
}

// ── Company Settings Tab ───────────────────────────────────────────────────

function CompanySettingsTab() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
  })

  // Track pending edits - null means use server values directly
  const [draft, setDraft] = useState<{ tagline: string; logoUrl: string } | null>(null)

  // Display values: use draft if user has started editing, otherwise server value
  const tagline = draft?.tagline ?? settings?.companyTagline ?? ''
  const logoUrl = draft?.logoUrl ?? settings?.companyLogo ?? ''

  const saveMutation = useMutation({
    mutationFn: async (settingsToSave: { key: string; value: string }[]) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Settings saved successfully')
      setDraft(null) // Clear draft so server values are shown after refetch
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setDraft((prev) => ({
        tagline: prev?.tagline ?? settings?.companyTagline ?? '',
        logoUrl: reader.result as string,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    const settingsToSave = [
      { key: 'companyTagline', value: tagline },
      { key: 'companyLogo', value: logoUrl },
    ]
    saveMutation.mutate(settingsToSave)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full max-w-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Profile
          </CardTitle>
          <CardDescription>
            Manage your company branding and information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/50 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-2">
            <Label htmlFor="tagline">Company Tagline</Label>
            <Input
              id="tagline"
              placeholder="Enter your company tagline..."
              value={tagline}
              onChange={(e) => {
                setDraft((prev) => ({
                  tagline: e.target.value,
                  logoUrl: prev?.logoUrl ?? settings?.companyLogo ?? '',
                }))
              }}
              className="max-w-md"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Team Members Tab ───────────────────────────────────────────────────────

function TeamMembersTab() {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await fetch('/api/team')
      if (!res.ok) throw new Error('Failed to fetch team members')
      return res.json()
    },
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('Member')

  const resetForm = () => {
    setFormName('')
    setFormEmail('')
    setFormRole('Member')
    setEditingMember(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member)
    setFormName(member.name)
    setFormEmail(member.email)
    setFormRole(member.role)
    setDialogOpen(true)
  }

  const openDeleteDialog = (member: TeamMember) => {
    setDeletingMember(member)
    setDeleteDialogOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string }) => {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create team member')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Team member added successfully')
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; email: string; role: string } }) => {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update team member')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Team member updated successfully')
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setDialogOpen(false)
      resetForm()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete team member')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Team member deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setDeleteDialogOpen(false)
      setDeletingMember(null)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('Name is required')
      return
    }
    if (editingMember) {
      updateMutation.mutate({
        id: editingMember.id,
        data: { name: formName.trim(), email: formEmail, role: formRole },
      })
    } else {
      createMutation.mutate({
        name: formName.trim(),
        email: formEmail,
        role: formRole,
      })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage who has access to your CRM workspace.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No team members yet
              </p>
              <p className="text-xs text-muted-foreground/70">
                Click &quot;Add Member&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Proposals</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {member.email || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {member._count?.proposals ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(member)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(member)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? 'Update the team member details below.'
                : 'Fill in the details to add a new team member.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="member-name">Name *</Label>
              <Input
                id="member-name"
                placeholder="Full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="email@company.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : editingMember
                  ? 'Update Member'
                  : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingMember?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMember && deleteMutation.mutate(deletingMember.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Section Customization Tab ──────────────────────────────────────────────

function SectionCustomizationTab() {
  const { currentPage, setCurrentPage } = useCrmStore()

  // Load section order from localStorage
  const loadSectionOrder = useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('crm-section-order')
      if (stored) return JSON.parse(stored) as string[]
    } catch {
      // ignore parse errors
    }
    return null
  }, [])

  const savedOrder = loadSectionOrder()

  const defaultOrder = CRM_SECTIONS.map((s) => s.id)
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    savedOrder && savedOrder.length === CRM_SECTIONS.length ? savedOrder : defaultOrder
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSectionOrder((items) => {
      const oldIndex = items.indexOf(active.id as string)
      const newIndex = items.indexOf(over.id as string)
      const newOrder = arrayMove(items, oldIndex, newIndex)

      // Persist to localStorage
      try {
        localStorage.setItem('crm-section-order', JSON.stringify(newOrder))
      } catch {
        // ignore storage errors
      }

      return newOrder
    })
  }

  const handleReset = () => {
    setSectionOrder(defaultOrder)
    try {
      localStorage.removeItem('crm-section-order')
    } catch {
      // ignore
    }
    toast.success('Section order reset to default')
  }

  const orderedSections = sectionOrder
    .map((id) => CRM_SECTIONS.find((s) => s.id === id))
    .filter(Boolean) as CrmSection[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Section Order
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop to reorder navigation sections.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Reset to Default
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {orderedSections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main Settings Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanySettingsTab />
        </TabsContent>

        <TabsContent value="team">
          <TeamMembersTab />
        </TabsContent>

        <TabsContent value="sections">
          <SectionCustomizationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
