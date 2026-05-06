import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSystemConfig } from '@/lib/config-service'

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

    const checkinPointsStr = await getSystemConfig('checkin_points')
    const checkinQuota = parseInt(checkinPointsStr || '10') || 10

    const pointsToAdd = Math.max(0, checkinQuota - user.checkinPoints)
    const newCheckinCount = user.checkinCount + 1
    const today = new Date()
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    await prisma.user.update({
      where: { id: authResult.id },
      data: {
        drawingPoints: { increment: pointsToAdd },
        checkinPoints: Math.min(user.checkinPoints + pointsToAdd, checkinQuota),
        checkinCount: newCheckinCount,
        lastCheckinDate: todayDate,
      },
    })

    const newPoints = user.drawingPoints + pointsToAdd

    return NextResponse.json({
      success: true,
      message: pointsToAdd > 0 ? `签到成功！获得${pointsToAdd}积分` : '签到成功！积分已满',
      data: {
        points_earned: pointsToAdd,
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
