import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const user = await prisma.user.findUnique({ where: { id: authResult.id } })
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }

    let canCheckin = true
    if (user.lastCheckinDate) {
      const last = new Date(user.lastCheckinDate)
      const today = new Date()
      const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate())
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      canCheckin = lastDate.getTime() !== todayDate.getTime()
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        drawing_points: user.drawingPoints,
        creation_count: user.creationCount,
        checkin_count: user.checkinCount,
        last_checkin_date: user.lastCheckinDate,
        can_checkin: canCheckin,
        created_at: user.createdAt,
      },
    })
  } catch (error) {
    console.error('获取用户信息错误:', error)
    return NextResponse.json({ success: false, error: '获取用户信息失败' }, { status: 500 })
  }
}
