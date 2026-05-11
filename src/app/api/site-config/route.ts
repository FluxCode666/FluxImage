import { NextResponse } from 'next/server'
import { DEFAULT_SITE_NAME, DEFAULT_SITE_SUBTITLE, DEFAULT_PROMPT_MAX_LENGTH, getSiteConfig, isRegisterCaptchaRequired } from '@/lib/config-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [siteConfig, captchaRequired] = await Promise.all([
      getSiteConfig(),
      isRegisterCaptchaRequired(),
    ])
    return NextResponse.json(
      {
        success: true,
        data: {
          site_name: siteConfig.siteName,
          site_subtitle: siteConfig.siteSubtitle,
          prompt_max_length: siteConfig.promptMaxLength,
          register_require_captcha: captchaRequired,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      {
        success: true,
        data: {
          site_name: DEFAULT_SITE_NAME,
          site_subtitle: DEFAULT_SITE_SUBTITLE,
          prompt_max_length: DEFAULT_PROMPT_MAX_LENGTH,
          register_require_captcha: true,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
