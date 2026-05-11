import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { getVerificationCode, deleteVerificationCode } from '@/lib/redis'
import { isRegisterCaptchaRequired } from '@/lib/config-service'

export async function POST(req: NextRequest) {
  try {
    const { username, email, password, code } = await req.json()

    if (!username || !email || !password) {
      return NextResponse.json({ success: false, error: '用户名、邮箱和密码都不能为空' }, { status: 400 })
    }

    // 验证码校验（仅在后台开启时强制校验）
    const captchaRequired = await isRegisterCaptchaRequired()
    if (captchaRequired) {
      const savedCode = await getVerificationCode(email)
      if (!savedCode) {
        return NextResponse.json({ success: false, error: '请先点击获取验证码' }, { status: 400 })
      }
      if (String(savedCode) !== String(code)) {
        return NextResponse.json({ success: false, error: '验证码错误' }, { status: 400 })
      }
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少需要6个字符' }, { status: 400 })
    }

    // 检查用户名/邮箱是否已存在
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    })
    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json({ success: false, error: '该用户名已被使用' }, { status: 409 })
      }
      return NextResponse.json({ success: false, error: '该邮箱已被注册' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        drawingPoints: 10,
        creationCount: 0,
      },
    })

    await deleteVerificationCode(email)

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
      message: '注册成功！已赠送10积分',
      data: { user: userProfile, token },
    }, { status: 201 })
  } catch (error) {
    console.error('注册错误:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
