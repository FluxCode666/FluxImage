import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isCustomApiAllowed } from '@/lib/config-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const config = await prisma.userApiConfig.findUnique({ where: { userId: authResult.id } })

    if (!config) {
      return NextResponse.json({ success: true, data: null, has_key: false, message: '暂未配置API Key' })
    }

    const maskedKey = config.apiKey.substring(0, 8) + '...' + config.apiKey.substring(config.apiKey.length - 4)

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        api_key_preview: maskedKey,
        api_base_url: config.apiBaseUrl,
        created_at: config.createdAt,
        updated_at: config.updatedAt,
      },
      has_key: true,
      message: '已配置API Key',
    })
  } catch (error) {
    console.error('获取API Key错误:', error)
    return NextResponse.json({ success: false, error: '获取API Key失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const allowed = await isCustomApiAllowed()
    if (!allowed) {
      return NextResponse.json({ success: false, error: '管理员已关闭自定义 API 功能' }, { status: 403 })
    }

    const { api_key, api_base_url } = await req.json()
    if (!api_key || api_key.length < 10) {
      return NextResponse.json({ success: false, error: 'API Key格式不正确' }, { status: 400 })
    }

    const baseUrl = api_base_url || 'https://api.fengjungpt.com'

    await prisma.userApiConfig.upsert({
      where: { userId: authResult.id },
      update: { apiKey: api_key, apiBaseUrl: baseUrl },
      create: { userId: authResult.id, apiKey: api_key, apiBaseUrl: baseUrl },
    })

    return NextResponse.json({ success: true, message: '✅ API Key 配置成功！' })
  } catch (error) {
    console.error('配置API Key错误:', error)
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult

  try {
    const existing = await prisma.userApiConfig.findUnique({ where: { userId: authResult.id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '您还未配置API Key' }, { status: 404 })
    }

    await prisma.userApiConfig.delete({ where: { userId: authResult.id } })
    return NextResponse.json({ success: true, message: '✅ API Key 已删除' })
  } catch (error) {
    console.error('删除API Key错误:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
