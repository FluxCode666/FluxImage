import { Client } from 'pg'

async function check() {
  const c = new Client({ connectionString: 'postgresql://admin:123456@localhost:5432/nano_banana' })
  await c.connect()

  const tables = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  )
  console.log('📋 数据库表:', tables.rows.map(r => r.tablename).join(', '))

  const migrations = await c.query('SELECT version, name, execution_ms, executed_at FROM _migrations ORDER BY version')
  console.log('📦 迁移记录:')
  for (const m of migrations.rows) {
    console.log(`  V${m.version} - ${m.name} (${m.execution_ms}ms, ${m.executed_at})`)
  }

  await c.end()
}

check()
