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
export const DEFAULT_PROMPT_MAX_LENGTH = 5000

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

export async function getSiteConfig(): Promise<{ siteName: string; siteSubtitle: string; promptMaxLength: number }> {
  try {
    const [siteName, siteSubtitle, promptMaxLength] = await Promise.all([
      getSystemConfig('site_name'),
      getSystemConfig('site_subtitle'),
      getSystemConfig('prompt_max_length'),
    ])

    return {
      siteName: siteName?.trim() || DEFAULT_SITE_NAME,
      siteSubtitle: siteSubtitle?.trim() || DEFAULT_SITE_SUBTITLE,
      promptMaxLength: parseInt(promptMaxLength || '') || DEFAULT_PROMPT_MAX_LENGTH,
    }
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME,
      siteSubtitle: DEFAULT_SITE_SUBTITLE,
      promptMaxLength: DEFAULT_PROMPT_MAX_LENGTH,
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
  isEnabled: boolean
  sortOrder: number
  pointsCost: number
}

// ── 供应商配置 ──────────────────────────────────────

export interface ProviderInfo {
  id: number
  name: string
  apiBaseUrl: string
  apiKey: string
  priority: number
  isEnabled: boolean
  supportedModels: string[] // modelId 数组，["*"] 表示支持所有
  responseFormat: string // 'url' | 'b64_json'
  providerType: string // 'openai' | 'modelscope'
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
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
    pointsCost: row.pointsCost,
  }
}

// ── 供应商查询 ──────────────────────────────────────

function parseProviderRow(r: { id: number; name: string; apiBaseUrl: string; apiKey: string; priority: number; isEnabled: boolean; supportedModels: string; responseFormat: string; providerType?: string; createdAt: Date; updatedAt: Date }): ProviderInfo {
  let models: string[] = []
  try { models = JSON.parse(r.supportedModels) } catch { models = [] }
  return {
    id: r.id,
    name: r.name,
    apiBaseUrl: r.apiBaseUrl,
    apiKey: r.apiKey,
    priority: r.priority,
    isEnabled: r.isEnabled,
    supportedModels: models,
    responseFormat: r.responseFormat || 'url',
    providerType: r.providerType || 'openai',
  }
}

export async function getAllProviders(): Promise<ProviderInfo[]> {
  const rows = await prisma.apiProvider.findMany({ orderBy: { priority: 'desc' } })
  return rows.map(parseProviderRow)
}

export async function getEnabledProviders(): Promise<ProviderInfo[]> {
  const cached = getCached<ProviderInfo[]>('providers:enabled')
  if (cached) return cached

  const rows = await prisma.apiProvider.findMany({
    where: { isEnabled: true },
    orderBy: { priority: 'desc' },
  })
  const providers = rows.map(parseProviderRow)
  setCache('providers:enabled', providers)
  return providers
}

/** 获取支持指定模型的已启用供应商列表（按 priority 降序） */
export async function getProvidersForModel(modelId: string): Promise<ProviderInfo[]> {
  const all = await getEnabledProviders()
  return all.filter(p =>
    p.supportedModels.includes('*') || p.supportedModels.includes(modelId)
  )
}

// ── 获取模型的 API 配置（通过供应商调度） ────────

export async function getApiConfigForModel(modelId: string): Promise<{ apiKey: string; baseUrl: string } | null> {
  const providers = await getProvidersForModel(modelId)
  if (providers.length === 0) return null
  return { apiKey: providers[0].apiKey, baseUrl: providers[0].apiBaseUrl }
}
