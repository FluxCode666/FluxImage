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
    if (body.name !== undefined) updateData.name = body.name
    if (body.api_base_url !== undefined) updateData.apiBaseUrl = body.api_base_url
    if (body.api_key !== undefined) updateData.apiKey = body.api_key
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.is_enabled !== undefined) updateData.isEnabled = body.is_enabled
    if (body.supported_models !== undefined) updateData.supportedModels = JSON.stringify(body.supported_models)

    await prisma.apiProvider.update({ where: { id }, data: updateData })
    invalidateConfigCache()

    return NextResponse.json({ success: true, message: '供应商配置已更新' })
  } catch (error) {
    console.error('更新供应商失败:', error)
    return NextResponse.json({ success: false, error: '更新供应商失败' }, { status: 500 })
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
    await prisma.apiProvider.delete({ where: { id } })
    invalidateConfigCache()

    return NextResponse.json({ success: true, message: '供应商已删除' })
  } catch (error) {
    console.error('删除供应商失败:', error)
    return NextResponse.json({ success: false, error: '删除供应商失败' }, { status: 500 })
  }
}
