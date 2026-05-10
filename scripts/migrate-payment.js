// 临时脚本：为支付功能建表
const fs = require('fs')
const path = require('path')
const envPath = path.resolve(__dirname, '..', '.env')
console.log('Reading env from:', envPath)
const envFile = fs.readFileSync(envPath, 'utf8')
envFile.split('\n').forEach(line => {
  line = line.replace(/\r$/, '')
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
})

const host = process.env.DB_HOST
const port = process.env.DB_PORT || '5432'
const user = process.env.DB_USER
const pw = process.env.DB_PASSWORD
const db = process.env.DB_NAME

console.log('DB_HOST:', host, 'DB_USER:', user, 'DB_NAME:', db, 'DB_PASSWORD:', pw ? '***' : 'MISSING')

if (!host || !user || !pw || !db) {
  console.error('Missing DB env vars. Trying DATABASE_URL from env...')
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL either. Exiting.')
    process.exit(1)
  }
}

const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pw)}@${host}:${port}/${db}`
process.env.DATABASE_URL = url
console.log('DATABASE_URL configured for', host + ':' + port + '/' + db)

const { execSync } = require('child_process')
try {
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } })
  console.log('DB push done!')
} catch (e) {
  console.error('DB push failed:', e.message)
  process.exit(1)
}
