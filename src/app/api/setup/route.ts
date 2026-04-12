import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/setup — Initialize the database with seed data
// Called automatically on first visit after Vercel deployment
export async function POST() {
  try {
    // Check if already set up
    const count = await db.teamMember.count()
    if (count > 0) {
      return NextResponse.json({ message: 'Database already initialized', teamMemberCount: count })
    }

    console.log('[Setup] Initializing database with seed data...')

    // Create default team members
    const members = [
      { name: 'Ahmed Khan', email: 'ahmed@crmpro.com', password: 'admin123', role: 'Admin' },
      { name: 'Sara Ali', email: 'sara@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Usman Tariq', email: 'usman@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Fatima Noor', email: 'fatima@crmpro.com', password: 'admin123', role: 'Admin' },
      { name: 'Bilal Ahmed', email: 'bilal@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Ayesha Siddiqui', email: 'ayesha@crmpro.com', password: 'manager123', role: 'Manager' },
    ]

    for (const m of members) {
      await db.teamMember.create({ data: m }).catch(() => {})
    }

    // Create default settings
    const settings = [
      { key: 'companyName', value: 'ECI CRM' },
      { key: 'companyTagline', value: 'Empowering Business Growth' },
      { key: 'companyLogo', value: '' },
    ]

    for (const s of settings) {
      await db.setting.upsert({
        where: { key: s.key },
        update: {},
        create: s,
      }).catch(() => {})
    }

    // Create default thematic areas
    const areas = [
      { name: 'IT & Technology', color: '#3b82f6', sortOrder: 1 },
      { name: 'Healthcare', color: '#10b981', sortOrder: 2 },
      { name: 'Education', color: '#f59e0b', sortOrder: 3 },
      { name: 'Infrastructure', color: '#8b5cf6', sortOrder: 4 },
      { name: 'Finance & Banking', color: '#ef4444', sortOrder: 5 },
    ]

    for (const a of areas) {
      await db.thematicArea.create({ data: a }).catch(() => {})
    }

    // Create sample clients
    const clients = [
      { name: 'Pakistan Telecommunication Company (PTCL)', address: 'Islamabad', status: 'Active' },
      { name: 'National Bank of Pakistan', address: 'Karachi', status: 'Active' },
      { name: 'Water and Power Development Authority (WAPDA)', address: 'Lahore', status: 'Active' },
      { name: 'Pakistan Steel Mills', address: 'Karachi', status: 'Active' },
      { name: 'Pakistan International Airlines (PIA)', address: 'Karachi', status: 'Active' },
      { name: 'Ministry of Information Technology', address: 'Islamabad', status: 'Active' },
      { name: 'Sindh Health Department', address: 'Karachi', status: 'Active' },
      { name: 'Punjab Education Department', address: 'Lahore', status: 'Active' },
      { name: 'K-Electric', address: 'Karachi', status: 'Active' },
    ]

    for (const c of clients) {
      await db.client.create({ data: c }).catch(() => {})
    }

    console.log('[Setup] Database initialized successfully')

    return NextResponse.json({
      message: 'Database initialized successfully',
      teamMembers: members.length,
      clients: clients.length,
      thematicAreas: areas.length,
    })
  } catch (error) {
    console.error('[Setup] Failed to initialize database:', error)
    return NextResponse.json(
      { error: 'Failed to initialize database: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// GET /api/setup — Check if database is initialized
export async function GET() {
  try {
    const count = await db.teamMember.count()
    return NextResponse.json({
      initialized: count > 0,
      teamMemberCount: count,
    })
  } catch (error) {
    console.error('[Setup] Database check failed:', error)
    return NextResponse.json(
      { initialized: false, error: 'Database not accessible' },
      { status: 500 }
    )
  }
}
