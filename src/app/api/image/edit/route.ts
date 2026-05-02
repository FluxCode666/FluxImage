import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { aiService } from '@/lib/ai-service'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

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
    const userConfig = await prisma.userApiConfig.findUnique({ where: { userId } })
    let apiKeyInfo
    if (userConfig) {
      apiKeyInfo = { key: userConfig.apiKey, baseUrl: userConfig.apiBaseUrl || process.env.AI_API_BASE_URL, isUserKey: true, shouldDeductPoints: false }
    } else if (currentPoints >= 1) {
      apiKeyInfo = { key: process.env.AI_API_KEY!, baseUrl: process.env.AI_API_BASE_URL!, isUserKey: false, shouldDeductPoints: true }
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

    const fileName = `${Date.now()}-${userId}-edit.png`
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const filePath = path.join(uploadsDir, fileName)
    const publicUrl = `/uploads/${fileName}`

    const response = await axios({ url: temporaryImageUrl, responseType: 'stream' })
    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)
    await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject) })

    const sizeString = targetWidth && targetHeight ? `${targetWidth}x${targetHeight}` : null

    await prisma.creation.create({
      data: { userId, prompt, imageUrl: publicUrl, model: model || null, size: sizeString, createdAt: new Date() },
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
      data: { url: publicUrl, prompt, model: model || null, size: sizeString, createdAt: new Date().toISOString() },
      quantity: 1, remaining_points: remainingPoints, used_api_key: apiKeyInfo.isUserKey,
    })
  } catch (error) {
    console.error('图生图错误:', error)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
