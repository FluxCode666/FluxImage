import { Client } from 'pg'
import bcrypt from 'bcryptjs'

async function createTestUser() {
  const c = new Client({ connectionString: 'postgresql://admin:123456@localhost:5432/nano_banana' })
  await c.connect()

  const hash = await bcrypt.hash('123456', 10)
  const exists = await c.query("SELECT id FROM users WHERE email='test@test.com'")

  if (exists.rowCount === 0) {
    await c.query(
      `INSERT INTO users (username, email, password, role, drawing_points) VALUES ($1, $2, $3, $4, $5)`,
      ['TestAdmin', 'test@test.com', hash, 'admin', 100]
    )
    console.log('✅ 测试用户创建成功: test@test.com / 123456 (admin)')
  } else {
    console.log('✅ 测试用户已存在')
  }

  await c.end()
}

createTestUser()
