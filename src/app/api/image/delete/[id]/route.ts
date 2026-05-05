import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const id = parseInt(params.id)
    const creation = await prisma.creation.findFirst({ where: { id, userId: authResult.id } })
    if (!creation) return NextResponse.json({ error: '无权删除' }, { status: 404 })

    await prisma.creation.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '已删除' })
  } catch (error) {
    console.error('删除错误:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
