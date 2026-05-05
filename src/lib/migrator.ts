import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getDatabaseUrl } from './database'

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

/**
 * SQL 迁移系统
 * - 启动时自动检查并执行未运行的 SQL 迁移文件
 * - 迁移文件放在 migrations/ 目录下，命名格式: V001__description.sql
 * - 使用 _migrations 表记录已执行的迁移和校验和
 */
export async function runMigrations() {
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    console.error('❌ [Migrator] 数据库未配置，跳过数据库迁移')
    return
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    console.log('🔌 [Migrator] 数据库连接成功')

    // 1. 确保迁移记录表存在
    await ensureMigrationsTable(client)

    // 2. 获取已执行的迁移
    const executed = await getExecutedMigrations(client)

    // 3. 扫描迁移文件
    const pending = getPendingMigrations(executed)

    if (pending.length === 0) {
      console.log('✅ [Migrator] 数据库已是最新，无需迁移')
      return
    }

    console.log(`📦 [Migrator] 发现 ${pending.length} 个待执行迁移`)

    // 4. 按顺序执行迁移
    for (const migration of pending) {
      await executeMigration(client, migration)
    }

    console.log('✅ [Migrator] 所有迁移执行完成')
  } catch (error) {
    console.error('❌ [Migrator] 迁移执行失败:', error)
    throw error
  } finally {
    await client.end()
  }
}

/**
 * 创建迁移记录表（若不存在）
 */
async function ensureMigrationsTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id            SERIAL PRIMARY KEY,
      version       VARCHAR(20) NOT NULL UNIQUE,
      name          VARCHAR(255) NOT NULL,
      checksum      VARCHAR(64) NOT NULL,
      executed_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      execution_ms  INT NOT NULL DEFAULT 0
    )
  `)
}

/**
 * 获取已执行的迁移版本号集合
 */
async function getExecutedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query('SELECT version FROM _migrations ORDER BY version')
  return new Set(result.rows.map(r => r.version))
}

interface MigrationFile {
  version: string
  name: string
  filename: string
  filepath: string
}

/**
 * 扫描 migrations/ 目录，返回未执行的迁移文件列表（已排序）
 */
function getPendingMigrations(executed: Set<string>): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn('⚠️ [Migrator] migrations/ 目录不存在，跳过')
    return []
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && /^V\d+__/.test(f))
    .sort()

  const pending: MigrationFile[] = []

  for (const filename of files) {
    // 解析文件名: V001__init_tables.sql -> version=001, name=init_tables
    const match = filename.match(/^V(\d+)__(.+)\.sql$/)
    if (!match) continue

    const version = match[1]
    if (executed.has(version)) continue

    pending.push({
      version,
      name: match[2],
      filename,
      filepath: path.join(MIGRATIONS_DIR, filename),
    })
  }

  return pending
}

/**
 * 执行单个迁移文件
 */
async function executeMigration(client: Client, migration: MigrationFile) {
  const sql = fs.readFileSync(migration.filepath, 'utf-8')
  const checksum = crypto.createHash('sha256').update(sql).digest('hex').substring(0, 16)

  console.log(`🔄 [Migrator] 执行迁移 V${migration.version} - ${migration.name}...`)

  const start = Date.now()

  try {
    // 在事务中执行迁移SQL
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO _migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)',
      [migration.version, migration.name, checksum, Date.now() - start]
    )
    await client.query('COMMIT')

    console.log(`  ✅ V${migration.version} 完成 (${Date.now() - start}ms)`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`  ❌ V${migration.version} 失败:`, error)
    throw error
  }
}
