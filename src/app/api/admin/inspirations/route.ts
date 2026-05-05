import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildPublicUrl } from '@/lib/storage-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const rows = await prisma.inspiration.findMany({ orderBy: { id: 'desc' } })
    const data = await Promise.all(rows.map(async r => ({ ...r, url: await buildPublicUrl(r.url) })))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取灵感失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { url, prompt } = await req.json()
    if (!url) return NextResponse.json({ success: false, error: '图片URL不能为空' }, { status: 400 })

    await prisma.inspiration.create({ data: { url, prompt: prompt || null } })
    return NextResponse.json({ success: true, message: '添加成功' })
  } catch (error) {
    return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 })
  }
}
