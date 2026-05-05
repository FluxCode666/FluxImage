'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lightbulb, Wand2, ImageIcon, Key, Coins } from 'lucide-react'
import { useSiteConfig } from '@/lib/use-site-config'

export default function TutorialPage() {
  const router = useRouter()
  const { siteName } = useSiteConfig()

  const sections = [
    {
      icon: <Wand2 className="w-5 h-5 text-purple-400" />,
      title: '文生图',
      content: '在输入框中描述你想要生成的图片内容，支持中英文。描述越详细，生成效果越好。你可以指定画面风格、色彩、构图等细节。'
    },
    {
      icon: <ImageIcon className="w-5 h-5 text-blue-400" />,
      title: '图生图',
      content: '上传一张参考图片，然后输入提示词来描述你想要对图片做的修改。AI 将基于参考图和你的描述来生成新图片。'
    },
    {
      icon: <Coins className="w-5 h-5 text-yellow-400" />,
      title: '积分系统',
      content: '每次生成图片消耗1积分。新注册用户赠送10积分。每日签到可获得10积分。如果配置了自己的API Key则不消耗积分。'
    },
    {
      icon: <Key className="w-5 h-5 text-green-400" />,
      title: '自定义 API Key',
      content: '你可以在设置中配置自己的 API Key，使用自己的额度生成图片，不再消耗平台积分。这适合有大量创作需求的用户。'
    },
    {
      icon: <Lightbulb className="w-5 h-5 text-orange-400" />,
      title: '提示词技巧',
      content: '1. 使用具体的描述而非抽象概念\n2. 指定艺术风格（如水彩、油画、赛博朋克）\n3. 描述光线和色调\n4. 包含构图信息（如特写、全景、俯视）\n5. 使用英文通常效果更好'
    },
  ]

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">使用教程</h1>
          <p className="text-sm text-muted-foreground">了解如何使用 {siteName} 创作精美图片</p>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <Card key={i} className="bg-card/80 border-border/50 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-base">
                {section.icon}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{section.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <div className="text-center text-sm text-muted-foreground">
        <p>如有问题或建议，请联系管理员</p>
        <Button variant="link" className="mt-2" onClick={() => router.push('/')}>
          返回创作
        </Button>
      </div>
    </div>
  )
}
