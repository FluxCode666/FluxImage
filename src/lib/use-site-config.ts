'use client'

import { useEffect, useState } from 'react'

export interface ClientSiteConfig {
  siteName: string
  siteSubtitle: string
  promptMaxLength: number
  registerRequireCaptcha: boolean
}

export const DEFAULT_CLIENT_SITE_CONFIG: ClientSiteConfig = {
  siteName: 'FluxImage',
  siteSubtitle: 'AI Creative Studio',
  promptMaxLength: 5000,
  registerRequireCaptcha: true,
}

export function useSiteConfig(updateTitle = true): ClientSiteConfig {
  const [config, setConfig] = useState<ClientSiteConfig>(DEFAULT_CLIENT_SITE_CONFIG)

  useEffect(() => {
    let mounted = true

    async function loadSiteConfig() {
      try {
        const res = await fetch('/api/site-config', { cache: 'no-store' })
        const data = await res.json()
        if (!mounted || !data.success) return

        setConfig({
          siteName: data.data?.site_name?.trim() || DEFAULT_CLIENT_SITE_CONFIG.siteName,
          siteSubtitle: data.data?.site_subtitle?.trim() || DEFAULT_CLIENT_SITE_CONFIG.siteSubtitle,
          promptMaxLength: parseInt(data.data?.prompt_max_length) || DEFAULT_CLIENT_SITE_CONFIG.promptMaxLength,
          registerRequireCaptcha: data.data?.register_require_captcha !== false,
        })
      } catch {
        if (mounted) setConfig(DEFAULT_CLIENT_SITE_CONFIG)
      }
    }

    loadSiteConfig()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (updateTitle && typeof document !== 'undefined') {
      document.title = `${config.siteName} - ${config.siteSubtitle}`
    }
  }, [config, updateTitle])

  return config
}
