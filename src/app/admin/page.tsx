'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, ImageIcon, Megaphone, Plus, Trash2, ArrowLeft, Coins, Settings, Save, Pencil, Cloud, ArrowRightLeft, Server, HardDrive, Sun, Moon, Search, Shield, ShieldOff, UserX, X, Zap, RefreshCw, Minus, ChevronLeft, ChevronRight, Calendar, Palette, CreditCard, BarChart3, Package, DollarSign, ShoppingCart } from 'lucide-react'
import { LazyImage } from '@/components/ui/lazy-image'

const v = (name: string) => `var(--nb-${name})`

const Toggle = ({ checked, onChange, isDark }: { checked: boolean; onChange: () => void; isDark?: boolean }) => (
  <button onClick={onChange} className="relative w-10 h-5 rounded-full transition-colors shrink-0 cursor-pointer"
    style={{ background: checked ? '#3b82f6' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' }}>
    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: checked ? '22px' : '2px' }} />
  </button>
)
const Lbl = ({ children }: { children: React.ReactNode }) => <label className="text-[10px] uppercase tracking-wider font-bold block mb-1" style={{ color: v('text-muted') }}>{children}</label>
const Btn = ({ onClick, children, outline, disabled, className: cn }: { onClick: () => void; children: React.ReactNode; outline?: boolean; disabled?: boolean; className?: string }) => (
  <button onClick={onClick} disabled={disabled}
    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${cn || ''}`}
    style={outline
      ? { background: 'transparent', color: v('text-secondary'), border: `1px solid ${v('border')}`, borderRadius: v('radius-sm') }
      : { background: v('btn-primary'), color: '#fff', border: 'none', borderRadius: v('radius-sm') }}>
    {children}
  </button>
)
const SCard = ({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <div style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), padding: '20px' }}>
    {(title || right) && <div className="flex items-center justify-between mb-4">{title && <h3 className="text-sm font-bold" style={{ color: v('text') }}>{title}</h3>}{right}</div>}
    {children}
  </div>
)

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null }
function authHeaders() { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' } }

interface UserItem { id: number; username: string; email: string; role: string; drawing_points: number; creation_count: number; created_at: string }
interface InspirationItem { id: number; url: string; prompt: string | null }
interface AnnouncementItem { id: number; content: string; isActive: boolean; isImportant: boolean; createdAt: string }
interface ModelItem {
  id: number; model_id: string; display_name: string; icon: string; description: string
  is_enabled: boolean; sort_order: number; points_cost: number
}
interface ProviderItem {
  id: number; name: string; api_base_url: string; api_key: string
  priority: number; is_enabled: boolean; supported_models: string[]
  response_format: string
}

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
  const [userSearch, setUserSearch] = useState('')
  const [pointsDialogUser, setPointsDialogUser] = useState<UserItem | null>(null)
  const [dialogPointsAmount, setDialogPointsAmount] = useState('')
  const [userPage, setUserPage] = useState(0)
  const USER_PAGE_SIZE = 15

  // 系统配置
  const [sysConfig, setSysConfig] = useState<Record<string, string>>({})
  const [savedStorageProvider, setSavedStorageProvider] = useState('qiniu')
  const [models, setModels] = useState<ModelItem[]>([])
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editedCosts, setEditedCosts] = useState<Record<number, number>>({})
  const [newModel, setNewModel] = useState({ model_id: '', display_name: '', icon: '🤖', description: '', points_cost: 1 })

  // 供应商
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderItem | null>(null)
  const [newProvider, setNewProvider] = useState({ name: '', api_base_url: '', api_key: '', priority: 0, supported_models: [] as string[], response_format: 'url' })

  // 支付管理
  const [payProviders, setPayProviders] = useState<{ id: number; name: string; channel: string; app_id: string; private_key_tail: string; public_key_tail: string; notify_url: string | null; gateway: string; priority: number; is_enabled: boolean }[]>([])
  const [payPackages, setPayPackages] = useState<{ id: number; name: string; points: number; price: number; original_price: number | null; badge: string | null; is_enabled: boolean; sort_order: number }[]>([])
  const [payOrders, setPayOrders] = useState<any[]>([])
  const [payOrdersTotal, setPayOrdersTotal] = useState(0)
  const [payOrderPage, setPayOrderPage] = useState(0)
  const [payOrderStatus, setPayOrderStatus] = useState('')
  const [payStats, setPayStats] = useState<any>(null)
  const [showAddPayProvider, setShowAddPayProvider] = useState(false)
  const [newPayProvider, setNewPayProvider] = useState({ name: '', channel: 'alipay', app_id: '', private_key: '', public_key: '', notify_url: '', gateway: '', priority: 0 })
  const [editingPayProvider, setEditingPayProvider] = useState<{ id: number; name: string; channel: string; app_id: string; private_key: string; public_key: string; notify_url: string; gateway: string; priority: number } | null>(null)
  const [showAddPackage, setShowAddPackage] = useState(false)
  const [newPackage, setNewPackage] = useState({ name: '', points: '', price: '', original_price: '', badge: '', sort_order: '0' })
  const [paySubTab, setPaySubTab] = useState<'providers' | 'packages' | 'orders'>('providers')

  const [activeTab, setActiveTab] = useState('users')
  const [settingsTab, setSettingsTab] = useState('qiniu')
  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('themeMode') as 'system' | 'dark' | 'light') || 'system'
    return 'system'
  })
  const resolveTheme = (mode: 'system' | 'dark' | 'light'): 'dark' | 'light' => {
    if (mode === 'system') return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return mode
  }
  const [theme, setTheme] = useState<'dark' | 'light'>(() => resolveTheme(themeMode))
  useEffect(() => {
    document.documentElement.className = theme
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])
  function applyThemeMode(mode: 'system' | 'dark' | 'light') {
    setThemeMode(mode); localStorage.setItem('themeMode', mode); localStorage.removeItem('theme'); setTheme(resolveTheme(mode))
  }
  const isDark = theme === 'dark'

  useEffect(() => { fetchUsers(); fetchInspirations(); fetchAnnouncements(); fetchSysConfig(); fetchModels(); fetchProviders() }, [])

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
  async function handleDialogAddPoints() {
    if (!pointsDialogUser || !dialogPointsAmount) return
    try {
      const res = await fetch('/api/admin/users/points', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ user_id: String(pointsDialogUser.id), points: dialogPointsAmount }),
      })
      const data = await res.json()
      if (data.success) { toast.success(data.message); fetchUsers(); setPointsDialogUser(null); setDialogPointsAmount('') }
      else toast.error(data.error)
    } catch { toast.error('操作失败') }
  }
  async function handleToggleRole(u: UserItem) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`确定将用户 ${u.username} 的角色改为 ${newRole}？`)) return
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (data.success) { toast.success(`角色已更改为 ${newRole}`); fetchUsers() }
      else toast.error(data.error)
    } catch { toast.error('操作失败') }
  }
  async function handleDeleteUser(u: UserItem) {
    if (!confirm(`确定删除用户 ${u.username}？该操作不可恢复，用户的所有数据将被清除。`)) return
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (data.success) { toast.success('用户已删除'); setUsers(us => us.filter(x => x.id !== u.id)) }
      else toast.error(data.error)
    } catch { toast.error('删除失败') }
  }
  async function handleSaveModelPoints(m: ModelItem, newCost: number) {
    try {
      const res = await fetch(`/api/admin/models/${m.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ points_cost: newCost }),
      })
      const data = await res.json()
      if (data.success) { toast.success(`${m.display_name} 积分消耗已更新为 ${newCost}`); fetchModels() }
      else toast.error(data.error)
    } catch { toast.error('更新失败') }
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

  // ── 系统配置 & 模型管理 ──
  async function fetchSysConfig() {
    try {
      const res = await fetch('/api/admin/config', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) { setSysConfig(data.data); setSavedStorageProvider(data.data.storage_provider || 'qiniu') }
    } catch {}
  }
  async function fetchModels() {
    try {
      const res = await fetch('/api/admin/models', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setModels(data.data)
    } catch {}
  }
  async function handleSaveConfig() {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(sysConfig),
      })
      const data = await res.json()
      if (data.success) { toast.success('配置已保存'); setSavedStorageProvider(sysConfig.storage_provider || 'qiniu') }
      else toast.error(data.error)
    } catch { toast.error('保存失败') }
  }
  async function handleAddModel() {
    if (!newModel.model_id || !newModel.display_name) { toast.error('模型ID和名称不能为空'); return }
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(newModel),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('模型添加成功')
        fetchModels()
        setNewModel({ model_id: '', display_name: '', icon: '🤖', description: '', points_cost: 1 })
        setShowAddModel(false)
      } else toast.error(data.error)
    } catch { toast.error('添加失败') }
  }

  // ── 供应商管理 ──
  async function fetchProviders() {
    try {
      const res = await fetch('/api/admin/providers', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setProviders(data.data)
    } catch {}
  }
  async function handleAddProvider() {
    if (!newProvider.name || !newProvider.api_base_url || !newProvider.api_key) { toast.error('名称、API 域名和 API Key 不能为空'); return }
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(newProvider),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('供应商添加成功')
        fetchProviders()
        setNewProvider({ name: '', api_base_url: '', api_key: '', priority: 0, supported_models: [], response_format: 'url' })
        setShowAddProvider(false)
      } else toast.error(data.error)
    } catch { toast.error('添加失败') }
  }
  async function handleUpdateProvider(p: ProviderItem) {
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(p),
      })
      const data = await res.json()
      if (data.success) { toast.success('已更新'); fetchProviders(); setEditingProvider(null) }
      else toast.error(data.error)
    } catch { toast.error('更新失败') }
  }
  async function handleDeleteProvider(id: number) {
    if (!confirm('确定删除此供应商？')) return
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (data.success) { toast.success('已删除'); setProviders(ps => ps.filter(x => x.id !== id)) }
    } catch { toast.error('删除失败') }
  }
  async function handleToggleProviderEnabled(p: ProviderItem) {
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ is_enabled: !p.is_enabled }),
      })
      const data = await res.json()
      if (data.success) fetchProviders()
    } catch {}
  }
  async function handleUpdateModel(m: ModelItem) {
    try {
      const res = await fetch(`/api/admin/models/${m.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify(m),
      })
      const data = await res.json()
      if (data.success) { toast.success('已更新'); fetchModels(); setEditingModel(null) }
      else toast.error(data.error)
    } catch { toast.error('更新失败') }
  }
  async function handleDeleteModel(id: number) {
    if (!confirm('确定删除此模型？')) return
    try {
      const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      if (data.success) { toast.success('已删除'); setModels(ms => ms.filter(x => x.id !== id)) }
    } catch { toast.error('删除失败') }
  }
  const [cleanupLoading, setCleanupLoading] = useState(false)
  async function handleQiniuCleanup() {
    if (!confirm(`确定清理超过 ${sysConfig.qiniu_cleanup_days || '30'} 天的七牛云文件？`)) return
    setCleanupLoading(true)
    try {
      const res = await fetch('/api/admin/qiniu-cleanup', { method: 'POST', headers: authHeaders() })
      const data = await res.json()
      if (data.success) toast.success(data.message)
      else toast.error(data.error)
    } catch { toast.error('清理失败') }
    finally { setCleanupLoading(false) }
  }
  const [migrateLoading, setMigrateLoading] = useState(false)
  const [migrateSource, setMigrateSource] = useState('qiniu')
  const [migrateTarget, setMigrateTarget] = useState('minio')
  const storageOptions = [
    { value: 'qiniu', label: '七牛云' },
    { value: 'minio', label: 'MinIO' },
    { value: 'seaweedfs', label: 'SeaweedFS' },
  ]
  async function handleStorageMigrate() {
    if (migrateSource === migrateTarget) { toast.error('源平台和目标平台不能相同'); return }
    const srcLabel = storageOptions.find(o => o.value === migrateSource)?.label || migrateSource
    const tgtLabel = storageOptions.find(o => o.value === migrateTarget)?.label || migrateTarget
    if (!confirm(`确定将所有文件从「${srcLabel}」迁移到「${tgtLabel}」？此操作可能耗时较长。`)) return
    setMigrateLoading(true)
    try {
      const res = await fetch('/api/admin/storage-migrate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ source_type: migrateSource, target_type: migrateTarget }),
      })
      const data = await res.json()
      if (data.success) toast.success(data.message)
      else toast.error(data.error)
    } catch { toast.error('迁移失败') }
    finally { setMigrateLoading(false) }
  }
  async function handleToggleModelEnabled(m: ModelItem) {
    try {
      const res = await fetch(`/api/admin/models/${m.id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ is_enabled: !m.is_enabled }),
      })
      const data = await res.json()
      if (data.success) fetchModels()
    } catch {}
  }

  // ── 支付管理函数 ──
  async function fetchPayProviders() {
    try { const res = await fetch('/api/admin/payment/providers', { headers: authHeaders() }); const data = await res.json(); if (data.success) setPayProviders(data.data) } catch {}
  }
  async function fetchPayPackages() {
    try { const res = await fetch('/api/admin/payment/packages', { headers: authHeaders() }); const data = await res.json(); if (data.success) setPayPackages(data.data) } catch {}
  }
  async function fetchPayOrders(page = 0) {
    try {
      const params = new URLSearchParams({ page: String(page), size: '15' })
      if (payOrderStatus) params.set('status', payOrderStatus)
      const res = await fetch(`/api/admin/payment/orders?${params}`, { headers: authHeaders() })
      const data = await res.json()
      if (data.success) { setPayOrders(data.data); setPayOrdersTotal(data.total) }
    } catch {}
  }
  async function fetchPayStats() {
    try { const res = await fetch('/api/admin/payment/stats', { headers: authHeaders() }); const data = await res.json(); if (data.success) setPayStats(data.data) } catch {}
  }
  function getDefaultOrigin() {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }
  function buildNotifyUrl(origin: string, channel: string) {
    const base = (origin || getDefaultOrigin()).replace(/\/+$/, '')
    return `${base}/api/payment/notify/${channel}`
  }
  function extractOriginFromNotifyUrl(notifyUrl: string | null) {
    if (!notifyUrl) return ''
    const match = notifyUrl.match(/^(https?:\/\/[^/]+)/)
    return match ? match[1] : notifyUrl
  }
  async function handleAddPayProvider() {
    if (!newPayProvider.name || !newPayProvider.app_id || !newPayProvider.private_key) { toast.error('名称、APPID和私钥不能为空'); return }
    const payload = { ...newPayProvider, notify_url: buildNotifyUrl(newPayProvider.notify_url, newPayProvider.channel), gateway: newPayProvider.gateway || undefined }
    try {
      const res = await fetch('/api/admin/payment/providers', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) { toast.success('添加成功'); fetchPayProviders(); setNewPayProvider({ name: '', channel: 'alipay', app_id: '', private_key: '', public_key: '', notify_url: '', gateway: '', priority: 0 }); setShowAddPayProvider(false) }
      else toast.error(data.error)
    } catch { toast.error('添加失败') }
  }
  async function handleTogglePayProvider(p: typeof payProviders[0]) {
    try { await fetch(`/api/admin/payment/providers/${p.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ is_enabled: !p.is_enabled }) }); fetchPayProviders() } catch {}
  }
  async function handleDeletePayProvider(id: number) {
    if (!confirm('确定删除该支付渠道？')) return
    try { await fetch(`/api/admin/payment/providers/${id}`, { method: 'DELETE', headers: authHeaders() }); fetchPayProviders() } catch { toast.error('删除失败') }
  }
  function handleStartEditPayProvider(p: typeof payProviders[0]) {
    setEditingPayProvider({ id: p.id, name: p.name, channel: p.channel, app_id: p.app_id, private_key: '', public_key: '', notify_url: extractOriginFromNotifyUrl(p.notify_url), gateway: p.gateway || '', priority: p.priority })
    setShowAddPayProvider(false)
  }
  async function handleSavePayProvider() {
    if (!editingPayProvider) return
    const body: Record<string, unknown> = { name: editingPayProvider.name, channel: editingPayProvider.channel, app_id: editingPayProvider.app_id, notify_url: buildNotifyUrl(editingPayProvider.notify_url, editingPayProvider.channel), gateway: editingPayProvider.gateway || '', priority: editingPayProvider.priority }
    if (editingPayProvider.private_key) body.private_key = editingPayProvider.private_key
    if (editingPayProvider.public_key) body.public_key = editingPayProvider.public_key
    try {
      const res = await fetch(`/api/admin/payment/providers/${editingPayProvider.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) { toast.success('保存成功'); fetchPayProviders(); setEditingPayProvider(null) }
      else toast.error(data.error)
    } catch { toast.error('保存失败') }
  }
  async function handleAddPackage() {
    if (!newPackage.name || !newPackage.points || !newPackage.price) { toast.error('名称、积分和价格不能为空'); return }
    try {
      const res = await fetch('/api/admin/payment/packages', { method: 'POST', headers: authHeaders(), body: JSON.stringify(newPackage) })
      const data = await res.json()
      if (data.success) { toast.success('添加成功'); fetchPayPackages(); setNewPackage({ name: '', points: '', price: '', original_price: '', badge: '', sort_order: '0' }); setShowAddPackage(false) }
      else toast.error(data.error)
    } catch { toast.error('添加失败') }
  }
  async function handleTogglePackage(p: typeof payPackages[0]) {
    try { await fetch(`/api/admin/payment/packages/${p.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ is_enabled: !p.is_enabled }) }); fetchPayPackages() } catch {}
  }
  async function handleDeletePackage(id: number) {
    if (!confirm('确定删除该套餐？')) return
    try { await fetch(`/api/admin/payment/packages/${id}`, { method: 'DELETE', headers: authHeaders() }); fetchPayPackages() } catch { toast.error('删除失败') }
  }
  useEffect(() => {
    if (activeTab === 'payment') { fetchPayProviders(); fetchPayPackages(); fetchPayOrders() }
    if (activeTab === 'stats') fetchPayStats()
  }, [activeTab])
  useEffect(() => { if (activeTab === 'payment' && paySubTab === 'orders') fetchPayOrders(payOrderPage) }, [payOrderPage, payOrderStatus])

  const tabs = [
    { id: 'users', icon: <Users className="w-[18px] h-[18px]" />, title: '用户管理' },
    { id: 'points', icon: <Zap className="w-[18px] h-[18px]" />, title: '积分配置' },
    { id: 'inspirations', icon: <ImageIcon className="w-[18px] h-[18px]" />, title: '灵感管理' },
    { id: 'announcements', icon: <Megaphone className="w-[18px] h-[18px]" />, title: '公告管理' },
    { id: 'payment', icon: <CreditCard className="w-[18px] h-[18px]" />, title: '支付管理' },
    { id: 'stats', icon: <BarChart3 className="w-[18px] h-[18px]" />, title: '收入统计' },
    { id: 'settings', icon: <Settings className="w-[18px] h-[18px]" />, title: '系统配置' },
  ]
  const iStyle: React.CSSProperties = { background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm'), padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%' }

  return (
    <div className="flex h-screen w-full overflow-hidden transition-colors duration-300" style={{ background: v('bg'), color: v('text'), padding: '12px', gap: '12px' }}>
      {/* 侧栏 */}
      <div className="w-20 flex flex-col items-center py-8 shrink-0" style={{ background: v('panel'), borderRadius: v('panel-radius'), boxShadow: v('panel-shadow') }}>
        <div className="mb-6 text-xl">⚙️</div>
        <div className="flex flex-col items-center space-y-3 w-full">
          {tabs.map(t => (
            <button key={t.id} title={t.title} onClick={() => setActiveTab(t.id)}
              className="w-10 h-10 flex items-center justify-center transition-all rounded-xl hover:opacity-80"
              style={activeTab === t.id ? { background: v('active-bg'), color: v('active-color') } : { color: v('inactive-color') }}>
              {t.icon}
            </button>
          ))}
        </div>
        <div className="mt-auto pt-6 w-full flex flex-col items-center gap-3" style={{ borderTop: `1px solid ${v('border')}` }}>
          <div className="flex flex-col items-center gap-1">
            {([['system', '💻'], ['light', '☀️'], ['dark', '🌙']] as const).map(([mode, icon]) => (
              <button key={mode} onClick={() => applyThemeMode(mode)} title={mode === 'system' ? '跟随系统' : mode === 'light' ? '明亮' : '暗黑'}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
                style={themeMode === mode ? { background: v('active-bg') } : { color: v('inactive-color') }}>
                {icon}
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/')} title="返回首页" className="w-10 h-10 flex items-center justify-center rounded-xl hover:opacity-80 transition-all" style={{ color: v('inactive-color') }}>
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: v('panel'), borderRadius: v('panel-radius'), boxShadow: v('panel-shadow') }}>
        <div className="p-6 pb-4 shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
          <h1 className="text-xl font-bold">{tabs.find(t => t.id === activeTab)?.title}</h1>
          <p className="text-[11px] mt-1" style={{ color: v('text-muted') }}>
            {activeTab === 'users' && '管理用户账号、角色与积分'}{activeTab === 'points' && '配置每张图片消耗的积分数量'}{activeTab === 'inspirations' && '管理灵感社区图片'}{activeTab === 'announcements' && '管理系统公告'}{activeTab === 'payment' && '支付渠道、积分套餐与订单管理'}{activeTab === 'stats' && '收入趋势、渠道分析与套餐销量'}{activeTab === 'settings' && '站点展示、API、存储平台与模型管理'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ── 用户管理 ── */}
          {activeTab === 'users' && (() => {
            const filtered = users.filter(u =>
              !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()) || String(u.id) === userSearch
            )
            const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE))
            const paged = filtered.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE)
            return <>
              {/* 统计 & 搜索 */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-3">
                  {[
                    { label: '总用户', value: users.length, color: '#3b82f6' },
                    { label: '管理员', value: users.filter(u => u.role === 'admin').length, color: '#8b5cf6' },
                    { label: '总积分', value: users.reduce((s, u) => s + u.drawing_points, 0), color: '#10b981' },
                  ].map(s => (
                    <div key={s.label} className="px-4 py-3 text-center" style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), minWidth: '100px' }}>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: v('text-muted') }} />
                    <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(0) }}
                      placeholder="搜索用户名、邮箱或ID..."
                      style={{ ...iStyle, paddingLeft: '36px' }} />
                  </div>
                </div>
                <Btn onClick={fetchUsers} outline><RefreshCw className="w-3.5 h-3.5" />刷新</Btn>
              </div>

              {/* 用户表格 */}
              <div style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), overflow: 'hidden' }}>
                <table className="w-full text-sm">
                  <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                    {['ID','用户名','邮箱','角色','积分','作品','注册时间','操作'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{paged.map(u => (
                    <tr key={u.id} className="transition-colors" style={{ borderTop: `1px solid ${v('border')}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-3 text-xs" style={{ color: v('text-muted') }}>{u.id}</td>
                      <td className="p-3 text-xs font-medium">{u.username}</td>
                      <td className="p-3 text-xs" style={{ color: v('text-secondary') }}>{u.email}</td>
                      <td className="p-3">
                        <button onClick={() => handleToggleRole(u)} title="点击切换角色"
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                          style={u.role === 'admin' ? { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' } : { background: v('hover'), color: v('text-muted') }}>
                          {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}{u.role}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold" style={{ color: u.drawing_points > 0 ? '#10b981' : '#ef4444', minWidth: '32px' }}>{u.drawing_points}</span>
                          <button onClick={() => { setPointsDialogUser(u); setDialogPointsAmount('') }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: v('hover'), color: v('text-muted') }} title="调整积分">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-xs" style={{ color: v('text-secondary') }}>{u.creation_count}</td>
                      <td className="p-3 text-[10px]" style={{ color: v('text-muted') }}>
                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(u.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-3">
                        <button onClick={() => handleDeleteUser(u)} title="删除用户"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity" style={{ color: '#ef4444' }}>
                          <UserX className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${v('border')}` }}>
                    <span className="text-[10px]" style={{ color: v('text-muted') }}>共 {filtered.length} 个用户，第 {userPage + 1}/{totalPages} 页</span>
                    <div className="flex gap-1">
                      <button onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0}
                        className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30 hover:opacity-80 transition-opacity"
                        style={{ background: v('hover'), color: v('text-muted') }}><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setUserPage(p => Math.min(totalPages - 1, p + 1))} disabled={userPage >= totalPages - 1}
                        className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30 hover:opacity-80 transition-opacity"
                        style={{ background: v('hover'), color: v('text-muted') }}><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* 积分调整对话框 */}
              {pointsDialogUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setPointsDialogUser(null)}>
                  <div className="w-[400px]" style={{ background: v('panel'), borderRadius: v('radius-md'), boxShadow: '0 25px 50px rgba(0,0,0,0.25)', padding: '24px' }} onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold flex items-center gap-2"><Coins className="w-4 h-4" style={{ color: '#f59e0b' }} />调整积分</h3>
                      <button onClick={() => setPointsDialogUser(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: v('text-muted') }}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="mb-4 p-3 rounded-lg" style={{ background: v('card'), border: `1px solid ${v('border')}` }}>
                      <p className="text-xs"><span style={{ color: v('text-muted') }}>用户：</span><span className="font-medium">{pointsDialogUser.username}</span> <span style={{ color: v('text-muted') }}>#{pointsDialogUser.id}</span></p>
                      <p className="text-xs mt-1"><span style={{ color: v('text-muted') }}>当前积分：</span><span className="font-bold" style={{ color: '#10b981' }}>{pointsDialogUser.drawing_points}</span></p>
                    </div>
                    <Lbl>调整数量（正数增加，负数扣除）</Lbl>
                    <div className="flex gap-2 mb-4">
                      <div className="flex gap-1">
                        {[10, 50, 100, -10, -50].map(n => (
                          <button key={n} onClick={() => setDialogPointsAmount(String(n))}
                            className="px-2 py-1 text-[10px] font-medium rounded-md hover:opacity-80 transition-opacity"
                            style={n > 0 ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {n > 0 ? `+${n}` : n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input type="number" value={dialogPointsAmount} onChange={e => setDialogPointsAmount(e.target.value)} placeholder="输入积分数量" style={iStyle} autoFocus />
                    {dialogPointsAmount && <p className="text-[10px] mt-2" style={{ color: v('text-muted') }}>
                      操作后积分：<span className="font-bold" style={{ color: (pointsDialogUser.drawing_points + parseInt(dialogPointsAmount || '0')) >= 0 ? '#10b981' : '#ef4444' }}>
                        {pointsDialogUser.drawing_points + parseInt(dialogPointsAmount || '0')}
                      </span>
                    </p>}
                    <div className="flex justify-end gap-2 mt-4">
                      <Btn onClick={() => setPointsDialogUser(null)} outline>取消</Btn>
                      <Btn onClick={handleDialogAddPoints} disabled={!dialogPointsAmount}><Coins className="w-4 h-4" />确认调整</Btn>
                    </div>
                  </div>
                </div>
              )}
            </>
          })()}

          {/* ── 积分配置 ── */}
          {activeTab === 'points' && <>
            {/* 全局默认积分 */}
            <SCard title="全局默认积分消耗">
              <div className="space-y-4">
                <p className="text-xs" style={{ color: v('text-secondary') }}>设置新模型的默认积分消耗，已有模型可单独配置</p>
                <div className="flex items-center gap-3">
                  <div>
                    <Lbl>默认积分消耗</Lbl>
                    <input type="number" min="0" value={sysConfig.default_points_cost || '1'}
                      onChange={e => setSysConfig(c => ({ ...c, default_points_cost: e.target.value }))}
                      placeholder="1" style={{ ...iStyle, width: '120px' }} />
                  </div>
                  <div className="pt-4"><Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存</Btn></div>
                </div>
              </div>
            </SCard>

            {/* 各模型积分消耗 */}
            <SCard title="各模型积分消耗配置" right={
              <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: v('hover'), color: v('text-muted') }}>
                共 {models.length} 个模型
              </span>
            }>
              <div className="space-y-3">
                {models.length === 0 && (
                  <p className="text-xs text-center py-8" style={{ color: v('text-muted') }}>暂无模型，请先在「系统配置」中添加模型</p>
                )}
                {models.map(m => {
                  const displayCost = editedCosts[m.id] ?? m.points_cost
                  const hasUnsaved = editedCosts[m.id] !== undefined && editedCosts[m.id] !== m.points_cost
                  return (
                    <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl transition-all"
                      style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${hasUnsaved ? '#f59e0b' : v('border')}` }}>
                      {/* 模型信息 */}
                      <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg" style={{ background: v('card') }}>{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{m.display_name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: v('hover'), color: v('text-muted') }}>{m.model_id}</span>
                          {!m.is_enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>已禁用</span>}
                        </div>
                        {m.description && <p className="text-[10px] mt-0.5 truncate" style={{ color: v('text-muted') }}>{m.description}</p>}
                      </div>

                      {/* 积分调整区 */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleSaveModelPoints(m, displayCost - 1).then(() => setEditedCosts(c => { const n = { ...c }; delete n[m.id]; return n }))}
                            disabled={displayCost <= 1}
                            className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 hover:opacity-80 transition-all"
                            style={{ background: v('hover'), color: v('text-muted') }}>
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-16 text-center">
                            <input type="number" min="1" value={displayCost}
                              className="w-full text-center text-sm font-bold bg-transparent outline-none"
                              style={{ color: v('text'), border: 'none' }}
                              onChange={e => {
                                const val = parseInt(e.target.value)
                                if (!isNaN(val) && val >= 1) {
                                  setEditedCosts(c => ({ ...c, [m.id]: val }))
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = editedCosts[m.id]
                                  if (val !== undefined && val !== m.points_cost && val >= 1) {
                                    handleSaveModelPoints(m, val).then(() => setEditedCosts(c => { const n = { ...c }; delete n[m.id]; return n }))
                                  }
                                }
                              }}
                            />
                            <p className="text-[9px]" style={{ color: v('text-muted') }}>积分/张</p>
                          </div>
                          <button onClick={() => handleSaveModelPoints(m, displayCost + 1).then(() => setEditedCosts(c => { const n = { ...c }; delete n[m.id]; return n }))}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80 transition-all"
                            style={{ background: v('hover'), color: v('text-muted') }}>
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 保存按钮 */}
                        {hasUnsaved ? (
                          <Btn onClick={() => handleSaveModelPoints(m, editedCosts[m.id]).then(() => setEditedCosts(c => { const n = { ...c }; delete n[m.id]; return n }))}><Save className="w-3.5 h-3.5" />保存</Btn>
                        ) : (
                          <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: v('hover') }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${Math.min(100, (displayCost / Math.max(...models.map(x => x.points_cost), 1)) * 100)}%`,
                              background: displayCost <= 2 ? '#10b981' : displayCost <= 5 ? '#f59e0b' : '#ef4444',
                            }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SCard>

            {/* 积分说明 */}
            <SCard title="积分说明">
              <div className="space-y-2 text-xs" style={{ color: v('text-secondary') }}>
                <p>• 用户每次生成图片时，会根据所选模型扣除对应积分</p>
                <p>• 积分不足时用户无法生成图片</p>
                <p>• 可在「用户管理」中为用户手动调整积分</p>
                <p>• 新增模型时默认使用全局默认积分消耗值</p>
              </div>
            </SCard>
          </>}

          {/* ── 灵感管理 ── */}
          {activeTab === 'inspirations' && <>
            <SCard title="添加灵感图片">
              <div className="space-y-3">
                <input placeholder="图片URL" value={newInspUrl} onChange={e => setNewInspUrl(e.target.value)} style={iStyle} />
                <input placeholder="提示词（可选）" value={newInspPrompt} onChange={e => setNewInspPrompt(e.target.value)} style={iStyle} />
                <Btn onClick={handleAddInspiration}><Plus className="w-4 h-4" />添加</Btn>
              </div>
            </SCard>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {inspirations.map(item => (
                <div key={item.id} className="group overflow-hidden" style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
                  <div className="aspect-square relative overflow-hidden">
                    <LazyImage src={item.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => handleDeleteInspiration(item.id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {item.prompt && <div className="p-2"><p className="text-[10px] truncate" style={{ color: v('text-muted') }}>{item.prompt}</p></div>}
                </div>
              ))}
            </div>
          </>}

          {/* ── 公告管理 ── */}
          {activeTab === 'announcements' && <>
            <SCard title="发布公告">
              <div className="space-y-3">
                <textarea placeholder="公告内容..." value={newAnnContent} onChange={e => setNewAnnContent(e.target.value)} rows={3} style={{ ...iStyle, resize: 'vertical' as const }} />
                <div className="flex items-center gap-3">
                  <Toggle checked={newAnnImportant} onChange={() => setNewAnnImportant(!newAnnImportant)} isDark={isDark} />
                  <span className="text-xs" style={{ color: v('text-secondary') }}>重要公告</span>
                </div>
                <Btn onClick={handleAddAnnouncement}><Plus className="w-4 h-4" />发布</Btn>
              </div>
            </SCard>
            <div className="space-y-3">
              {announcements.map(item => (
                <div key={item.id} className="flex items-center gap-4" style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), padding: '16px' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: v('text-muted') }}>{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isImportant && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>重要</span>}
                    <Toggle checked={item.isActive} onChange={() => handleToggleAnnouncement(item.id, item.isActive)} isDark={isDark} />
                    <button onClick={() => handleDeleteAnnouncement(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity" style={{ color: v('text-muted') }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* ── 支付管理 ── */}
          {activeTab === 'payment' && <>
            {/* 子Tab */}
            <div className="flex gap-2">
              {([['providers', '支付渠道', CreditCard], ['packages', '积分套餐', Package], ['orders', '订单管理', ShoppingCart]] as const).map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setPaySubTab(tab)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all"
                  style={paySubTab === tab ? { background: v('active-bg'), color: v('active-color'), borderRadius: v('radius-sm') } : { color: v('text-muted'), borderRadius: v('radius-sm') }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* 支付渠道管理 */}
            {paySubTab === 'providers' && (
              <SCard title="支付渠道供应商" right={
                <div className="flex gap-2">
                  <Btn onClick={() => fetchPayProviders()} outline><RefreshCw className="w-3.5 h-3.5" />刷新</Btn>
                  <Btn onClick={() => setShowAddPayProvider(!showAddPayProvider)}><Plus className="w-4 h-4" />{showAddPayProvider ? '收起' : '添加渠道'}</Btn>
                </div>
              }>
                {showAddPayProvider && (
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${v('border')}`, borderRadius: v('radius-sm'), padding: '16px' }} className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Lbl>名称</Lbl><input value={newPayProvider.name} onChange={e => setNewPayProvider(p => ({ ...p, name: e.target.value }))} placeholder="支付宝主号" style={iStyle} /></div>
                      <div><Lbl>渠道</Lbl><select value={newPayProvider.channel} onChange={e => setNewPayProvider(p => ({ ...p, channel: e.target.value }))} style={iStyle}>
                        <option value="alipay">支付宝</option><option value="wechat">微信支付</option>
                      </select></div>
                      <div><Lbl>APPID</Lbl><input value={newPayProvider.app_id} onChange={e => setNewPayProvider(p => ({ ...p, app_id: e.target.value }))} placeholder="2021..." style={iStyle} /></div>
                      <div><Lbl>回调域名</Lbl><input value={newPayProvider.notify_url} onChange={e => setNewPayProvider(p => ({ ...p, notify_url: e.target.value }))} placeholder={getDefaultOrigin()} style={iStyle} /></div>
                      <div><Lbl>优先级</Lbl><input type="number" value={newPayProvider.priority} onChange={e => setNewPayProvider(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} style={iStyle} /></div>
                      <div><Lbl>网关地址 <span className="font-normal" style={{ color: v('text-muted') }}>(可选)</span></Lbl><input value={newPayProvider.gateway} onChange={e => setNewPayProvider(p => ({ ...p, gateway: e.target.value }))} placeholder="默认支付宝官方网关" style={iStyle} /></div>
                    </div>
                    <div><Lbl>应用私钥</Lbl><textarea value={newPayProvider.private_key} onChange={e => setNewPayProvider(p => ({ ...p, private_key: e.target.value }))} placeholder="MIIEvQIBADANBg..." rows={3} style={{ ...iStyle, resize: 'vertical' as const }} /></div>
                    <div><Lbl>支付宝公钥</Lbl><textarea value={newPayProvider.public_key} onChange={e => setNewPayProvider(p => ({ ...p, public_key: e.target.value }))} placeholder="MIIBIjANBg..." rows={3} style={{ ...iStyle, resize: 'vertical' as const }} /></div>
                    <Btn onClick={handleAddPayProvider}><Plus className="w-4 h-4" />确认添加</Btn>
                  </div>
                )}
                {editingPayProvider && (
                  <div style={{ background: isDark ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.04)', border: `1px solid rgba(59,130,246,0.3)`, borderRadius: v('radius-sm'), padding: '16px' }} className="space-y-3 mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: '#3b82f6' }}>编辑渠道 #{editingPayProvider.id}</span>
                      <button onClick={() => setEditingPayProvider(null)} className="w-6 h-6 flex items-center justify-center rounded hover:opacity-80" style={{ color: v('text-muted') }}><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Lbl>名称</Lbl><input value={editingPayProvider.name} onChange={e => setEditingPayProvider(p => p && ({ ...p, name: e.target.value }))} style={iStyle} /></div>
                      <div><Lbl>渠道</Lbl><select value={editingPayProvider.channel} onChange={e => setEditingPayProvider(p => p && ({ ...p, channel: e.target.value }))} style={iStyle}>
                        <option value="alipay">支付宝</option><option value="wechat">微信支付</option>
                      </select></div>
                      <div><Lbl>APPID</Lbl><input value={editingPayProvider.app_id} onChange={e => setEditingPayProvider(p => p && ({ ...p, app_id: e.target.value }))} style={iStyle} /></div>
                      <div><Lbl>回调域名</Lbl><input value={editingPayProvider.notify_url} onChange={e => setEditingPayProvider(p => p && ({ ...p, notify_url: e.target.value }))} placeholder={getDefaultOrigin()} style={iStyle} /></div>
                      <div><Lbl>优先级</Lbl><input type="number" value={editingPayProvider.priority} onChange={e => setEditingPayProvider(p => p && ({ ...p, priority: parseInt(e.target.value) || 0 }))} style={iStyle} /></div>
                      <div><Lbl>网关地址 <span className="font-normal" style={{ color: v('text-muted') }}>(可选)</span></Lbl><input value={editingPayProvider.gateway} onChange={e => setEditingPayProvider(p => p && ({ ...p, gateway: e.target.value }))} placeholder="默认支付宝官方网关" style={iStyle} /></div>
                    </div>
                    <div><Lbl>应用私钥 <span className="font-normal" style={{ color: v('text-muted') }}>（留空则不修改）</span></Lbl><textarea value={editingPayProvider.private_key} onChange={e => setEditingPayProvider(p => p && ({ ...p, private_key: e.target.value }))} placeholder="留空则保持原密钥不变" rows={3} style={{ ...iStyle, resize: 'vertical' as const }} /></div>
                    <div><Lbl>支付宝公钥 <span className="font-normal" style={{ color: v('text-muted') }}>（留空则不修改）</span></Lbl><textarea value={editingPayProvider.public_key} onChange={e => setEditingPayProvider(p => p && ({ ...p, public_key: e.target.value }))} placeholder="留空则保持原公钥不变" rows={3} style={{ ...iStyle, resize: 'vertical' as const }} /></div>
                    <div className="flex gap-2">
                      <Btn onClick={handleSavePayProvider}><Save className="w-4 h-4" />保存修改</Btn>
                      <Btn onClick={() => setEditingPayProvider(null)} outline><X className="w-4 h-4" />取消</Btn>
                    </div>
                  </div>
                )}
                {/* 调度模式 */}
                <div className="flex items-center gap-3 mb-4">
                  <Lbl>调度模式</Lbl>
                  <select value={sysConfig.payment_selection_mode || 'priority'} onChange={e => { setSysConfig(c => ({ ...c, payment_selection_mode: e.target.value })); handleSaveConfig() }} style={{ ...iStyle, width: 'auto' }}>
                    <option value="priority">按优先级</option><option value="round_robin">轮询</option>
                  </select>
                </div>
                <div style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm'), overflow: 'hidden' }}>
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      {['名称','渠道','APPID','私钥','网关','优先级','状态','操作'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{payProviders.map(p => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${v('border')}` }}>
                        <td className="p-3 text-xs font-medium">{p.name}</td>
                        <td className="p-3"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: p.channel === 'alipay' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: p.channel === 'alipay' ? '#3b82f6' : '#10b981' }}>{p.channel === 'alipay' ? '支付宝' : '微信'}</span></td>
                        <td className="p-3 font-mono text-[10px]">{p.app_id}</td>
                        <td className="p-3 text-[10px]" style={{ color: v('text-muted') }}>{p.private_key_tail}</td>
                        <td className="p-3 text-[10px] max-w-[180px] truncate" title={p.gateway || '默认'} style={{ color: v('text-muted') }}>{p.gateway || '默认'}</td>
                        <td className="p-3 text-xs">{p.priority}</td>
                        <td className="p-3"><Toggle checked={p.is_enabled} onChange={() => handleTogglePayProvider(p)} isDark={isDark} /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleStartEditPayProvider(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: '#3b82f6' }}><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDeletePayProvider(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {payProviders.length === 0 && <div className="p-8 text-center text-xs" style={{ color: v('text-muted') }}>暂无支付渠道</div>}
                </div>
              </SCard>
            )}

            {/* 积分套餐管理 */}
            {paySubTab === 'packages' && (
              <SCard title="积分套餐" right={
                <div className="flex gap-2">
                  <Btn onClick={() => fetchPayPackages()} outline><RefreshCw className="w-3.5 h-3.5" />刷新</Btn>
                  <Btn onClick={() => setShowAddPackage(!showAddPackage)}><Plus className="w-4 h-4" />{showAddPackage ? '收起' : '添加套餐'}</Btn>
                </div>
              }>
                {showAddPackage && (
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${v('border')}`, borderRadius: v('radius-sm'), padding: '16px' }} className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Lbl>套餐名称</Lbl><input value={newPackage.name} onChange={e => setNewPackage(p => ({ ...p, name: e.target.value }))} placeholder="新手礼包" style={iStyle} /></div>
                      <div><Lbl>积分数</Lbl><input type="number" value={newPackage.points} onChange={e => setNewPackage(p => ({ ...p, points: e.target.value }))} placeholder="100" style={iStyle} /></div>
                      <div><Lbl>售价（分）</Lbl><input type="number" value={newPackage.price} onChange={e => setNewPackage(p => ({ ...p, price: e.target.value }))} placeholder="1000 = ¥10" style={iStyle} /></div>
                      <div><Lbl>原价（分，选填）</Lbl><input type="number" value={newPackage.original_price} onChange={e => setNewPackage(p => ({ ...p, original_price: e.target.value }))} placeholder="划线价" style={iStyle} /></div>
                      <div><Lbl>角标</Lbl><input value={newPackage.badge} onChange={e => setNewPackage(p => ({ ...p, badge: e.target.value }))} placeholder="热门/推荐" style={iStyle} /></div>
                      <div><Lbl>排序</Lbl><input type="number" value={newPackage.sort_order} onChange={e => setNewPackage(p => ({ ...p, sort_order: e.target.value }))} style={iStyle} /></div>
                    </div>
                    <Btn onClick={handleAddPackage}><Plus className="w-4 h-4" />确认添加</Btn>
                  </div>
                )}
                {/* 直充比例配置 */}
                <div className="flex items-center gap-3 mb-4 p-3" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: v('radius-sm') }}>
                  <Lbl>直充比例: 1元 =</Lbl>
                  <input type="number" min="1" value={sysConfig.direct_recharge_rate || '10'}
                    onChange={e => setSysConfig(c => ({ ...c, direct_recharge_rate: e.target.value }))}
                    style={{ ...iStyle, width: '80px' }} />
                  <span className="text-xs" style={{ color: v('text-muted') }}>积分</span>
                  <Btn onClick={handleSaveConfig}><Save className="w-3.5 h-3.5" />保存</Btn>
                </div>
                <div style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm'), overflow: 'hidden' }}>
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      {['名称','积分','售价','原价','角标','排序','状态','操作'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{payPackages.map(p => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${v('border')}` }}>
                        <td className="p-3 text-xs font-medium">{p.name}</td>
                        <td className="p-3 text-xs font-bold text-blue-500">{p.points}</td>
                        <td className="p-3 text-xs">¥{(p.price / 100).toFixed(2)}</td>
                        <td className="p-3 text-xs" style={{ color: v('text-muted') }}>{p.original_price ? `¥${(p.original_price / 100).toFixed(2)}` : '-'}</td>
                        <td className="p-3">{p.badge ? <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{p.badge}</span> : '-'}</td>
                        <td className="p-3 text-xs">{p.sort_order}</td>
                        <td className="p-3"><Toggle checked={p.is_enabled} onChange={() => handleTogglePackage(p)} isDark={isDark} /></td>
                        <td className="p-3">
                          <button onClick={() => handleDeletePackage(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}><Trash2 className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {payPackages.length === 0 && <div className="p-8 text-center text-xs" style={{ color: v('text-muted') }}>暂无套餐</div>}
                </div>
              </SCard>
            )}

            {/* 订单管理 */}
            {paySubTab === 'orders' && (
              <SCard title="支付订单" right={
                <div className="flex items-center gap-2">
                  <select value={payOrderStatus} onChange={e => { setPayOrderStatus(e.target.value); setPayOrderPage(0) }} style={{ ...iStyle, width: 'auto' }}>
                    <option value="">全部状态</option>
                    <option value="pending">待支付</option>
                    <option value="paid">已支付</option>
                    <option value="expired">已过期</option>
                    <option value="failed">失败</option>
                  </select>
                  <Btn onClick={() => fetchPayOrders(payOrderPage)} outline><RefreshCw className="w-3.5 h-3.5" />刷新</Btn>
                </div>
              }>
                <div style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm'), overflow: 'hidden' }}>
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      {['订单号','用户','类型','积分','金额','渠道','状态','时间'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{payOrders.map((o: any) => (
                      <tr key={o.id} style={{ borderTop: `1px solid ${v('border')}` }}>
                        <td className="p-3 font-mono text-[10px]">{o.order_no}</td>
                        <td className="p-3 text-xs">{o.user?.username || '-'}</td>
                        <td className="p-3 text-xs">{o.package_name}</td>
                        <td className="p-3 text-xs font-bold text-blue-500">{o.points}</td>
                        <td className="p-3 text-xs">¥{(o.amount / 100).toFixed(2)}</td>
                        <td className="p-3"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: o.channel === 'alipay' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: o.channel === 'alipay' ? '#3b82f6' : '#10b981' }}>{o.channel === 'alipay' ? '支付宝' : o.channel}</span></td>
                        <td className="p-3"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          background: o.status === 'paid' ? 'rgba(16,185,129,0.15)' : o.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: o.status === 'paid' ? '#10b981' : o.status === 'pending' ? '#f59e0b' : '#ef4444',
                        }}>{o.status === 'paid' ? '已支付' : o.status === 'pending' ? '待支付' : o.status === 'expired' ? '已过期' : '失败'}</span></td>
                        <td className="p-3 text-[10px]" style={{ color: v('text-muted') }}>{new Date(o.created_at).toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {payOrders.length === 0 && <div className="p-8 text-center text-xs" style={{ color: v('text-muted') }}>暂无订单</div>}
                </div>
                {/* 分页 */}
                {payOrdersTotal > 15 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px]" style={{ color: v('text-muted') }}>共 {payOrdersTotal} 条，第 {payOrderPage + 1}/{Math.ceil(payOrdersTotal / 15)} 页</span>
                    <div className="flex gap-1">
                      <button onClick={() => setPayOrderPage(p => Math.max(0, p - 1))} disabled={payOrderPage === 0} className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30" style={{ background: v('hover'), color: v('text-muted') }}><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setPayOrderPage(p => p + 1)} disabled={(payOrderPage + 1) * 15 >= payOrdersTotal} className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30" style={{ background: v('hover'), color: v('text-muted') }}><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </SCard>
            )}
          </>}

          {/* ── 收入统计 ── */}
          {activeTab === 'stats' && payStats && <>
            {/* 汇总卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '今日收入', value: `¥${((payStats.summary.today_income || 0) / 100).toFixed(2)}`, sub: `${payStats.summary.today_count} 笔`, color: '#3b82f6' },
                { label: '本月收入', value: `¥${((payStats.summary.month_income || 0) / 100).toFixed(2)}`, sub: `${payStats.summary.month_count} 笔`, color: '#8b5cf6' },
                { label: '总收入', value: `¥${((payStats.summary.total_income || 0) / 100).toFixed(2)}`, sub: `${payStats.summary.total_count} 笔`, color: '#10b981' },
                { label: '总订单', value: payStats.summary.total_count.toLocaleString(), sub: '已支付', color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} className="p-4 text-center" style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>{s.label}</p>
                  <p className="text-[9px]" style={{ color: v('text-muted') }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* 近30天收入趋势 - SVG折线图 */}
            <SCard title="近30天收入趋势" right={<Btn onClick={fetchPayStats} outline><RefreshCw className="w-3.5 h-3.5" />刷新</Btn>}>
              {(() => {
                const data = payStats.daily_trend || []
                const maxVal = Math.max(...data.map((d: any) => d.amount), 1)
                const W = 700, H = 200, PX = 40, PY = 20
                const points = data.map((d: any, i: number) => ({
                  x: PX + (i / Math.max(data.length - 1, 1)) * (W - PX * 2),
                  y: PY + (1 - d.amount / maxVal) * (H - PY * 2),
                  amount: d.amount, date: d.date,
                }))
                const line = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
                const area = line + ` L${points[points.length - 1]?.x || W - PX},${H - PY} L${PX},${H - PY} Z`
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '220px' }}>
                    <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
                    {/* 网格线 */}
                    {[0, 0.25, 0.5, 0.75, 1].map(r => (
                      <g key={r}>
                        <line x1={PX} y1={PY + r * (H - PY * 2)} x2={W - PX} y2={PY + r * (H - PY * 2)} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
                        <text x={PX - 4} y={PY + r * (H - PY * 2) + 4} textAnchor="end" fontSize="9" fill={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}>¥{((1 - r) * maxVal / 100).toFixed(0)}</text>
                      </g>
                    ))}
                    <path d={area} fill="url(#areaGrad)" />
                    <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    {points.map((p: any, i: number) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" opacity={i === points.length - 1 ? 1 : 0.5}>
                        <title>{p.date}: ¥{(p.amount / 100).toFixed(2)}</title>
                      </circle>
                    ))}
                  </svg>
                )
              })()}
            </SCard>

            {/* 套餐销量排行 */}
            <SCard title="套餐销量排行">
              <div className="space-y-2">
                {(payStats.package_stats || []).map((p: any, i: number) => {
                  const maxCount = Math.max(...(payStats.package_stats || []).map((x: any) => x.count), 1)
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-24 truncate">{p.name}</span>
                      <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-[10px] w-16 text-right" style={{ color: v('text-muted') }}>{p.count}笔 ¥{(p.amount / 100).toFixed(0)}</span>
                    </div>
                  )
                })}
                {(!payStats.package_stats || payStats.package_stats.length === 0) && (
                  <div className="py-4 text-center text-xs" style={{ color: v('text-muted') }}>暂无销量数据</div>
                )}
              </div>
            </SCard>

            {/* 渠道收入占比 */}
            {payStats.channel_stats && payStats.channel_stats.length > 0 && (
              <SCard title="渠道收入占比">
                <div className="flex gap-4 flex-wrap">
                  {payStats.channel_stats.map((c: any, i: number) => {
                    const totalAmount = payStats.channel_stats.reduce((s: number, x: any) => s + (x.amount || 0), 0) || 1
                    const pct = ((c.amount / totalAmount) * 100).toFixed(1)
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                        <span className="text-xs">{c.channel === 'alipay' ? '支付宝' : c.channel}</span>
                        <span className="text-xs font-bold" style={{ color: colors[i % colors.length] }}>{pct}%</span>
                        <span className="text-[10px]" style={{ color: v('text-muted') }}>¥{(c.amount / 100).toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              </SCard>
            )}
          </>}

          {/* ── 系统配置 ── */}
          {activeTab === 'settings' && <>
            {/* 站点展示 */}
            <SCard title="站点展示配置" right={
              <span className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1" style={{ background: v('hover'), color: v('text-muted') }}>
                <Palette className="w-3 h-3" />可视化
              </span>
            }>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-stretch">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Lbl>网站名称</Lbl>
                      <input value={sysConfig.site_name ?? 'FluxImage'} onChange={e => setSysConfig(c => ({ ...c, site_name: e.target.value }))} placeholder="FluxImage" style={iStyle} />
                    </div>
                    <div>
                      <Lbl>网站副标题</Lbl>
                      <input value={sysConfig.site_subtitle ?? 'AI Creative Studio'} onChange={e => setSysConfig(c => ({ ...c, site_subtitle: e.target.value }))} placeholder="AI Creative Studio" style={iStyle} />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存站点</Btn>
                    <Btn onClick={() => setSysConfig(c => ({ ...c, site_name: 'FluxImage', site_subtitle: 'AI Creative Studio' }))} outline><RefreshCw className="w-3.5 h-3.5" />恢复默认</Btn>
                  </div>
                </div>
                <div className="min-h-[132px] flex flex-col justify-between overflow-hidden"
                  style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), padding: '18px', background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.08))' : 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.08))' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: v('text-muted') }}>Preview</p>
                    <h2 className="text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent break-words">
                      {(sysConfig.site_name || 'FluxImage').trim() || 'FluxImage'}
                    </h2>
                    <p className="text-[10px] tracking-widest uppercase mt-1 break-words" style={{ color: v('text-muted') }}>
                      {(sysConfig.site_subtitle || 'AI Creative Studio').trim() || 'AI Creative Studio'}
                    </p>
                  </div>
                  <span className="self-start text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />在线
                  </span>
                </div>
              </div>
            </SCard>

            {/* 供应商管理 */}
            <SCard title="API 供应商管理" right={
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: v('hover'), color: v('text-muted') }}>
                  共 {providers.length} 个供应商 · {providers.filter(p => p.is_enabled).length} 个启用
                </span>
                <Btn onClick={() => setShowAddProvider(!showAddProvider)} outline><Plus className="w-4 h-4" />{showAddProvider ? '收起' : '添加供应商'}</Btn>
              </div>
            }>
              <div className="space-y-4">
                {showAddProvider && (
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${v('border')}`, borderRadius: v('radius-sm'), padding: '16px' }} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div><Lbl>供应商名称</Lbl><input value={newProvider.name} onChange={e => setNewProvider(p => ({ ...p, name: e.target.value }))} placeholder="如：OpenAI 官方" style={iStyle} /></div>
                      <div><Lbl>API 域名</Lbl><input value={newProvider.api_base_url} onChange={e => setNewProvider(p => ({ ...p, api_base_url: e.target.value }))} placeholder="https://api.openai.com" style={iStyle} /></div>
                      <div><Lbl>API Key</Lbl><input type="password" value={newProvider.api_key} onChange={e => setNewProvider(p => ({ ...p, api_key: e.target.value }))} placeholder="sk-..." style={iStyle} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div><Lbl>优先级（越大越优先）</Lbl><input type="number" value={newProvider.priority} onChange={e => setNewProvider(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} style={{ ...iStyle, width: '120px' }} /></div>
                      <div><Lbl>响应格式</Lbl><select value={newProvider.response_format} onChange={e => setNewProvider(p => ({ ...p, response_format: e.target.value }))} style={iStyle}><option value="url">url</option><option value="b64_json">b64_json</option></select></div>
                      <div>
                        <Lbl>支持的模型（多选，留空或勾选 * 表示支持所有）</Lbl>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={newProvider.supported_models.includes('*')}
                              onChange={e => setNewProvider(p => ({ ...p, supported_models: e.target.checked ? ['*'] : [] }))} />
                            <span style={{ color: '#3b82f6', fontWeight: 600 }}>* 全部模型</span>
                          </label>
                          {models.map(m => (
                            <label key={m.model_id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input type="checkbox" disabled={newProvider.supported_models.includes('*')}
                                checked={newProvider.supported_models.includes('*') || newProvider.supported_models.includes(m.model_id)}
                                onChange={e => {
                                  setNewProvider(p => ({
                                    ...p,
                                    supported_models: e.target.checked
                                      ? [...p.supported_models.filter(x => x !== '*'), m.model_id]
                                      : p.supported_models.filter(x => x !== m.model_id),
                                  }))
                                }} />
                              {m.icon} {m.display_name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Btn onClick={handleAddProvider}><Plus className="w-4 h-4" />确认添加</Btn>
                  </div>
                )}
                <div style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm'), overflow: 'hidden' }}>
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      {['名称','API 域名','API Key','优先级','响应格式','支持模型','启用','操作'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{providers.map(p => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${v('border')}` }}>
                        {editingProvider?.id === p.id ? <>
                          <td className="p-2"><input value={editingProvider.name} onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }} /></td>
                          <td className="p-2"><input value={editingProvider.api_base_url} onChange={e => setEditingProvider({ ...editingProvider, api_base_url: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }} /></td>
                          <td className="p-2"><input type="password" value={editingProvider.api_key} onChange={e => setEditingProvider({ ...editingProvider, api_key: e.target.value })} placeholder="不修改请留空" style={{ ...iStyle, padding: '4px 8px' }} /></td>
                          <td className="p-2"><input type="number" value={editingProvider.priority} onChange={e => setEditingProvider({ ...editingProvider, priority: parseInt(e.target.value) || 0 })} style={{ ...iStyle, width: '72px', padding: '4px 8px' }} /></td>
                          <td className="p-2"><select value={editingProvider.response_format || 'url'} onChange={e => setEditingProvider({ ...editingProvider, response_format: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }}><option value="url">url</option><option value="b64_json">b64_json</option></select></td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              <label className="flex items-center gap-0.5 text-[10px] cursor-pointer">
                                <input type="checkbox" checked={editingProvider.supported_models.includes('*')}
                                  onChange={e => setEditingProvider({ ...editingProvider, supported_models: e.target.checked ? ['*'] : [] })} />
                                <span style={{ color: '#3b82f6' }}>*</span>
                              </label>
                              {models.map(m => (
                                <label key={m.model_id} className="flex items-center gap-0.5 text-[10px] cursor-pointer">
                                  <input type="checkbox" disabled={editingProvider.supported_models.includes('*')}
                                    checked={editingProvider.supported_models.includes('*') || editingProvider.supported_models.includes(m.model_id)}
                                    onChange={e => setEditingProvider({
                                      ...editingProvider,
                                      supported_models: e.target.checked
                                        ? [...editingProvider.supported_models.filter(x => x !== '*'), m.model_id]
                                        : editingProvider.supported_models.filter(x => x !== m.model_id),
                                    })} />
                                  {m.icon}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="p-2"><Toggle checked={editingProvider.is_enabled} onChange={() => setEditingProvider({ ...editingProvider, is_enabled: !editingProvider.is_enabled })} isDark={isDark} /></td>
                          <td className="p-2"><div className="flex gap-1">
                            <Btn onClick={() => handleUpdateProvider(editingProvider)}>保存</Btn>
                            <Btn onClick={() => setEditingProvider(null)} outline>取消</Btn>
                          </div></td>
                        </> : <>
                          <td className="p-3 text-xs font-medium">{p.name}</td>
                          <td className="p-3 text-xs font-mono" style={{ color: v('text-secondary') }}>{p.api_base_url}</td>
                          <td className="p-3 text-xs font-mono" style={{ color: v('text-muted') }}>{p.api_key ? '••••••' + p.api_key.slice(-4) : '-'}</td>
                          <td className="p-3"><span className="text-xs font-bold" style={{ color: '#3b82f6' }}>{p.priority}</span></td>
                          <td className="p-3"><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: p.response_format === 'b64_json' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)', color: p.response_format === 'b64_json' ? '#a855f7' : '#3b82f6' }}>{p.response_format || 'url'}</span></td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {p.supported_models.includes('*')
                                ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>全部模型</span>
                                : p.supported_models.map(mid => {
                                    const m = models.find(x => x.model_id === mid)
                                    return <span key={mid} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: v('hover'), color: v('text-secondary') }}>{m ? `${m.icon} ${m.display_name}` : mid}</span>
                                  })
                              }
                              {p.supported_models.length === 0 && <span className="text-[10px]" style={{ color: '#ef4444' }}>无</span>}
                            </div>
                          </td>
                          <td className="p-3"><Toggle checked={p.is_enabled} onChange={() => handleToggleProviderEnabled(p)} isDark={isDark} /></td>
                          <td className="p-3"><div className="flex gap-1">
                            <button onClick={() => setEditingProvider({ ...p })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: v('text-muted') }}><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDeleteProvider(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}><Trash2 className="w-3 h-3" /></button>
                          </div></td>
                        </>}
                      </tr>
                    ))}</tbody>
                  </table>
                  {providers.length === 0 && <p className="text-xs text-center py-8" style={{ color: v('text-muted') }}>暂无供应商，请添加至少一个供应商以启用 AI 服务</p>}
                </div>
                <div style={{ borderTop: `1px solid ${v('border')}`, paddingTop: '16px' }} className="space-y-4">
                  <div>
                    <Lbl>提示词字数限制</Lbl>
                    <input type="number" value={sysConfig.prompt_max_length || '5000'} onChange={e => setSysConfig(c => ({ ...c, prompt_max_length: e.target.value }))} placeholder="5000" style={{ ...iStyle, width: '128px' }} />
                    <p className="text-[10px] mt-1" style={{ color: v('text-muted') }}>用户输入提示词的最大字符数，默认 5000</p>
                  </div>
                  <div>
                    <Lbl>请求超时时间（秒）</Lbl>
                    <input type="number" value={sysConfig.ai_timeout || '180'} onChange={e => setSysConfig(c => ({ ...c, ai_timeout: e.target.value }))} placeholder="180" style={{ ...iStyle, width: '128px' }} />
                    <p className="text-[10px] mt-1" style={{ color: v('text-muted') }}>AI 生图请求的最大等待时间，默认 180 秒</p>
                  </div>
                  <div>
                    <Lbl>每日签到积分</Lbl>
                    <input type="number" value={sysConfig.checkin_points || '10'} onChange={e => setSysConfig(c => ({ ...c, checkin_points: e.target.value }))} placeholder="10" style={{ ...iStyle, width: '128px' }} />
                    <p className="text-[10px] mt-1" style={{ color: v('text-muted') }}>用户每天签到获得的积分数量，默认 10</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">允许用户自定义 API</p>
                      <p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>关闭后用户无法配置自己的 API Key</p>
                    </div>
                    <Toggle checked={sysConfig.allow_custom_api !== 'false'} onChange={() => setSysConfig(c => ({ ...c, allow_custom_api: String(c.allow_custom_api === 'false') }))} isDark={isDark} />
                  </div>
                  <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存配置</Btn>
                </div>
              </div>
            </SCard>

            {/* 数据源 */}
            <SCard title="当前数据源">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs">
                  <span style={{ color: v('text-muted') }}>当前激活:</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ background: v('active-bg'), color: v('active-color') }}>
                    {savedStorageProvider === 'minio' ? <><Server className="w-3 h-3" />MinIO</> : savedStorageProvider === 'seaweedfs' ? <><HardDrive className="w-3 h-3" />SeaweedFS</> : <><Cloud className="w-3 h-3" />七牛云</>}
                  </span>
                  {(sysConfig.storage_provider || 'qiniu') !== savedStorageProvider && <span className="text-amber-500 text-[10px]">(未保存)</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[{ k: 'qiniu', l: '七牛云', i: <Cloud className="w-3.5 h-3.5" /> }, { k: 'minio', l: 'MinIO', i: <Server className="w-3.5 h-3.5" /> }, { k: 'seaweedfs', l: 'SeaweedFS', i: <HardDrive className="w-3.5 h-3.5" /> }].map(o => {
                    const active = (sysConfig.storage_provider || 'qiniu') === o.k
                    return <button key={o.k} onClick={() => setSysConfig(c => ({ ...c, storage_provider: o.k }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-lg"
                      style={active ? { background: v('active-bg'), color: v('active-color') } : { background: v('hover'), color: v('text-muted'), border: `1px solid ${v('border')}` }}>
                      {o.i}{o.l}
                    </button>
                  })}
                </div>
                <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存数据源</Btn>
              </div>
            </SCard>

            {/* 平台配置 */}
            <SCard title="平台配置">
              <div className="flex gap-2 mb-4 flex-wrap">
                {[{ k: 'qiniu', l: '七牛云', i: <Cloud className="w-3.5 h-3.5" />, sp: 'qiniu' }, { k: 'minio', l: 'MinIO', i: <Server className="w-3.5 h-3.5" />, sp: 'minio' }, { k: 'seaweedfs', l: 'SeaweedFS', i: <HardDrive className="w-3.5 h-3.5" />, sp: 'seaweedfs' }].map(o => (
                  <button key={o.k} onClick={() => setSettingsTab(o.k)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-lg"
                    style={settingsTab === o.k ? { background: v('active-bg'), color: v('active-color') } : { color: v('text-muted'), background: v('hover') }}>
                    {o.i}{o.l}
                    {(sysConfig.storage_provider || 'qiniu') === o.sp && <span className="text-[9px] px-1.5 py-0 rounded-full ml-1" style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>使用中</span>}
                  </button>
                ))}
              </div>

              {settingsTab === 'qiniu' && <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>AccessKey</Lbl><input type="password" value={sysConfig.qiniu_access_key || ''} onChange={e => setSysConfig(c => ({ ...c, qiniu_access_key: e.target.value }))} placeholder="七牛 AccessKey" style={iStyle} /></div>
                  <div><Lbl>SecretKey</Lbl><input type="password" value={sysConfig.qiniu_secret_key || ''} onChange={e => setSysConfig(c => ({ ...c, qiniu_secret_key: e.target.value }))} placeholder="七牛 SecretKey" style={iStyle} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>Bucket 名称</Lbl><input value={sysConfig.qiniu_bucket || ''} onChange={e => setSysConfig(c => ({ ...c, qiniu_bucket: e.target.value }))} placeholder="your-bucket-name" style={iStyle} /></div>
                  <div><Lbl>CDN 域名</Lbl><input value={sysConfig.qiniu_domain || ''} onChange={e => setSysConfig(c => ({ ...c, qiniu_domain: e.target.value }))} placeholder="https://cdn.example.com" style={iStyle} /></div>
                </div>
                <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存配置</Btn>
              </div>}

              {settingsTab === 'minio' && <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>Endpoint</Lbl><input value={sysConfig.minio_endpoint || ''} onChange={e => setSysConfig(c => ({ ...c, minio_endpoint: e.target.value }))} placeholder="minio.example.com" style={iStyle} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Lbl>端口</Lbl><input type="number" value={sysConfig.minio_port || '9000'} onChange={e => setSysConfig(c => ({ ...c, minio_port: e.target.value }))} placeholder="9000" style={iStyle} /></div>
                    <div><Lbl>SSL</Lbl><div className="flex items-center h-9 gap-2"><Toggle checked={sysConfig.minio_use_ssl === 'true'} onChange={() => setSysConfig(c => ({ ...c, minio_use_ssl: String(c.minio_use_ssl !== 'true') }))} isDark={isDark} /><span className="text-xs" style={{ color: v('text-muted') }}>{sysConfig.minio_use_ssl === 'true' ? '启用' : '关闭'}</span></div></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>AccessKey</Lbl><input type="password" value={sysConfig.minio_access_key || ''} onChange={e => setSysConfig(c => ({ ...c, minio_access_key: e.target.value }))} placeholder="MinIO AccessKey" style={iStyle} /></div>
                  <div><Lbl>SecretKey</Lbl><input type="password" value={sysConfig.minio_secret_key || ''} onChange={e => setSysConfig(c => ({ ...c, minio_secret_key: e.target.value }))} placeholder="MinIO SecretKey" style={iStyle} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>Bucket 名称</Lbl><input value={sysConfig.minio_bucket || ''} onChange={e => setSysConfig(c => ({ ...c, minio_bucket: e.target.value }))} placeholder="your-bucket-name" style={iStyle} /></div>
                  <div><Lbl>公开访问域名</Lbl><input value={sysConfig.minio_domain || ''} onChange={e => setSysConfig(c => ({ ...c, minio_domain: e.target.value }))} placeholder="https://oss.example.com" style={iStyle} /></div>
                </div>
                <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存配置</Btn>
              </div>}

              {settingsTab === 'seaweedfs' && <div className="space-y-4">
                <p className="text-[10px]" style={{ color: v('text-muted') }}>通过 Filer HTTP 接口上传/下载文件，公开域名用于浏览器访问图片</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>Filer URL</Lbl><input value={sysConfig.seaweedfs_filer_url || ''} onChange={e => setSysConfig(c => ({ ...c, seaweedfs_filer_url: e.target.value }))} placeholder="http://localhost:8888" style={iStyle} /><p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>必填，服务端上传/下载用</p></div>
                  <div><Lbl>公开访问域名</Lbl><input value={sysConfig.seaweedfs_domain || ''} onChange={e => setSysConfig(c => ({ ...c, seaweedfs_domain: e.target.value }))} placeholder="http://your-ip:8888" style={iStyle} /><p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>必填，浏览器访问图片的地址（可填 Filer 公网地址或 CDN）</p></div>
                </div>
                <div><Lbl>Master URL</Lbl><input value={sysConfig.seaweedfs_master_url || ''} onChange={e => setSysConfig(c => ({ ...c, seaweedfs_master_url: e.target.value }))} placeholder="http://localhost:9333" style={{ ...iStyle, maxWidth: '320px' }} /><p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>可选</p></div>
                <div style={{ borderTop: `1px solid ${v('border')}`, paddingTop: '12px' }}><p className="text-xs font-medium mb-3">HTTP Basic Auth（可选）</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Lbl>用户名</Lbl><input value={sysConfig.seaweedfs_auth_user || ''} onChange={e => setSysConfig(c => ({ ...c, seaweedfs_auth_user: e.target.value }))} placeholder="nginx basic auth 用户名" style={iStyle} /></div>
                  <div><Lbl>密码</Lbl><input type="password" value={sysConfig.seaweedfs_auth_password || ''} onChange={e => setSysConfig(c => ({ ...c, seaweedfs_auth_password: e.target.value }))} placeholder="nginx basic auth 密码" style={iStyle} /></div>
                </div>
                <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存配置</Btn>
              </div>}
            </SCard>

            {/* 存储运维 */}
            <SCard title="存储运维">
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Lbl>自动清理天数</Lbl>
                    <input type="number" value={sysConfig.storage_cleanup_days || sysConfig.qiniu_cleanup_days || '30'} onChange={e => setSysConfig(c => ({ ...c, storage_cleanup_days: e.target.value }))} placeholder="30" style={{ ...iStyle, width: '128px' }} />
                    <p className="text-[10px] mt-0.5" style={{ color: v('text-muted') }}>超过此天数的 OSS 文件将在手动清理时被删除</p>
                  </div>
                  <Btn onClick={handleQiniuCleanup} outline disabled={cleanupLoading}><Trash2 className="w-3.5 h-3.5" />{cleanupLoading ? '清理中...' : '立即清理'}</Btn>
                </div>
                <div style={{ borderTop: `1px solid ${v('border')}`, paddingTop: '16px' }} className="space-y-2">
                  <Lbl>数据迁移</Lbl>
                  <p className="text-[10px]" style={{ color: v('text-muted') }}>将所有媒体文件从一个存储平台迁移到另一个</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={migrateSource} onChange={e => setMigrateSource(e.target.value)} style={{ ...iStyle, width: 'auto', padding: '6px 12px', fontSize: '12px' }}>
                      {storageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ArrowRightLeft className="w-4 h-4 shrink-0" style={{ color: v('text-muted') }} />
                    <select value={migrateTarget} onChange={e => setMigrateTarget(e.target.value)} style={{ ...iStyle, width: 'auto', padding: '6px 12px', fontSize: '12px' }}>
                      {storageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Btn onClick={handleStorageMigrate} outline disabled={migrateLoading || migrateSource === migrateTarget}><ArrowRightLeft className="w-3.5 h-3.5" />{migrateLoading ? '迁移中...' : '执行迁移'}</Btn>
                  </div>
                  {migrateSource === migrateTarget && <p className="text-[10px]" style={{ color: '#ef4444' }}>源平台和目标平台不能相同</p>}
                </div>
                <Btn onClick={handleSaveConfig}><Save className="w-4 h-4" />保存配置</Btn>
              </div>
            </SCard>

            {/* 模型管理 */}
            <SCard title="模型管理" right={<Btn onClick={() => setShowAddModel(!showAddModel)} outline><Plus className="w-4 h-4" />{showAddModel ? '收起' : '添加模型'}</Btn>}>
              <div className="space-y-4">
                {showAddModel && (
                  <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px dashed ${v('border')}`, borderRadius: v('radius-sm'), padding: '16px' }} className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Lbl>模型ID</Lbl><input value={newModel.model_id} onChange={e => setNewModel(m => ({ ...m, model_id: e.target.value }))} placeholder="gpt-image-2" style={iStyle} /></div>
                      <div><Lbl>显示名称</Lbl><input value={newModel.display_name} onChange={e => setNewModel(m => ({ ...m, display_name: e.target.value }))} placeholder="GPT Image 2" style={iStyle} /></div>
                      <div><Lbl>图标</Lbl><input value={newModel.icon} onChange={e => setNewModel(m => ({ ...m, icon: e.target.value }))} placeholder="🎨" style={{ ...iStyle, width: '80px' }} /></div>
                      <div><Lbl>积分消耗</Lbl><input type="number" value={newModel.points_cost} onChange={e => setNewModel(m => ({ ...m, points_cost: parseInt(e.target.value) || 1 }))} style={{ ...iStyle, width: '80px' }} /></div>
                    </div>
                    <div><Lbl>描述</Lbl><input value={newModel.description} onChange={e => setNewModel(m => ({ ...m, description: e.target.value }))} placeholder="模型描述" style={iStyle} /></div>
                    <Btn onClick={handleAddModel}><Plus className="w-4 h-4" />确认添加</Btn>
                  </div>
                )}
                <div style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm'), overflow: 'hidden' }}>
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      {['图标','模型ID','名称','描述','积分','排序','启用','操作'].map(h => <th key={h} className="p-3 text-left text-[10px] uppercase tracking-wider font-bold" style={{ color: v('text-muted') }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{models.map(m => (
                      <tr key={m.id} style={{ borderTop: `1px solid ${v('border')}` }}>
                        {editingModel?.id === m.id ? <>
                          <td className="p-2"><input value={editingModel.icon} onChange={e => setEditingModel({ ...editingModel, icon: e.target.value })} style={{ ...iStyle, width: '56px', textAlign: 'center', padding: '4px' }} /></td>
                          <td className="p-2 text-xs" style={{ color: v('text-muted') }}>{m.model_id}</td>
                          <td className="p-2"><input value={editingModel.display_name} onChange={e => setEditingModel({ ...editingModel, display_name: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }} /></td>
                          <td className="p-2"><input value={editingModel.description} onChange={e => setEditingModel({ ...editingModel, description: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }} /></td>
                          <td className="p-2"><input type="number" value={editingModel.points_cost} onChange={e => setEditingModel({ ...editingModel, points_cost: parseInt(e.target.value) || 1 })} style={{ ...iStyle, width: '64px', padding: '4px 8px' }} /></td>
                          <td className="p-2"><input type="number" value={editingModel.sort_order} onChange={e => setEditingModel({ ...editingModel, sort_order: parseInt(e.target.value) || 0 })} style={{ ...iStyle, width: '64px', padding: '4px 8px' }} /></td>
                          <td className="p-2"><Toggle checked={editingModel.is_enabled} onChange={() => setEditingModel({ ...editingModel, is_enabled: !editingModel.is_enabled })} isDark={isDark} /></td>
                          <td className="p-2"><div className="flex gap-1">
                            <Btn onClick={() => handleUpdateModel(editingModel)}>保存</Btn>
                            <Btn onClick={() => setEditingModel(null)} outline>取消</Btn>
                          </div></td>
                        </> : <>
                          <td className="p-3 text-lg">{m.icon}</td>
                          <td className="p-3 font-mono text-xs">{m.model_id}</td>
                          <td className="p-3 text-xs font-medium">{m.display_name}</td>
                          <td className="p-3 text-xs" style={{ color: v('text-muted') }}>{m.description}</td>
                          <td className="p-3 text-xs">{m.points_cost}</td>
                          <td className="p-3 text-xs">{m.sort_order}</td>
                          <td className="p-3"><Toggle checked={m.is_enabled} onChange={() => handleToggleModelEnabled(m)} isDark={isDark} /></td>
                          <td className="p-3"><div className="flex gap-1">
                            <button onClick={() => setEditingModel({ ...m })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: v('text-muted') }}><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDeleteModel(m.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: '#ef4444' }}><Trash2 className="w-3 h-3" /></button>
                          </div></td>
                        </>}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </SCard>
          </>}
        </div>
      </div>
    </div>
  )
}
