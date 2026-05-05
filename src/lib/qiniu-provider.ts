import qiniu from 'qiniu'
import axios from 'axios'
import { getSystemConfig } from './config-service'
import type { StorageProvider } from './storage-service'

interface QiniuConfig {
  accessKey: string
  secretKey: string
  bucket: string
  domain: string
}

async function getQiniuConfig(): Promise<QiniuConfig> {
  const [accessKey, secretKey, bucket, domain] = await Promise.all([
    getSystemConfig('qiniu_access_key'),
    getSystemConfig('qiniu_secret_key'),
    getSystemConfig('qiniu_bucket'),
    getSystemConfig('qiniu_domain'),
  ])

  if (!accessKey || !secretKey || !bucket || !domain) {
    throw new Error('七牛云配置不完整，请在管理后台配置 AccessKey/SecretKey/Bucket/Domain')
  }
  return { accessKey, secretKey, bucket, domain }
}

function getUploadToken(config: QiniuConfig, key: string): string {
  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
  const putPolicy = new qiniu.rs.PutPolicy({ scope: `${config.bucket}:${key}` })
  return putPolicy.uploadToken(mac)
}

function getZoneConfig(): qiniu.conf.Config {
  return new qiniu.conf.Config()
}

export async function createQiniuProvider(): Promise<StorageProvider> {
  const config = await getQiniuConfig()

  return {
    async uploadBuffer(buffer: Buffer, key: string): Promise<string> {
      const token = getUploadToken(config, key)
      const formUploader = new qiniu.form_up.FormUploader(getZoneConfig())
      const putExtra = new qiniu.form_up.PutExtra()

      return new Promise((resolve, reject) => {
        formUploader.put(token, key, buffer, putExtra, (err, body, info) => {
          if (err) return reject(err)
          if (info.statusCode === 200) {
            resolve(key)
          } else {
            reject(new Error(`七牛上传失败: ${info.statusCode} - ${JSON.stringify(body)}`))
          }
        })
      })
    },

    async downloadToBuffer(key: string): Promise<Buffer> {
      const domain = config.domain.replace(/\/+$/, '')
      const url = `${domain}/${key}`
      const response = await axios({ url, responseType: 'arraybuffer', timeout: 120000 })
      return Buffer.from(response.data)
    },

    async deleteFile(key: string): Promise<void> {
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
      const bucketManager = new qiniu.rs.BucketManager(mac, getZoneConfig())

      return new Promise((resolve, reject) => {
        bucketManager.delete(config.bucket, key, (err, _body, info) => {
          if (err) return reject(err)
          if (info.statusCode === 200 || info.statusCode === 612) {
            resolve()
          } else {
            reject(new Error(`七牛删除失败: ${info.statusCode}`))
          }
        })
      })
    },

    buildPublicUrl(key: string): string {
      const domain = config.domain.replace(/\/+$/, '')
      return `${domain}/${key}`
    },

    async cleanupOldFiles(days: number): Promise<number> {
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
      const bucketManager = new qiniu.rs.BucketManager(mac, getZoneConfig())

      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
      const cutoffPutTime = cutoffTime * 10000

      let deletedCount = 0
      let marker: string | undefined = undefined
      const limit = 1000

      do {
        const result = await new Promise<{ items: Array<{ key: string; putTime: number }>; marker?: string }>((resolve, reject) => {
          bucketManager.listPrefix(config.bucket, {
            limit,
            marker: marker || '',
            prefix: '',
          }, (err, body, info) => {
            if (err) return reject(err)
            if (info.statusCode !== 200) return reject(new Error(`列举文件失败: ${info.statusCode}`))
            resolve({ items: body.items || [], marker: body.marker })
          })
        })

        const toDelete = result.items.filter(item => item.putTime < cutoffPutTime)

        if (toDelete.length > 0) {
          const deleteOps = toDelete.map(item => qiniu.rs.deleteOp(config.bucket, item.key))

          for (let i = 0; i < deleteOps.length; i += 1000) {
            const batch = deleteOps.slice(i, i + 1000)
            await new Promise<void>((resolve, reject) => {
              bucketManager.batch(batch, (err, _body, info) => {
                if (err) return reject(err)
                if (info.statusCode === 200 || info.statusCode === 298) {
                  resolve()
                } else {
                  reject(new Error(`批量删除失败: ${info.statusCode}`))
                }
              })
            })
          }

          deletedCount += toDelete.length
        }

        marker = result.marker
      } while (marker)

      return deletedCount
    },
  }
}
