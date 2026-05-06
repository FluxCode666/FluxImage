import axios from 'axios'
import FormData from 'form-data'
import { getEnabledModels, getSystemConfig, ProviderInfo } from './config-service'

class AIService {
  private async withRetry<T>(fn: () => Promise<T>, retries = 1, label = ''): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error: unknown) {
        const code = (error as { code?: string }).code
        const isRetryable = code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ENOTFOUND'
        if (isRetryable && attempt < retries) {
          const delay = (attempt + 1) * 5000
          console.warn(`⚠️ ${label} 网络错误(${code})，${delay / 1000}s 后重试 (${attempt + 1}/${retries})...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw error
      }
    }
    throw new Error('unreachable')
  }

  async getAvailableModels() {
    const models = await getEnabledModels()
    return models.map(model => ({
      id: model.modelId,
      name: model.displayName,
      description: model.description,
      icon: model.icon,
      points_cost: model.pointsCost,
    }))
  }

  private async getTimeout(): Promise<number> {
    const val = await getSystemConfig('ai_timeout')
    const sec = parseInt(val || '180')
    return (isNaN(sec) || sec < 10 ? 180 : sec) * 1000
  }

  private extractImageSize(imageData: Record<string, unknown>) {
    if (imageData.width && imageData.height) {
      return { width: imageData.width as number, height: imageData.height as number }
    }
    if (imageData.size && typeof imageData.size === 'string') {
      const match = imageData.size.match(/(\d+)x(\d+)/)
      if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) }
    }
    return null
  }

  async generateImage(params: {
    prompt: string
    model?: string
    size?: string
    width?: number | string
    height?: number | string
    n?: number
    quality?: string
    style?: string
    responseFormat?: string
    apiKey?: string | null
    baseUrl?: string | null
  }) {
    const {
      prompt, model = 'gpt-4o-image', n = 1,
      quality = 'standard', style = 'vivid', responseFormat = 'url',
      size, width, height, apiKey = null, baseUrl = null,
    } = params

    if (!apiKey || !baseUrl) {
      return { success: false, error: 'API 配置缺失，请在管理后台配置 API Key 和域名' }
    }
    const finalApiKey = apiKey
    const finalBaseURL = baseUrl
    let finalSize = (size && size !== 'auto') ? size : undefined
    if (width && height) finalSize = `${width}x${height}`

    const requestData: Record<string, unknown> = {
      model, prompt, n, response_format: responseFormat,
    }
    // gpt-image-2 不支持 quality / style 参数
    if (model !== 'gpt-image-2') {
      requestData.quality = quality
      requestData.style = style
    }
    if (finalSize) requestData.size = finalSize
    if (width) requestData.width = parseInt(String(width))
    if (height) requestData.height = parseInt(String(height))

    console.log('🎨 开始[文生图]:', { model, size: finalSize })

    try {
      const timeout = await this.getTimeout()
      const response = await this.withRetry(
        () => axios.post(`${finalBaseURL}/v1/images/generations`, requestData, {
          headers: { Authorization: `Bearer ${finalApiKey}`, 'Content-Type': 'application/json' },
          timeout,
        }),
        2,
        '[文生图]'
      )

      if (response.data?.data && Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map((item: Record<string, unknown>) => {
          const sizeInfo = this.extractImageSize(item)
          if (sizeInfo) {
            item.width = sizeInfo.width
            item.height = sizeInfo.height
            item.size = `${sizeInfo.width}x${sizeInfo.height}`
          } else if (width && height) {
            item.width = parseInt(String(width))
            item.height = parseInt(String(height))
            item.size = finalSize
          }
          return item
        })
      }

      return { success: true, data: response.data }
    } catch (error) {
      console.error('❌ [文生图]失败:', error)
      return { success: false, error: this.formatError(error) }
    }
  }

  async editImage(params: {
    prompt: string
    images: { buffer: Buffer; originalname: string }[]
    model?: string
    size?: string
    width?: number | string | null
    height?: number | string | null
    n?: number
    responseFormat?: string
    apiKey?: string | null
    baseUrl?: string | null
  }) {
    const {
      prompt, images, model = 'gpt-4o-image', size, width, height,
      n = 1, responseFormat = 'url', apiKey = null, baseUrl = null,
    } = params

    if (!apiKey || !baseUrl) {
      return { success: false, error: 'API 配置缺失，请在管理后台配置 API Key 和域名' }
    }
    const finalApiKey = apiKey
    const finalBaseURL = baseUrl
    let finalSize = size
    if (width && height) finalSize = `${width}x${height}`

    const form = new FormData()
    form.append('prompt', prompt)
    if (images && Array.isArray(images)) {
      images.forEach((file) => form.append('image', file.buffer, { filename: file.originalname }))
    }
    form.append('model', model)
    form.append('n', n.toString())
    form.append('response_format', responseFormat)
    if (finalSize) {
      form.append('size', finalSize)
      if (width) form.append('width', String(width))
      if (height) form.append('height', String(height))
    }

    console.log('🎨 开始[图生图]...')

    try {
      const timeout = await this.getTimeout()
      const response = await this.withRetry(
        () => axios.post(`${finalBaseURL}/v1/images/edits`, form, {
          headers: { Authorization: `Bearer ${finalApiKey}`, ...form.getHeaders() },
          timeout,
        }),
        2,
        '[图生图]'
      )

      if (response.data?.data) {
        response.data.data = response.data.data.map((item: Record<string, unknown>) => {
          const sizeInfo = this.extractImageSize(item)
          if (sizeInfo) {
            item.width = sizeInfo.width; item.height = sizeInfo.height
            item.size = `${sizeInfo.width}x${sizeInfo.height}`
          } else if (width && height) {
            item.width = parseInt(String(width)); item.height = parseInt(String(height))
            item.size = finalSize
          }
          return item
        })
      }

      return { success: true, data: response.data }
    } catch (error) {
      console.error('❌ [图生图]失败:', error)
      return { success: false, error: this.formatError(error) }
    }
  }


  async generateTitleAndCategory(prompt: string, apiKey: string, baseUrl: string): Promise<{ title: string; category: string }> {
    const CATEGORIES = ['人物', '风景', '动漫', '写实', '抽象', '科幻', '美食', '动物', '建筑', '其他']
    const fallback = { title: prompt.slice(0, 30), category: '其他' }
    try {
      const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一个图片标题和分类生成器。根据用户的绘图提示词，生成一个简短有吸引力的中文标题（不超过20字）和一个分类。
分类只能从以下选项中选择：${CATEGORIES.join('、')}
请严格以 JSON 格式回复，不要包含其他内容：{"title":"标题","category":"分类"}`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      })
      const text = response.data?.choices?.[0]?.message?.content?.trim() || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        const title = (parsed.title || '').slice(0, 50) || fallback.title
        const category = CATEGORIES.includes(parsed.category) ? parsed.category : '其他'
        return { title, category }
      }
    } catch (error) {
      console.error('生成标题/分类失败:', (error as Error).message)
    }
    return fallback
  }

  /** 带 fallback 的文生图：按优先级逐个尝试供应商 */
  async generateImageWithFallback(params: {
    prompt: string
    model?: string
    size?: string
    width?: number | string
    height?: number | string
    n?: number
    quality?: string
    style?: string
    responseFormat?: string
    providers: ProviderInfo[]
  }) {
    const { providers, ...rest } = params
    const errors: string[] = []
    for (const provider of providers) {
      console.log(`🔄 尝试供应商: ${provider.name} (priority=${provider.priority})`)
      const result = await this.generateImage({
        ...rest,
        apiKey: provider.apiKey,
        baseUrl: provider.apiBaseUrl,
        responseFormat: provider.responseFormat || 'url',
      })
      if (result.success) {
        return { ...result, usedProvider: provider.name }
      }
      const errMsg = `[${provider.name}] ${result.error}`
      errors.push(errMsg)
      console.warn(`⚠️ 供应商 ${provider.name} 失败: ${result.error}，尝试下一个...`)
    }
    return { success: false as const, error: `所有供应商均失败: ${errors.join('; ')}` }
  }

  /** 带 fallback 的图生图：按优先级逐个尝试供应商 */
  async editImageWithFallback(params: {
    prompt: string
    images: { buffer: Buffer; originalname: string }[]
    model?: string
    size?: string
    width?: number | string | null
    height?: number | string | null
    n?: number
    responseFormat?: string
    providers: ProviderInfo[]
  }) {
    const { providers, ...rest } = params
    const errors: string[] = []
    for (const provider of providers) {
      console.log(`🔄 尝试供应商: ${provider.name} (priority=${provider.priority})`)
      const result = await this.editImage({
        ...rest,
        apiKey: provider.apiKey,
        baseUrl: provider.apiBaseUrl,
        responseFormat: provider.responseFormat || 'url',
      })
      if (result.success) {
        return { ...result, usedProvider: provider.name }
      }
      const errMsg = `[${provider.name}] ${result.error}`
      errors.push(errMsg)
      console.warn(`⚠️ 供应商 ${provider.name} 失败: ${result.error}，尝试下一个...`)
    }
    return { success: false as const, error: `所有供应商均失败: ${errors.join('; ')}` }
  }

  /** 带 fallback 的标题分类生成 */
  async generateTitleAndCategoryWithFallback(prompt: string, providers: ProviderInfo[]): Promise<{ title: string; category: string }> {
    for (const provider of providers) {
      try {
        return await this.generateTitleAndCategory(prompt, provider.apiKey, provider.apiBaseUrl)
      } catch {
        console.warn(`标题生成供应商 ${provider.name} 失败，尝试下一个...`)
      }
    }
    return { title: prompt.slice(0, 30), category: '其他' }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response
      if (status === 401) return 'AI服务认证失败，请检查API密钥'
      if (status === 429) return 'AI服务请求频率过高'
      return data?.error?.message || `请求失败 (${status})`
    }
    return (error as Error).message || '未知错误'
  }
}

export const aiService = new AIService()
