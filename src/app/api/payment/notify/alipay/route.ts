import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { alipayClient, paymentOrderService } from '@/lib/payment-service'

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const params: Record<string, string> = {}
    const form = new URLSearchParams(text)
    form.forEach((val, key) => {
      params[key] = val
    })

    const orderNo = params.out_trade_no
    if (!orderNo) {
      console.error('回调缺少 out_trade_no')
      return new NextResponse('fail', { status: 200 })
    }

    // 查找订单和对应供应商
    const order = await (prisma as any).paymentOrder.findUnique({
      where: { orderNo },
      include: { provider: true },
    })

    if (!order || !order.provider) {
      console.error(`回调订单或供应商不存在: ${orderNo}`)
      return new NextResponse('fail', { status: 200 })
    }

    let metadata: Record<string, unknown> | null = null
    if (order.provider.metadata) {
      try { metadata = JSON.parse(order.provider.metadata) } catch { metadata = null }
    }

    // 验签
    const provider = {
      id: order.provider.id,
      name: order.provider.name,
      channel: order.provider.channel,
      appId: order.provider.appId,
      privateKey: order.provider.privateKey,
      publicKey: order.provider.publicKey,
      notifyUrl: order.provider.notifyUrl,
      priority: order.provider.priority,
      isEnabled: order.provider.isEnabled,
      lastUsedAt: order.provider.lastUsedAt,
      metadata,
    }

    const verified = alipayClient.verifyNotify(provider, params)
    if (!verified) {
      console.error(`验签失败: ${orderNo}`)
      return new NextResponse('fail', { status: 200 })
    }

    // 校验金额（防篡改）
    const notifyAmount = Math.round(parseFloat(params.total_amount || '0') * 100)
    if (notifyAmount !== order.amount) {
      console.error(`金额不匹配: 订单${order.amount}分 vs 回调${notifyAmount}分`)
      return new NextResponse('fail', { status: 200 })
    }

    const tradeStatus = params.trade_status
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      const tradeNo = params.trade_no || ''
      await paymentOrderService.handlePaymentSuccess(orderNo, tradeNo)
    }

    // 返回 success 告知支付宝不再重发
    return new NextResponse('success', { status: 200 })
  } catch (error) {
    console.error('处理支付宝回调异常:', error)
    return new NextResponse('fail', { status: 200 })
  }
}
