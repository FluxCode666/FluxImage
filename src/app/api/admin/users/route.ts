import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({
      success: true,
      data: users.map(u => ({
        id: u.id, username: u.username, email: u.email, role: u.role,
        drawing_points: u.drawingPoints, creation_count: u.creationCount,
        checkin_count: u.checkinCount, created_at: u.createdAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 })
  }
}
