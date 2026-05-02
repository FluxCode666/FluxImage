import axios from 'axios'
import FormData from 'form-data'

class AIService {
  private defaultBaseURL: string
  private defaultApiKey: string
  private timeout: number

  constructor() {
    this.defaultBaseURL = process.env.AI_API_BASE_URL || ''
    this.defaultApiKey = process.env.AI_API_KEY || ''
    this.timeout = 180000
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

    const finalApiKey = apiKey || this.defaultApiKey
    const finalBaseURL = baseUrl || this.defaultBaseURL
    let finalSize = size || '1024x1024'
    if (width && height) finalSize = `${width}x${height}`

    const requestData: Record<string, unknown> = {
      model, prompt, n, size: finalSize, quality, style, response_format: responseFormat,
    }
    if (width) requestData.width = parseInt(String(width))
    if (height) requestData.height = parseInt(String(height))

    console.log('🎨 开始[文生图]:', { model, size: finalSize })

    try {
      const response = await axios.post(`${finalBaseURL}/v1/images/generations`, requestData, {
        headers: { Authorization: `Bearer ${finalApiKey}`, 'Content-Type': 'application/json' },
        timeout: this.timeout,
      })

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

    const finalApiKey = apiKey || this.defaultApiKey
    const finalBaseURL = baseUrl || this.defaultBaseURL
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
      const response = await axios.post(`${finalBaseURL}/v1/images/edits`, form, {
        headers: { Authorization: `Bearer ${finalApiKey}`, ...form.getHeaders() },
        timeout: this.timeout,
      })

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

  async getAvailableModels() {
    const modelData: Record<string, { name: string; description: string; icon: string }> = {
      'gpt-4o-image': { name: 'GPT-4o-Image', description: '智能图像生成', icon: '🌟' },
      'nano-banana': { name: 'Nano Banana', description: '快速生成', icon: '🍌' },
      'nano-banana-hd': { name: 'Nano Banana HD', description: '高清品质', icon: '🍌✨' },
      'nano-banana-2': { name: 'Nano Banana 2.0', description: '旗舰模型', icon: '🚀' },
    }
    return Object.keys(modelData).map((key) => ({ id: key, ...modelData[key] }))
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
