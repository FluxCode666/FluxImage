import { NextRequest, NextResponse } from 'next/server'
import { getSystemConfig } from '@/lib/config-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    const key = params.path.join('/')
    if (!key) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    const [filerUrl, authUser, authPassword] = await Promise.all([
      getSystemConfig('seaweedfs_filer_url'),
      getSystemConfig('seaweedfs_auth_user'),
      getSystemConfig('seaweedfs_auth_password'),
    ])

    if (!filerUrl) {
      console.error('[Image Proxy] SeaweedFS filer URL not configured')
      return NextResponse.json({ error: 'SeaweedFS not configured' }, { status: 500 })
    }

    const url = `${filerUrl.replace(/\/+$/, '')}/${key}`
    const headers: Record<string, string> = {}
    if (authUser) {
      const token = Buffer.from(`${authUser}:${authPassword || ''}`).toString('base64')
      headers['Authorization'] = `Basic ${token}`
    }

    const resp = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      console.error(`[Image Proxy] Upstream returned ${resp.status} for ${url}`)
      return new NextResponse(null, { status: resp.status })
    }

    const contentType = resp.headers.get('content-type') || 'image/png'
    const data = Buffer.from(await resp.arrayBuffer())

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('[Image Proxy] Error:', (error as Error).message)
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 })
  }
}
