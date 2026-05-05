import { NextResponse } from 'next/server'
import { getEnabledModels, isCustomApiAllowed } from '@/lib/config-service'

export async function GET() {
  try {
    const models = await getEnabledModels()
    const allowCustomApi = await isCustomApiAllowed()

    return NextResponse.json({
      success: true,
      allow_custom_api: allowCustomApi,
      data: models.map(m => ({
        id: m.modelId,
        name: m.displayName,
        icon: m.icon,
        desc: m.description,
        points_cost: m.pointsCost,
      })),
    })
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return NextResponse.json({ success: false, error: '获取模型列表失败' }, { status: 500 })
  }
}
