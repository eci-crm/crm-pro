'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  FolderOpen,
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
  X,
  Paperclip,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ── Types ──────────────────────────────────────────────────────────

interface Resource {
  id: string
  name: string
  filePath: string
  fileType: string
  fileSize: number
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
  if (
    mime.includes('pdf') ||
    ext === 'pdf'
  )
    return 'pdf'
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)
  )
    return 'document'
  if (
    mime.includes('sheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  )
    return 'spreadsheet'
  if (
    mime.includes('presentation') ||
    ['ppt', 'pptx', 'odp'].includes(ext)
  )
    return 'presentation'
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(ext)
  )
    return 'audio'
  if (
    mime.startsWith('video/') ||
    ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm'].includes(ext)
  )
    return 'video'
  if (
    mime.includes('zip') ||
    mime.includes('rar') ||
    mime.includes('compress') ||
    mime.includes('tar') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
  )
    return 'archive'
  if (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('html') ||
    mime.includes('css') ||
    mime.includes('xml') ||
    ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'xml', 'py', 'java', 'cpp', 'c', 'rb', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'toml', 'sql'].includes(ext)
  )
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

  // Fetch resources
  const {
    data: resources = [],
    isLoading,
    isError,
  } = useQuery<Resource[]>({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await fetch('/api/resources')
      if (!res.ok) throw new Error('Failed to fetch resources')
      return res.json()
    },
  })

  if (isError) {
    toast.error('Failed to load resources')
  }

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
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
      toast.success('File uploaded successfully')
      setUploadProgress(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file')
      setUploadProgress(false)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete resource')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast.success('Resource deleted successfully')
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Failed to delete resource')
    },
  })

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
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <FolderOpen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Resources</h1>
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
              Any file type &middot; Multiple files supported
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            Files
            {resources.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {resources.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No resources uploaded yet.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Upload your first file using the area above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">File</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((resource) => {
                    const category = getFileCategory(
                      resource.fileType,
                      resource.name
                    )
                    return (
                      <TableRow key={resource.id}>
                        {/* File Name + Icon */}
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0">
                              {getFileIcon(category)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium max-w-[200px] sm:max-w-[280px]">
                                {resource.name}
                              </p>
                              {/* Mobile: show type and size below name */}
                              <div className="flex items-center gap-2 sm:hidden mt-0.5">
                                {getCategoryBadge(category, resource.fileType, resource.name)}
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(resource.fileSize)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Type Badge - hidden on mobile */}
                        <TableCell className="hidden sm:table-cell">
                          {getCategoryBadge(category, resource.fileType, resource.name)}
                        </TableCell>

                        {/* Size - hidden on small screens */}
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(resource.fileSize)}
                          </span>
                        </TableCell>

                        {/* Upload Date - hidden on smaller screens */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(resource.createdAt), 'MMM d, yyyy')}
                          </span>
                        </TableCell>

                        {/* Actions */}
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

      {/* Delete Confirmation Dialog */}
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
              ? This action cannot be undone. The file will be permanently
              removed.
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
    </div>
  )
}
