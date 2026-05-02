import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ success: false, error: '邮箱和密码不能为空' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 })
    }

    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      drawing_points: user.drawingPoints,
      creation_count: user.creationCount,
    }

    const token = signToken(userProfile)

    return NextResponse.json({
      success: true,
      message: '登录成功',
      data: { user: userProfile, token },
    })
  } catch (error) {
    console.error('登录错误:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
