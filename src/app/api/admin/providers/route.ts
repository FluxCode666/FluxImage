import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateConfigCache } from '@/lib/config-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const providers = await prisma.apiProvider.findMany({ orderBy: { priority: 'desc' } })
    return NextResponse.json({
      success: true,
      data: providers.map(p => {
        let supportedModels: string[] = []
        try { supportedModels = JSON.parse(p.supportedModels) } catch { supportedModels = [] }
        return {
          id: p.id,
          name: p.name,
          api_base_url: p.apiBaseUrl,
          api_key: p.apiKey,
          priority: p.priority,
          is_enabled: p.isEnabled,
          supported_models: supportedModels,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        }
      }),
    })
  } catch (error) {
    console.error('获取供应商列表失败:', error)
    return NextResponse.json({ success: false, error: '获取供应商列表失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { name, api_base_url, api_key, priority, is_enabled, supported_models } = await req.json()

    if (!name || !api_base_url || !api_key) {
      return NextResponse.json({ success: false, error: '名称、API 域名和 API Key 不能为空' }, { status: 400 })
    }

    await prisma.apiProvider.create({
      data: {
        name,
        apiBaseUrl: api_base_url,
        apiKey: api_key,
        priority: priority ?? 0,
        isEnabled: is_enabled !== false,
        supportedModels: JSON.stringify(supported_models || []),
      },
    })

    invalidateConfigCache()
    return NextResponse.json({ success: true, message: '供应商添加成功' }, { status: 201 })
  } catch (error) {
    console.error('添加供应商失败:', error)
    return NextResponse.json({ success: false, error: '添加供应商失败' }, { status: 500 })
  }
}
