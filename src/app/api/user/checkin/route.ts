import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
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

    if (!canCheckin) {
      return NextResponse.json({ success: false, error: '今天已经签到过了，请明天再来！' }, { status: 400 })
    }

    const newPoints = user.drawingPoints + 10
    const newCheckinCount = user.checkinCount + 1
    const today = new Date()
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    await prisma.user.update({
      where: { id: authResult.id },
      data: {
        drawingPoints: newPoints,
        checkinCount: newCheckinCount,
        lastCheckinDate: todayDate,
      },
    })

    return NextResponse.json({
      success: true,
      message: '签到成功！获得10积分',
      data: {
        points_earned: 10,
        total_points: newPoints,
        checkin_count: newCheckinCount,
        last_checkin_date: todayDate.toISOString().split('T')[0],
      },
    })
  } catch (error) {
    console.error('签到错误:', error)
    return NextResponse.json({ success: false, error: '签到失败' }, { status: 500 })
  }
}
