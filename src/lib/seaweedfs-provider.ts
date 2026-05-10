import axios from 'axios'
import { getSystemConfig } from './config-service'
import type { StorageProvider } from './storage-service'

interface SeaweedFSConfig {
  masterUrl: string
  filerUrl: string
  domain: string
  authUser: string
  authPassword: string
}

async function getSeaweedFSConfig(): Promise<SeaweedFSConfig> {
  const [masterUrl, filerUrl, domain, authUser, authPassword] = await Promise.all([
    getSystemConfig('seaweedfs_master_url'),
    getSystemConfig('seaweedfs_filer_url'),
    getSystemConfig('seaweedfs_domain'),
    getSystemConfig('seaweedfs_auth_user'),
    getSystemConfig('seaweedfs_auth_password'),
  ])

  if (!filerUrl || !domain) {
    throw new Error('SeaweedFS 配置不完整，请在管理后台配置 Filer URL 和公开访问域名')
  }

  return {
    masterUrl: masterUrl || '',
    filerUrl: filerUrl.replace(/\/+$/, ''),
    domain: domain.replace(/\/+$/, ''),
    authUser: authUser || '',
    authPassword: authPassword || '',
  }
}

function buildAuthHeaders(config: SeaweedFSConfig): Record<string, string> {
  if (!config.authUser) return {}
  const token = Buffer.from(`${config.authUser}:${config.authPassword}`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

export async function createSeaweedFSProvider(): Promise<StorageProvider> {
  const config = await getSeaweedFSConfig()
  const auth = buildAuthHeaders(config)

  return {
    async uploadBuffer(buffer: Buffer, key: string): Promise<string> {
      const url = `${config.filerUrl}/${key}`
      await axios.put(url, buffer, {
        headers: { 'Content-Type': 'image/png', ...auth },
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      return key
    },

    async downloadToBuffer(key: string): Promise<Buffer> {
      const url = `${config.filerUrl}/${key}`
      const response = await axios.get(url, {
        headers: { ...auth },
        responseType: 'arraybuffer',
        timeout: 120000,
      })
      return Buffer.from(response.data)
    },

    async deleteFile(key: string): Promise<void> {
      const url = `${config.filerUrl}/${key}`
      await axios.delete(url, { headers: { ...auth }, timeout: 30000 })
    },

    buildPublicUrl(key: string): string {
      if (config.authUser) {
        return `/api/image/proxy/${key}`
      }
      return `${config.domain}/${key}`
    },

    async fileExists(key: string): Promise<boolean> {
      try {
        await axios.head(`${config.filerUrl}/${key}`, { headers: { ...auth }, timeout: 5000 })
        return true
      } catch {
        return false
      }
    },

    async cleanupOldFiles(days: number): Promise<number> {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000
      let deletedCount = 0

      try {
        const listUrl = `${config.filerUrl}/images/?limit=10000`
        const res = await axios.get(listUrl, { headers: { ...auth }, timeout: 60000 })
        const entries = res.data?.Entries || res.data?.entries || []

        for (const entry of entries) {
          const name = entry.FullPath
            ? entry.FullPath.split('/').pop()
            : entry.name || entry.Name
          const mtime = entry.Mtime
            ? new Date(entry.Mtime).getTime()
            : entry.crtime
              ? new Date(entry.crtime).getTime()
              : 0

          if (mtime && mtime < cutoffTime && name) {
            try {
              await axios.delete(`${config.filerUrl}/images/${name}`, { headers: { ...auth }, timeout: 30000 })
              deletedCount++
            } catch (e) {
              console.error(`[SeaweedFS] 删除失败: images/${name}`, e)
            }
          }
        }
      } catch (e) {
        console.error('[SeaweedFS] 清理列表失败:', e)
      }

      return deletedCount
    },
  }
}
