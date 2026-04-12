import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Track whether auto-setup has been attempted this process lifetime
let setupAttempted = false

/**
 * Ensures the database has required data (team members, settings, etc.).
 * Runs once per process lifetime. Safe to call from any API route.
 */
export async function ensureDatabase(): Promise<boolean> {
  if (setupAttempted) return true
  setupAttempted = true

  try {
    // Check if team members already exist
    const count = await db.teamMember.count()
    if (count > 0) return true
  } catch (error) {
    console.error('[DB] Database not accessible:', error)
    return false
  }

  // First-time setup: seed default team members and settings
  try {
    console.log('[DB] First-time setup: seeding default data...')

    // Create default admin users
    const members = [
      { name: 'Ahmed Khan', email: 'ahmed@crmpro.com', password: 'admin123', role: 'Admin' },
      { name: 'Sara Ali', email: 'sara@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Usman Tariq', email: 'usman@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Fatima Noor', email: 'fatima@crmpro.com', password: 'admin123', role: 'Admin' },
      { name: 'Bilal Ahmed', email: 'bilal@crmpro.com', password: 'member123', role: 'Member' },
      { name: 'Ayesha Siddiqui', email: 'ayesha@crmpro.com', password: 'manager123', role: 'Manager' },
    ]

    for (const m of members) {
      await db.teamMember.create({ data: m }).catch(() => {
        // Ignore unique constraint errors (user already exists)
      })
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

    console.log('[DB] Default data seeded successfully')
    return true
  } catch (error) {
    console.error('[DB] Failed to seed database:', error)
    return false
  }
}
