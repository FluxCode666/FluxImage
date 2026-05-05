import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { redis } from './redis'
import { getDatabaseUrl } from './database'

// ─── Redis Streams 配置 ───
const STREAM_KEY = 'stream:upload:retry'
const GROUP_NAME = 'upload-retry-group'
const CONSUMER_NAME = `consumer-${process.pid}`
const MAX_RETRIES = 20

// ─── 本地兜底路径 ───
function getFallbackDir(): string {
  const configured = process.env.LOCAL_FALLBACK_PATH || './uploads'
  const dir = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 初始化 Stream 消费者组（幂等）
 */
async function ensureConsumerGroup() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM')
    console.log(`📥 [Stream] 消费者组 ${GROUP_NAME} 已创建`)
  } catch (e) {
    // BUSYGROUP = 已存在，忽略
    if (!(e as Error).message?.includes('BUSYGROUP')) {
      throw e
    }
  }
}

/**
 * 将文件保存到本地兜底目录，并发布到 Redis Stream
 */
export async function saveToLocal(buffer: Buffer, key: string): Promise<string> {
  const dir = getFallbackDir()
  const localPath = path.join(dir, key)
  const localDir = path.dirname(localPath)
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true })
  }

  fs.writeFileSync(localPath, buffer)
  console.log(`⚠️ [Fallback] OSS 上传失败，已保存到本地: ${localPath}`)

  // 写入数据库记录
  const client = new Client({ connectionString: getDatabaseUrl() })
  try {
    await client.connect()
    await client.query(
      `INSERT INTO pending_uploads (file_key, local_path, status) VALUES ($1, $2, 'pending')
       ON CONFLICT DO NOTHING`,
      [key, localPath]
    )
  } catch (dbErr) {
    console.error('⚠️ [Fallback] 写入 pending_uploads 失败:', dbErr)
  } finally {
    await client.end()
  }

  // 发布到 Redis Stream
  try {
    await redis.xadd(STREAM_KEY, '*', 'key', key, 'localPath', localPath, 'retryCount', '0')
    console.log(`📤 [Stream] 已发布重试消息: ${key}`)
  } catch (mqErr) {
    console.error('⚠️ [Stream] 发布消息失败:', mqErr)
  }

  return key
}

/**
 * 从本地兜底目录读取文件
 */
export function readLocalFile(key: string): Buffer | null {
  const dir = getFallbackDir()
  const localPath = path.join(dir, key)
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath)
  }
  return null
}

/**
 * 检查文件是否存在于本地兜底目录
 */
export function isLocalFallbackFile(key: string): boolean {
  const dir = getFallbackDir()
  const localPath = path.join(dir, key)
  return fs.existsSync(localPath)
}

/**
 * 处理单条 Stream 消息
 */
async function processMessage(
  msgId: string,
  fields: Record<string, string>,
): Promise<void> {
  const { key, localPath, retryCount: retryCountStr } = fields
  const retryCount = parseInt(retryCountStr || '0')
  const client = new Client({ connectionString: getDatabaseUrl() })

  try {
    await client.connect()

    if (!fs.existsSync(localPath)) {
      await client.query(
        `UPDATE pending_uploads SET status = 'missing', updated_at = NOW() WHERE file_key = $1 AND status = 'pending'`,
        [key]
      )
      console.warn(`⚠️ [Stream] 本地文件不存在: ${localPath}`)
      await redis.xack(STREAM_KEY, GROUP_NAME, msgId)
      return
    }

    const buffer = fs.readFileSync(localPath)
    const { getStorageProvider } = await import('./storage-service')
    const provider = await getStorageProvider()
    await provider.uploadBuffer(buffer, key)

    // 上传成功
    fs.unlinkSync(localPath)
    await client.query(
      `UPDATE pending_uploads SET status = 'uploaded', updated_at = NOW() WHERE file_key = $1 AND status = 'pending'`,
      [key]
    )
    await redis.xack(STREAM_KEY, GROUP_NAME, msgId)
    console.log(`✅ [Stream] 重试上传成功: ${key}`)
  } catch (e) {
    const newRetryCount = retryCount + 1

    // 更新数据库重试次数
    await client.query(
      `UPDATE pending_uploads SET retry_count = $2, error = $3, updated_at = NOW() WHERE file_key = $1 AND status = 'pending'`,
      [key, newRetryCount, (e as Error).message]
    ).catch(() => {})

    // ACK 当前消息（不让它永远 pending）
    await redis.xack(STREAM_KEY, GROUP_NAME, msgId)

    if (newRetryCount < MAX_RETRIES) {
      // 指数退避后重新发布新消息
      const delaySec = Math.min(30 * Math.pow(2, Math.min(newRetryCount, 8)), 86400)
      setTimeout(async () => {
        try {
          await redis.xadd(STREAM_KEY, '*', 'key', key, 'localPath', localPath, 'retryCount', String(newRetryCount))
        } catch {}
      }, delaySec * 1000)
      console.error(`❌ [Stream] 重试失败 (第${newRetryCount}次), ${delaySec}s 后重试: ${key}`)
    } else {
      console.error(`❌ [Stream] 重试次数已达上限(${MAX_RETRIES})，放弃: ${key}`)
    }
  } finally {
    await client.end()
  }
}

/**
 * 启动 Redis Stream 消费者
 */
export async function startRetryConsumer() {
  await ensureConsumerGroup()
  console.log(`📥 [Stream] 消费者 ${CONSUMER_NAME} 已启动`)

  // 1. 先处理该消费者之前未 ACK 的消息（崩溃恢复）
  await claimPendingMessages()

  // 2. 持续消费新消息
  consumeLoop()
}

/**
 * 认领并处理该消费者之前未 ACK 的 pending 消息
 */
async function claimPendingMessages() {
  try {
    const pending = await redis.xpending(STREAM_KEY, GROUP_NAME, '-', '+', 100) as unknown[][]
    if (!pending || pending.length === 0) return

    console.log(`� [Stream] 发现 ${pending.length} 条未确认消息，正在恢复...`)
    const msgIds = pending.map((p: unknown[]) => p[0] as string)

    // XCLAIM: 将超过 30s 未 ACK 的消息认领到当前消费者
    const claimed = await redis.xclaim(
      STREAM_KEY, GROUP_NAME, CONSUMER_NAME, 30000, ...msgIds
    ) as [string, string[]][]

    for (const [id, fieldArray] of claimed) {
      const fields: Record<string, string> = {}
      for (let i = 0; i < fieldArray.length; i += 2) {
        fields[fieldArray[i]] = fieldArray[i + 1]
      }
      await processMessage(id, fields)
    }
  } catch (e) {
    console.error('⚠️ [Stream] 恢复 pending 消息失败:', (e as Error).message)
  }
}

/**
 * 主消费循环
 */
function consumeLoop() {
  let running = true

  async function loop() {
    while (running) {
      try {
        // XREADGROUP: 阻塞读取新消息，超时 5 秒
        const results = await redis.xreadgroup(
          'GROUP', GROUP_NAME, CONSUMER_NAME,
          'COUNT', 10, 'BLOCK', 5000,
          'STREAMS', STREAM_KEY, '>'
        ) as [string, [string, string[]][]][] | null

        if (!results) continue

        for (const [, messages] of results) {
          for (const [msgId, fieldArray] of messages) {
            const fields: Record<string, string> = {}
            for (let i = 0; i < fieldArray.length; i += 2) {
              fields[fieldArray[i]] = fieldArray[i + 1]
            }
            await processMessage(msgId, fields)
          }
        }
      } catch (e) {
        console.error('❌ [Stream] 消费异常:', (e as Error).message)
        await new Promise(r => setTimeout(r, 5000))
      }
    }
  }

  loop()
  return () => { running = false }
}

/**
 * 将数据库中残留的 pending 记录重新发布到 Stream（应用重启时调用）
 */
export async function requeuePendingUploads() {
  const client = new Client({ connectionString: getDatabaseUrl() })
  try {
    await client.connect()
    const { rows } = await client.query(
      `SELECT file_key, local_path, retry_count FROM pending_uploads WHERE status = 'pending' AND retry_count < $1`,
      [MAX_RETRIES]
    )
    if (rows.length === 0) return
    console.log(`📥 [Stream] 恢复 ${rows.length} 个待重试上传到 Stream`)
    for (const row of rows) {
      await redis.xadd(STREAM_KEY, '*', 'key', row.file_key, 'localPath', row.local_path, 'retryCount', String(row.retry_count || 0))
    }
  } catch (e) {
    console.error('⚠️ [Stream] 恢复待重试队列失败:', e)
  } finally {
    await client.end()
  }
}
