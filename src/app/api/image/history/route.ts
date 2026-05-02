import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const rows = await prisma.creation.findMany({
      where: { userId: authResult.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('获取历史错误:', error)
    return NextResponse.json({ success: false, error: '获取历史失败' }, { status: 500 })
  }
}
