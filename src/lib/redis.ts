import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return new Redis(url, {
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
