import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { aiService } from '@/lib/ai-service'
import { getApiConfigForModel, isCustomApiAllowed } from '@/lib/config-service'
import sharp from 'sharp'
import { uploadFromUrl, buildPublicUrl } from '@/lib/storage-service'

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
    const userId = authResult.id

    if (!prompt) return NextResponse.json({ error: '提示词为空' }, { status: 400 })
    if (!imageFiles.length) return NextResponse.json({ error: '请上传图片' }, { status: 400 })

    let targetWidth: number | null = null
    let targetHeight: number | null = null
    const firstFile = imageFiles[0]
    const buffer = Buffer.from(await firstFile.arrayBuffer())
    try {
      const meta = await sharp(buffer).metadata()
      targetWidth = meta.width || null
      targetHeight = meta.height || null
    } catch {}
    if (widthStr && heightStr) {
      targetWidth = parseInt(widthStr)
      targetHeight = parseInt(heightStr)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })

    const currentPoints = user.drawingPoints
    const modelId = model || 'gpt-4o-image'
    let apiKeyInfo: { key: string; baseUrl: string; isUserKey: boolean; shouldDeductPoints: boolean } | undefined

    const customAllowed = await isCustomApiAllowed()
    if (customAllowed) {
      const userConfig = await prisma.userApiConfig.findUnique({ where: { userId } })
      if (userConfig) {
        apiKeyInfo = { key: userConfig.apiKey, baseUrl: userConfig.apiBaseUrl || '', isUserKey: true, shouldDeductPoints: false }
      }
    }
    if (!apiKeyInfo && currentPoints >= 1) {
      const sysConfig = await getApiConfigForModel(modelId)
      if (sysConfig) {
        apiKeyInfo = { key: sysConfig.apiKey, baseUrl: sysConfig.baseUrl, isUserKey: false, shouldDeductPoints: true }
      }
    }
    if (!apiKeyInfo) return NextResponse.json({ success: false, error: '积分不足' }, { status: 400 })

    const images = await Promise.all(imageFiles.map(async (f) => ({
      buffer: Buffer.from(await f.arrayBuffer()),
      originalname: f.name,
    })))

    const result = await aiService.editImage({
      prompt, model: model || undefined, images,
      width: targetWidth, height: targetHeight,
      apiKey: apiKeyInfo.key, baseUrl: apiKeyInfo.baseUrl,
    })
    if (!result.success) return NextResponse.json({ error: result.error || 'AI异常' }, { status: 500 })

    const temporaryImageUrl = result.data?.data?.[0]?.url
    if (!temporaryImageUrl) return NextResponse.json({ error: '无图片URL' }, { status: 500 })

    const key = `images/${Date.now()}-${userId}-edit.png`
    const storedKey = await uploadFromUrl(temporaryImageUrl, key)

    const sizeString = targetWidth && targetHeight ? `${targetWidth}x${targetHeight}` : null

    const titleCategory = await aiService.generateTitleAndCategory(prompt, apiKeyInfo.key, apiKeyInfo.baseUrl)

    await prisma.creation.create({
      data: { userId, prompt, imageUrl: storedKey, model: model || null, size: sizeString, title: titleCategory.title, category: titleCategory.category, createdAt: new Date() },
    })

    let remainingPoints = currentPoints
    if (apiKeyInfo.shouldDeductPoints) {
      await prisma.user.update({
        where: { id: userId },
        data: { drawingPoints: { decrement: 1 }, creationCount: { increment: 1 } },
      })
      remainingPoints -= 1
    }

    return NextResponse.json({
      success: true,
      data: { url: await buildPublicUrl(storedKey), prompt, model: model || null, size: sizeString, createdAt: new Date().toISOString() },
      quantity: 1, remaining_points: remainingPoints, used_api_key: apiKeyInfo.isUserKey,
    })
  } catch (error) {
    console.error('图生图错误:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
