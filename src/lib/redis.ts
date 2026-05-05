import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

function createRedisClient() {
  // 兼容：若直接配置了 REDIS_URL 则优先使用
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('❌ Redis 连接失败，停止重试')
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })
  }

  const host = process.env.REDIS_HOST || 'localhost'
  const port = parseInt(process.env.REDIS_PORT || '6379')
  const password = process.env.REDIS_PASSWORD || undefined
  const db = parseInt(process.env.REDIS_DB || '0')

  return new Redis({
    host,
    port,
    password,
    db,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        console.error('❌ Redis 连接失败，停止重试')
        return null
      }
      return Math.min(times * 200, 2000)
    },
  })
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// 验证码相关操作
export async function setVerificationCode(email: string, code: string) {
  await redis.set(`verify:${email}`, code, 'EX', 300) // 5分钟过期
}

export async function getVerificationCode(email: string): Promise<string | null> {
  return redis.get(`verify:${email}`)
}

export async function deleteVerificationCode(email: string) {
  await redis.del(`verify:${email}`)
}
