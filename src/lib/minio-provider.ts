import * as Minio from 'minio'
import { getSystemConfig } from './config-service'
import type { StorageProvider } from './storage-service'

interface MinioConfig {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
  domain: string  // 公开访问域名
}

async function getMinioConfig(): Promise<MinioConfig> {
  const [endPoint, port, useSSL, accessKey, secretKey, bucket, domain] = await Promise.all([
    getSystemConfig('minio_endpoint'),
    getSystemConfig('minio_port'),
    getSystemConfig('minio_use_ssl'),
    getSystemConfig('minio_access_key'),
    getSystemConfig('minio_secret_key'),
    getSystemConfig('minio_bucket'),
    getSystemConfig('minio_domain'),
  ])

  if (!endPoint || !accessKey || !secretKey || !bucket || !domain) {
    throw new Error('MinIO 配置不完整，请在管理后台配置 Endpoint/AccessKey/SecretKey/Bucket/Domain')
  }

  return {
    endPoint,
    port: parseInt(port || '9000'),
    useSSL: useSSL === 'true',
    accessKey,
    secretKey,
    bucket,
    domain,
  }
}

function createClient(config: MinioConfig): Minio.Client {
  return new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  })
}

export async function createMinioProvider(): Promise<StorageProvider> {
  const config = await getMinioConfig()
  const client = createClient(config)

  return {
    async uploadBuffer(buffer: Buffer, key: string): Promise<string> {
      await client.putObject(config.bucket, key, buffer, buffer.length, {
        'Content-Type': 'image/png',
      })
      return key
    },

    async downloadToBuffer(key: string): Promise<Buffer> {
      const stream = await client.getObject(config.bucket, key)
      const chunks: Buffer[] = []
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    },

    async deleteFile(key: string): Promise<void> {
      await client.removeObject(config.bucket, key)
    },

    buildPublicUrl(key: string): string {
      const domain = config.domain.replace(/\/+$/, '')
      if (domain.endsWith(`/${config.bucket}`)) {
        return `${domain}/${key}`
      }
      return `${domain}/${config.bucket}/${key}`
    },

    async fileExists(key: string): Promise<boolean> {
      try {
        await client.statObject(config.bucket, key)
        return true
      } catch {
        return false
      }
    },

    async cleanupOldFiles(days: number): Promise<number> {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
      let deletedCount = 0

      const stream = client.listObjectsV2(config.bucket, '', true)
      const toDelete: string[] = []

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.lastModified && obj.lastModified.getTime() < cutoffTime && obj.name) {
            toDelete.push(obj.name)
          }
        })
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      if (toDelete.length > 0) {
        await client.removeObjects(config.bucket, toDelete)
        deletedCount = toDelete.length
      }

      return deletedCount
    },
  }
}
