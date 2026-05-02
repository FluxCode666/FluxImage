import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { user_id, points } = await req.json()
    if (!user_id || points === undefined) {
      return NextResponse.json({ success: false, error: '参数缺失' }, { status: 400 })
    }

    const pointsNum = parseInt(points)
    await prisma.user.update({
      where: { id: parseInt(user_id) },
      data: { drawingPoints: { increment: pointsNum } },
    })

    return NextResponse.json({ success: true, message: `成功${pointsNum >= 0 ? '增加' : '扣除'}${Math.abs(pointsNum)}积分` })
  } catch (error) {
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 })
  }
}
