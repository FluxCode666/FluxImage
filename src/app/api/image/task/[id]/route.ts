import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildPublicUrl } from '@/lib/storage-service'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const taskId = parseInt(params.id)
    if (isNaN(taskId)) return NextResponse.json({ success: false, error: '无效的任务ID' }, { status: 400 })

    const task = await prisma.generationTask.findFirst({
      where: { id: taskId, userId: authResult.id },
    })
    if (!task) return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        status: task.status,
        prompt: task.prompt,
        model: task.model,
        size: task.size,
        quantity: task.quantity,
        result: task.result ? await Promise.all(JSON.parse(task.result).map(async (img: any) => ({ ...img, url: await buildPublicUrl(img.url) }))) : null,
        error: task.error,
        created_at: task.createdAt.toISOString(),
        completed_at: task.completedAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('查询任务失败:', error)
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 })
  }
}
