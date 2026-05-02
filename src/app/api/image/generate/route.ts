import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { aiService } from '@/lib/ai-service'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

async function getApiKeyToUse(userId: number, currentPoints: number, requiredPoints: number) {
  try {
    const userConfig = await prisma.userApiConfig.findUnique({ where: { userId } })
    if (userConfig) {
      return {
        key: userConfig.apiKey,
        baseUrl: userConfig.apiBaseUrl || process.env.AI_API_BASE_URL,
        isUserKey: true,
        shouldDeductPoints: false,
      }
    }
  } catch (error) {
    console.error('获取用户API Key失败:', error)
  }
  if (currentPoints >= requiredPoints) {
    return {
      key: process.env.AI_API_KEY!,
      baseUrl: process.env.AI_API_BASE_URL!,
      isUserKey: false,
      shouldDeductPoints: true,
    }
  }
  return null
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
    const apiKeyInfo = await getApiKeyToUse(userId, currentPoints, qty)
    if (!apiKeyInfo) return NextResponse.json({ success: false, error: '积分不足' }, { status: 400 })

    const generatedImages = []
    for (let i = 0; i < qty; i++) {
      try {
        const result = await aiService.generateImage({
          prompt, model, size, width, height,
          apiKey: apiKeyInfo.key, baseUrl: apiKeyInfo.baseUrl,
        })
        const temporaryImageUrl = result.data?.data?.[0]?.url
        if (!temporaryImageUrl) throw new Error('AI无返回图片')

        const fileName = `${Date.now()}-${userId}-${i}.png`
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const filePath = path.join(uploadsDir, fileName)
        const publicUrl = `/uploads/${fileName}`

        const response = await axios({ url: temporaryImageUrl, responseType: 'stream' })
        const writer = fs.createWriteStream(filePath)
        response.data.pipe(writer)
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve)
          writer.on('error', reject)
        })

        const sizeToSave = width && height ? `${width}x${height}` : (size || null)

        const creation = await prisma.creation.create({
          data: { userId, prompt, imageUrl: publicUrl, model: model || null, size: sizeToSave, createdAt: new Date() },
        })

        generatedImages.push({
          url: publicUrl, prompt, model: model || null, size: sizeToSave,
          id: creation.id, createdAt: creation.createdAt.toISOString(),
        })
      } catch (error) {
        console.error(`生成第 ${i + 1} 张出错:`, (error as Error).message)
      }
    }

    if (generatedImages.length === 0) return NextResponse.json({ error: '生成失败' }, { status: 500 })

    let remainingPoints = currentPoints
    if (apiKeyInfo.shouldDeductPoints) {
      await prisma.user.update({
        where: { id: userId },
        data: { drawingPoints: { decrement: qty }, creationCount: { increment: qty } },
      })
      remainingPoints -= qty
    }

    return NextResponse.json({
      success: true,
      data: qty === 1 ? generatedImages[0] : generatedImages,
      remaining_points: remainingPoints,
      used_api_key: apiKeyInfo.isUserKey,
    })
  } catch (error) {
    console.error('文生图错误:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
