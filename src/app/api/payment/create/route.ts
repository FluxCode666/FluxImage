import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { paymentOrderService } from '@/lib/payment-service'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const { package_id, amount, channel } = body

    // package_id: 套餐ID (套餐充值)
    // amount: 金额（分）(直充)
    const result = await paymentOrderService.createOrder({
      userId: authResult.id,
      packageId: package_id || null,
      amountFen: amount ? parseInt(amount) : undefined,
      channel: channel || 'alipay',
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        order_no: result.orderNo,
        qr_code: result.qrCode,
      },
    })
  } catch (error: any) {
    console.error('创建支付订单失败:', error?.message, error?.stack)
    return NextResponse.json({ success: false, error: error?.message || '创建订单失败' }, { status: 500 })
  }
}
