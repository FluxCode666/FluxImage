import { AlipaySdk } from 'alipay-sdk'
import { createVerify } from 'crypto'
import { prisma } from './db'
import { getSystemConfig } from './config-service'

// ── 类型定义 ──────────────────────────────────────

export interface PaymentProviderInfo {
  id: number
  name: string
  channel: string
  appId: string
  privateKey: string
  publicKey: string
  notifyUrl: string | null
  priority: number
  isEnabled: boolean
  lastUsedAt: Date | null
  metadata: Record<string, unknown> | null
}

// ── 供应商调度管理器 ──────────────────────────────

export class ProviderManager {
  /**
   * 根据渠道和调度模式选择供应商
   * @param channel 渠道标识 alipay / wechat
   * @returns 选中的供应商，null 表示无可用
   */
  async selectProvider(channel: string): Promise<PaymentProviderInfo | null> {
    const mode = await getSystemConfig('payment_selection_mode') || 'priority'

    const providers = await prisma.paymentProvider.findMany({
      where: { channel, isEnabled: true },
      orderBy: mode === 'round_robin' ? { lastUsedAt: 'asc' } : { priority: 'desc' },
    })

    if (providers.length === 0) return null

    const selected = providers[0]

    // 更新 lastUsedAt
    await prisma.paymentProvider.update({
      where: { id: selected.id },
      data: { lastUsedAt: new Date() },
    })

    let metadata: Record<string, unknown> | null = null
    if (selected.metadata) {
      try { metadata = JSON.parse(selected.metadata) } catch { metadata = null }
    }

    return {
      id: selected.id,
      name: selected.name,
      channel: selected.channel,
      appId: selected.appId,
      privateKey: selected.privateKey,
      publicKey: selected.publicKey,
      notifyUrl: selected.notifyUrl,
      priority: selected.priority,
      isEnabled: selected.isEnabled,
      lastUsedAt: selected.lastUsedAt,
      metadata,
    }
  }
}

// ── 支付宝当面付客户端 ──────────────────────────────

export class AlipayClient {
  private normalizePublicKey(publicKey: string): string {
    const key = publicKey.trim()
    if (key.includes('BEGIN PUBLIC KEY')) return key
    return `-----BEGIN PUBLIC KEY-----\n${key.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || key}\n-----END PUBLIC KEY-----`
  }

  private createSdk(provider: PaymentProviderInfo): AlipaySdk {
    const gateway = provider.metadata?.gateway as string | undefined
    return new AlipaySdk({
      appId: provider.appId,
      privateKey: provider.privateKey,
      alipayPublicKey: provider.publicKey,
      signType: 'RSA2',
      ...(gateway ? { gateway } : {}),
    })
  }

  /**
   * 创建当面付预下单（生成二维码链接）
   */
  async createQrPay(params: {
    provider: PaymentProviderInfo
    orderNo: string
    amountYuan: string // 元，如 "0.01"
    subject: string
    notifyUrl?: string
  }): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const sdk = this.createSdk(params.provider)
      const notifyUrl = params.notifyUrl || params.provider.notifyUrl

      const execParams: Record<string, any> = {
        bizContent: {
          out_trade_no: params.orderNo,
          total_amount: params.amountYuan,
          subject: params.subject,
        },
      }
      if (notifyUrl) execParams.notify_url = notifyUrl

      const result = await sdk.exec('alipay.trade.precreate', execParams)

      // alipay-sdk v3 返回格式
      const data = result as Record<string, unknown>
      if (data.code === '10000' && data.qrCode) {
        return { success: true, qrCode: data.qrCode as string }
      }

      // 尝试从 response 字段取
      const resp = (data.alipayTradePrecreateResponse || data) as Record<string, unknown>
      if (resp.code === '10000' && resp.qr_code) {
        return { success: true, qrCode: resp.qr_code as string }
      }

      return { success: false, error: (resp.sub_msg || resp.msg || '创建支付失败') as string }
    } catch (error) {
      console.error('支付宝预下单失败:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 验证异步回调签名
   */
  verifyNotify(provider: PaymentProviderInfo, params: Record<string, string>): boolean {
    try {
      const sign = params.sign
      if (!sign) return false
      const content = Object.keys(params)
        .filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined && params[key] !== '')
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&')
      const verifier = createVerify('RSA-SHA256')
      verifier.update(content, 'utf8')
      verifier.end()
      return verifier.verify(this.normalizePublicKey(provider.publicKey), sign, 'base64')
    } catch (error) {
      console.error('验签异常:', error)
      return false
    }
  }

  /**
   * 主动查询交易状态
   */
  async queryTrade(provider: PaymentProviderInfo, orderNo: string): Promise<{
    success: boolean
    tradeStatus?: string
    tradeNo?: string
    error?: string
  }> {
    try {
      const sdk = this.createSdk(provider)
      const result = await sdk.exec('alipay.trade.query', {
        bizContent: { out_trade_no: orderNo },
      })

      const data = result as Record<string, unknown>
      const resp = (data.alipayTradeQueryResponse || data) as Record<string, unknown>

      if (resp.code === '10000') {
        return {
          success: true,
          tradeStatus: resp.trade_status as string,
          tradeNo: resp.trade_no as string,
        }
      }

      return { success: false, error: (resp.sub_msg || resp.msg || '查询失败') as string }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}

// ── 订单服务 ──────────────────────────────────────

export class PaymentOrderService {
  private providerManager = new ProviderManager()
  private alipayClient = new AlipayClient()

  /**
   * 生成唯一订单号
   */
  private generateOrderNo(): string {
    const now = new Date()
    const date = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const random = Math.random().toString(36).slice(2, 10).toUpperCase()
    return `PAY${date}${random}`
  }

  /**
   * 获取直充兑换比例
   */
  async getDirectRechargeRate(): Promise<number> {
    const rate = await getSystemConfig('direct_recharge_rate')
    const parsed = parseInt(rate || '10')
    return isNaN(parsed) || parsed <= 0 ? 10 : parsed
  }

  /**
   * 创建订单（套餐或直充）
   */
  async createOrder(params: {
    userId: number
    packageId?: number | null // null = 直充
    amountFen?: number       // 直充金额（分）
    channel?: string
  }): Promise<{ success: boolean; orderNo?: string; qrCode?: string; error?: string }> {
    const channel = params.channel || 'alipay'

    let points: number
    let amountFen: number
    let packageId: number | null = null

    if (params.packageId) {
      // 套餐充值
      const pkg = await prisma.pointsPackage.findUnique({ where: { id: params.packageId } })
      if (!pkg || !pkg.isEnabled) return { success: false, error: '套餐不存在或已下架' }
      points = pkg.points
      amountFen = pkg.price
      packageId = pkg.id
    } else if (params.amountFen && params.amountFen > 0) {
      // 直充
      const minAmount = parseInt(await getSystemConfig('direct_recharge_min') || '100') // 默认最低1元
      const maxAmount = parseInt(await getSystemConfig('direct_recharge_max') || '100000') // 默认最高1000元
      if (params.amountFen < minAmount) return { success: false, error: `最低充值 ${minAmount / 100} 元` }
      if (params.amountFen > maxAmount) return { success: false, error: `最高充值 ${maxAmount / 100} 元` }
      const rate = await this.getDirectRechargeRate()
      amountFen = params.amountFen
      points = Math.floor((amountFen / 100) * rate)
    } else {
      return { success: false, error: '请选择套餐或输入充值金额' }
    }

    // 选择供应商
    const provider = await this.providerManager.selectProvider(channel)
    if (!provider) return { success: false, error: '暂无可用支付渠道，请联系管理员' }

    const orderNo = this.generateOrderNo()
    const expiredAt = new Date(Date.now() + 15 * 60 * 1000) // 15分钟后过期
    const amountYuan = (amountFen / 100).toFixed(2)

    // 创建订单记录
    await prisma.paymentOrder.create({
      data: {
        orderNo,
        userId: params.userId,
        packageId,
        points,
        amount: amountFen,
        channel,
        providerId: provider.id,
        status: 'pending',
        expiredAt,
      },
    })

    // 调用支付宝下单
    if (channel === 'alipay') {
      const subject = packageId
        ? `积分充值 - ${points}积分`
        : `积分直充 - ${points}积分`
      const result = await this.alipayClient.createQrPay({
        provider,
        orderNo,
        amountYuan,
        subject,
      })

      if (!result.success) {
        // 标记订单失败
        await prisma.paymentOrder.update({
          where: { orderNo },
          data: { status: 'failed' },
        })
        return { success: false, error: result.error }
      }

      return { success: true, orderNo, qrCode: result.qrCode }
    }

    return { success: false, error: '暂不支持该支付渠道' }
  }

  /**
   * 处理支付成功回调（幂等）
   */
  async handlePaymentSuccess(orderNo: string, tradeNo: string): Promise<boolean> {
    const order = await prisma.paymentOrder.findUnique({ where: { orderNo } })
    if (!order) {
      console.error(`订单不存在: ${orderNo}`)
      return false
    }

    // 幂等：已支付则跳过
    if (order.status === 'paid') {
      console.log(`订单已处理，跳过: ${orderNo}`)
      return true
    }

    if (order.status !== 'pending') {
      console.error(`订单状态异常: ${orderNo} status=${order.status}`)
      return false
    }

    // 事务：更新订单状态 + 发放积分
    await prisma.$transaction([
      prisma.paymentOrder.update({
        where: { orderNo },
        data: { status: 'paid', tradeNo, paidAt: new Date() },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: { drawingPoints: { increment: order.points } },
      }),
    ])

    console.log(`✅ 订单支付成功: ${orderNo}, 用户${order.userId} +${order.points}积分`)
    return true
  }

  /**
   * 查询订单状态
   */
  async getOrderStatus(orderNo: string, userId: number): Promise<{
    status: string
    points: number
    amount: number
  } | null> {
    const order = await prisma.paymentOrder.findFirst({
      where: { orderNo, userId },
    })
    if (!order) return null
    return { status: order.status, points: order.points, amount: order.amount }
  }
}

export const providerManager = new ProviderManager()
export const alipayClient = new AlipayClient()
export const paymentOrderService = new PaymentOrderService()
