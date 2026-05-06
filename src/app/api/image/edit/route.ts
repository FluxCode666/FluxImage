import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { aiService } from '@/lib/ai-service'
import { isCustomApiAllowed, getProvidersForModel, ProviderInfo } from '@/lib/config-service'
import sharp from 'sharp'
import { uploadFromUrl, getStorageProvider } from '@/lib/storage-service'

type ApiKeyInfo =
  | { type: 'user'; key: string; baseUrl: string; shouldDeductPoints: false }
  | { type: 'providers'; providers: ProviderInfo[]; shouldDeductPoints: true }

// 后台异步执行图生图任务（fire-and-forget）
async function executeEditTask(
  taskId: number,
  userId: number,
  prompt: string,
  model: string | null,
  imageBuffers: Buffer[],
  imageNames: string[],
  targetWidth: number | null,
  targetHeight: number | null,
  apiKeyInfo: ApiKeyInfo,
) {
  try {
    await prisma.generationTask.update({ where: { id: taskId }, data: { status: 'processing' } })

    const images = imageBuffers.map((buf, i) => ({
      buffer: buf,
      originalname: imageNames[i] || `reference-${i}.png`,
    }))

    let result
    if (apiKeyInfo.type === 'user') {
      result = await aiService.editImage({
        prompt, model: model || undefined, images,
        width: targetWidth, height: targetHeight,
        apiKey: apiKeyInfo.key, baseUrl: apiKeyInfo.baseUrl,
      })
    } else {
      result = await aiService.editImageWithFallback({
        prompt, model: model || undefined, images,
        width: targetWidth, height: targetHeight,
        providers: apiKeyInfo.providers,
      })
    }

    if (!result.success) throw new Error(result.error || 'AI生成失败')

    const temporaryImageUrl = result.data?.data?.[0]?.url
    if (!temporaryImageUrl) throw new Error('AI无返回图片')

    const key = `images/${Date.now()}-${userId}-edit.png`
    const storedKey = await uploadFromUrl(temporaryImageUrl, key)

    const sizeString = targetWidth && targetHeight ? `${targetWidth}x${targetHeight}` : null

    let titleCategory
    if (apiKeyInfo.type === 'user') {
      titleCategory = await aiService.generateTitleAndCategory(prompt, apiKeyInfo.key, apiKeyInfo.baseUrl)
    } else {
      titleCategory = await aiService.generateTitleAndCategoryWithFallback(prompt, apiKeyInfo.providers)
    }

    const creation = await prisma.creation.create({
      data: { userId, prompt, imageUrl: storedKey, model: model || null, size: sizeString, title: titleCategory.title, category: titleCategory.category, createdAt: new Date() },
    })

    // 扣积分
    if (apiKeyInfo.shouldDeductPoints) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { checkinPoints: true } })
      const checkinDeduct = Math.min(currentUser?.checkinPoints || 0, 1)
      await prisma.user.update({
        where: { id: userId },
        data: {
          drawingPoints: { decrement: 1 },
          checkinPoints: { decrement: checkinDeduct },
          creationCount: { increment: 1 },
        },
      })
    }

    const generatedImage = {
      url: storedKey, prompt, model: model || null, size: sizeString,
      id: creation.id, createdAt: creation.createdAt.toISOString(),
    }

    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: JSON.stringify([generatedImage]),
        completedAt: new Date(),
      },
    })
    console.log(`[EditTask ${taskId}] 完成`)
  } catch (error) {
    console.error(`[EditTask ${taskId}] 执行失败:`, error)
    await prisma.generationTask.update({
      where: { id: taskId },
      data: { status: 'failed', error: (error as Error).message, completedAt: new Date() },
    }).catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const formData = await req.formData()
    const prompt = formData.get('prompt') as string
    const model = formData.get('model') as string | null
    const widthStr = formData.get('width') as string | null
    const heightStr = formData.get('height') as string | null
    const imageFiles = formData.getAll('image') as File[]
    const imageKeys = formData.getAll('image_key') as string[]
    const userId = authResult.id

    if (!prompt) return NextResponse.json({ error: '提示词为空' }, { status: 400 })
    if (!imageFiles.length && !imageKeys.length) return NextResponse.json({ error: '请上传图片' }, { status: 400 })

    // 收集图片 buffer 和文件名
    const imageBuffers: Buffer[] = []
    const imageNames: string[] = []
    for (const f of imageFiles) {
      imageBuffers.push(Buffer.from(await f.arrayBuffer()))
      imageNames.push(f.name)
    }
    if (imageKeys.length > 0) {
      const provider = await getStorageProvider()
      for (const key of imageKeys) {
        if (key) {
          imageBuffers.push(await provider.downloadToBuffer(key))
          imageNames.push(key.split('/').pop() || 'reference.png')
        }
      }
    }

    // 检测图片尺寸
    let targetWidth: number | null = null
    let targetHeight: number | null = null
    if (imageBuffers.length > 0) {
      try {
        const meta = await sharp(imageBuffers[0]).metadata()
        targetWidth = meta.width || null
        targetHeight = meta.height || null
      } catch {}
    }
    if (widthStr && heightStr) {
      targetWidth = parseInt(widthStr)
      targetHeight = parseInt(heightStr)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })

    const currentPoints = user.drawingPoints
    const modelId = model || 'gpt-4o-image'
    let apiKeyInfo: ApiKeyInfo | undefined

    const customAllowed = await isCustomApiAllowed()
    if (customAllowed) {
      const userConfig = await prisma.userApiConfig.findUnique({ where: { userId } })
      if (userConfig) {
        apiKeyInfo = { type: 'user', key: userConfig.apiKey, baseUrl: userConfig.apiBaseUrl || '', shouldDeductPoints: false }
      }
    }
    if (!apiKeyInfo && currentPoints >= 1) {
      const providers = await getProvidersForModel(modelId)
      if (providers.length > 0) {
        apiKeyInfo = { type: 'providers', providers, shouldDeductPoints: true }
      }
    }
    if (!apiKeyInfo) return NextResponse.json({ success: false, error: '积分不足或无可用供应商' }, { status: 400 })

    // 创建任务记录
    const sizeString = targetWidth && targetHeight ? `${targetWidth}x${targetHeight}` : null
    const task = await prisma.generationTask.create({
      data: {
        userId,
        status: 'pending',
        prompt,
        model: model || null,
        size: sizeString,
        quantity: 1,
      },
    })

    // Fire-and-forget: 后台异步执行，不 await
    executeEditTask(task.id, userId, prompt, model, imageBuffers, imageNames, targetWidth, targetHeight, apiKeyInfo)

    return NextResponse.json({
      success: true,
      task_id: task.id,
      message: '任务已提交，正在后台生成',
    })
  } catch (error) {
    console.error('图生图错误:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
