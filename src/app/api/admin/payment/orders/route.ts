import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '0')
    const size = parseInt(url.searchParams.get('size') || '20')
    const status = url.searchParams.get('status') || undefined
    const startDate = url.searchParams.get('start') || undefined
    const endDate = url.searchParams.get('end') || undefined

    const where: any = {}
    if (status) where.status = status
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59Z')
    }

    const [orders, total] = await Promise.all([
      (prisma as any).paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
        include: { user: { select: { id: true, username: true, email: true } }, package: { select: { name: true } } },
      }),
      (prisma as any).paymentOrder.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: orders.map((o: any) => ({
        id: o.id, order_no: o.orderNo, user: o.user, package_name: o.package?.name || '直充',
        points: o.points, amount: o.amount, channel: o.channel, status: o.status,
        trade_no: o.tradeNo, paid_at: o.paidAt, created_at: o.createdAt,
      })),
      total,
      page,
      size,
    })
  } catch (error) {
    console.error('获取订单列表失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}
