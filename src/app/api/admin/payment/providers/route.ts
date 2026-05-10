import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const providers = await (prisma as any).paymentProvider.findMany({
      orderBy: { priority: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: providers.map((p: any) => {
        let gateway = ''
        try { const m = p.metadata ? JSON.parse(p.metadata) : null; gateway = m?.gateway || '' } catch {}
        return {
          id: p.id,
          name: p.name,
          channel: p.channel,
          app_id: p.appId,
          // 脱敏：私钥只返回末4位
          private_key_tail: p.privateKey ? '...' + p.privateKey.slice(-4) : '',
          public_key_tail: p.publicKey ? '...' + p.publicKey.slice(-4) : '',
          notify_url: p.notifyUrl,
          gateway,
          priority: p.priority,
          is_enabled: p.isEnabled,
          last_used_at: p.lastUsedAt,
          created_at: p.createdAt,
        }
      }),
    })
  } catch (error) {
    console.error('获取支付供应商失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const body = await req.json()
    const { name, channel, app_id, private_key, public_key, notify_url, priority, metadata, gateway } = body

    if (!name || !channel || !app_id || !private_key || !public_key) {
      return NextResponse.json({ success: false, error: '必填字段不完整' }, { status: 400 })
    }

    const provider = await (prisma as any).paymentProvider.create({
      data: {
        name,
        channel,
        appId: app_id,
        privateKey: private_key,
        publicKey: public_key,
        notifyUrl: notify_url || null,
        priority: parseInt(priority) || 0,
        metadata: gateway ? JSON.stringify({ ...(metadata || {}), gateway }) : (metadata ? JSON.stringify(metadata) : null),
      },
    })

    return NextResponse.json({ success: true, data: { id: provider.id } })
  } catch (error) {
    console.error('创建支付供应商失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}
