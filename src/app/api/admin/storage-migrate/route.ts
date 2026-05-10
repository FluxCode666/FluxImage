import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProviderByType, getActiveStorageType } from '@/lib/storage-service'

export async function POST(req: NextRequest) {
  const authResult = authenticateRequest(req)
  if (authResult instanceof NextResponse) return authResult
  const adminCheck = requireAdmin(authResult)
  if (adminCheck) return adminCheck

  try {
    const { source_type, target_type } = await req.json()

    if (!source_type || !target_type) {
      return NextResponse.json({ success: false, error: '请指定源和目标存储类型' }, { status: 400 })
    }
    if (source_type === target_type) {
      return NextResponse.json({ success: false, error: '源和目标存储类型不能相同' }, { status: 400 })
    }

    const validTypes = ['qiniu', 'minio', 'seaweedfs']
    if (!validTypes.includes(source_type) || !validTypes.includes(target_type)) {
      return NextResponse.json({ success: false, error: '不支持的存储类型' }, { status: 400 })
    }

    // 初始化两端 provider
    let sourceProvider, targetProvider
    try {
      sourceProvider = await getProviderByType(source_type)
    } catch (e) {
      return NextResponse.json({ success: false, error: `源存储配置错误: ${(e as Error).message}` }, { status: 400 })
    }
    try {
      targetProvider = await getProviderByType(target_type)
    } catch (e) {
      return NextResponse.json({ success: false, error: `目标存储配置错误: ${(e as Error).message}` }, { status: 400 })
    }

    // 收集所有需要迁移的 key
    const creations = await prisma.creation.findMany({ select: { id: true, imageUrl: true } })
    const inspirations = await prisma.inspiration.findMany({ select: { id: true, url: true } })

    const keysToMigrate = new Set<string>()
    for (const c of creations) {
      if (c.imageUrl && !c.imageUrl.startsWith('http') && !c.imageUrl.startsWith('/uploads/')) {
        keysToMigrate.add(c.imageUrl)
      }
    }
    for (const i of inspirations) {
      if (i.url && !i.url.startsWith('http') && !i.url.startsWith('/uploads/')) {
        keysToMigrate.add(i.url)
      }
    }

    // 同样检查 task result 中的 key
    const tasks = await prisma.generationTask.findMany({
      where: { result: { not: null } },
      select: { id: true, result: true },
    })
    for (const t of tasks) {
      if (!t.result) continue
      try {
        const imgs = JSON.parse(t.result)
        if (Array.isArray(imgs)) {
          for (const img of imgs) {
            if (img.url && !img.url.startsWith('http') && !img.url.startsWith('/uploads/')) {
              keysToMigrate.add(img.url)
            }
          }
        }
      } catch {}
    }

    const keysList = Array.from(keysToMigrate)

    if (keysList.length === 0) {
      return NextResponse.json({ success: true, message: '没有需要迁移的文件', migrated: 0, failed: 0 })
    }

    // 执行迁移：从源下载 → 上传到目标
    let migrated = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    for (const key of keysList) {
      try {
        const buffer = await sourceProvider.downloadToBuffer(key)
        await targetProvider.uploadBuffer(buffer, key)
        migrated++
      } catch (e: any) {
        // 404 = 文件不在源存储中（可能是其他 provider 上传的），跳过
        const status = e?.response?.status || e?.status
        if (status === 404) {
          skipped++
          console.log(`[迁移跳过] ${key}: 文件不在源存储中`)
        } else {
          failed++
          const msg = `${key}: ${(e as Error).message}`
          if (errors.length < 10) errors.push(msg)
          console.error(`[迁移失败] ${msg}`)
        }
      }
    }

    const parts = [`${migrated} 成功`]
    if (skipped > 0) parts.push(`${skipped} 跳过(不在源存储)`)
    if (failed > 0) parts.push(`${failed} 失败`)

    return NextResponse.json({
      success: true,
      message: `迁移完成: ${parts.join(', ')} (共 ${keysList.length} 个文件)`,
      total: keysList.length,
      migrated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('存储迁移失败:', error)
    return NextResponse.json({ success: false, error: (error as Error).message || '迁移失败' }, { status: 500 })
  }
}
