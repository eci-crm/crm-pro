'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  FolderOpen,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  Building2,
  LogOut,
  UserCircle,
} from 'lucide-react'
import { useCrmStore } from '@/lib/store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'Admin':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    case 'Manager':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Member':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'Viewer':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
  }
}

function BrandLogo({ logoUrl, name, size = 'sm' }: { logoUrl: string; name: string; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'h-9 w-9 p-1' : 'h-14 w-14 p-1'
  if (!logoUrl) return null
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg bg-sidebar-primary', sizeClasses)}>
      <img src={logoUrl} alt={name} className="h-full w-full object-contain" />
    </div>
  )
}

function SidebarNavContent({
  currentPage,
  onNavigate,
  collapsed = false,
  onNavigateMobile,
}: {
  currentPage: string
  onNavigate: (page: string) => void
  collapsed?: boolean
  onNavigateMobile?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = currentPage === item.id
        const button = (
          <button
            onClick={() => {
              onNavigate(item.id)
              onNavigateMobile?.()
            }}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-sidebar-accent text-sidebar-primary shadow-sm'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5 shrink-0 transition-colors',
                isActive
                  ? 'text-sidebar-primary'
                  : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'
              )}
            />
            {!collapsed && <span>{item.label}</span>}
          </button>
        )

        if (collapsed) {
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        }

        return <React.Fragment key={item.id}>{button}</React.Fragment>
      })}
    </nav>
  )
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, user, setUser } =
    useCrmStore()
  const isMobile = useIsMobile()

  // On mobile, always start collapsed
  const isCollapsed = !isMobile && !sidebarOpen

  // Fetch company branding settings
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings-branding'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const companyName = settings?.companyName || 'CRM Pro'
  const companyLogo = settings?.companyLogo || ''

  const handleLogout = () => {
    setUser(null)
    toast.success('You have been signed out')
  }

  const handleNavigateSettings = () => {
    setCurrentPage('settings')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.aside
          className={cn(
            'relative flex flex-col border-r border-sidebar-border bg-sidebar transition-colors',
            isCollapsed ? 'w-[68px]' : 'w-[260px]'
          )}
          animate={{ width: isCollapsed ? 68 : 260 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {/* Brand */}
          <div className="flex h-16 items-center gap-3 px-4">
            {companyLogo ? (
              <BrandLogo logoUrl={companyLogo} name={companyName} size="sm" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
            )}
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-lg font-bold text-sidebar-foreground truncate"
              >
                {companyName}
              </motion.span>
            )}
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2">
            <SidebarNavContent
              currentPage={currentPage}
              onNavigate={setCurrentPage}
              collapsed={isCollapsed}
            />
          </ScrollArea>

          <Separator className="bg-sidebar-border" />

          {/* Collapse Toggle */}
          <div className="flex items-center justify-center p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isCollapsed && 'rotate-180'
                )}
              />
            </Button>
          </div>
        </motion.aside>
      )}

      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-3.5 z-40 h-10 w-10 text-foreground hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
            <SheetHeader className="flex h-16 flex-row items-center gap-3 px-4">
              {companyLogo ? (
                <BrandLogo logoUrl={companyLogo} name={companyName} size="sm" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                  <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
                </div>
              )}
              <SheetTitle className="text-lg font-bold text-sidebar-foreground truncate">
                {companyName}
              </SheetTitle>
            </SheetHeader>
            <Separator className="bg-sidebar-border" />
            <ScrollArea className="flex-1 py-2">
              <SidebarNavContent
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                collapsed={false}
                onNavigateMobile={() => {}}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
          <div className={cn('flex items-center gap-3', isMobile && 'pl-12')}>
            {companyLogo && (
              <div className="hidden sm:block h-8 w-8 overflow-hidden rounded-md p-0.5">
                <img src={companyLogo} alt={companyName} className="h-full w-full object-contain" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-foreground capitalize">
              {currentPage}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold">
                      {user ? getInitials(user.name) : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {user?.name || 'User'}
                    </p>
                    <span
                      className={cn(
                        'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5',
                        getRoleBadgeColor(user?.role || '')
                      )}
                    >
                      {user?.role || 'Unknown'}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                    <span
                      className={cn(
                        'inline-block self-start text-[10px] font-semibold px-2 py-0.5 rounded',
                        getRoleBadgeColor(user?.role || '')
                      )}
                    >
                      {user?.role}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleNavigateSettings}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:text-red-400 dark:focus:bg-red-950/30"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="mx-auto max-w-6xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
