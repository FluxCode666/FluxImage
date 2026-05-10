import axios from 'axios'
import { getSystemConfig } from './config-service'

// ─── 抽象存储接口 ───
export interface StorageProvider {
  /** 上传 Buffer，返回存储 key */
  uploadBuffer(buffer: Buffer, key: string): Promise<string>
  /** 根据 key 下载文件为 Buffer */
  downloadToBuffer(key: string): Promise<Buffer>
  /** 删除单个文件 */
  deleteFile(key: string): Promise<void>
  /** 根据存储 key 构建公开访问 URL */
  buildPublicUrl(key: string): string
  /** 检查文件是否存在 */
  fileExists(key: string): Promise<boolean>
  /** 列出并清理超过指定天数的文件，返回删除数量 */
  cleanupOldFiles(days: number): Promise<number>
}

// ─── 获取当前活跃的存储类型 ───
export async function getActiveStorageType(): Promise<string> {
  const provider = await getSystemConfig('storage_provider')
  return provider || 'qiniu'
}

// ─── Provider 缓存 ───
let cachedProvider: StorageProvider | null = null
let cachedProviderType: string | null = null

export function invalidateStorageCache() {
  cachedProvider = null
  cachedProviderType = null
}

// ─── 工厂：获取当前 Provider 实例 ───
export async function getStorageProvider(): Promise<StorageProvider> {
  const type = await getActiveStorageType()
  if (cachedProvider && cachedProviderType === type) return cachedProvider

  if (type === 'minio') {
    const { createMinioProvider } = await import('./minio-provider')
    cachedProvider = await createMinioProvider()
  } else if (type === 'seaweedfs') {
    const { createSeaweedFSProvider } = await import('./seaweedfs-provider')
    cachedProvider = await createSeaweedFSProvider()
  } else {
    const { createQiniuProvider } = await import('./qiniu-provider')
    cachedProvider = await createQiniuProvider()
  }
  cachedProviderType = type
  return cachedProvider!
}

// ─── 获取指定类型的 Provider（用于迁移） ───
export async function getProviderByType(type: string): Promise<StorageProvider> {
  if (type === 'minio') {
    const { createMinioProvider } = await import('./minio-provider')
    return createMinioProvider()
  } else if (type === 'seaweedfs') {
    const { createSeaweedFSProvider } = await import('./seaweedfs-provider')
    return createSeaweedFSProvider()
  } else {
    const { createQiniuProvider } = await import('./qiniu-provider')
    return createQiniuProvider()
  }
}

// ─── 对外统一 API（所有业务代码调用这些） ───

export async function uploadFromUrl(remoteUrl: string, key: string): Promise<string> {
  const response = await axios({ url: remoteUrl, responseType: 'arraybuffer', timeout: 120000 })
  const buffer = Buffer.from(response.data)
  try {
    const provider = await getStorageProvider()
    return await provider.uploadBuffer(buffer, key)
  } catch (e) {
    console.error('⚠️ [Storage] OSS 上传失败，启用本地兜底:', (e as Error).message)
    const { saveToLocal } = await import('./local-fallback')
    return saveToLocal(buffer, key)
  }
}

export async function uploadBuffer(buffer: Buffer, key: string): Promise<string> {
  try {
    const provider = await getStorageProvider()
    return await provider.uploadBuffer(buffer, key)
  } catch (e) {
    console.error('⚠️ [Storage] OSS 上传失败，启用本地兜底:', (e as Error).message)
    const { saveToLocal } = await import('./local-fallback')
    return saveToLocal(buffer, key)
  }
}

export async function buildPublicUrl(key: string): Promise<string> {
  if (!key) return key
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  if (key.startsWith('/uploads/')) return key
  // 检查是否是本地兜底文件（OSS 上传失败暂存本地的）
  const { isLocalFallbackFile } = await import('./local-fallback')
  if (isLocalFallbackFile(key)) {
    return `/uploads/${key}`
  }
  const provider = await getStorageProvider()
  return provider.buildPublicUrl(key)
}

export async function deleteFile(key: string): Promise<void> {
  const provider = await getStorageProvider()
  return provider.deleteFile(key)
}

export async function cleanupOldFiles(days: number): Promise<number> {
  const provider = await getStorageProvider()
  return provider.cleanupOldFiles(days)
}

export async function fileExists(key: string): Promise<boolean> {
  if (!key) return false
  if (key.startsWith('http://') || key.startsWith('https://')) return true
  if (key.startsWith('/uploads/')) {
    const fs = await import('fs')
    const path = await import('path')
    return fs.existsSync(path.join(process.cwd(), 'public', key))
  }
  const { isLocalFallbackFile } = await import('./local-fallback')
  if (isLocalFallbackFile(key)) {
    const fs = await import('fs')
    const path = await import('path')
    return fs.existsSync(path.join(process.cwd(), 'public/uploads', key))
  }
  const provider = await getStorageProvider()
  return provider.fileExists(key)
}
