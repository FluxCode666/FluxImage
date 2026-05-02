import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const result = authenticateRequest(req)
  if (result instanceof NextResponse) return result

  return NextResponse.json({ success: true, data: { user: result } })
}
