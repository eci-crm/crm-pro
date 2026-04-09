'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isAfter,
  isBefore,
  addDays,
} from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  User,
  FileText,
  AlertCircle,
  TrendingUp,
  Briefcase,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ── Types ──────────────────────────────────────────────────────────

interface Proposal {
  id: string
  name: string
  rfpNumber: string
  status: string
  value: number
  deadline: string | null
  submissionDate: string | null
  remarks: string
  client: { id: string; name: string; status: string } | null
  assignedMember: { id: string; name: string; email: string; role: string } | null
}

interface CalendarEvent {
  date: Date
  proposal: Proposal
}

// ── Helpers ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Submitted: 'bg-blue-500',
  Won: 'bg-emerald-500',
  'In Process': 'bg-amber-500',
  'In Evaluation': 'bg-purple-500',
  Pending: 'bg-orange-500',
  Lost: 'bg-red-500',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  Submitted:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'In Process':
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'In Evaluation':
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  Pending:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  Lost: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Component ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)

  // Fetch all proposals
  const {
    data: proposals = [],
    isLoading,
    isError,
  } = useQuery<Proposal[]>({
    queryKey: ['proposals-calendar'],
    queryFn: async () => {
      const res = await fetch('/api/proposals')
      if (!res.ok) throw new Error('Failed to fetch proposals')
      return res.json()
    },
  })

  if (isError) {
    toast.error('Failed to load proposals')
  }

  // Build events map: proposals with deadlines
  const events = useMemo<CalendarEvent[]>(() => {
    return proposals
      .filter((p) => p.deadline)
      .map((p) => ({
        date: parseISO(p.deadline!),
        proposal: p,
      }))
  }, [proposals])

  // Events for the current visible month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const monthEvents = useMemo(
    () => events.filter((e) => isSameMonth(e.date, currentMonth)),
    [events, currentMonth]
  )

  // Upcoming deadlines: next 5 from today
  const upcomingDeadlines = useMemo(() => {
    const today = new Date()
    return events
      .filter((e) => isAfter(e.date, today) || isSameDay(e.date, today))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
  }, [events])

  // Events on a specific date
  const getEventsForDate = (date: Date) =>
    events.filter((e) => isSameDay(e.date, date))

  // Navigate months
  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1))
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(null)
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    const dayEvents = getEventsForDate(date)
    if (dayEvents.length === 1) {
      setSelectedProposal(dayEvents[0].proposal)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        </div>
      </div>

      {/* Upcoming Deadlines Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No upcoming deadlines in the next period.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {upcomingDeadlines.map((ue, idx) => (
                <button
                  key={ue.proposal.id}
                  onClick={() => {
                    setCurrentMonth(ue.date)
                    setSelectedDate(ue.date)
                    setSelectedProposal(ue.proposal)
                  }}
                  className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <div
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[ue.proposal.status] || 'bg-gray-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ue.proposal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(ue.date, 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {ue.proposal.client?.name || 'No client'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Grid + Event List */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Calendar Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevMonth} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="min-w-[160px] text-center text-lg font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-semibold uppercase text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1 mt-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="min-h-[80px] rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1 mt-1">
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDate(day)
                  const inMonth = isSameMonth(day, currentMonth)
                  const today = isToday(day)
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={`min-h-[80px] p-1 border rounded-md text-left transition-colors cursor-pointer overflow-hidden
                        ${!inMonth ? 'bg-muted/30 border-muted/50 opacity-50' : 'bg-background border-border hover:bg-accent/40'}
                        ${today ? 'ring-2 ring-primary ring-offset-1' : ''}
                        ${isSelected ? 'bg-accent border-primary/50' : ''}
                      `}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                          ${today ? 'bg-primary text-primary-foreground' : ''}
                          ${!today && inMonth ? 'text-foreground' : ''}
                          ${!inMonth ? 'text-muted-foreground' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.proposal.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedProposal(ev.proposal)
                            }}
                            className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] leading-tight text-white truncate cursor-pointer hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor:
                                ev.proposal.status === 'Submitted'
                                  ? '#3b82f6'
                                  : ev.proposal.status === 'Won'
                                    ? '#10b981'
                                    : ev.proposal.status === 'In Process'
                                      ? '#f59e0b'
                                      : ev.proposal.status === 'In Evaluation'
                                        ? '#a855f7'
                                        : ev.proposal.status === 'Pending'
                                          ? '#f97316'
                                          : ev.proposal.status === 'Lost'
                                            ? '#ef4444'
                                            : '#6b7280',
                            }}
                          >
                            <span className="truncate">{ev.proposal.name}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="block px-1 text-[10px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event List Sidebar */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {selectedDate
                ? format(selectedDate, 'MMMM d, yyyy')
                : format(currentMonth, 'MMMM yyyy')}{' '}
              Events
            </CardTitle>
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(null)}
                className="ml-auto -mt-2 -mr-2 h-auto p-1 text-xs"
              >
                Show all this month
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : (() => {
              const listEvents = selectedDate
                ? getEventsForDate(selectedDate)
                : monthEvents
              const sortedList = [...listEvents].sort(
                (a, b) => a.date.getTime() - b.date.getTime()
              )

              if (sortedList.length === 0) {
                return (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {selectedDate
                      ? 'No events on this date.'
                      : 'No deadlines this month.'}
                  </p>
                )
              }

              return (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {sortedList.map((ev) => (
                      <button
                        key={ev.proposal.id}
                        onClick={() => setSelectedProposal(ev.proposal)}
                        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[ev.proposal.status] || 'bg-gray-400'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {ev.proposal.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(ev.date, 'MMM d')} &middot;{' '}
                              {ev.proposal.client?.name || 'No client'}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE_COLORS[ev.proposal.status] || ''}`}
                              >
                                {ev.proposal.status}
                              </Badge>
                              {ev.proposal.value > 0 && (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {formatCurrency(ev.proposal.value)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Event Detail Dialog */}
      <Dialog
        open={!!selectedProposal}
        onOpenChange={(open) => !open && setSelectedProposal(null)}
      >
        <DialogContent className="sm:max-w-md">
          {selectedProposal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  {selectedProposal.name}
                </DialogTitle>
                <DialogDescription>
                  Proposal deadline details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE_COLORS[selectedProposal.status] || ''}
                  >
                    {selectedProposal.status}
                  </Badge>
                </div>

                <Separator />

                {/* Details Grid */}
                <div className="grid gap-3">
                  {/* Client */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="text-sm font-medium">
                        {selectedProposal.client?.name || 'No client assigned'}
                      </p>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="text-sm font-medium">
                        {selectedProposal.value > 0
                          ? formatCurrency(selectedProposal.value)
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Deadline</p>
                      <p className="text-sm font-medium">
                        {selectedProposal.deadline
                          ? format(parseISO(selectedProposal.deadline), 'MMMM d, yyyy')
                          : 'Not set'}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Member */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned To</p>
                      <p className="text-sm font-medium">
                        {selectedProposal.assignedMember?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>

                  {/* RFP Number */}
                  {selectedProposal.rfpNumber && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">RFP Number</p>
                        <p className="text-sm font-medium">
                          {selectedProposal.rfpNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                {selectedProposal.remarks && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Remarks
                      </p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedProposal.remarks}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
