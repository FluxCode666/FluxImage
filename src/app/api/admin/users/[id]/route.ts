import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    const body = await req.json()
    const updateData: Record<string, unknown> = {}

    if (body.role !== undefined) updateData.role = body.role
    if (body.drawing_points !== undefined) updateData.drawingPoints = parseInt(body.drawing_points)

    await prisma.user.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, message: '用户信息已更新' })
  } catch (error) {
    console.error('更新用户失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '用户已删除' })
  } catch (error) {
    console.error('删除用户失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
