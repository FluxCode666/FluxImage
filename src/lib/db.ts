import { PrismaClient } from '@prisma/client'
import { getDatabaseUrl } from './database'

// 确保 DATABASE_URL 在 Prisma 实例化前从拆分字段构建
getDatabaseUrl()

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
