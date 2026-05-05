/**
 * 数据库连接配置工具
 * - 从拆分的环境变量构建 PostgreSQL 连接串
 * - 自动设置 DATABASE_URL 供 Prisma 使用
 */

export function getDatabaseUrl(): string | undefined {
  // 兼容：若直接配置了 DATABASE_URL 则优先使用
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.DB_HOST
  const port = process.env.DB_PORT || '5432'
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const dbName = process.env.DB_NAME
  const timezone = process.env.DB_TIMEZONE || 'Asia/Shanghai'

  if (!host || !user || !password || !dbName) {
    return undefined
  }

  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?options=-c%20timezone%3D${encodeURIComponent(timezone)}`

  // 同步设置 DATABASE_URL，供 Prisma 等依赖该变量的库使用
  process.env.DATABASE_URL = url

  return url
}
