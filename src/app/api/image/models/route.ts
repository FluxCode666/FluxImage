import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { aiService } from '@/lib/ai-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const modelsData = await aiService.getAvailableModels()
    return NextResponse.json({ success: true, data: modelsData })
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取模型列表失败' }, { status: 500 })
  }
}
