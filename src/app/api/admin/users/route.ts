import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { username, email, password, role, drawing_points } = await req.json()

    if (!username || !email || !password) {
      return NextResponse.json({ success: false, error: '用户名、邮箱和密码不能为空' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少需要6个字符' }, { status: 400 })
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } })
    if (existing) {
      if (existing.username === username) return NextResponse.json({ success: false, error: '用户名已被使用' }, { status: 409 })
      return NextResponse.json({ success: false, error: '邮箱已被注册' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'user',
        drawingPoints: parseInt(String(drawing_points ?? 10)),
        creationCount: 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: '用户创建成功',
      data: {
        id: user.id, username: user.username, email: user.email, role: user.role,
        drawing_points: user.drawingPoints, creation_count: user.creationCount,
        checkin_count: user.checkinCount, created_at: user.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('创建用户失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}
