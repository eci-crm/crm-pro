'use client'

import { useQuery } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  FileText,
  Trophy,
  Clock,
  Users,
  LayoutDashboard,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatusData {
  status: string
  count: number
  totalValue: number
}

interface DeadlineItem {
  id: string
  name: string
  deadline: string
  status: string
  client: { id: string; name: string }
}

interface RecentProposal {
  id: string
  name: string
  status: string
  value: number
  createdAt: string
  client: { id: string; name: string }
}

interface DashboardData {
  clients: { total: number; active: number }
  proposals: {
    total: number
    totalValue: number
    wonValue: number
    byStatus: StatusData[]
  }
  upcomingDeadlines: DeadlineItem[]
  recentProposals: RecentProposal[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Won: '#22c55e',
  Submitted: '#3b82f6',
  'In Process': '#f59e0b',
  'In Evaluation': '#a855f7',
  Pending: '#ef4444',
}

const STATUS_BG_CLASSES: Record<string, string> = {
  Won: 'bg-green-100 text-green-800 border-green-200',
  Submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  'In Process': 'bg-amber-100 text-amber-800 border-amber-200',
  'In Evaluation': 'bg-purple-100 text-purple-800 border-purple-200',
  Pending: 'bg-red-100 text-red-800 border-red-200',
}

const DEADLINE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  overdue: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  urgent: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  safe: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
}

const pkrFormat = (value: number) =>
  `PKR ${new Intl.NumberFormat('en-PK').format(value)}`

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  return res.json()
}

// ─── Deadline Helpers ────────────────────────────────────────────────────────

function getDeadlineColor(daysRemaining: number) {
  if (daysRemaining <= 0) return DEADLINE_COLORS.overdue
  if (daysRemaining <= 2) return DEADLINE_COLORS.urgent
  if (daysRemaining <= 5) return DEADLINE_COLORS.warning
  return DEADLINE_COLORS.safe
}

function getDeadlineLabel(daysRemaining: number) {
  if (daysRemaining <= 0) return 'Due today'
  if (daysRemaining === 1) return '1 day left'
  return `${daysRemaining} days left`
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function DeadlinesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-60" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-52" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Summary Card ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  borderColor: string
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  borderColor,
}: SummaryCardProps) {
  return (
    <Card className={cn('relative overflow-hidden border-l-4', borderColor)}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconBg)}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Custom Tooltip for Charts ───────────────────────────────────────────────

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-foreground">{item.name}</p>
      <p className="text-sm text-muted-foreground">{item.value} proposals</p>
    </div>
  )
}

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { fill: string } }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{pkrFormat(payload[0].value)}</p>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  })

  const wonStatus = data?.proposals.byStatus.find((s) => s.status === 'Won')
  const inProcessStatus = data?.proposals.byStatus.find((s) => s.status === 'In Process')
  const wonCount = wonStatus?.count ?? 0
  const wonValue = data?.proposals.wonValue ?? 0
  const inProcessCount = inProcessStatus?.count ?? 0

  // Chart data — filter out statuses with 0 count
  const pieData = (data?.proposals.byStatus ?? []).filter((s) => s.count > 0)
  const barData = (data?.proposals.byStatus ?? []).filter((s) => s.totalValue > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your proposals, clients, and upcoming deadlines
          </p>
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              title="Total Proposals"
              value={data?.proposals.total ?? 0}
              subtitle={pkrFormat(data?.proposals.totalValue ?? 0)}
              icon={FileText}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              borderColor="border-l-blue-500"
            />
            <SummaryCard
              title="Won Proposals"
              value={wonCount}
              subtitle={pkrFormat(wonValue)}
              icon={Trophy}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              borderColor="border-l-green-500"
            />
            <SummaryCard
              title="In Progress"
              value={inProcessCount}
              subtitle="Currently active"
              icon={Clock}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              borderColor="border-l-amber-500"
            />
            <SummaryCard
              title="Active Clients"
              value={data?.clients.active ?? 0}
              subtitle={`of ${data?.clients.total ?? 0} total`}
              icon={Users}
              iconBg="bg-violet-100"
              iconColor="text-violet-600"
              borderColor="border-l-violet-500"
            />
          </>
        )}
      </div>

      {/* ── Proposal Status Charts ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
                    <LayoutDashboard className="h-4 w-4 text-blue-600" />
                  </div>
                  Proposal Status Distribution
                </CardTitle>
                <CardDescription>Breakdown of proposals by current status</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">No proposals yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="status"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] ?? '#94a3b8'}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => (
                          <span className="text-xs text-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-100">
                    <Trophy className="h-4 w-4 text-green-600" />
                  </div>
                  Proposal Value by Status
                </CardTitle>
                <CardDescription>Total monetary value across proposal statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">No proposal values yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={barData}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="status"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={false}
                        tickFormatter={(v: number) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
                          return String(v)
                        }}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar
                        dataKey="totalValue"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={52}
                      >
                        {barData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] ?? '#94a3b8'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Upcoming Deadlines ───────────────────────────────────────────── */}
      {isLoading ? (
        <DeadlinesSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-100">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>
              Proposals due within the next 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.upcomingDeadlines.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No upcoming deadlines
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  You&apos;re all caught up! No proposals due in the next 7 days.
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {data.upcomingDeadlines.map((item) => {
                    const deadlineDate = new Date(item.deadline)
                    const daysLeft = differenceInDays(deadlineDate, new Date())
                    const colorInfo = getDeadlineColor(daysLeft)
                    const label = getDeadlineLabel(daysLeft)

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-4 rounded-lg border p-3 transition-colors',
                          colorInfo.bg
                        )}
                      >
                        <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colorInfo.dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.client.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-muted-foreground">
                            {format(deadlineDate, 'MMM dd, yyyy')}
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-xs font-semibold',
                              colorInfo.text
                            )}
                          >
                            {label}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Recent Proposals Table ───────────────────────────────────────── */}
      {isLoading ? (
        <RecentTableSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                <FileText className="h-4 w-4 text-slate-600" />
              </div>
              Recent Proposals
            </CardTitle>
            <CardDescription>
              Last 5 proposals created in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.recentProposals.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No proposals yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Start by creating your first proposal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Proposal</TableHead>
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Value</TableHead>
                      <TableHead className="text-right font-semibold">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentProposals.map((proposal) => (
                      <TableRow key={proposal.id}>
                        <TableCell className="font-medium text-foreground">
                          {proposal.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {proposal.client.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px] font-medium',
                              STATUS_BG_CLASSES[proposal.status] ?? 'bg-gray-100 text-gray-800 border-gray-200'
                            )}
                          >
                            {proposal.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {pkrFormat(proposal.value)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {format(new Date(proposal.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              Failed to load dashboard data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
