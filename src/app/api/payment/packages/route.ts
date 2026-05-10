import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSystemConfig } from '@/lib/config-service'

export async function GET() {
  try {
    const packages = await (prisma as any).pointsPackage.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        points: true,
        price: true,
        originalPrice: true,
        badge: true,
        sortOrder: true,
      },
    })

    const directRechargeRate = parseInt(await getSystemConfig('direct_recharge_rate') || '10')
    const directRechargeMin = parseInt(await getSystemConfig('direct_recharge_min') || '100')
    const directRechargeMax = parseInt(await getSystemConfig('direct_recharge_max') || '100000')

    return NextResponse.json({
      success: true,
      data: {
        packages,
        directRecharge: {
          rate: directRechargeRate,  // X积分/元
          minAmount: directRechargeMin,  // 最低金额（分）
          maxAmount: directRechargeMax,  // 最高金额（分）
        },
      },
    })
  } catch (error) {
    console.error('获取套餐列表失败:', error)
    return NextResponse.json({ success: false, error: '获取套餐失败' }, { status: 500 })
  }
}
