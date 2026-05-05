import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildPublicUrl } from '@/lib/storage-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cursor = parseInt(searchParams.get('cursor') || '0') || 0
    const limit = Math.min(parseInt(searchParams.get('limit') || '20') || 20, 50)
    const search = (searchParams.get('search') || '').trim()
    const category = (searchParams.get('category') || '').trim()

    const where: Record<string, unknown> = {}
    if (cursor > 0) where.id = { lt: cursor }
    if (search) where.prompt = { contains: search, mode: 'insensitive' }
    if (category) where.category = category

    const rows = await prisma.inspiration.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null
    const data = await Promise.all(items.map(async r => ({ ...r, url: await buildPublicUrl(r.url) })))

    return NextResponse.json({ success: true, data, hasMore, nextCursor })
  } catch (error) {
    console.error('获取灵感失败:', error)
    return NextResponse.json({ success: false, error: '获取灵感失败' }, { status: 500 })
  }
}
