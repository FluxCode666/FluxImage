import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { getSystemConfig } from '@/lib/config-service'
import { cleanupOldFiles } from '@/lib/storage-service'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const cleanupDaysStr = await getSystemConfig('storage_cleanup_days') || await getSystemConfig('qiniu_cleanup_days')
    const cleanupDays = parseInt(cleanupDaysStr || '30') || 30

    if (cleanupDays < 1) {
      return NextResponse.json({ success: false, error: '清理天数必须大于 0' }, { status: 400 })
    }

    const deletedCount = await cleanupOldFiles(cleanupDays)

    return NextResponse.json({
      success: true,
      message: `已清理 ${deletedCount} 个超过 ${cleanupDays} 天的文件`,
      deleted_count: deletedCount,
    })
  } catch (error) {
    console.error('七牛清理失败:', error)
    return NextResponse.json({ success: false, error: (error as Error).message || '清理失败' }, { status: 500 })
  }
}
