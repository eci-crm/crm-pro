import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { getClientInfo } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // POST /api/auth/logout
    if (action === 'logout') {
      const { userId, userName, userRole } = getUserFromHeaders(request.headers)
      await logAudit({
        action: 'LOGOUT',
        entityType: 'TeamMember',
        details: 'User logged out',
        userId,
        userName,
        userRole,
      })
      return NextResponse.json({ success: true })
    }

    // POST /api/auth/login
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const member = await db.teamMember.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'Account deactivated' },
        { status: 403 }
      )
    }

    if (member.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Audit log for login
    const { userAgent, ipAddress } = getClientInfo(request)
    await logAudit({
      action: 'LOGIN',
      entityType: 'TeamMember',
      entityId: member.id,
      entityName: member.name,
      details: `User logged in: ${member.name} (${member.email})`,
      userName: member.name,
      userRole: member.role,
      userId: member.id,
      userAgent,
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}

function getUserFromHeaders(headers: Headers) {
  return {
    userId: headers.get('x-user-id') || '',
    userName: headers.get('x-user-name') || 'System',
    userRole: headers.get('x-user-role') || '',
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    const member = await db.teamMember.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user: member })
  } catch (error) {
    console.error('[Auth] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/auth - Change own password
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword } = body

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'User ID, current password, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'New password must be at least 4 characters' },
        { status: 400 }
      )
    }

    const member = await db.teamMember.findUnique({
      where: { id: userId },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (member.password !== currentPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    await db.teamMember.update({
      where: { id: userId },
      data: { password: newPassword },
    })

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    console.error('[Auth] PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
