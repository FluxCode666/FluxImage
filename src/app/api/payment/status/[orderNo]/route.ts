import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { paymentOrderService } from '@/lib/payment-service'

export async function GET(
  req: NextRequest,
  { params }: { params: { orderNo: string } }
) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const result = await paymentOrderService.getOrderStatus(params.orderNo, authResult.id)
    if (!result) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('查询订单状态失败:', error)
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 })
  }
}
