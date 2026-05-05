import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const tasks = await prisma.generationTask.findMany({
      where: {
        userId: authResult.id,
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: tasks.map(t => ({
        id: t.id,
        status: t.status,
        prompt: t.prompt,
        model: t.model,
        size: t.size,
        quantity: t.quantity,
        created_at: t.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('查询活跃任务失败:', error)
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 })
  }
}
