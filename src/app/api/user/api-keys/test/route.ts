import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const { api_key } = await req.json()
    if (!api_key || api_key.length < 10) {
      return NextResponse.json({ success: false, error: 'API Key格式不正确' }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: '✅ API Key 格式有效（完整验证需在调用API时进行）' })
  } catch (error) {
    return NextResponse.json({ success: false, error: '测试失败' }, { status: 500 })
  }
}
