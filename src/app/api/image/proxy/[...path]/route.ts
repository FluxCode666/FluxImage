import { NextRequest, NextResponse } from 'next/server'
import { getSystemConfig } from '@/lib/config-service'

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
      return NextResponse.json({ error: 'SeaweedFS not configured' }, { status: 500 })
    }

    const url = `${filerUrl.replace(/\/+$/, '')}/${key}`
    const headers: Record<string, string> = {}
    if (authUser) {
      const token = Buffer.from(`${authUser}:${authPassword || ''}`).toString('base64')
      headers['Authorization'] = `Basic ${token}`
    }

    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
    if (!resp.ok) {
      return new NextResponse(null, { status: resp.status })
    }

    const contentType = resp.headers.get('content-type') || 'image/png'
    const body = resp.body

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('[Image Proxy] Error:', error)
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 })
  }
}
