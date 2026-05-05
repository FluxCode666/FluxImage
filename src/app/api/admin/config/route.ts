import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { DEFAULT_SITE_NAME, DEFAULT_SITE_SUBTITLE, getAllSystemConfig, setSystemConfig, invalidateConfigCache } from '@/lib/config-service'
import { invalidateStorageCache } from '@/lib/storage-service'

export async function GET(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const storedConfig = await getAllSystemConfig()
    const config = {
      site_name: DEFAULT_SITE_NAME,
      site_subtitle: DEFAULT_SITE_SUBTITLE,
      ...storedConfig,
    }
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('获取系统配置失败:', error)
    return NextResponse.json({ success: false, error: '获取配置失败' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const body = await req.json()
    const allowedKeys = [
      'default_api_base_url', 'default_api_key', 'allow_custom_api', 'ai_timeout',
      'storage_provider', 'storage_cleanup_days',
      'qiniu_access_key', 'qiniu_secret_key', 'qiniu_bucket', 'qiniu_domain', 'qiniu_cleanup_days',
      'minio_endpoint', 'minio_port', 'minio_use_ssl', 'minio_access_key', 'minio_secret_key', 'minio_bucket', 'minio_domain',
      'seaweedfs_master_url', 'seaweedfs_filer_url', 'seaweedfs_domain', 'seaweedfs_auth_user', 'seaweedfs_auth_password',
      'default_points_cost',
      'site_name', 'site_subtitle',
    ]

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        await setSystemConfig(key, String(body[key]))
      }
    }

    invalidateConfigCache()
    invalidateStorageCache()
    return NextResponse.json({ success: true, message: '配置已更新' })
  } catch (error) {
    console.error('更新系统配置失败:', error)
    return NextResponse.json({ success: false, error: '更新配置失败' }, { status: 500 })
  }
}
