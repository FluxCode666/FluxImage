import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/mail-service'
import { setVerificationCode } from '@/lib/redis'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ success: false, error: '请输入邮箱地址' }, { status: 400 })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))

    await sendVerificationEmail(email, code)
    await setVerificationCode(email, code)

    return NextResponse.json({ success: true, message: '验证码已发送' })
  } catch (error) {
    console.error('发送验证码失败:', error)
    return NextResponse.json({ success: false, error: '邮件发送失败，请检查邮箱是否正确或稍后再试' }, { status: 500 })
  }
}
