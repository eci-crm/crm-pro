// Fix: System-level DATABASE_URL overrides .env (points to old SQLite).
// Set the correct PostgreSQL URL directly before Prisma initializes.
const pgUrl = 'postgresql://neondb_owner:npg_D5KcnuZLVX9d@ep-red-cell-a4ps8e2n-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
const pgDirectUrl = 'postgresql://neondb_owner:npg_D5KcnuZLVX9d@ep-red-cell-a4ps8e2n.us-east-1.aws.neon.tech/neondb?sslmode=require'

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = pgUrl
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = pgDirectUrl
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
