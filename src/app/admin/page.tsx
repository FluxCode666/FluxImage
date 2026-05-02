'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Users, ImageIcon, Megaphone, Plus, Trash2, ArrowLeft, Coins } from 'lucide-react'

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null }
function authHeaders() { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' } }

interface UserItem { id: number; username: string; email: string; role: string; drawing_points: number; creation_count: number; created_at: string }
interface InspirationItem { id: number; url: string; prompt: string | null }
interface AnnouncementItem { id: number; content: string; isActive: boolean; isImportant: boolean; createdAt: string }

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [inspirations, setInspirations] = useState<InspirationItem[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [newInspUrl, setNewInspUrl] = useState('')
  const [newInspPrompt, setNewInspPrompt] = useState('')
  const [newAnnContent, setNewAnnContent] = useState('')
  const [newAnnImportant, setNewAnnImportant] = useState(false)
  const [pointsUserId, setPointsUserId] = useState('')
  const [pointsAmount, setPointsAmount] = useState('')

  useEffect(() => { fetchUsers(); fetchInspirations(); fetchAnnouncements() }, [])

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setUsers(data.data)
      else if (res.status === 403) { toast.error('无管理员权限'); router.push('/') }
    } catch { toast.error('加载用户失败') }
  }
  async function fetchInspirations() {
    try {
      const res = await fetch('/api/admin/inspirations', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setInspirations(data.data)
    } catch {}
  }
  async function fetchAnnouncements() {
    try {
      const res = await fetch('/api/admin/announcements', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setAnnouncements(data.data)
    } catch {}
  }

  async function handleAddPoints() {
    if (!pointsUserId || !pointsAmount) { toast.error('请填写用户ID和积分'); return }
    try {
      const res = await fetch('/api/admin/users/points', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ user_id: pointsUserId, points: pointsAmount }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); fetchUsers(); setPointsUserId(''); setPointsAmount('') }
      else toast.error(data.error)
    } catch { toast.error('操作失败') }
  }

  async function handleAddInspiration() {
    if (!newInspUrl) { toast.error('请输入图片URL'); return }
    try {
      const res = await fetch('/api/admin/inspirations', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ url: newInspUrl, prompt: newInspPrompt }),
      })
      const data = await res.json()
      if (data.success) { toast.success('添加成功'); fetchInspirations(); setNewInspUrl(''); setNewInspPrompt('') }
      else toast.error(data.error)
    } catch { toast.error('添加失败') }
  }

  async function handleDeleteInspiration(id: number) {
    try {
      const res = await fetch(`/api/admin/inspirations/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (data.success) { toast.success('已删除'); setInspirations(i => i.filter(x => x.id !== id)) }
    } catch {}
  }

  async function handleAddAnnouncement() {
    if (!newAnnContent) { toast.error('请输入公告内容'); return }
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ content: newAnnContent, is_important: newAnnImportant }),
      })
      const data = await res.json()
      if (data.success) { toast.success('发布成功'); fetchAnnouncements(); setNewAnnContent(''); setNewAnnImportant(false) }
      else toast.error(data.error)
    } catch { toast.error('发布失败') }
  }

  async function handleToggleAnnouncement(id: number, isActive: boolean) {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ is_active: !isActive }),
      })
      const data = await res.json()
      if (data.success) fetchAnnouncements()
    } catch {}
  }

  async function handleDeleteAnnouncement(id: number) {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (data.success) { toast.success('已删除'); setAnnouncements(a => a.filter(x => x.id !== id)) }
    } catch {}
  }

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="text-2xl font-bold">管理后台</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />用户管理</TabsTrigger>
          <TabsTrigger value="inspirations" className="gap-2"><ImageIcon className="w-4 h-4" />灵感管理</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2"><Megaphone className="w-4 h-4" />公告管理</TabsTrigger>
        </TabsList>

        {/* 用户管理 */}
        <TabsContent value="users" className="space-y-4">
          <Card className="bg-card/80">
            <CardHeader><CardTitle className="text-base">调整积分</CardTitle></CardHeader>
            <CardContent className="flex gap-3 items-end">
              <div className="space-y-1"><Label className="text-xs">用户ID</Label><Input value={pointsUserId} onChange={e => setPointsUserId(e.target.value)} placeholder="ID" className="w-24" /></div>
              <div className="space-y-1"><Label className="text-xs">积分(负数为扣除)</Label><Input value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} placeholder="10" className="w-28" /></div>
              <Button onClick={handleAddPoints} className="gap-1"><Coins className="w-4 h-4" />执行</Button>
            </CardContent>
          </Card>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">用户名</th><th className="p-3 text-left">邮箱</th><th className="p-3 text-left">角色</th><th className="p-3 text-left">积分</th><th className="p-3 text-left">作品</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-border/50 hover:bg-secondary/20">
                    <td className="p-3">{u.id}</td>
                    <td className="p-3 font-medium">{u.username}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3"><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></td>
                    <td className="p-3">{u.drawing_points}</td>
                    <td className="p-3">{u.creation_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 灵感管理 */}
        <TabsContent value="inspirations" className="space-y-4">
          <Card className="bg-card/80">
            <CardHeader><CardTitle className="text-base">添加灵感图片</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="图片URL" value={newInspUrl} onChange={e => setNewInspUrl(e.target.value)} />
              <Input placeholder="提示词（可选）" value={newInspPrompt} onChange={e => setNewInspPrompt(e.target.value)} />
              <Button onClick={handleAddInspiration} className="gap-1"><Plus className="w-4 h-4" />添加</Button>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {inspirations.map(item => (
              <Card key={item.id} className="group overflow-hidden bg-secondary/30 border-none">
                <div className="aspect-square relative">
                  <img src={item.url} alt={item.prompt || ''} className="w-full h-full object-cover" />
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition h-7 w-7"
                    onClick={() => handleDeleteInspiration(item.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
                {item.prompt && <CardContent className="p-2"><p className="text-xs text-muted-foreground truncate">{item.prompt}</p></CardContent>}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 公告管理 */}
        <TabsContent value="announcements" className="space-y-4">
          <Card className="bg-card/80">
            <CardHeader><CardTitle className="text-base">发布公告</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="公告内容..." value={newAnnContent} onChange={e => setNewAnnContent(e.target.value)} />
              <div className="flex items-center gap-2">
                <Switch checked={newAnnImportant} onCheckedChange={setNewAnnImportant} />
                <Label className="text-sm">重要公告</Label>
              </div>
              <Button onClick={handleAddAnnouncement} className="gap-1"><Plus className="w-4 h-4" />发布</Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {announcements.map(item => (
              <Card key={item.id} className="bg-secondary/30 border-none">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm">{item.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isImportant && <Badge variant="destructive">重要</Badge>}
                    <Switch checked={item.isActive} onCheckedChange={() => handleToggleAnnouncement(item.id, item.isActive)} />
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteAnnouncement(item.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
