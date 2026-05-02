import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const rows = await prisma.announcement.findMany({ orderBy: { id: 'desc' } })
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取公告失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { content, is_important = false } = await req.json()
    if (!content) return NextResponse.json({ success: false, error: '公告内容不能为空' }, { status: 400 })

    await prisma.announcement.create({ data: { content, isImportant: is_important } })
    return NextResponse.json({ success: true, message: '发布成功' })
  } catch (error) {
    return NextResponse.json({ success: false, error: '发布失败' }, { status: 500 })
  }
}
