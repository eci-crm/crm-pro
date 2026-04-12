import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || ''
    const entityType = searchParams.get('entityType') || ''
    const userId = searchParams.get('userId') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Prisma.AuditLogWhereInput = {}

    if (action) {
      where.action = action
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (userId) {
      where.userId = userId
    }

    if (search) {
      where.OR = [
        { entityName: { contains: search } },
        { userName: { contains: search } },
        { details: { contains: search } },
      ]
    }

    if (startDate || endDate) {
      const createdAtFilter: Prisma.DateTimeFilter<'AuditLog'> = {}
      if (startDate) {
        createdAtFilter.gte = new Date(startDate)
      }
      if (endDate) {
        // End of day for endDate
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        createdAtFilter.lte = end
      }
      where.createdAt = createdAtFilter
    }

    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 100), // Cap at 100
      }),
      db.auditLog.count({
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    ])

    // Get summary stats
    const [actionStats, entityTypeStats] = await Promise.all([
      db.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      db.auditLog.groupBy({
        by: ['entityType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    // Get most recent activity per day (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const activityByDay = await db.auditLog.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    })

    // Group activity by date
    const activityTimeline: Record<string, number> = {}
    for (const item of activityByDay) {
      const dateKey = item.createdAt.toISOString().split('T')[0]
      activityTimeline[dateKey] = (activityTimeline[dateKey] || 0) + item._count.id
    }

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        actionStats: actionStats.map((s) => ({
          action: s.action,
          count: s._count.id,
        })),
        entityTypeStats: entityTypeStats.map((s) => ({
          entityType: s.entityType,
          count: s._count.id,
        })),
        activityTimeline,
      },
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
