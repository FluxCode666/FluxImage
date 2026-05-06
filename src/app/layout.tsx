import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { getSiteConfig } from '@/lib/config-service'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getSiteConfig()

  return {
    title: `${siteConfig.siteName} - ${siteConfig.siteSubtitle}`,
    description: `使用 ${siteConfig.siteName} 创作精美图片，释放你的创意`,
    icons: { icon: '/logo.png' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=localStorage.getItem('themeMode')||'system';var t=m;if(m==='system'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.className=t;document.documentElement.setAttribute('data-theme',t)}catch(e){}})()` }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
