import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { is_active } = await req.json()
    await prisma.announcement.update({
      where: { id: parseInt(params.id) },
      data: { isActive: is_active },
    })
    return NextResponse.json({ success: true, message: '更新成功' })
  } catch (error) {
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    await prisma.announcement.delete({ where: { id: parseInt(params.id) } })
    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
