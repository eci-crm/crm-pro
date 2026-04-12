'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  FolderOpen,
  Folder,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  FileText,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  Loader2,
  AlertCircle,
  Pencil,
  ChevronRight,
  ChevronLeft,
  X,
  Paperclip,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ── Types ──────────────────────────────────────────────────────────

interface Resource {
  id: string
  name: string
  filePath: string
  fileType: string
  fileSize: number
  folderId: string | null
  folder: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface Folder {
  id: string
  name: string
  parentId: string | null
  _count: { children: number; resources: number }
  createdAt: string
  updatedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function getFileCategory(fileType: string, filename: string): string {
  const ext = getFileExtension(filename)
  const mime = fileType.toLowerCase()

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext))
    return 'image'
  if (mime.includes('pdf') || ext === 'pdf')
    return 'pdf'
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext))
    return 'document'
  if (mime.includes('sheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext))
    return 'spreadsheet'
  if (mime.includes('presentation') || ['ppt', 'pptx', 'odp'].includes(ext))
    return 'presentation'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(ext))
    return 'audio'
  if (mime.startsWith('video/') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm'].includes(ext))
    return 'video'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('compress') || mime.includes('tar') || ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext))
    return 'archive'
  if (mime.includes('javascript') || mime.includes('json') || mime.includes('html') || mime.includes('css') || mime.includes('xml') || ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'xml', 'py', 'java', 'cpp', 'c', 'rb', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'toml', 'sql'].includes(ext))
    return 'code'

  return 'other'
}

function getFileIcon(category: string) {
  switch (category) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />
    case 'document':
      return <FileText className="h-5 w-5 text-blue-500" />
    case 'spreadsheet':
      return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
    case 'presentation':
      return <FileImage className="h-5 w-5 text-orange-500" />
    case 'image':
      return <ImageIcon className="h-5 w-5 text-pink-500" />
    case 'audio':
      return <FileAudio className="h-5 w-5 text-purple-500" />
    case 'video':
      return <FileVideo className="h-5 w-5 text-cyan-500" />
    case 'archive':
      return <FileArchive className="h-5 w-5 text-amber-500" />
    case 'code':
      return <FileCode className="h-5 w-5 text-teal-500" />
    default:
      return <File className="h-5 w-5 text-gray-500" />
  }
}

function getCategoryBadge(category: string, fileType: string, filename: string) {
  const ext = getFileExtension(filename).toUpperCase() || 'FILE'
  const colors: Record<string, string> = {
    pdf: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    document: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    spreadsheet: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    presentation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    image: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    audio: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    video: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    archive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    code: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  }
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${colors[category] || colors.other}`}>
      {ext}
    </Badge>
  )
}

// ── Component ──────────────────────────────────────────────────────

export default function ResourcesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([])
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [folderName, setFolderName] = useState('')

  // Fetch folders
  const {
    data: folders = [],
    isLoading: foldersLoading,
  } = useQuery<Folder[]>({
    queryKey: ['folders', currentFolderId],
    queryFn: async () => {
      const params = currentFolderId ? `?parentId=${currentFolderId}` : '?parentId=null'
      const res = await fetch(`/api/folders${params}`)
      if (!res.ok) throw new Error('Failed to fetch folders')
      return res.json()
    },
  })

  // Fetch resources
  const {
    data: resources = [],
    isLoading: resourcesLoading,
    isError,
  } = useQuery<Resource[]>({
    queryKey: ['resources', currentFolderId],
    queryFn: async () => {
      const params = currentFolderId ? `?folderId=${currentFolderId}` : '?folderId=root'
      const res = await fetch(`/api/resources${params}`)
      if (!res.ok) throw new Error('Failed to fetch resources')
      return res.json()
    },
  })

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load resources')
    }
  }, [isError])

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      if (currentFolderId) formData.append('folderId', currentFolderId)
      const res = await fetch('/api/resources', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Upload failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('File uploaded successfully')
      setUploadProgress(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file')
      setUploadProgress(false)
    },
  })

  // Delete resource mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete resource')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Resource deleted successfully')
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Failed to delete resource')
    },
  })

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: currentFolderId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create folder')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder created successfully')
      setFolderDialogOpen(false)
      setFolderName('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update folder')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      toast.success('Folder renamed successfully')
      setEditFolderDialogOpen(false)
      setEditingFolder(null)
      setFolderName('')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete folder')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast.success('Folder deleted successfully')
      setDeleteFolderTarget(null)
    },
    onError: () => toast.error('Failed to delete folder'),
  })

  // Navigation
  const navigateToFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateUp = () => {
    setFolderPath((prev) => {
      const newPath = prev.slice(0, -1)
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null)
      return newPath
    })
  }

  const navigateTo = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const newPath = folderPath.slice(0, index + 1)
      setCurrentFolderId(newPath[newPath.length - 1].id)
      setFolderPath(newPath)
    }
  }

  // File handling
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      setUploadProgress(true)
      Array.from(files).forEach((file) => {
        uploadMutation.mutate(file)
      })
    },
    [uploadMutation]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleFiles]
  )

  const handleDownload = useCallback(async (resource: Resource) => {
    try {
      const res = await fetch(`/api/resources/${resource.id}`)
      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resource.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download file')
    }
  }, [])

  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required')
      return
    }
    createFolderMutation.mutate(folderName.trim())
  }

  const handleRenameFolder = () => {
    if (!editingFolder || !folderName.trim()) {
      toast.error('Folder name is required')
      return
    }
    updateFolderMutation.mutate({ id: editingFolder.id, name: folderName.trim() })
  }

  const isLoading = foldersLoading || resourcesLoading

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Resources</h1>
        </div>
        <Button onClick={() => setFolderDialogOpen(true)} variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button
          onClick={() => navigateTo(-1)}
          className={`hover:text-primary transition-colors px-1.5 py-0.5 rounded ${!currentFolderId ? 'text-primary font-medium' : 'text-muted-foreground'}`}
        >
          Root
        </button>
        {folderPath.map((crumb, index) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => navigateTo(index)}
              className={`hover:text-primary transition-colors px-1.5 py-0.5 rounded ${
                index === folderPath.length - 1 ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer
              ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30'
              }
            `}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click()
              }
            }}
            aria-label="Upload files by clicking or dragging"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              className="hidden"
              multiple
            />
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragOver ? 'bg-primary/10' : 'bg-muted'
              }`}
            >
              {uploadProgress ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="mt-3 text-sm font-medium">
              {isDragOver ? (
                <span className="text-primary">Drop files here</span>
              ) : (
                <>
                  <span className="text-primary">Click to upload</span> or drag
                  and drop
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentFolderId
                ? `Files will be uploaded to the current folder`
                : 'Files will be uploaded to root level'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Folders & Files List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            {currentFolderId ? 'Contents' : 'All Files & Folders'}
            <Badge variant="secondary" className="ml-1">
              {folders.length + resources.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : folders.length === 0 && resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {currentFolderId
                  ? 'This folder is empty.'
                  : 'No resources uploaded yet.'}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {currentFolderId
                  ? 'Upload files or create subfolders.'
                  : 'Create folders and upload your files.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead className="hidden lg:table-cell">Modified</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Back button when inside a folder */}
                  {currentFolderId && (
                    <TableRow className="hover:bg-accent/50 cursor-pointer" onClick={navigateUp}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0">
                            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">
                            ..
                          </span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  )}

                  {/* Folders */}
                  {folders.map((folder) => (
                    <TableRow
                      key={folder.id}
                      className="hover:bg-accent/50 cursor-pointer"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0">
                            <Folder className="h-5 w-5 text-amber-500 fill-amber-200" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {folder.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {folder._count.resources} file{folder._count.resources !== 1 ? 's' : ''}
                              {folder._count.children > 0 && `, ${folder._count.children} folder${folder._count.children !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          FOLDER
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(folder.updatedAt), 'MMM d, yyyy')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingFolder(folder)
                              setFolderName(folder.name)
                              setEditFolderDialogOpen(true)
                            }}
                            aria-label={`Rename ${folder.name}`}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteFolderTarget(folder)}
                            aria-label={`Delete ${folder.name}`}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Files */}
                  {resources.map((resource) => {
                    const category = getFileCategory(
                      resource.fileType,
                      resource.name
                    )
                    return (
                      <TableRow key={resource.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0">
                              {getFileIcon(category)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium max-w-[200px] sm:max-w-[280px]">
                                {resource.name}
                              </p>
                              <div className="flex items-center gap-2 sm:hidden mt-0.5">
                                {getCategoryBadge(category, resource.fileType, resource.name)}
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(resource.fileSize)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          {getCategoryBadge(category, resource.fileType, resource.name)}
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(resource.fileSize)}
                          </span>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(resource.createdAt), 'MMM d, yyyy')}
                          </span>
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(resource)}
                              aria-label={`Download ${resource.name}`}
                              className="h-8 w-8"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(resource)}
                              aria-label={`Delete ${resource.name}`}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={(open) => { setFolderDialogOpen(open); setFolderName('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              {currentFolderId
                ? 'Create a subfolder inside the current folder.'
                : 'Create a new folder at the root level.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name *</Label>
              <Input
                id="folder-name"
                placeholder="e.g., Proposals, Contracts, Reports"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFolderDialogOpen(false); setFolderName('') }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!folderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={editFolderDialogOpen} onOpenChange={(open) => { setEditFolderDialogOpen(open); setFolderName(''); setEditingFolder(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Folder Name *</Label>
              <Input
                id="edit-folder-name"
                placeholder="Folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditFolderDialogOpen(false); setFolderName(''); setEditingFolder(null) }}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={!folderName.trim() || updateFolderMutation.isPending}
            >
              {updateFolderMutation.isPending ? 'Saving...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Resource Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Resource
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.name}&rdquo;
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id)
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Confirmation Dialog */}
      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={(open) => !open && setDeleteFolderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Folder
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete folder{' '}
              <span className="font-medium text-foreground">
                &ldquo;{deleteFolderTarget?.name}&rdquo;
              </span>
              ?
              {deleteFolderTarget && deleteFolderTarget._count.children > 0 && (
                <span className="block mt-2 text-amber-600">
                  This folder contains {deleteFolderTarget._count.children} subfolder(s) and {deleteFolderTarget._count.resources} file(s). All contents will be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFolderMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteFolderTarget) {
                  deleteFolderMutation.mutate(deleteFolderTarget.id)
                }
              }}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteFolderMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Folder'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
