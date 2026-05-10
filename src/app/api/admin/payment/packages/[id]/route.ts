import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const id = parseInt(params.id)
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.points !== undefined) data.points = parseInt(body.points)
    if (body.price !== undefined) data.price = parseInt(body.price)
    if (body.original_price !== undefined) data.originalPrice = body.original_price ? parseInt(body.original_price) : null
    if (body.badge !== undefined) data.badge = body.badge || null
    if (body.is_enabled !== undefined) data.isEnabled = body.is_enabled
    if (body.sort_order !== undefined) data.sortOrder = parseInt(body.sort_order)
    data.updatedAt = new Date()

    await (prisma as any).pointsPackage.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新积分套餐失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const id = parseInt(params.id)
    await (prisma as any).pointsPackage.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除积分套餐失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
