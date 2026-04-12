import { db } from '@/lib/db'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORT'
  | 'EXPORT'
  | 'BULK_CREATE'

export type AuditEntityType =
  | 'Proposal'
  | 'Client'
  | 'TeamMember'
  | 'Setting'
  | 'ThematicArea'
  | 'Resource'
  | 'ResourceFolder'
  | 'Backup'

interface AuditLogParams {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  entityName?: string
  details?: string
  userId?: string
  userName?: string
  userRole?: string
  userAgent?: string
  ipAddress?: string
}

/**
 * Log an audit event to the database.
 * This is a fire-and-forget operation - errors are logged but don't propagate.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || '',
        entityName: params.entityName || '',
        details: params.details || '',
        userId: params.userId || '',
        userName: params.userName || '',
        userRole: params.userRole || '',
        userAgent: params.userAgent || '',
        ipAddress: params.ipAddress || '',
      },
    })
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('[Audit] Failed to log audit event:', error)
  }
}

/**
 * Extract user info from request headers (X-User-* custom headers set by frontend)
 */
export function getUserFromHeaders(headers: Headers): {
  userId: string
  userName: string
  userRole: string
} {
  return {
    userId: headers.get('x-user-id') || '',
    userName: headers.get('x-user-name') || 'System',
    userRole: headers.get('x-user-role') || '',
  }
}

/**
 * Extract client info from request
 */
export function getClientInfo(request: Request): {
  userAgent: string
  ipAddress: string
} {
  const userAgent = request.headers.get('user-agent') || ''
  // Try to get IP from standard headers
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return { userAgent, ipAddress }
}

/**
 * Convenience: log audit from a NextRequest with user context
 */
export async function logAuditFromRequest(
  request: Request,
  params: Omit<AuditLogParams, 'userId' | 'userName' | 'userRole' | 'userAgent' | 'ipAddress'>
): Promise<void> {
  const { userId, userName, userRole } = getUserFromHeaders(request.headers)
  const { userAgent, ipAddress } = getClientInfo(request)

  return logAudit({
    ...params,
    userId,
    userName,
    userRole,
    userAgent,
    ipAddress,
  })
}
