import qiniu from 'qiniu'
import axios from 'axios'
import { getSystemConfig } from './config-service'

interface QiniuConfig {
  accessKey: string
  secretKey: string
  bucket: string
  domain: string
}

async function getQiniuConfig(): Promise<QiniuConfig | null> {
  const [accessKey, secretKey, bucket, domain] = await Promise.all([
    getSystemConfig('qiniu_access_key'),
    getSystemConfig('qiniu_secret_key'),
    getSystemConfig('qiniu_bucket'),
    getSystemConfig('qiniu_domain'),
  ])

  if (!accessKey || !secretKey || !bucket || !domain) return null
  return { accessKey, secretKey, bucket, domain }
}

function getUploadToken(config: QiniuConfig, key: string): string {
  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
  const putPolicy = new qiniu.rs.PutPolicy({ scope: `${config.bucket}:${key}` })
  return putPolicy.uploadToken(mac)
}

function getZoneConfig(): qiniu.conf.Config {
  const cfg = new qiniu.conf.Config()
  return cfg
}

/**
 * 根据存储 key 构建完整的公开访问 URL
 * 兼容旧数据：如果已经是完整 URL 或 /uploads/ 路径则原样返回
 */
export async function buildPublicUrl(key: string): Promise<string> {
  if (!key) return key
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  if (key.startsWith('/uploads/')) return key
  const config = await getQiniuConfig()
  if (!config) return key
  const domain = config.domain.replace(/\/+$/, '')
  return `${domain}/${key}`
}

/**
 * 从远程 URL 下载图片后上传到七牛 OSS，返回存储 key
 */
export async function uploadFromUrl(remoteUrl: string, key: string): Promise<string> {
  const config = await getQiniuConfig()
  if (!config) throw new Error('七牛云配置不完整，请在管理后台配置 AccessKey/SecretKey/Bucket/Domain')

  // 先下载到 Buffer
  const response = await axios({ url: remoteUrl, responseType: 'arraybuffer', timeout: 120000 })
  const buffer = Buffer.from(response.data)

  return uploadBuffer(buffer, key, config)
}

/**
 * 直接上传 Buffer 到七牛 OSS，返回存储 key
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  existingConfig?: QiniuConfig | null,
): Promise<string> {
  const config = existingConfig || await getQiniuConfig()
  if (!config) throw new Error('七牛云配置不完整，请在管理后台配置 AccessKey/SecretKey/Bucket/Domain')

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
}

/**
 * 从完整 CDN URL 中提取七牛存储 key
 */
export async function extractKeyFromUrl(url: string): Promise<string | null> {
  const config = await getQiniuConfig()
  if (!config) return null
  const domain = config.domain.replace(/\/+$/, '')
  if (url.startsWith(domain)) {
    return url.slice(domain.length + 1) // +1 for the slash
  }
  // 如果是相对路径（旧数据），返回 null
  return null
}

/**
 * 从七牛删除单个文件
 */
export async function deleteFile(key: string): Promise<void> {
  const config = await getQiniuConfig()
  if (!config) throw new Error('七牛云配置不完整')

  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
  const cfg = getZoneConfig()
  const bucketManager = new qiniu.rs.BucketManager(mac, cfg)

  return new Promise((resolve, reject) => {
    bucketManager.delete(config.bucket, key, (err, _body, info) => {
      if (err) return reject(err)
      if (info.statusCode === 200 || info.statusCode === 612) {
        resolve() // 612 = file not found, treat as success
      } else {
        reject(new Error(`七牛删除失败: ${info.statusCode}`))
      }
    })
  })
}

/**
 * 列出并清理超过指定天数的文件
 * 返回被删除的文件数量
 */
export async function cleanupOldFiles(days: number): Promise<number> {
  const config = await getQiniuConfig()
  if (!config) throw new Error('七牛云配置不完整')

  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
  const cfg = getZoneConfig()
  const bucketManager = new qiniu.rs.BucketManager(mac, cfg)

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
  // 七牛的 putTime 是以 100 纳秒为单位的
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
      // 批量删除
      const deleteOps = toDelete.map(item => qiniu.rs.deleteOp(config.bucket, item.key))

      // 每次最多 1000 个操作
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
}
