import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateConfigCache } from '@/lib/config-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const models = await prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json({
      success: true,
      data: models.map(m => ({
        id: m.id,
        model_id: m.modelId,
        display_name: m.displayName,
        icon: m.icon,
        description: m.description,
        is_enabled: m.isEnabled,
        sort_order: m.sortOrder,
        points_cost: m.pointsCost,
        prompt_max_length: m.promptMaxLength ?? null,
      })),
    })
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return NextResponse.json({ success: false, error: '获取模型列表失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { model_id, display_name, icon, description, is_enabled, sort_order, points_cost, prompt_max_length } = await req.json()

    if (!model_id || !display_name) {
      return NextResponse.json({ success: false, error: '模型ID和名称不能为空' }, { status: 400 })
    }

    const existing = await prisma.modelConfig.findUnique({ where: { modelId: model_id } })
    if (existing) {
      return NextResponse.json({ success: false, error: '模型ID已存在' }, { status: 409 })
    }

    await prisma.modelConfig.create({
      data: {
        modelId: model_id,
        displayName: display_name,
        icon: icon || '🤖',
        description: description || '',
        isEnabled: is_enabled !== false,
        sortOrder: sort_order ?? 0,
        pointsCost: points_cost ?? 1,
        promptMaxLength: prompt_max_length != null ? parseInt(prompt_max_length) || null : null,
      },
    })

    invalidateConfigCache()
    return NextResponse.json({ success: true, message: '模型添加成功' }, { status: 201 })
  } catch (error) {
    console.error('添加模型失败:', error)
    return NextResponse.json({ success: false, error: '添加模型失败' }, { status: 500 })
  }
}
