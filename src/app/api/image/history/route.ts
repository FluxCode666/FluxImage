import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildPublicUrl, fileExists } from '@/lib/storage-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const rows = await prisma.creation.findMany({
      where: { userId: authResult.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // 并发检查文件是否存在，过滤掉 OSS 中不存在的记录
    const existsChecks = await Promise.all(rows.map(r => fileExists(r.imageUrl)))
    const validRows = rows.filter((_, i) => existsChecks[i])

    const data = await Promise.all(validRows.map(async r => ({
      id: r.id,
      prompt: r.prompt,
      image_url: await buildPublicUrl(r.imageUrl),
      image_key: r.imageUrl,
      model: r.model,
      size: r.size,
      title: r.title,
      category: r.category,
      created_at: r.createdAt.toISOString(),
    })))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('获取历史错误:', error)
    return NextResponse.json({ success: false, error: '获取历史失败' }, { status: 500 })
  }
}
