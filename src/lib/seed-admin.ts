import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import { getDatabaseUrl } from './database'

/**
 * 管理员账号初始化
 * - 从环境变量读取 ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME
 * - 若数据库中不存在该邮箱的用户，则创建管理员账号
 * - 若已存在，则将其角色更新为 admin（确保配置文件始终具有最高优先级）
 */
export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const username = process.env.ADMIN_USERNAME || 'Admin'

  if (!email || !password) {
    console.log('⏭️  [SeedAdmin] ADMIN_EMAIL 或 ADMIN_PASSWORD 未配置，跳过管理员初始化')
    return
  }

  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    console.error('❌ [SeedAdmin] 数据库未配置，跳过管理员初始化')
    return
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()

    const hashedPassword = await bcrypt.hash(password, 10)

    // 检查邮箱是否已存在
    const existing = await client.query(
      'SELECT id, role FROM users WHERE email = $1',
      [email]
    )

    if (existing.rowCount && existing.rowCount > 0) {
      // 用户已存在 —— 确保角色为 admin 并更新密码
      const user = existing.rows[0]
      if (user.role !== 'admin') {
        await client.query(
          'UPDATE users SET role = $1, password = $2 WHERE id = $3',
          ['admin', hashedPassword, user.id]
        )
        console.log(`✅ [SeedAdmin] 已将用户 ${email} 提升为管理员`)
      } else {
        // 仅更新密码，保持与配置文件同步
        await client.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        )
        console.log(`✅ [SeedAdmin] 管理员 ${email} 已存在，密码已同步`)
      }
    } else {
      // 检查用户名是否冲突
      const usernameExists = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      )

      const finalUsername = usernameExists.rowCount && usernameExists.rowCount > 0
        ? `${username}_${Date.now()}`
        : username

      await client.query(
        `INSERT INTO users (username, email, password, role, drawing_points, creation_count, checkin_count)
         VALUES ($1, $2, $3, 'admin', 9999, 0, 0)`,
        [finalUsername, email, hashedPassword]
      )
      console.log(`✅ [SeedAdmin] 管理员账号创建成功: ${email} (${finalUsername})`)
    }
  } catch (error) {
    console.error('❌ [SeedAdmin] 管理员初始化失败:', error)
  } finally {
    await client.end()
  }
}
