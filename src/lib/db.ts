import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // In production on Vercel, use connection pooling
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      log: ['error'],
    })
  }

  // Development: direct connection
  return new PrismaClient({
    log: ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
