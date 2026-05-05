import { prisma } from './db'

interface CacheEntry<T> {
  data: T
  expiry: number
}

const CACHE_TTL = 60_000 // 60s
const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expiry > Date.now()) return entry.data as T
  cache.delete(key)
  return null
}

function setCache<T>(key: string, data: T) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL })
}

export function invalidateConfigCache() {
  cache.clear()
}

export const DEFAULT_SITE_NAME = 'FluxImage'
export const DEFAULT_SITE_SUBTITLE = 'AI Creative Studio'

// ── 系统全局配置 ──────────────────────────────────

export async function getSystemConfig(key: string): Promise<string | null> {
  const cacheKey = `sys:${key}`
  const cached = getCached<string | null>(cacheKey)
  if (cached !== null) return cached

  const row = await prisma.systemConfig.findUnique({ where: { configKey: key } })
  const value = row?.configValue ?? null
  setCache(cacheKey, value)
  return value
}

export async function setSystemConfig(key: string, value: string) {
  await prisma.systemConfig.upsert({
    where: { configKey: key },
    update: { configValue: value, updatedAt: new Date() },
    create: { configKey: key, configValue: value },
  })
  invalidateConfigCache()
}

export async function getAllSystemConfig(): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany()
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.configKey] = row.configValue ?? ''
  }
  return result
}

export async function getSiteConfig(): Promise<{ siteName: string; siteSubtitle: string }> {
  try {
    const [siteName, siteSubtitle] = await Promise.all([
      getSystemConfig('site_name'),
      getSystemConfig('site_subtitle'),
    ])

    return {
      siteName: siteName?.trim() || DEFAULT_SITE_NAME,
      siteSubtitle: siteSubtitle?.trim() || DEFAULT_SITE_SUBTITLE,
    }
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME,
      siteSubtitle: DEFAULT_SITE_SUBTITLE,
    }
  }
}

// ── 用户自定义 API 开关 ──────────────────────────────

export async function isCustomApiAllowed(): Promise<boolean> {
  const val = await getSystemConfig('allow_custom_api')
  return val !== 'false' // 默认 true
}

// ── 模型配置 ──────────────────────────────────────

export interface ModelInfo {
  id: number
  modelId: string
  displayName: string
  icon: string
  description: string
  apiBaseUrl: string | null
  apiKey: string | null
  isEnabled: boolean
  sortOrder: number
  pointsCost: number
}

export async function getEnabledModels(): Promise<ModelInfo[]> {
  const cached = getCached<ModelInfo[]>('models:enabled')
  if (cached) return cached

  const rows = await prisma.modelConfig.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  })

  const models: ModelInfo[] = rows.map(r => ({
    id: r.id,
    modelId: r.modelId,
    displayName: r.displayName,
    icon: r.icon,
    description: r.description,
    apiBaseUrl: r.apiBaseUrl,
    apiKey: r.apiKey,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
    pointsCost: r.pointsCost,
  }))

  setCache('models:enabled', models)
  return models
}

export async function getAllModels(): Promise<ModelInfo[]> {
  const rows = await prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } })
  return rows.map(r => ({
    id: r.id,
    modelId: r.modelId,
    displayName: r.displayName,
    icon: r.icon,
    description: r.description,
    apiBaseUrl: r.apiBaseUrl,
    apiKey: r.apiKey,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
    pointsCost: r.pointsCost,
  }))
}

export async function getModelConfig(modelId: string): Promise<ModelInfo | null> {
  const row = await prisma.modelConfig.findUnique({ where: { modelId } })
  if (!row) return null
  return {
    id: row.id,
    modelId: row.modelId,
    displayName: row.displayName,
    icon: row.icon,
    description: row.description,
    apiBaseUrl: row.apiBaseUrl,
    apiKey: row.apiKey,
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
    pointsCost: row.pointsCost,
  }
}

// ── 获取模型最终 API 配置（模型级 > 全局默认） ────────

export async function getApiConfigForModel(modelId: string): Promise<{ apiKey: string; baseUrl: string } | null> {
  const model = await getModelConfig(modelId)

  const apiKey = model?.apiKey || await getSystemConfig('default_api_key')
  const baseUrl = model?.apiBaseUrl || await getSystemConfig('default_api_base_url')

  if (!apiKey || !baseUrl) return null
  return { apiKey, baseUrl }
}
