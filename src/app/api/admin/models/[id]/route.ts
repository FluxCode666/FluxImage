import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateConfigCache } from '@/lib/config-service'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    const body = await req.json()

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.display_name !== undefined) updateData.displayName = body.display_name
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.description !== undefined) updateData.description = body.description
    if (body.api_base_url !== undefined) updateData.apiBaseUrl = body.api_base_url || null
    if (body.api_key !== undefined) updateData.apiKey = body.api_key || null
    if (body.is_enabled !== undefined) updateData.isEnabled = body.is_enabled
    if (body.sort_order !== undefined) updateData.sortOrder = body.sort_order
    if (body.points_cost !== undefined) updateData.pointsCost = body.points_cost

    await prisma.modelConfig.update({ where: { id }, data: updateData })
    invalidateConfigCache()

    return NextResponse.json({ success: true, message: '模型配置已更新' })
  } catch (error) {
    console.error('更新模型失败:', error)
    return NextResponse.json({ success: false, error: '更新模型失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    await prisma.modelConfig.delete({ where: { id } })
    invalidateConfigCache()

    return NextResponse.json({ success: true, message: '模型已删除' })
  } catch (error) {
    console.error('删除模型失败:', error)
    return NextResponse.json({ success: false, error: '删除模型失败' }, { status: 500 })
  }
}
