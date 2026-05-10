import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const packages = await (prisma as any).pointsPackage.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: packages.map((p: any) => ({
        id: p.id,
        name: p.name,
        points: p.points,
        price: p.price,
        original_price: p.originalPrice,
        badge: p.badge,
        is_enabled: p.isEnabled,
        sort_order: p.sortOrder,
      })),
    })
  } catch (error) {
    console.error('获取积分套餐失败:', error)
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
    const { name, points, price, original_price, badge, sort_order } = body

    if (!name || !points || !price) {
      return NextResponse.json({ success: false, error: '名称、积分数、价格不能为空' }, { status: 400 })
    }

    const pkg = await (prisma as any).pointsPackage.create({
      data: {
        name,
        points: parseInt(points),
        price: parseInt(price),
        originalPrice: original_price ? parseInt(original_price) : null,
        badge: badge || null,
        sortOrder: parseInt(sort_order) || 0,
      },
    })

    return NextResponse.json({ success: true, data: { id: pkg.id } })
  } catch (error) {
    console.error('创建积分套餐失败:', error)
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 })
  }
}
