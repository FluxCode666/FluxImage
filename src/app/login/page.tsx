'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Mail, Lock, User, Sparkles, ArrowRight } from 'lucide-react'
import { useSiteConfig } from '@/lib/use-site-config'

export default function LoginPage() {
  const router = useRouter()
  const { siteName, siteSubtitle, registerRequireCaptcha } = useSiteConfig()
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regCode, setRegCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSending, setCodeSending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail || !loginPassword) { toast.error('请填写完整信息'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('token', data.data.token)
        toast.success('登录成功')
        router.push('/')
      } else toast.error(data.error)
    } catch { toast.error('登录失败') }
    setLoading(false)
  }

  async function handleSendCode() {
    if (!regEmail) { toast.error('请先输入邮箱'); return }
    setCodeSending(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('验证码已发送')
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0 }
            return prev - 1
          })
        }, 1000)
      } else toast.error(data.error)
    } catch { toast.error('发送失败') }
    setCodeSending(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!regUsername || !regEmail || !regPassword) { toast.error('请填写完整信息'); return }
    if (registerRequireCaptcha && !regCode) { toast.error('请填写验证码'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword, code: regCode }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('token', data.data.token)
        toast.success(data.message)
        router.push('/')
      } else toast.error(data.error)
    } catch { toast.error('注册失败') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-purple-950/20">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {siteName}
            </h1>
          </div>
          <p className="text-muted-foreground">{siteSubtitle}</p>
        </div>

        <Card className="bg-card/80 backdrop-blur border-border/50">
          <Tabs defaultValue="login">
            <CardHeader className="pb-2">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">邮箱</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input id="login-email" type="email" placeholder="your@email.com" className="pl-9"
                        value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input id="login-password" type="password" placeholder="••••••" className="pl-9"
                        value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    登录
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>用户名</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="你的昵称" className="pl-9"
                        value={regUsername} onChange={e => setRegUsername(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="your@email.com" className="pl-9"
                        value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="至少6位" className="pl-9"
                        value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                    </div>
                  </div>
                  {registerRequireCaptcha && (
                  <div className="space-y-2">
                    <Label>验证码</Label>
                    <div className="flex gap-2">
                      <Input placeholder="6位验证码" value={regCode} onChange={e => setRegCode(e.target.value)} />
                      <Button type="button" variant="outline" onClick={handleSendCode}
                        disabled={codeSending || countdown > 0} className="shrink-0 w-28">
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </Button>
                    </div>
                  </div>
                  )}
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    注册
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
