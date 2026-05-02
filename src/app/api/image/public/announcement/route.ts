import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const row = await prisma.announcement.findFirst({
      where: { isActive: true },
      orderBy: { id: 'desc' },
    })
    if (row) {
      return NextResponse.json({
        success: true,
        data: { content: row.content, isImportant: row.isImportant, createdAt: row.createdAt },
      })
    }
    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    return NextResponse.json({ success: true, data: null })
  }
}
