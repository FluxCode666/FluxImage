import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 汇总统计
    const [todayOrders, monthOrders, allOrders, totalOrderCount] = await Promise.all([
      (prisma as any).paymentOrder.aggregate({ where: { status: 'paid', paidAt: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
      (prisma as any).paymentOrder.aggregate({ where: { status: 'paid', paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
      (prisma as any).paymentOrder.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      (prisma as any).paymentOrder.count({ where: { status: 'paid' } }),
    ])

    // 近30天每日收入
    const dailyOrders = await (prisma as any).paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: thirtyDaysAgo } },
      select: { paidAt: true, amount: true },
    })

    const dailyMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dailyMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const o of dailyOrders) {
      if (o.paidAt) {
        const key = new Date(o.paidAt).toISOString().slice(0, 10)
        if (dailyMap[key] !== undefined) dailyMap[key] += o.amount
      }
    }
    const dailyTrend = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }))

    // 渠道收入占比
    const channelOrders = await (prisma as any).paymentOrder.groupBy({
      by: ['channel'],
      where: { status: 'paid' },
      _sum: { amount: true },
      _count: true,
    })

    // 套餐销量排行
    const packageSales = await (prisma as any).paymentOrder.groupBy({
      by: ['packageId'],
      where: { status: 'paid', packageId: { not: null } },
      _sum: { amount: true },
      _count: true,
    })

    // 获取套餐名称
    const pkgIds = packageSales.map((p: any) => p.packageId).filter(Boolean)
    const pkgNames = pkgIds.length > 0
      ? await (prisma as any).pointsPackage.findMany({ where: { id: { in: pkgIds } }, select: { id: true, name: true } })
      : []
    const pkgNameMap: Record<number, string> = {}
    for (const p of pkgNames) pkgNameMap[p.id] = p.name

    // 直充统计
    const directSales = await (prisma as any).paymentOrder.aggregate({
      where: { status: 'paid', packageId: null },
      _sum: { amount: true },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          today_income: todayOrders._sum.amount || 0,
          today_count: todayOrders._count || 0,
          month_income: monthOrders._sum.amount || 0,
          month_count: monthOrders._count || 0,
          total_income: allOrders._sum.amount || 0,
          total_count: totalOrderCount,
        },
        daily_trend: dailyTrend,
        channel_stats: channelOrders.map((c: any) => ({
          channel: c.channel, amount: c._sum.amount || 0, count: c._count,
        })),
        package_stats: [
          ...packageSales.map((p: any) => ({
            name: pkgNameMap[p.packageId] || `套餐#${p.packageId}`,
            amount: p._sum.amount || 0,
            count: p._count,
          })),
          ...(directSales._count > 0 ? [{ name: '直充', amount: directSales._sum.amount || 0, count: directSales._count }] : []),
        ],
      },
    })
  } catch (error) {
    console.error('获取支付统计失败:', error)
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 })
  }
}
