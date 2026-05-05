import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const { creation_id } = await req.json()
    if (!creation_id) {
      return NextResponse.json({ success: false, error: '缺少作品ID' }, { status: 400 })
    }

    const creation = await prisma.creation.findFirst({
      where: { id: creation_id, userId: authResult.id },
    })
    if (!creation) {
      return NextResponse.json({ success: false, error: '作品不存在' }, { status: 404 })
    }

    // 检查是否已分享过（避免重复）
    const existing = await prisma.inspiration.findFirst({
      where: { url: creation.imageUrl },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: '该作品已分享过' }, { status: 400 })
    }

    await prisma.inspiration.create({
      data: {
        url: creation.imageUrl,
        prompt: creation.prompt,
        category: creation.category,
        model: creation.model,
      },
    })

    return NextResponse.json({ success: true, message: '已分享到灵感社区' })
  } catch (error) {
    console.error('分享失败:', error)
    return NextResponse.json({ success: false, error: '分享失败' }, { status: 500 })
  }
}
