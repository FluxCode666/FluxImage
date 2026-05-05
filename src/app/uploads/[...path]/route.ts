import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FALLBACK_DIR = (() => {
  const configured = process.env.LOCAL_FALLBACK_PATH || './uploads'
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured)
})()

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = path.join(FALLBACK_DIR, ...params.path)

  // 安全检查：防止目录穿越
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(FALLBACK_DIR))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(resolved).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'
  const buffer = fs.readFileSync(resolved)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
