import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const id = parseInt(params.id)
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.channel !== undefined) data.channel = body.channel
    if (body.app_id !== undefined) data.appId = body.app_id
    if (body.private_key !== undefined) data.privateKey = body.private_key
    if (body.public_key !== undefined) data.publicKey = body.public_key
    if (body.notify_url !== undefined) data.notifyUrl = body.notify_url
    if (body.priority !== undefined) data.priority = parseInt(body.priority)
    if (body.is_enabled !== undefined) data.isEnabled = body.is_enabled
    if (body.gateway !== undefined) {
      const existing = await (prisma as any).paymentProvider.findUnique({ where: { id }, select: { metadata: true } })
      let meta: Record<string, unknown> = {}
      try { meta = existing?.metadata ? JSON.parse(existing.metadata) : {} } catch {}
      if (body.gateway) { meta.gateway = body.gateway } else { delete meta.gateway }
      data.metadata = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null
    }
    data.updatedAt = new Date()

    await (prisma as any).paymentProvider.update({ where: { id }, data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新支付供应商失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const id = parseInt(params.id)
    await (prisma as any).paymentProvider.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除支付供应商失败:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
