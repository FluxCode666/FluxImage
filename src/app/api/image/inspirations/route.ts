import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const rows = await prisma.inspiration.findMany({ orderBy: { id: 'desc' }, take: 20 })
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json({ success: false, error: '获取灵感失败' }, { status: 500 })
  }
}
