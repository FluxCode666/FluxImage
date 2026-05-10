'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSiteConfig } from '@/lib/use-site-config'
import { LazyImage } from '@/components/ui/lazy-image'

interface UserInfo {
  id: number; username: string; email: string; drawing_points: number
  creation_count: number; checkin_count: number; can_checkin: boolean; role: string
}
interface Creation {
  id: number; prompt: string; image_url: string; image_key?: string; model: string; size: string; title?: string | null; category?: string | null; created_at: string
}
interface GenerationTask {
  id: number; status: string; prompt: string | null; model: string | null; size: string | null; quantity: number; created_at: string
}
interface InspirationItem { id: number; url: string; prompt: string | null; model?: string | null }

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null }
function authHeaders() { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' } }

interface ModelOption { id: string; name: string; icon: string; desc: string; points_cost?: number }

const PASTEL_COLORS = ['#F8D7CC', '#D4EDDA', '#E8DEF3', '#FDEBD0', '#D1ECF1', '#F5C6CB']

// CSS var helpers
const v = (name: string) => `var(--nb-${name})`

// 阶段化提示文案：根据真实 status + 已用时长动态选择，每隔几秒在同组内轮换
const TASK_TIPS = {
  pending: ['任务已提交，正在排队…', '正在分配 AI 算力…', '马上为你启动绘画引擎…'],
  early: ['AI 正在解析你的提示词…', '正在理解创意构思…', '勾勒画面轮廓中…'],
  mid: ['AI 正在挥洒色彩…', '细节雕琢中…', '光影渲染中…'],
  late: ['正在精修最后细节…', '即将完成，最后润色中…', '收尾阶段，请稍候…'],
  long: ['复杂场景需要更多时间…', '画面较精细，正在耐心打磨…', '即将完工，再坚持一下…'],
  done: ['创作完成！'],
}

function pickTip(status: string, elapsed: number, tickIdx: number): string {
  let group: keyof typeof TASK_TIPS
  if (status === 'completed') group = 'done'
  else if (status === 'pending') group = 'pending'
  else if (elapsed < 10) group = 'early'
  else if (elapsed < 25) group = 'mid'
  else if (elapsed < 50) group = 'late'
  else group = 'long'
  const list = TASK_TIPS[group]
  return list[tickIdx % list.length]
}

// 基于真实 status + 已用时长推算进度（不再凭空假装）：
// - pending: 0% → 12%（缓慢爬升，提示排队中）
// - processing: 12% → 92%（按经验时长分段映射；超时后渐近 95%）
// - completed: 100%（瞬间锁定）
function computeProgress(status: string, elapsed: number): number {
  if (status === 'completed') return 100
  if (status === 'failed') return 0
  if (status === 'pending') {
    // 排队阶段最多到 12%，避免给用户「快好了」的错觉
    return Math.min(elapsed * 2.5, 12)
  }
  // processing
  if (elapsed < 6) return 12 + (elapsed / 6) * 23           // 12 → 35
  if (elapsed < 18) return 35 + ((elapsed - 6) / 12) * 30   // 35 → 65
  if (elapsed < 35) return 65 + ((elapsed - 18) / 17) * 22  // 65 → 87
  // 35s 之后渐近 95%，给用户"还在工作但需要更多时间"的诚实反馈
  return 87 + (1 - Math.exp(-(elapsed - 35) / 25)) * 8
}

function TaskCard({ task }: { task: GenerationTask; isDark: boolean }) {
  const [, forceTick] = useState(0)
  const createdTime = useRef<number>(Date.parse(task.created_at) || Date.now())

  // 用 ref 持有最新 status / created_at，避免重建定时器
  useEffect(() => {
    const parsed = Date.parse(task.created_at)
    if (!Number.isNaN(parsed)) createdTime.current = parsed
  }, [task.created_at])

  // 每 500ms 重渲染一次（驱动进度数字、文案轮换、计时器）
  useEffect(() => {
    const timer = setInterval(() => forceTick(t => t + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.max(0, (Date.now() - createdTime.current) / 1000)
  const progress = computeProgress(task.status, elapsed)
  const tipIdx = Math.floor(elapsed / 4) // 每 4s 轮换一句
  const tip = pickTip(task.status, elapsed, tipIdx)
  const isCompleted = task.status === 'completed'
  const isQueued = task.status === 'pending'
  const elapsedLabel = elapsed < 60 ? `${Math.floor(elapsed)}s` : `${Math.floor(elapsed / 60)}m${Math.floor(elapsed % 60)}s`

  return (
    <div className="break-inside-avoid mb-4 overflow-hidden relative"
      style={{ borderRadius: '16px', background: '#1a1a2e', aspectRatio: '1 / 1.1' }}>
      {/* 微光扫过动画 */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: '16px' }}>
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.12) 50%, rgba(59,130,246,0.08) 100%)',
        }} />
        <div className="absolute top-0 left-0 w-full h-full" style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
          animation: 'shimmer 2.5s ease-in-out infinite',
        }} />
      </div>
      {/* 居中内容 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="relative w-16 h-16 mb-3">
          {/* 外圈轨道 */}
          <svg className="w-16 h-16 absolute inset-0" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="url(#taskGrad)" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${progress * 1.76} ${176 - progress * 1.76}`}
              strokeDashoffset="44"
              className="transition-all duration-500 ease-out" />
            <defs>
              <linearGradient id="taskGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop stopColor={isCompleted ? '#34D399' : '#818CF8'} />
                <stop offset="1" stopColor={isCompleted ? '#10B981' : '#6366F1'} />
              </linearGradient>
            </defs>
          </svg>
          {/* 中心：排队显示动效点点 / 处理中显示百分比 / 完成显示 ✓ */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isCompleted ? (
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : isQueued ? (
              <span className="flex items-center gap-[3px]">
                <span className="w-1 h-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            ) : (
              <span className="text-lg font-semibold text-white/90 tabular-nums">
                {Math.round(progress)}<span className="text-xs text-white/50">%</span>
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-white/55 font-medium tracking-wide transition-opacity duration-300">{tip}</p>
        <p className="text-[10px] text-white/25 mt-1 tabular-nums">已用 {elapsedLabel}{isQueued ? '' : ' · 通常 20-60s'}</p>
        <p className="text-[10px] text-white/30 mt-3 px-2 text-center line-clamp-2 leading-relaxed">{task.prompt || ''}</p>
      </div>
      {/* 底部模型信息 */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 flex items-center justify-between"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.4))' }}>
        <span className="text-[10px] text-white/30 truncate max-w-[60%]">{task.model || ''}</span>
        {task.quantity > 1 && <span className="text-[10px] text-white/30">×{task.quantity}</span>}
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { siteName, siteSubtitle, promptMaxLength } = useSiteConfig()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('nano-banana')
  const [modelOpen, setModelOpen] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(false)
  const [inspirations, setInspirations] = useState<InspirationItem[]>([])
  const [works, setWorks] = useState<Creation[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [referenceKeys, setReferenceKeys] = useState<(string | null)[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState('https://flux-code.cc')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [MODELS, setMODELS] = useState<ModelOption[]>([])
  const [allowCustomApi, setAllowCustomApi] = useState(true)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [uiVersion, setUiVersion] = useState<'new' | 'classic'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('uiVersion') as 'new' | 'classic') || 'new'
    }
    return 'new'
  })
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [showNotice, setShowNotice] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [imageSize, setImageSize] = useState('auto')
  const [mobileTab, setMobileTab] = useState<'create' | 'inspire'>('create')
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState<{ type: 'work' | 'inspiration'; data: Creation | InspirationItem } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [inspCategory, setInspCategory] = useState('')
  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('themeMode') as 'system' | 'dark' | 'light') || 'system'
    }
    return 'system'
  })
  const resolveTheme = (mode: 'system' | 'dark' | 'light'): 'dark' | 'light' => {
    if (mode === 'system') return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    return mode
  }
  const [theme, setTheme] = useState<'dark' | 'light'>(() => resolveTheme(themeMode))
  const [currentPage, setCurrentPage] = useState<'create' | 'inspire'>('create')
  const [selectedInspiration, setSelectedInspiration] = useState<InspirationItem | null>(null)
  const [selectedWork, setSelectedWork] = useState<Creation | null>(null)
  const [activeTasks, setActiveTasks] = useState<GenerationTask[]>([])
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [inspHasMore, setInspHasMore] = useState(true)
  const [inspCursor, setInspCursor] = useState<number | null>(null)
  const [inspLoading, setInspLoading] = useState(false)
  const inspScrollRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutMenuRef = useRef<HTMLDivElement>(null)
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeTab, setRechargeTab] = useState<'package' | 'direct'>('package')
  const [rechargePackages, setRechargePackages] = useState<{ id: number; name: string; points: number; price: number; original_price: number | null; badge: string | null }[]>([])
  const [directRate, setDirectRate] = useState(10)
  const [directMin, setDirectMin] = useState(100)
  const [directMax, setDirectMax] = useState(100000)
  const [directAmount, setDirectAmount] = useState('')
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null)
  const [payQrCode, setPayQrCode] = useState<string | null>(null)
  const [payOrderNo, setPayOrderNo] = useState<string | null>(null)
  const [payStatus, setPayStatus] = useState<'idle' | 'loading' | 'qr' | 'success' | 'error'>('idle')
  const [payError, setPayError] = useState('')
  const payPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    setThemeMode(mode)
    localStorage.setItem('themeMode', mode)
    localStorage.removeItem('theme')
    setTheme(resolveTheme(mode))
  }

  const isDark = theme === 'dark'

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/login'); return }
    fetchUser(); fetchAnnouncement(); fetchModels()
  }, [])
  useEffect(() => {
    if (!showLogoutMenu) return
    const handler = (e: MouseEvent) => {
      if (logoutMenuRef.current && !logoutMenuRef.current.contains(e.target as Node)) setShowLogoutMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLogoutMenu])

  async function fetchModels() {
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      if (data.success && data.data?.length) {
        setMODELS(data.data)
        setAllowCustomApi(data.allow_custom_api !== false)
        if (!data.data.find((m: ModelOption) => m.id === model)) setModel(data.data[0].id)
      }
    } catch {}
  }

  async function fetchUser() {
    try { const res = await fetch('/api/user/info', { headers: authHeaders() }); const data = await res.json(); if (data.success) setUser(data.data); else { localStorage.removeItem('token'); router.push('/login') } } catch { localStorage.removeItem('token'); router.push('/login') }
  }
  async function fetchInspirations(reset = true, search = '', category = '') {
    if (inspLoading) return
    setInspLoading(true)
    try {
      const cursor = reset ? 0 : (inspCursor || 0)
      const params = new URLSearchParams({ limit: '20' })
      if (cursor > 0) params.set('cursor', String(cursor))
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      const res = await fetch(`/api/image/inspirations?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        if (reset) {
          setInspirations(data.data)
        } else {
          setInspirations(prev => [...prev, ...data.data])
        }
        setInspHasMore(!!data.hasMore)
        setInspCursor(data.nextCursor ?? null)
      } else if (reset) {
        setInspirations([])
        setInspHasMore(false)
      }
    } catch {
      if (reset) { setInspirations([]); setInspHasMore(false) }
    }
    setInspLoading(false)
  }
  function loadMoreInspirations() {
    if (!inspHasMore || inspLoading) return
    fetchInspirations(false, searchQuery, inspCategory)
  }
  async function fetchWorks() {
    try { const res = await fetch('/api/image/history', { headers: authHeaders() }); const data = await res.json(); if (data.success) setWorks(data.data || []) } catch {}
  }
  async function fetchActiveTasks() {
    try {
      const res = await fetch('/api/image/tasks', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) {
        setActiveTasks(data.data || [])
        return data.data || []
      }
    } catch {}
    return []
  }
  function startPolling(taskIds: number[]) {
    stopPolling()
    if (taskIds.length === 0) return
    // 已经处理完毕但仍在动画延迟期内的 task，避免重复 toast / fetch
    const settled = new Set<number>()
    pollingRef.current = setInterval(async () => {
      let anyPending = false
      for (const tid of taskIds) {
        if (settled.has(tid)) continue
        try {
          const res = await fetch(`/api/image/task/${tid}`, { headers: authHeaders() })
          const data = await res.json()
          if (data.success) {
            const t = data.data
            if (t.status === 'completed') {
              settled.add(tid)
              // 先将 UI 状态切到 completed，让 TaskCard 显示 100% + ✓ 完成态
              setActiveTasks(prev => prev.map(x => x.id === tid ? { ...x, status: 'completed' } : x))
              toast.success('图片生成完成！')
              fetchWorks()
              fetchUser()
              // 短暂展示完成动画后再从列表中移除
              setTimeout(() => {
                setActiveTasks(prev => prev.filter(x => x.id !== tid))
              }, 900)
            } else if (t.status === 'failed') {
              settled.add(tid)
              toast.error(t.error || '生成失败')
              setActiveTasks(prev => prev.filter(x => x.id !== tid))
            } else {
              // 同步后端真实 status（pending → processing 切换会被前端感知）
              setActiveTasks(prev => prev.map(x =>
                x.id === tid && x.status !== t.status ? { ...x, status: t.status } : x
              ))
              anyPending = true
            }
          } else {
            anyPending = true
          }
        } catch { anyPending = true }
      }
      if (!anyPending) stopPolling()
    }, 3000)
  }
  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }
  async function fetchAnnouncement() {
    try { const res = await fetch('/api/image/public/announcement'); const data = await res.json(); if (data.success && data.data) { setAnnouncement(data.data.content); setShowNotice(true) } } catch {}
  }
  async function fetchApiKeyStatus() {
    try { const res = await fetch('/api/user/api-keys', { headers: authHeaders() }); const data = await res.json(); setHasApiKey(data.success && data.has_key) } catch {}
  }
  async function handleCheckin() {
    try { const res = await fetch('/api/user/checkin', { method: 'POST', headers: authHeaders() }); const data = await res.json(); if (data.success) { toast.success(`签到成功！获得 ${data.data?.points_earned || 10} 积分`); fetchUser() } else toast.error(data.error) } catch { toast.error('签到失败') }
  }
  async function handleGenerate() {
    if (!prompt.trim()) { toast.error('请输入提示词'); return }
    setLoading(true)
    try {
      if (previewUrls.length > 0) {
        const formData = new FormData(); formData.append('prompt', prompt); formData.append('model', model)
        referenceKeys.forEach((key, i) => {
          if (key) { formData.append('image_key', key) }
          else if (uploadedFiles[i]) { formData.append('image', uploadedFiles[i]) }
        })
        const res = await fetch('/api/image/edit', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData }); const data = await res.json()
        if (data.success && data.task_id) {
          toast.success('任务已提交，正在后台生成...')
          const newTask: GenerationTask = { id: data.task_id, status: 'pending', prompt, model, size: null, quantity: 1, created_at: new Date().toISOString() }
          setActiveTasks(prev => [newTask, ...prev])
          startPolling([...(activeTasks.map(t => t.id)), data.task_id])
        } else toast.error(data.error || '生成失败')
      } else {
        const sizeParam = (model === 'gpt-image-2' || model === 'gpt-4o-image') && imageSize !== 'auto' ? imageSize : undefined
        const res = await fetch('/api/image/generate', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ prompt, model, quantity, size: sizeParam }) }); const data = await res.json()
        if (data.success && data.task_id) {
          toast.success('任务已提交，正在后台生成...')
          const newTask: GenerationTask = { id: data.task_id, status: 'pending', prompt, model, size: sizeParam || null, quantity: parseInt(quantity) || 1, created_at: new Date().toISOString() }
          setActiveTasks(prev => [newTask, ...prev])
          startPolling([...(activeTasks.map(t => t.id)), data.task_id])
        } else toast.error(data.error || '生成失败')
      }
    } catch { toast.error('请求失败，请重试') }
    setLoading(false)
  }
  async function handleDeleteWork(id: number) {
    try { const res = await fetch(`/api/image/delete/${id}`, { method: 'DELETE', headers: authHeaders() }); const data = await res.json(); if (data.success) { toast.success('已删除'); setWorks(w => w.filter(i => i.id !== id)) } } catch {}
  }
  async function saveApiKey() {
    if (!apiKeyInput.trim()) return
    try { const res = await fetch('/api/user/api-keys', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ api_key: apiKeyInput, api_base_url: apiBaseUrlInput }) }); const data = await res.json(); if (data.success) { toast.success('保存成功'); setShowApiKeyModal(false); setHasApiKey(true) } else toast.error(data.error || '保存失败') } catch { toast.error('保存失败') }
  }
  async function deleteApiKey() {
    try { const res = await fetch('/api/user/api-keys', { method: 'DELETE', headers: authHeaders() }); if (res.ok) { toast.success('已删除'); setHasApiKey(false) } } catch {}
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (files.length + previewUrls.length > 3) { toast.error('最多上传3张'); return }
    setUploadedFiles(prev => [...prev, ...files]); setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]); setReferenceKeys(prev => [...prev, ...files.map(() => null)])
  }
  function removeFile(idx: number) { setUploadedFiles(prev => prev.filter((_, i) => i !== idx)); setPreviewUrls(prev => prev.filter((_, i) => i !== idx)); setReferenceKeys(prev => prev.filter((_, i) => i !== idx)) }
  function useAsReference(imageUrl: string, imageKey?: string) {
    if (previewUrls.length >= 3) { toast.error('参考图最多3张'); return }
    setPreviewUrls(prev => [...prev, imageUrl])
    setReferenceKeys(prev => [...prev, imageKey || null])
    setUploadedFiles(prev => [...prev]) // keep length in sync placeholder
    toast.success('已添加为参考图')
  }
  function handleLogout() { localStorage.clear(); sessionStorage.clear(); router.push('/login') }
  async function handleDownloadImage(url: string, filename?: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename || url.split('/').pop() || 'image.png'
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('下载已开始')
    } catch { toast.error('下载失败') }
  }
  function handleCopyPrompt(prompt: string | null) {
    if (!prompt) { toast.error('无提示词可复制'); return }
    navigator.clipboard.writeText(prompt).then(() => toast.success('提示词已复制')).catch(() => toast.error('复制失败'))
  }
  async function handleShareWork(id: number) {
    try {
      const res = await fetch('/api/image/share', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ creation_id: id }) })
      const data = await res.json()
      if (data.success) toast.success('已分享到灵感社区')
      else toast.error(data.error || '分享失败')
    } catch { toast.error('分享失败') }
  }
  function applyPrompt(p: string | null) { if (p) { setPrompt(p); setCurrentPage('create'); toast.success('已应用提示词') } }

  // 搜索 debounce：输入 400ms 后触发搜索
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setInspCursor(null)
      setInspHasMore(true)
      fetchInspirations(true, searchQuery, inspCategory)
    }, 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchQuery, inspCategory])

  // 滚动加载更多
  const handleInspScroll = useCallback(() => {
    const el = inspScrollRef.current
    if (!el || inspLoading || !inspHasMore) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      loadMoreInspirations()
    }
  }, [inspLoading, inspHasMore, inspCursor, searchQuery, inspCategory])

  useEffect(() => {
    const el = inspScrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleInspScroll)
    return () => el.removeEventListener('scroll', handleInspScroll)
  }, [handleInspScroll])

  useEffect(() => {
    if (currentPage === 'create') {
      fetchWorks()
      // 页面切到创作时，检查是否有未完成的任务并恢复轮询
      fetchActiveTasks().then((tasks: GenerationTask[]) => {
        if (tasks.length > 0) startPolling(tasks.map((t: GenerationTask) => t.id))
      })
    } else if (currentPage === 'inspire') {
      fetchInspirations(true, searchQuery, inspCategory)
    }
    return () => stopPolling()
  }, [currentPage])

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0] || { id: '', name: '加载中...', icon: '⏳', desc: '' }

  /* ===== 充值相关函数 ===== */
  async function openRecharge() {
    setShowRecharge(true)
    setPayStatus('idle')
    setPayQrCode(null)
    setPayOrderNo(null)
    setPayError('')
    setSelectedPkgId(null)
    setDirectAmount('')
    try {
      const res = await fetch('/api/payment/packages')
      const data = await res.json()
      if (data.success) {
        setRechargePackages(data.data.packages)
        setDirectRate(data.data.directRecharge.rate)
        setDirectMin(data.data.directRecharge.minAmount)
        setDirectMax(data.data.directRecharge.maxAmount)
      }
    } catch {}
  }

  function closeRecharge() {
    setShowRecharge(false)
    if (payPollRef.current) { clearInterval(payPollRef.current); payPollRef.current = null }
    setPayStatus('idle')
    setPayQrCode(null)
    setPayOrderNo(null)
  }

  async function handlePay() {
    setPayStatus('loading')
    setPayError('')
    try {
      const body: Record<string, unknown> = {}
      if (rechargeTab === 'package' && selectedPkgId) {
        body.package_id = selectedPkgId
      } else if (rechargeTab === 'direct' && directAmount) {
        body.amount = Math.round(parseFloat(directAmount) * 100)
      } else {
        setPayError(rechargeTab === 'package' ? '请选择套餐' : '请输入金额')
        setPayStatus('idle')
        return
      }
      const res = await fetch('/api/payment/create', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.success) { setPayError(data.error || '创建订单失败'); setPayStatus('error'); return }
      setPayQrCode(data.data.qr_code)
      setPayOrderNo(data.data.order_no)
      setPayStatus('qr')
      // 开始轮询订单状态
      if (payPollRef.current) clearInterval(payPollRef.current)
      payPollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`/api/payment/status/${data.data.order_no}`, { headers: authHeaders() })
          const sd = await sr.json()
          if (sd.success && sd.data.status === 'paid') {
            if (payPollRef.current) { clearInterval(payPollRef.current); payPollRef.current = null }
            setPayStatus('success')
            toast.success(`充值成功！获得 ${sd.data.points} 积分`)
            fetchUser()
            setTimeout(() => closeRecharge(), 1500)
          }
        } catch {}
      }, 2000)
      // 15分钟后停止轮询
      setTimeout(() => { if (payPollRef.current) { clearInterval(payPollRef.current); payPollRef.current = null } }, 15 * 60 * 1000)
    } catch { setPayError('网络请求失败'); setPayStatus('error') }
  }

  useEffect(() => { return () => { if (payPollRef.current) clearInterval(payPollRef.current) } }, [])

  /* ===== 侧栏按钮定义 ===== */
  type SidebarBtn = { id: string; icon: React.ReactNode; title: string; page?: 'create' | 'inspire'; onClick?: () => void; href?: string }
  const sidebarButtons: SidebarBtn[] = [
    { id: 'create', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>, title: '创作', page: 'create' },
    { id: 'inspire', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>, title: '灵感', page: 'inspire' },
    { id: 'notice', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>, title: '公告', onClick: () => setShowNotice(true) },
    { id: 'recharge', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>, title: '充值', onClick: () => openRecharge() },
  ]

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: v('bg') }}>
      <div className="animate-pulse" style={{ color: v('text-muted') }}>加载中...</div>
    </div>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden transition-colors duration-300"
      style={{ background: v('bg'), color: v('text'), padding: '12px', gap: '12px' }}>

      {/* ===== 左侧图标栏 ===== */}
      <div className="hidden lg:flex w-20 flex-col items-center py-8 shrink-0 z-10 relative transition-all duration-300"
        style={{ background: v('panel'), borderRadius: v('panel-radius'), boxShadow: v('panel-shadow') }}>
        <img src="/logo.png" alt="Logo" className="mb-8 w-9 h-9 rounded-lg object-contain" />
        <div className="flex flex-col items-center space-y-3 w-full">
          {sidebarButtons.map(btn => {
            const isActive = btn.page === currentPage
            const style: React.CSSProperties = isActive
              ? { background: v('active-bg'), color: v('active-color') }
              : { color: v('inactive-color') }
            const cls = 'w-10 h-10 flex items-center justify-center transition-all no-underline rounded-xl hover:opacity-80'
            if (btn.href) return <a key={btn.id} href={btn.href} target="_blank" rel="noopener noreferrer" title={btn.title} className={cls} style={style}>{btn.icon}</a>
            return <button key={btn.id} title={btn.title} className={cls} style={style}
              onClick={() => { if (btn.page) { setCurrentPage(btn.page); setSelectedInspiration(null) } else btn.onClick?.() }}>{btn.icon}</button>
          })}
          {user.role === 'admin' && (
            <button onClick={() => router.push('/admin')} title="管理后台"
              className="w-10 h-10 flex items-center justify-center transition-all hover:opacity-80 rounded-xl"
              style={{ color: v('inactive-color') }}>
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
          )}
        </div>
        <div ref={logoutMenuRef} className="relative mt-auto pt-6 w-full flex justify-center" style={{ borderTop: `1px solid ${v('border')}` }}>
          <button onClick={() => { setShowLogoutMenu(!showLogoutMenu); setShowUserCenter(false) }}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all flex items-center justify-center"
            style={{ background: v('avatar-bg') }}>
            <svg className="w-5 h-5" style={{ color: v('avatar-color') }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
          {showLogoutMenu && (
            <div className="absolute bottom-0 left-16 mb-2 w-44 shadow-xl z-50 overflow-hidden"
              style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
              <button onClick={() => { setShowUserCenter(true); setShowLogoutMenu(false); fetchApiKeyStatus() }}
                className="w-full px-4 py-3 text-xs text-left hover:bg-blue-500/10 text-blue-500">👤 个人中心</button>
              <div style={{ borderTop: `1px solid ${v('border')}`, padding: '8px 12px' }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: v('text-muted') }}>界面版本</p>
                <div className="flex gap-1">
                  {([['new', '✨', '新版'], ['classic', '📋', '经典']] as const).map(([ver, icon, label]) => (
                    <button key={ver} onClick={() => { setUiVersion(ver as 'new' | 'classic'); localStorage.setItem('uiVersion', ver) }}
                      className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] transition-all"
                      style={uiVersion === ver
                        ? { background: v('active-bg'), color: v('active-color'), fontWeight: 600 }
                        : { color: v('text-muted') }}>
                      <span className="text-sm">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${v('border')}`, padding: '8px 12px' }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: v('text-muted') }}>主题设置</p>
                <div className="flex gap-1">
                  {([['system', '💻', '系统'], ['light', '☀️', '明亮'], ['dark', '🌙', '暗黑']] as const).map(([mode, icon, label]) => (
                    <button key={mode} onClick={() => applyThemeMode(mode)}
                      className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] transition-all"
                      style={themeMode === mode
                        ? { background: v('active-bg'), color: v('active-color'), fontWeight: 600 }
                        : { color: v('text-muted') }}>
                      <span className="text-sm">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleLogout}
                className="w-full px-4 py-3 text-xs text-left hover:bg-red-500/10 text-red-500" style={{ borderTop: `1px solid ${v('border')}` }}>🚪 退出</button>
            </div>
          )}
        </div>
      </div>

      {/* ===== 主内容区 ===== */}
      {currentPage === 'create' ? (
        uiVersion === 'new' ? (
          /* ===== 新版创作页：居中输入框 + 作品列表 ===== */
          <div className="flex-1 overflow-y-auto transition-all duration-300">
            {/* 顶部居中输入区域 */}
            <div className="w-full max-w-3xl mx-auto px-6 pt-20 lg:pt-12 pb-6">
              {/* 标题 */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">{siteName}</h1>
                <p className="text-xs mt-1" style={{ color: v('text-muted') }}>{siteSubtitle}</p>
              </div>

              {/* 输入框区域 */}
              <div style={{ background: v('panel'), borderRadius: v('radius-lg'), boxShadow: v('panel-shadow'), border: `1px solid ${v('border')}` }}>
                {/* 参考图预览 */}
                {previewUrls.length > 0 && (
                  <div className="flex gap-2 px-4 pt-3">
                    {previewUrls.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 overflow-hidden shrink-0" style={{ borderRadius: v('radius-sm'), border: `1px solid ${v('border')}` }}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeFile(i)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 文本输入 */}
                <div className="relative">
                  <textarea value={prompt} onChange={e => { setPrompt(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                    className="w-full p-4 pb-2 resize-none text-sm leading-relaxed focus:outline-none bg-transparent min-h-[80px]"
                    style={{ color: v('text'), maxHeight: '40vh' }}
                    placeholder="描述你想生成的画面..."
                    maxLength={promptMaxLength}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
                  />
                  <div className="absolute bottom-1 right-3 text-[10px]" style={{ color: v('text-muted') }}>{prompt.length}/{promptMaxLength}</div>
                </div>

                {/* 底部工具栏 */}
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: `1px solid ${v('border')}` }}>
                  <div className="flex items-center gap-2">
                    {/* 模型选择 */}
                    <div className="relative">
                      <button onClick={() => setModelOpen(!modelOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium hover:bg-blue-500/10 transition-all"
                        style={{ borderRadius: v('radius-sm'), color: v('text-secondary') }}>
                        <span className="text-base">{currentModel.icon}</span>
                        <span>{currentModel.name}</span>
                        <svg className={`w-3 h-3 transition-transform ${modelOpen ? 'rotate-180' : ''}`} style={{ color: v('text-muted') }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                      </button>
                      {modelOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 shadow-2xl z-30 overflow-hidden p-1"
                          style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-lg') }}>
                          {MODELS.map(m => (
                            <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false) }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${model === m.id ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-blue-500/5'}`}
                              style={{ borderRadius: v('radius-sm') }}>
                              <span className="text-xl">{m.icon}</span>
                              <div>
                                <div className="text-sm font-medium">{m.name}</div>
                                <div className="text-[10px]" style={{ color: v('text-muted') }}>{m.desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 上传参考图 */}
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" multiple />
                    <button onClick={() => fileInputRef.current?.click()} title="上传参考图"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-blue-500/10 transition-all"
                      style={{ borderRadius: v('radius-sm'), color: v('text-muted') }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </button>

                    {/* 高级设置 */}
                    <button onClick={() => setShowAdvanced(!showAdvanced)}
                      className={`flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-blue-500/10 transition-all ${showAdvanced ? 'text-blue-500' : ''}`}
                      style={{ borderRadius: v('radius-sm'), color: showAdvanced ? undefined : v('text-muted') }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      <span>设置</span>
                    </button>
                  </div>

                  {/* 积分显示 */}
                  <div className="text-[10px] cursor-pointer hover:opacity-80 transition-opacity" style={{ color: v('text-muted') }} onClick={openRecharge} title="点击充值">
                    积分: <span className="text-blue-500 font-bold">{user.drawing_points}</span> <span className="text-[9px] text-green-500">充值</span>
                  </div>
                </div>
              </div>

              {/* 高级设置展开区域 */}
              {showAdvanced && (
                <div className="mt-3 px-4 py-3 flex flex-wrap gap-4 items-center"
                  style={{ background: v('panel'), borderRadius: v('radius-md'), border: `1px solid ${v('border')}` }}>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] whitespace-nowrap" style={{ color: v('text-muted') }}>数量</label>
                    <select value={quantity} onChange={e => setQuantity(e.target.value)}
                      className="px-2 py-1 text-xs outline-none"
                      style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                      <option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option>
                    </select>
                  </div>
                  {model.includes('nano-banana-2') && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] whitespace-nowrap" style={{ color: v('text-muted') }}>比例</label>
                      <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                        <option value="1:1">1:1</option><option value="3:4">3:4</option><option value="4:3">4:3</option>
                        <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="21:9">21:9</option>
                      </select>
                    </div>
                  )}
                  {(model === 'gpt-image-2' || model === 'gpt-4o-image') && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] whitespace-nowrap" style={{ color: v('text-muted') }}>尺寸</label>
                      <select value={imageSize} onChange={e => setImageSize(e.target.value)}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                        <option value="auto">自动</option>
                        <option value="1024x1024">1:1</option>
                        <option value="1024x1536">3:4</option>
                        <option value="1536x1024">4:3</option>
                        <option value="1024x1792">9:16</option>
                        <option value="1792x1024">16:9</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 生成按钮 */}
              <div className="mt-4 flex justify-center">
                <button onClick={handleGenerate} disabled={loading}
                  className="px-10 py-3 text-white font-bold flex items-center justify-center gap-3 relative overflow-hidden transition-transform active:scale-95 disabled:opacity-50"
                  style={{ background: v('btn-primary'), borderRadius: v('radius-md'), boxShadow: v('btn-primary-shadow') }}>
                  <span>{loading ? '生成中...' : '立即生成'}</span>
                  {loading ? <span className="animate-spin">⏳</span> : <span className="animate-pulse">💎</span>}
                </button>
              </div>
            </div>

            {/* 我的作品列表 */}
            <div className="px-6 pb-6">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">我的作品</h2>
                  <span className="text-xs" style={{ color: v('text-muted') }}>Ctrl+Enter 快速生成</span>
                </div>
                <div className="columns-2 lg:columns-3 xl:columns-4 gap-4">
                  {activeTasks.map(task => (
                    <div key={`ntask-${task.id}`} className="break-inside-avoid mb-4">
                      <TaskCard task={task} isDark={isDark} />
                    </div>
                  ))}
                  {works.length > 0 ? works.map((item, idx) => (
                    <div key={item.id} className="break-inside-avoid mb-4 overflow-hidden group hover:-translate-y-1 transition-all cursor-pointer"
                      style={{ background: isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length], border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}
                      onClick={() => { if (window.innerWidth < 1024) setMobileDetail({ type: 'work', data: item }); else setSelectedWork(item) }}>
                      <div className="relative overflow-hidden">
                        <LazyImage src={item.image_url} alt="" className="w-full h-auto block group-hover:scale-105 transition-transform duration-700"
                          style={{ borderRadius: v('radius-md'), margin: '8px', width: 'calc(100% - 16px)' }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-3 pointer-events-none">
                          <p className="text-[10px] text-gray-100 line-clamp-2 leading-relaxed">{item.prompt || '无提示词'}</p>
                        </div>
                      </div>
                      <div className="px-2 pb-2 pt-1 flex items-center justify-between">
                        <span className="text-[9px] truncate max-w-[40%]" style={{ color: v('text-muted') }}>{item.model || ''}</span>
                        <div className="flex items-center gap-0.5">
                          <button title="下载" onClick={(e) => { e.stopPropagation(); handleDownloadImage(item.image_url) }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          </button>
                          <button title="复制提示词" onClick={(e) => { e.stopPropagation(); handleCopyPrompt(item.prompt) }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          </button>
                          <button title="分享" onClick={(e) => { e.stopPropagation(); handleShareWork(item.id) }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                          </button>
                          <button title="删除" onClick={(e) => { e.stopPropagation(); handleDeleteWork(item.id) }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors text-red-400/60">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : activeTasks.length === 0 ? (
                    <div className="w-full text-center text-xs py-10" style={{ color: v('text-muted') }}>暂无作品，快去创作吧！</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
        <>
          {/* 经典创作页：控制面板 */}
          <div className="w-full lg:w-96 flex flex-col shrink-0 transition-all duration-300"
            style={{ background: v('panel'), borderRadius: v('panel-radius'), boxShadow: v('panel-shadow') }}>
            <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin pt-16 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent break-words">{siteName}</h1>
                  <p className="text-[10px] tracking-widest uppercase break-words" style={{ color: v('text-muted') }}>{siteSubtitle}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>在线
                </span>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="text-xs font-bold mb-2 block uppercase pl-1" style={{ color: v('text-muted') }}>AI Model</label>
                <div className="relative">
                  <button onClick={() => setModelOpen(!modelOpen)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:border-blue-500/50 transition-all text-left"
                    style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{currentModel.icon}</span>
                      <span className="font-medium text-sm">{currentModel.name}</span>
                    </div>
                    <svg className={`w-3 h-3 transition-transform ${modelOpen ? 'rotate-180' : ''}`} style={{ color: v('text-muted') }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  {modelOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 shadow-2xl z-30 overflow-hidden p-1"
                      style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-lg') }}>
                      {MODELS.map(m => (
                        <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false) }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${model === m.id ? 'bg-blue-500/10 text-blue-500' : 'hover:bg-blue-500/5'}`}
                          style={{ borderRadius: v('radius-sm') }}>
                          <span className="text-xl">{m.icon}</span>
                          <div>
                            <div className="text-sm font-medium">{m.name}</div>
                            <div className="text-[10px]" style={{ color: v('text-muted') }}>{m.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 参考图 */}
              <div className="p-3 border border-dashed hover:border-blue-500/50 transition-all" style={{ borderColor: v('border'), borderRadius: v('radius-md') }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold flex items-center gap-2" style={{ color: v('text-muted') }}>🖼️ 参考图</label>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">Max 3</span>
                </div>
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {previewUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden" style={{ border: `1px solid ${v('border')}`, borderRadius: v('radius-sm') }}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeFile(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" multiple />
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full h-10 hover:bg-blue-500/10 text-xs flex items-center justify-center gap-2 transition-all"
                  style={{ color: v('text-muted'), borderRadius: v('radius-sm') }}>＋ 上传</button>
              </div>

              {/* Prompt */}
              <div className="flex flex-col" style={{ height: 140 }}>
                <label className="text-xs font-bold mb-1 block uppercase pl-1 flex justify-between" style={{ color: v('text-muted') }}>
                  <span>Prompt</span>
                  <span className="text-blue-500 cursor-pointer normal-case" onClick={() => setPrompt('')}>清空</span>
                </label>
                <div className="relative flex-1">
                  <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                    className="w-full h-full p-3 resize-none text-sm leading-relaxed focus:outline-none focus:border-blue-500 transition-colors"
                    style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }}
                    placeholder="描述你想生成的画面..." maxLength={promptMaxLength} />
                  <div className="absolute bottom-2 right-3 text-[10px]" style={{ color: v('text-muted') }}>{prompt.length}/{promptMaxLength}</div>
                </div>
              </div>

              {/* 高级设置 */}
              <div>
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-xs font-medium py-2 hover:text-blue-500 transition-colors" style={{ color: v('text-muted') }}>
                  <span>⚙ 高级设置</span>
                  <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 pl-1">
                    <div>
                      <label className="text-[10px] mb-1 block" style={{ color: v('text-muted') }}>生成数量</label>
                      <select value={quantity} onChange={e => setQuantity(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none"
                        style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                        <option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option>
                      </select>
                    </div>
                    {model.includes('nano-banana-2') && (
                      <div>
                        <label className="text-[10px] mb-1 block flex items-center gap-1" style={{ color: v('text-muted') }}>
                          画面比例 <span className="text-blue-500 text-[9px] border border-blue-500/30 px-1 rounded">2.0 模型专属</span>
                        </label>
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}
                          className="w-full px-3 py-2 text-xs outline-none"
                          style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                          <option value="1:1">1:1 (正方形)</option><option value="3:4">3:4 (手机竖屏)</option><option value="4:3">4:3 (iPad/老照片)</option>
                          <option value="16:9">16:9 (电脑横屏)</option><option value="9:16">9:16 (抖音/全屏)</option><option value="21:9">21:9 (电影宽屏)</option>
                        </select>
                      </div>
                    )}
                    {(model === 'gpt-image-2' || model === 'gpt-4o-image') && (
                      <div>
                        <label className="text-[10px] mb-1 block flex items-center gap-1" style={{ color: v('text-muted') }}>
                          图片尺寸 <span className="text-purple-500 text-[9px] border border-purple-500/30 px-1 rounded">GPT 模型</span>
                        </label>
                        <select value={imageSize} onChange={e => setImageSize(e.target.value)}
                          className="w-full px-3 py-2 text-xs outline-none"
                          style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-sm') }}>
                          <option value="auto">自动</option>
                          <option value="1024x1024">方形 1:1</option>
                          <option value="1024x1536">竖版 3:4</option>
                          <option value="1024x1792">故事版 9:16</option>
                          <option value="1536x1024">横版 4:3</option>
                          <option value="1792x1024">宽屏 16:9</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 移动端：我的作品 */}
              <div className="lg:hidden mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold">我的作品</h2>
                  <span className="text-[10px]" style={{ color: v('text-muted') }}>积分: <span className="text-blue-500 font-bold">{user.drawing_points}</span></span>
                </div>
                <div className="columns-2 gap-3">
                  {activeTasks.map(task => (
                    <TaskCard key={`mtask-${task.id}`} task={task} isDark={isDark} />
                  ))}
                  {works.length > 0 ? works.map((item, idx) => (
                    <div key={item.id} className="break-inside-avoid mb-3 overflow-hidden group"
                      style={{ background: isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length], border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}>
                      <div className="relative overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(item.image_url)}>
                        <LazyImage src={item.image_url} alt="" className="w-full h-auto block"
                          style={{ borderRadius: v('radius-md'), margin: '6px', width: 'calc(100% - 12px)' }} />
                      </div>
                      <div className="px-2 pb-2 pt-1 flex items-center justify-between">
                        <span className="text-[9px] truncate max-w-[40%]" style={{ color: v('text-muted') }}>{item.model || ''}</span>
                        <div className="flex items-center gap-0.5">
                          <button title="下载" onClick={() => handleDownloadImage(item.image_url)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          </button>
                          <button title="复制提示词" onClick={() => handleCopyPrompt(item.prompt)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          </button>
                          <button title="用作参考图" onClick={() => useAsReference(item.image_url, item.image_key)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-purple-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                          </button>
                          <button title="分享到社区" onClick={() => handleShareWork(item.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-green-500/10 transition-colors" style={{ color: v('text-muted') }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                          </button>
                          <button title="删除" onClick={() => handleDeleteWork(item.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors text-red-400/60">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : activeTasks.length === 0 ? (
                    <div className="col-span-2 text-center text-xs py-6" style={{ color: v('text-muted') }}>暂无作品，快去创作吧！</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="p-6" style={{ borderTop: `1px solid ${v('border')}` }}>
              <button onClick={handleGenerate} disabled={loading}
                className="w-full py-4 px-6 text-white font-bold flex items-center justify-center gap-3 relative overflow-hidden transition-transform active:scale-95 disabled:opacity-50"
                style={{ background: v('btn-primary'), borderRadius: v('radius-md'), boxShadow: v('btn-primary-shadow') }}>
                <span>{loading ? '生成中...' : '立即生成'}</span>
                {loading ? <span className="animate-spin">⏳</span> : <span className="animate-pulse">💎</span>}
              </button>
              <p className="text-[10px] text-center mt-3" style={{ color: v('text-muted') }}>⚡ 预计耗时 10-30 秒</p>
            </div>
          </div>

          {/* 创作页：我的作品（透明背景） */}
          <div className="hidden lg:flex flex-1 flex-col h-full overflow-hidden transition-all duration-300" style={{ minWidth: 0 }}>
            <div className="p-6 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
              <h2 className="text-lg font-bold">我的作品</h2>
              <div className="text-xs" style={{ color: v('text-muted') }}>
                积分: <span className="text-blue-500 font-bold">{user.drawing_points}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10" onClick={() => setSelectedWork(null)}>
              <div className="columns-3 gap-4">
                {activeTasks.map(task => (
                  <TaskCard key={`task-${task.id}`} task={task} isDark={isDark} />
                ))}
                {works.length > 0 ? works.map((item, idx) => (
                  <div key={item.id} className="break-inside-avoid mb-4 overflow-hidden group hover:-translate-y-1 transition-all"
                    style={{ background: isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length], border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}>
                    <div className="relative overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedWork(item) }}>
                      <LazyImage src={item.image_url} alt="" className="w-full h-auto block group-hover:scale-105 transition-transform duration-700"
                        style={{ borderRadius: v('radius-md'), margin: '8px', width: 'calc(100% - 16px)' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-3 pointer-events-none">
                        <p className="text-xs text-gray-100 line-clamp-2 leading-relaxed">{item.prompt || '无提示词'}</p>
                      </div>
                    </div>
                    <div className="px-2 pb-2 pt-1 flex items-center justify-between">
                      <span className="text-[10px] truncate max-w-[50%]" style={{ color: v('text-muted') }}>{item.model || ''}</span>
                      <div className="flex items-center gap-0.5">
                        <button title="下载" onClick={(e) => { e.stopPropagation(); handleDownloadImage(item.image_url) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors text-xs" style={{ color: v('text-muted') }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        </button>
                        <button title="复制提示词" onClick={(e) => { e.stopPropagation(); handleCopyPrompt(item.prompt) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-500/10 transition-colors text-xs" style={{ color: v('text-muted') }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                        <button title="用作参考图" onClick={(e) => { e.stopPropagation(); useAsReference(item.image_url, item.image_key) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-purple-500/10 transition-colors text-xs" style={{ color: v('text-muted') }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        </button>
                        <button title="分享到社区" onClick={(e) => { e.stopPropagation(); handleShareWork(item.id) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-green-500/10 transition-colors text-xs" style={{ color: v('text-muted') }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        </button>
                        <button title="删除" onClick={(e) => { e.stopPropagation(); handleDeleteWork(item.id) }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors text-xs text-red-400/60 hover:text-red-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )) : activeTasks.length === 0 ? <div className="col-span-3 text-center text-xs py-10" style={{ color: v('text-muted') }}>暂无作品，快去创作吧！</div> : null}
              </div>
            </div>
          </div>

          {/* 作品详情面板（动画滑入/滑出） */}
          <div className="hidden lg:flex flex-col shrink-0 h-full overflow-hidden"
            style={{
              width: selectedWork ? '384px' : '0px',
              minWidth: selectedWork ? '384px' : '0px',
              opacity: selectedWork ? 1 : 0,
              background: v('panel'),
              borderRadius: v('panel-radius'),
              boxShadow: selectedWork ? v('panel-shadow') : 'none',
              transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
              pointerEvents: selectedWork ? 'auto' : 'none',
            }}>
            <div className="w-96 flex flex-col h-full">
              <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
                <h3 className="text-sm font-bold">作品详情</h3>
                <button onClick={() => setSelectedWork(null)}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/5 transition-colors" style={{ borderRadius: '8px', color: v('text-muted') }}>×</button>
              </div>
              {selectedWork && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="overflow-hidden" style={{ borderRadius: v('radius-md'), border: `1px solid ${v('border')}` }}>
                    <img src={selectedWork.image_url} alt="" className="w-full h-auto cursor-zoom-in" onClick={() => setLightboxUrl(selectedWork.image_url)} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>提示词</label>
                      <div className="p-3 text-sm leading-relaxed" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                        {selectedWork.prompt || '无提示词'}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>模型</label>
                        <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.model || '-'}</div>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>尺寸</label>
                        <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.size || '-'}</div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>创建时间</label>
                      <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.created_at ? new Date(selectedWork.created_at).toLocaleString() : '-'}</div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>操作</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => applyPrompt(selectedWork.prompt)}
                          className="py-2.5 text-white text-xs font-bold transition-transform active:scale-95"
                          style={{ background: v('btn-primary'), borderRadius: v('radius-md') }}>
                          使用提示词
                        </button>
                        <button onClick={() => handleCopyPrompt(selectedWork.prompt)}
                          className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                          style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                          📋 复制提示词
                        </button>
                        <button onClick={() => handleDownloadImage(selectedWork.image_url)}
                          className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                          style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                          ⬇️ 下载图片
                        </button>
                        <button onClick={() => handleShareWork(selectedWork.id)}
                          className="py-2.5 text-xs font-bold transition-all hover:opacity-80 text-green-500"
                          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: v('radius-md') }}>
                          🌐 分享社区
                        </button>
                        <button onClick={() => setLightboxUrl(selectedWork.image_url)}
                          className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                          style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                          🔍 查看大图
                        </button>
                        <button onClick={() => { handleDeleteWork(selectedWork.id); setSelectedWork(null) }}
                          className="py-2.5 text-xs font-bold transition-all hover:opacity-80 text-red-400"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: v('radius-md') }}>
                          🗑 删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
        )
      ) : (
        /* ===== 灵感页 ===== */
        <>
          <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">
            {/* 灵感页头部 */}
            <div className="pt-16 lg:pt-0 px-4 pb-4 lg:p-8 shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold tracking-tight">创意灵感库</h1>
                  <p className="text-xs mt-1" style={{ color: v('text-muted') }}>探索和发现优秀的 AI 创作</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 lg:flex-none">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: v('text-muted') }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" placeholder="搜索灵感..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-xs w-full lg:w-48 lg:focus:w-64 transition-all outline-none focus:border-blue-500/50"
                      style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }} />
                  </div>
                  <div className="text-xs whitespace-nowrap" style={{ color: v('text-muted') }}>
                    共 <span className="font-bold" style={{ color: v('text') }}>{inspirations.length}</span> 张
                  </div>
                </div>
              </div>
              {/* 分类标签 */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 no-scrollbar">
                {['全部', '人物', '风景', '动漫', '写实', '抽象', '科幻', '美食', '动物', '建筑', '其他'].map(tag => {
                  const catValue = tag === '全部' ? '' : tag
                  const isActive = inspCategory === catValue
                  return (
                    <button key={tag}
                      onClick={() => setInspCategory(catValue)}
                      className="px-4 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      style={{
                        borderRadius: v('radius-sm'),
                        ...(isActive
                          ? { background: v('active-bg'), color: v('active-color'), border: 'none' }
                          : { color: v('text-muted'), background: v('tag-bg'), border: `1px solid ${v('border')}` }),
                      }}>
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 灵感瀑布流 */}
            <div ref={inspScrollRef} className="flex-1 overflow-y-auto p-6 lg:p-8" onClick={() => setSelectedInspiration(null)}>
              <div className="columns-2 lg:columns-3 xl:columns-4 gap-4">
                {inspirations.length > 0 ? inspirations.map((item, idx) => {
                  const cardBg = isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length]
                  return (
                    <div key={item.id} onClick={(e) => { e.stopPropagation(); if (window.innerWidth < 1024) setMobileDetail({ type: 'inspiration', data: item }); else setSelectedInspiration(item) }}
                      className="break-inside-avoid mb-4 overflow-hidden cursor-pointer group hover:-translate-y-1 transition-all"
                      style={{ background: cardBg, border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}>
                      <div className="relative overflow-hidden" style={{ padding: '8px', paddingBottom: 0 }}>
                        <LazyImage src={item.url} alt="" className="w-full h-auto block group-hover:scale-105 transition-transform duration-500"
                          style={{ borderRadius: v('radius-md') }} />
                      </div>
                      <div className="p-3">
                        <p className="text-xs line-clamp-2 leading-relaxed font-medium" style={{ color: v('text-secondary') }}>
                          {item.prompt || '无提示词'}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 font-medium" style={{
                            background: v('hover'),
                            color: v('text-muted'),
                            borderRadius: '6px',
                          }}>{item.model || 'AI 创作'}</span>
                          <button className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors"
                            onClick={(e) => { e.stopPropagation(); applyPrompt(item.prompt) }}>使用 →</button>
                        </div>
                      </div>
                    </div>
                  )
                }) : <div className="col-span-4 text-center text-sm py-20" style={{ color: v('text-muted') }}>{searchQuery ? '未找到匹配的灵感' : '暂无灵感图片'}</div>}
              </div>
              {inspLoading && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!inspLoading && inspHasMore && inspirations.length > 0 && (
                <div className="text-center py-4 text-xs" style={{ color: v('text-muted') }}>向下滚动加载更多</div>
              )}
              {!inspHasMore && inspirations.length > 0 && (
                <div className="text-center py-4 text-xs" style={{ color: v('text-muted') }}>已加载全部灵感</div>
              )}
            </div>
          </div>

          {/* 灵感详情面板（动画滑入/滑出） */}
          <div className="hidden lg:flex flex-col shrink-0 h-full overflow-hidden"
            style={{
              width: selectedInspiration ? '384px' : '0px',
              minWidth: selectedInspiration ? '384px' : '0px',
              opacity: selectedInspiration ? 1 : 0,
              background: v('panel'),
              borderRadius: v('panel-radius'),
              boxShadow: selectedInspiration ? v('panel-shadow') : 'none',
              transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
              pointerEvents: selectedInspiration ? 'auto' : 'none',
            }}>
            <div className="w-96 flex flex-col h-full">
              <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
                <h3 className="text-sm font-bold">灵感详情</h3>
                <button onClick={() => setSelectedInspiration(null)}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/5 transition-colors" style={{ borderRadius: '8px', color: v('text-muted') }}>×</button>
              </div>
              {selectedInspiration && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="overflow-hidden" style={{ borderRadius: v('radius-md'), border: `1px solid ${v('border')}` }}>
                    <img src={selectedInspiration.url} alt="" className="w-full h-auto cursor-zoom-in" onClick={() => setLightboxUrl(selectedInspiration.url)} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>提示词</label>
                      <div className="p-3 text-sm leading-relaxed" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                        {selectedInspiration.prompt || '无提示词'}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>操作</label>
                      <div className="flex gap-2">
                        <button onClick={() => applyPrompt(selectedInspiration.prompt)}
                          className="flex-1 py-2.5 text-white text-xs font-bold transition-transform active:scale-95"
                          style={{ background: v('btn-primary'), borderRadius: v('radius-md') }}>
                          使用此提示词
                        </button>
                        <button onClick={() => setLightboxUrl(selectedInspiration.url)}
                          className="px-4 py-2.5 text-xs font-bold transition-all hover:opacity-80"
                          style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                          🔍
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== 个人中心弹窗 ===== */}
      {showUserCenter && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={() => setShowUserCenter(false)}>
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: v('overlay') }}></div>
          <div className="relative w-full max-w-md mx-4 shadow-2xl overflow-hidden" style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('panel-radius') }} onClick={e => e.stopPropagation()}>
            <div className="h-24 bg-gradient-to-r from-blue-500 to-purple-600 relative">
              <button onClick={() => setShowUserCenter(false)} className="absolute top-3 right-3 text-white text-xl w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full">×</button>
            </div>
            <div className="px-6 pb-6 relative">
              <div className="w-20 h-20 rounded-full border-4 -mt-10 mb-4 flex items-center justify-center shadow-lg"
                style={{ background: v('card'), borderColor: v('panel') }}>
                <svg className="w-8 h-8" style={{ color: v('text-muted') }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold">{user.username}</h2>
                  <p className="text-xs" style={{ color: v('text-muted') }}>ID: {user.id}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${hasApiKey ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-500'}`}>{hasApiKey ? '已配置' : '未配置'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 text-center" style={{ background: isDark ? v('card') : '#F8D7CC', borderRadius: v('radius-md') }}>
                  <div className="text-lg font-bold text-blue-500">{user.drawing_points}</div>
                  <div className="text-xs" style={{ color: v('text-muted') }}>积分</div>
                </div>
                <div className="p-4 text-center" style={{ background: isDark ? v('card') : '#E8DEF3', borderRadius: v('radius-md') }}>
                  <div className="text-lg font-bold text-purple-500">{user.creation_count}</div>
                  <div className="text-xs" style={{ color: v('text-muted') }}>创作</div>
                </div>
              </div>
              <button onClick={handleCheckin} disabled={!user.can_checkin}
                className={`w-full py-3 text-white font-bold mb-2 ${user.can_checkin ? 'bg-gradient-to-r from-green-500 to-teal-500' : 'bg-gray-400 cursor-not-allowed opacity-50'}`}
                style={{ borderRadius: v('radius-md') }}>
                {user.can_checkin ? '每日签到' : '今日已签到'}
              </button>
              <button onClick={() => { setShowUserCenter(false); openRecharge() }}
                className="w-full py-3 text-white font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{ borderRadius: v('radius-md') }}>
                充值积分
              </button>
              <div className="text-center text-xs mb-4" style={{ color: v('text-muted') }}>签到次数: {user.checkin_count}</div>
              {allowCustomApi && (
                <div className="flex gap-3">
                  <button onClick={() => { setShowApiKeyModal(true); setShowUserCenter(false) }}
                    className="flex-1 py-2 border border-blue-500/50 text-blue-500 text-xs" style={{ borderRadius: v('radius-sm') }}>{hasApiKey ? '修改 Key' : '配置 Key'}</button>
                  {hasApiKey && <button onClick={deleteApiKey} className="flex-1 py-2 border border-red-500/50 text-red-500 text-xs" style={{ borderRadius: v('radius-sm') }}>删除 Key</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== API Key 弹窗 ===== */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[71] flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: v('overlay') }} onClick={() => setShowApiKeyModal(false)}></div>
          <div className="relative w-full max-w-md mx-4 p-6 shadow-2xl" style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('panel-radius') }}>
            <h2 className="text-lg font-bold mb-4">配置 API Key</h2>
            <p className="text-xs mb-3" style={{ color: v('text-muted') }}>积分用完后将使用KEY进行绘图</p>
            <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
              className="w-full px-4 py-3 text-sm mb-4 focus:border-blue-500 outline-none"
              style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }} placeholder="sk-..." />
            <input type="text" value={apiBaseUrlInput} onChange={e => setApiBaseUrlInput(e.target.value)}
              className="w-full px-4 py-3 text-sm mb-4 focus:border-blue-500 outline-none"
              style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }} />
            <div className="flex gap-3">
              <button onClick={saveApiKey} className="flex-1 bg-blue-600 text-white py-2 text-sm" style={{ borderRadius: v('radius-md') }}>保存</button>
              <button onClick={() => setShowApiKeyModal(false)} className="flex-1 py-2 text-sm" style={{ background: v('card'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 公告弹窗 ===== */}
      {showNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: v('overlay') }} onClick={() => setShowNotice(false)}></div>
          <div className="relative w-full max-w-lg shadow-2xl overflow-hidden" style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: '28px' }}>
            <button onClick={() => setShowNotice(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10" style={{ color: v('text-muted') }}>×</button>
            <div className="p-8">
              <h3 className="text-2xl font-bold tracking-tight mb-2">系统公告</h3>
              <div className="text-base whitespace-pre-wrap leading-[1.8] mt-4">{announcement || '暂无公告'}</div>
            </div>
            <div className="h-[2px] w-full bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50 opacity-50"></div>
          </div>
        </div>
      )}

      {/* ===== 新版UI - PC端作品详情弹窗 ===== */}
      {uiVersion === 'new' && selectedWork && (
        <div className="hidden lg:flex fixed inset-0 z-[100] items-center justify-center" style={{ background: v('overlay') }} onClick={() => setSelectedWork(null)}>
          <div className="w-full max-w-3xl h-[85vh] flex overflow-hidden mx-4 animate-fade-in"
            style={{ background: v('panel'), borderRadius: v('radius-lg'), boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            {/* 左侧图片 - 高度撑满弹窗 */}
            <div className="w-1/2 h-full overflow-hidden shrink-0" style={{ borderRight: `1px solid ${v('border')}` }}>
              <img src={selectedWork.image_url} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setLightboxUrl(selectedWork.image_url)} />
            </div>
            {/* 右侧作品详情 */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="p-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
                <h3 className="text-sm font-bold">作品详情</h3>
                <button onClick={() => setSelectedWork(null)}
                  className="w-7 h-7 flex items-center justify-center hover:bg-black/5 transition-colors" style={{ borderRadius: '8px', color: v('text-muted') }}>×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>提示词</label>
                  <div className="p-3 text-sm leading-relaxed" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                    {selectedWork.prompt || '无提示词'}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>模型</label>
                    <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.model || '-'}</div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>尺寸</label>
                    <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.size || '-'}</div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>创建时间</label>
                  <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{selectedWork.created_at ? new Date(selectedWork.created_at).toLocaleString() : '-'}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => applyPrompt(selectedWork.prompt)}
                    className="py-2.5 text-white text-xs font-bold transition-transform active:scale-95"
                    style={{ background: v('btn-primary'), borderRadius: v('radius-md') }}>
                    使用提示词
                  </button>
                  <button onClick={() => handleCopyPrompt(selectedWork.prompt)}
                    className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                    📋 复制提示词
                  </button>
                  <button onClick={() => handleDownloadImage(selectedWork.image_url)}
                    className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                    ⬇️ 下载图片
                  </button>
                  <button onClick={() => handleShareWork(selectedWork.id)}
                    className="py-2.5 text-xs font-bold transition-all hover:opacity-80 text-green-500"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: v('radius-md') }}>
                    🌐 分享社区
                  </button>
                  <button onClick={() => setLightboxUrl(selectedWork.image_url)}
                    className="py-2.5 text-xs font-bold transition-all hover:opacity-80"
                    style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                    🔍 查看大图
                  </button>
                  <button onClick={() => { handleDeleteWork(selectedWork.id); setSelectedWork(null) }}
                    className="py-2.5 text-xs font-bold transition-all hover:opacity-80 text-red-400"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: v('radius-md') }}>
                    🗑️ 删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 移动端详情弹窗 ===== */}
      {mobileDetail && (
        <>
          <div className="lg:hidden fixed inset-0 z-[100]" style={{ background: v('overlay') }} onClick={() => setMobileDetail(null)}></div>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[101] max-h-[90vh] overflow-y-auto animate-[slideUp_0.25s_ease-out]"
            style={{ background: v('panel'), borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: v('border') }}></div>
            </div>
            <div className="px-4 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1.5rem))' }}>
              {/* 图片 */}
              <div className="overflow-hidden mb-4" style={{ borderRadius: v('radius-md'), border: `1px solid ${v('border')}` }}>
                <img
                  src={mobileDetail.type === 'work' ? (mobileDetail.data as Creation).image_url : (mobileDetail.data as InspirationItem).url}
                  alt="" className="w-full h-auto cursor-zoom-in"
                  onClick={() => setLightboxUrl(mobileDetail.type === 'work' ? (mobileDetail.data as Creation).image_url : (mobileDetail.data as InspirationItem).url)}
                />
              </div>
              {/* 提示词 */}
              <div className="mb-4">
                <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>提示词</label>
                <div className="p-3 text-sm leading-relaxed" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                  {mobileDetail.data.prompt || '无提示词'}
                </div>
              </div>
              {/* 模型信息 */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>模型</label>
                  <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                    {mobileDetail.type === 'work' ? ((mobileDetail.data as Creation).model || '-') : ((mobileDetail.data as InspirationItem).model || 'AI 创作')}
                  </div>
                </div>
                {mobileDetail.type === 'work' && (
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>尺寸</label>
                    <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{(mobileDetail.data as Creation).size || '-'}</div>
                  </div>
                )}
              </div>
              {mobileDetail.type === 'work' && (
                <div className="mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: v('text-muted') }}>创建时间</label>
                  <div className="p-2 text-xs" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>{(mobileDetail.data as Creation).created_at ? new Date((mobileDetail.data as Creation).created_at).toLocaleString() : '-'}</div>
                </div>
              )}
              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { applyPrompt(mobileDetail.data.prompt || ''); setMobileDetail(null) }}
                  className="py-3 text-white text-xs font-bold transition-transform active:scale-95"
                  style={{ background: v('btn-primary'), borderRadius: v('radius-md') }}>
                  使用提示词
                </button>
                <button onClick={() => handleCopyPrompt(mobileDetail.data.prompt || '')}
                  className="py-3 text-xs font-bold transition-all active:scale-95"
                  style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                  📋 复制提示词
                </button>
                <button onClick={() => handleDownloadImage(mobileDetail.type === 'work' ? (mobileDetail.data as Creation).image_url : (mobileDetail.data as InspirationItem).url)}
                  className="py-3 text-xs font-bold transition-all active:scale-95"
                  style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md'), color: v('text-secondary') }}>
                  ⬇️ 下载图片
                </button>
                {mobileDetail.type === 'work' && (
                  <button onClick={() => { handleShareWork((mobileDetail.data as Creation).id); setMobileDetail(null) }}
                    className="py-3 text-xs font-bold transition-all active:scale-95 text-green-500"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: v('radius-md') }}>
                    🌐 分享社区
                  </button>
                )}
                {mobileDetail.type === 'work' && (
                  <button onClick={() => { handleDeleteWork((mobileDetail.data as Creation).id); setMobileDetail(null) }}
                    className="py-3 text-xs font-bold transition-all active:scale-95 text-red-400"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: v('radius-md') }}>
                    🗑️ 删除
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== 灯箱 ===== */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center flex-col bg-black/92 backdrop-blur-[5px] cursor-pointer"
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="预览" className="max-w-[95vw] max-h-[95vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/20 cursor-zoom-out"
            style={{ borderRadius: v('radius-lg') }} />
          <div className="text-gray-400 mt-4 text-sm">点击任意处关闭</div>
        </div>
      )}

      {/* ===== 移动端顶部导航 ===== */}
      <div className="lg:hidden fixed top-0 left-0 w-full z-[60] px-4 py-3 backdrop-blur-md flex items-center gap-3 shadow-lg"
        style={{ background: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(255,255,255,0.92)', borderBottom: `1px solid ${v('border')}` }}>
        <button onClick={() => setMobileSidebar(true)} className="shrink-0 w-10 h-10 flex items-center justify-center" style={{ color: v('text-secondary') }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <div className="flex-1 flex p-1" style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
          <button onClick={() => { setMobileTab('create'); setCurrentPage('create') }}
            className={`flex-1 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-all`}
            style={{
              borderRadius: v('radius-sm'),
              ...(mobileTab === 'create' ? { background: v('tab-active-bg'), color: v('tab-active-color'), boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: v('text-muted') }),
            }}>🎨 创作</button>
          <button onClick={() => { setMobileTab('inspire'); setCurrentPage('inspire') }}
            className={`flex-1 py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-all`}
            style={{
              borderRadius: v('radius-sm'),
              ...(mobileTab === 'inspire' ? { background: v('tab-active-bg'), color: v('tab-active-color'), boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: v('text-muted') }),
            }}>🔥 灵感</button>
        </div>
      </div>

      {mobileSidebar && (
        <>
          <div className="lg:hidden fixed inset-0 z-[90]" style={{ background: v('overlay') }} onClick={() => setMobileSidebar(false)}></div>
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[91] max-h-[85vh] overflow-y-auto animate-[slideUp_0.25s_ease-out]"
            style={{ background: v('panel'), borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
            {/* 拖拽指示条 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: v('border') }}></div>
            </div>

            {/* 用户信息卡片 */}
            <div className="mx-4 mb-4 p-4 flex items-center gap-3" style={{ background: v('tag-bg'), borderRadius: '16px' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #10b981)' }}>
                {user.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.username}</p>
                <p className="text-[11px] mt-0.5" style={{ color: v('text-muted') }}>积分 <span className="text-blue-500 font-bold">{user.drawing_points}</span></p>
              </div>
              <button onClick={() => { setShowUserCenter(true); setMobileSidebar(false); fetchApiKeyStatus() }}
                className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: v('active-bg') }}>
                <svg className="w-4 h-4" style={{ color: v('active-color') }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* 功能导航 - 宫格 */}
            <div className="mx-4 mb-4 grid grid-cols-4 gap-2">
              {sidebarButtons.map(btn => {
                const isActive = btn.page === currentPage
                return (
                  <button key={btn.id}
                    className="flex flex-col items-center gap-1.5 py-3 transition-all"
                    style={{ borderRadius: '14px', ...(isActive ? { background: v('active-bg') } : {}) }}
                    onClick={() => {
                      if (btn.page) { setCurrentPage(btn.page); setMobileTab(btn.page === 'create' ? 'create' : 'inspire'); setSelectedInspiration(null) }
                      else btn.onClick?.()
                      setMobileSidebar(false)
                    }}>
                    <span className="text-xl">{btn.icon}</span>
                    <span className="text-[11px] font-medium" style={{ color: isActive ? v('active-color') : v('text-secondary') }}>{btn.title}</span>
                  </button>
                )
              })}
              {user?.role === 'admin' && (
                <button onClick={() => { router.push('/admin'); setMobileSidebar(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 transition-all"
                  style={{ borderRadius: '14px' }}>
                  <span className="text-xl">⚙️</span>
                  <span className="text-[11px] font-medium" style={{ color: v('text-secondary') }}>管理</span>
                </button>
              )}
            </div>

            {/* 设置区块 */}
            <div className="mx-4 mb-4 p-4" style={{ background: v('tag-bg'), borderRadius: '16px' }}>
              {/* 界面版本 */}
              <p className="text-[11px] font-semibold mb-2.5" style={{ color: v('text-muted') }}>界面版本</p>
              <div className="flex gap-2 mb-4">
                {([['new', '✨', '新版'], ['classic', '📋', '经典']] as const).map(([ver, icon, label]) => (
                  <button key={ver} onClick={() => { setUiVersion(ver as 'new' | 'classic'); localStorage.setItem('uiVersion', ver) }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all"
                    style={{
                      borderRadius: '10px',
                      ...(uiVersion === ver
                        ? { background: v('active-bg'), color: v('active-color'), fontWeight: 700, boxShadow: '0 2px 8px rgba(59,130,246,0.15)' }
                        : { background: v('panel'), color: v('text-muted'), border: `1px solid ${v('border')}` }),
                    }}>
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </div>
              {/* 主题 */}
              <p className="text-[11px] font-semibold mb-2.5" style={{ color: v('text-muted') }}>主题</p>
              <div className="flex gap-2">
                {([['system', '💻', '跟随系统'], ['light', '☀️', '明亮'], ['dark', '🌙', '暗黑']] as const).map(([mode, icon, label]) => (
                  <button key={mode} onClick={() => applyThemeMode(mode)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all"
                    style={{
                      borderRadius: '10px',
                      ...(themeMode === mode
                        ? { background: v('active-bg'), color: v('active-color'), fontWeight: 700, boxShadow: '0 2px 8px rgba(59,130,246,0.15)' }
                        : { background: v('panel'), color: v('text-muted'), border: `1px solid ${v('border')}` }),
                    }}>
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </div>
            </div>

            {/* 退出按钮 */}
            <div className="mx-4 mb-6">
              <button onClick={() => { handleLogout(); setMobileSidebar(false) }}
                className="w-full py-3 text-sm font-medium text-red-500 transition-all active:scale-[0.98]"
                style={{ background: v('tag-bg'), borderRadius: '14px' }}>
                退出登录
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===== 充值弹窗 ===== */}
      {showRecharge && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: v('overlay') }} onClick={closeRecharge}></div>
          <div className="relative w-full max-w-lg mx-4 shadow-2xl overflow-hidden" style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('panel-radius') }}>
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="text-lg font-bold">充值积分</h2>
              <button onClick={closeRecharge} className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-80" style={{ color: v('text-muted') }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {payStatus === 'qr' || payStatus === 'success' ? (
              /* 二维码 / 成功状态 */
              <div className="p-6 text-center">
                {payStatus === 'success' ? (
                  <div className="py-8">
                    <div className="text-5xl mb-4">🎉</div>
                    <p className="text-lg font-bold text-green-500">充值成功</p>
                    <p className="text-xs mt-2" style={{ color: v('text-muted') }}>积分已到账</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm mb-4" style={{ color: v('text-secondary') }}>请使用支付宝扫描二维码完成支付</p>
                    {payQrCode && (
                      <div className="inline-block p-4 bg-white rounded-xl mb-4">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payQrCode)}`} alt="支付二维码" className="w-48 h-48" />
                      </div>
                    )}
                    <p className="text-[10px] mb-2" style={{ color: v('text-muted') }}>订单号: {payOrderNo}</p>
                    <div className="flex items-center justify-center gap-2 text-xs" style={{ color: v('text-muted') }}>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      等待支付...
                    </div>
                    <button onClick={() => { setPayStatus('idle'); setPayQrCode(null); if (payPollRef.current) { clearInterval(payPollRef.current); payPollRef.current = null } }}
                      className="mt-4 px-4 py-2 text-xs" style={{ color: v('text-muted'), border: `1px solid ${v('border')}`, borderRadius: v('radius-sm') }}>返回</button>
                  </>
                )}
              </div>
            ) : (
              /* 套餐/直充选择 */
              <>
                {/* Tab切换 */}
                <div className="flex mx-5 mb-3 p-1" style={{ background: v('tag-bg'), borderRadius: v('radius-md') }}>
                  {([['package', '套餐充值'], ['direct', '直充积分']] as const).map(([tab, label]) => (
                    <button key={tab} onClick={() => setRechargeTab(tab)} className="flex-1 py-2 text-xs font-medium transition-all"
                      style={rechargeTab === tab ? { background: v('panel'), borderRadius: v('radius-sm'), boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: v('text') } : { color: v('text-muted') }}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="px-5 pb-5 max-h-[50vh] overflow-y-auto">
                  {rechargeTab === 'package' ? (
                    /* 套餐列表 */
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      {rechargePackages.map(pkg => (
                        <button key={pkg.id} onClick={() => setSelectedPkgId(pkg.id)}
                          className="relative p-4 text-left transition-all hover:scale-[1.02]"
                          style={{
                            background: selectedPkgId === pkg.id ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)') : v('card'),
                            border: selectedPkgId === pkg.id ? '2px solid #3b82f6' : `1px solid ${v('border')}`,
                            borderRadius: v('radius-md'),
                          }}>
                          {pkg.badge && (
                            <span className="absolute top-0 right-0 text-[9px] px-2 py-0.5 rounded-bl-lg rounded-tr-[inherit] text-white font-bold"
                              style={{ background: pkg.badge === '热门' ? '#ef4444' : pkg.badge === '推荐' ? '#3b82f6' : '#f59e0b' }}>
                              {pkg.badge}
                            </span>
                          )}
                          <div className="text-xl font-bold text-blue-500">{pkg.points}</div>
                          <div className="text-[10px] mb-2" style={{ color: v('text-muted') }}>积分</div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold" style={{ color: v('text') }}>¥{(pkg.price / 100).toFixed(2)}</span>
                            {pkg.original_price && pkg.original_price > pkg.price && (
                              <span className="text-[10px] line-through" style={{ color: v('text-muted') }}>¥{(pkg.original_price / 100).toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-[9px] mt-1" style={{ color: v('text-muted') }}>{pkg.name}</div>
                        </button>
                      ))}
                      {rechargePackages.length === 0 && (
                        <div className="col-span-2 py-8 text-center text-xs" style={{ color: v('text-muted') }}>暂无套餐，请联系管理员配置</div>
                      )}
                    </div>
                  ) : (
                    /* 直充 */
                    <div>
                      <p className="text-xs mb-3" style={{ color: v('text-secondary') }}>
                        兑换比例: 1元 = {directRate}积分
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {[5, 10, 30, 50, 100].map(n => (
                          <button key={n} onClick={() => setDirectAmount(String(n))}
                            className="px-3 py-2 text-xs font-medium transition-all"
                            style={{
                              background: directAmount === String(n) ? (isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)') : v('card'),
                              border: directAmount === String(n) ? '2px solid #3b82f6' : `1px solid ${v('border')}`,
                              borderRadius: v('radius-sm'), color: directAmount === String(n) ? '#3b82f6' : v('text'),
                            }}>
                            ¥{n}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <input type="number" value={directAmount} onChange={e => setDirectAmount(e.target.value)}
                          placeholder={`输入金额 (${(directMin / 100).toFixed(0)}-${(directMax / 100).toFixed(0)}元)`}
                          className="flex-1 px-4 py-3 text-sm outline-none"
                          style={{ background: v('input-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }} />
                      </div>
                      {directAmount && parseFloat(directAmount) > 0 && (
                        <div className="p-3 mb-3" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)', borderRadius: v('radius-sm') }}>
                          <p className="text-xs">
                            支付 <span className="font-bold text-blue-500">¥{parseFloat(directAmount).toFixed(2)}</span>
                            {' → '}获得 <span className="font-bold text-green-500">{Math.floor(parseFloat(directAmount) * directRate)}</span> 积分
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 错误提示 */}
                {payError && <div className="mx-5 mb-3 p-2 text-xs text-red-500 text-center" style={{ background: 'rgba(239,68,68,0.1)', borderRadius: v('radius-sm') }}>{payError}</div>}

                {/* 支付按钮 */}
                <div className="px-5 pb-5">
                  <button onClick={handlePay} disabled={payStatus === 'loading' || (rechargeTab === 'package' && !selectedPkgId) || (rechargeTab === 'direct' && !directAmount)}
                    className="w-full py-3 text-white font-bold bg-gradient-to-r from-blue-500 to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ borderRadius: v('radius-md') }}>
                    {payStatus === 'loading' ? '创建订单中...' : '立即支付'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
