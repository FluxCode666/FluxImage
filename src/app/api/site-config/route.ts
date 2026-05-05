import { NextResponse } from 'next/server'
import { DEFAULT_SITE_NAME, DEFAULT_SITE_SUBTITLE, getSiteConfig } from '@/lib/config-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const siteConfig = await getSiteConfig()
    return NextResponse.json(
      {
        success: true,
        data: {
          site_name: siteConfig.siteName,
          site_subtitle: siteConfig.siteSubtitle,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      {
        success: true,
        data: { site_name: DEFAULT_SITE_NAME, site_subtitle: DEFAULT_SITE_SUBTITLE },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
