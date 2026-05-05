import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { aiService } from '@/lib/ai-service'
import { getApiConfigForModel, isCustomApiAllowed } from '@/lib/config-service'
import { uploadFromUrl } from '@/lib/storage-service'

async function getApiKeyToUse(userId: number, currentPoints: number, requiredPoints: number, modelId: string) {
  // 检查是否允许用户自定义 API
  const customAllowed = await isCustomApiAllowed()
  if (customAllowed) {
    try {
      const userConfig = await prisma.userApiConfig.findUnique({ where: { userId } })
      if (userConfig) {
        return {
          key: userConfig.apiKey,
          baseUrl: userConfig.apiBaseUrl || '',
          isUserKey: true,
          shouldDeductPoints: false,
        }
      }
    } catch (error) {
      console.error('获取用户API Key失败:', error)
    }
  }
  // 使用系统配置（模型级 > 全局）
  if (currentPoints >= requiredPoints) {
    const sysConfig = await getApiConfigForModel(modelId)
    if (!sysConfig) return null
    return {
      key: sysConfig.apiKey,
      baseUrl: sysConfig.baseUrl,
      isUserKey: false,
      shouldDeductPoints: true,
    }
  }
  return null
}

// 后台异步执行生图任务（fire-and-forget）
async function executeGenerationTask(
  taskId: number,
  userId: number,
  prompt: string,
  model: string,
  size: string | undefined,
  width: string | undefined,
  height: string | undefined,
  qty: number,
  apiKeyInfo: { key: string; baseUrl: string; isUserKey: boolean; shouldDeductPoints: boolean },
) {
  try {
    await prisma.generationTask.update({ where: { id: taskId }, data: { status: 'processing' } })

    let titleCategory: { title: string; category: string } | null = null
    const generatedImages = []
    for (let i = 0; i < qty; i++) {
      try {
        const result = await aiService.generateImage({
          prompt, model, size, width, height,
          apiKey: apiKeyInfo.key, baseUrl: apiKeyInfo.baseUrl,
        })
        const temporaryImageUrl = result.data?.data?.[0]?.url
        if (!temporaryImageUrl) throw new Error('AI无返回图片')

        const key = `images/${Date.now()}-${userId}-${i}.png`
        const storedKey = await uploadFromUrl(temporaryImageUrl, key)

        const sizeToSave = width && height ? `${width}x${height}` : (size || null)

        // 首张图片时生成标题和分类（后续复用）
        if (i === 0 && !titleCategory) {
          titleCategory = await aiService.generateTitleAndCategory(prompt, apiKeyInfo.key, apiKeyInfo.baseUrl)
        }

        const creation = await prisma.creation.create({
          data: { userId, prompt, imageUrl: storedKey, model: model || null, size: sizeToSave, title: titleCategory?.title || null, category: titleCategory?.category || null, createdAt: new Date() },
        })

        generatedImages.push({
          url: storedKey, prompt, model: model || null, size: sizeToSave,
          id: creation.id, createdAt: creation.createdAt.toISOString(),
        })
      } catch (error) {
        console.error(`[Task ${taskId}] 生成第 ${i + 1} 张出错:`, (error as Error).message)
      }
    }

    if (generatedImages.length === 0) {
      await prisma.generationTask.update({
        where: { id: taskId },
        data: { status: 'failed', error: '所有图片生成均失败', completedAt: new Date() },
      })
      return
    }

    // 扣积分
    if (apiKeyInfo.shouldDeductPoints) {
      await prisma.user.update({
        where: { id: userId },
        data: { drawingPoints: { decrement: generatedImages.length }, creationCount: { increment: generatedImages.length } },
      })
    }

    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: JSON.stringify(generatedImages),
        completedAt: new Date(),
      },
    })
    console.log(`[Task ${taskId}] 完成，生成 ${generatedImages.length} 张图片`)
  } catch (error) {
    console.error(`[Task ${taskId}] 执行失败:`, error)
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
    const { prompt, model, size, width, height, quantity = '1' } = await req.json()
    const userId = authResult.id

    if (!prompt) return NextResponse.json({ error: '提示词不能为空' }, { status: 400 })
    let qty = parseInt(quantity) || 1
    if (qty < 1) qty = 1
    if (qty > 4) qty = 4

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })

    const currentPoints = user.drawingPoints
    const apiKeyInfo = await getApiKeyToUse(userId, currentPoints, qty, model || 'gpt-4o-image')
    if (!apiKeyInfo) return NextResponse.json({ success: false, error: '积分不足' }, { status: 400 })

    // 创建任务记录
    const task = await prisma.generationTask.create({
      data: {
        userId,
        status: 'pending',
        prompt,
        model: model || null,
        size: size || null,
        quantity: qty,
      },
    })

    // Fire-and-forget: 后台异步执行，不 await
    executeGenerationTask(task.id, userId, prompt, model, size, width, height, qty, apiKeyInfo)

    return NextResponse.json({
      success: true,
      task_id: task.id,
      message: '任务已提交，正在后台生成',
    })
  } catch (error) {
    console.error('文生图错误:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
