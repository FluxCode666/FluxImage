import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { getSiteConfig } from '@/lib/config-service'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getSiteConfig()

  return {
    title: `${siteConfig.siteName} - ${siteConfig.siteSubtitle}`,
    description: `使用 ${siteConfig.siteName} 创作精美图片，释放你的创意`,
    icons: { icon: '/favicon.ico' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light')}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()` }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
