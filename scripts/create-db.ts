import { Client } from 'pg'

/**
 * 创建 nano_banana 数据库（若不存在）
 * 使用方式: npx tsx scripts/create-db.ts
 */
async function createDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'admin',
    password: '123456',
    database: 'postgres', // 连接默认库来创建新库
  })

  try {
    await client.connect()
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'nano_banana'"
    )
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE nano_banana')
      console.log('✅ 数据库 nano_banana 创建成功')
    } else {
      console.log('✅ 数据库 nano_banana 已存在')
    }
  } catch (error) {
    console.error('❌ 创建数据库失败:', error)
  } finally {
    await client.end()
  }
}

createDatabase()
