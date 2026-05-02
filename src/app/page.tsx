'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface UserInfo {
  id: number; username: string; email: string; drawing_points: number
  creation_count: number; checkin_count: number; can_checkin: boolean; role: string
}
interface Creation {
  id: number; prompt: string; image_url: string; model: string; size: string; created_at: string
}
interface InspirationItem { id: number; url: string; prompt: string | null }

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : null }
function authHeaders() { return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' } }

const MODELS = [
  { id: 'nano-banana', name: 'Nano Banana', icon: '🍌', desc: '标准模式，生成速度快' },
  { id: 'nano-banana-hd', name: 'Nano Banana HD', icon: '✨', desc: '高清模式，增强画质' },
  { id: 'nano-banana-2', name: 'Nano Banana 2.0', icon: '🚀', desc: '最新大模型，极致画质' },
  { id: 'nano-banana-2-2k', name: 'Nano Banana 2K', icon: '🔷', desc: '2K 超清分辨率' },
  { id: 'nano-banana-2-4k', name: 'Nano Banana 4K', icon: '💠', desc: '4K 极致细节' },
  { id: 'gpt-4o-image', name: 'GPT-4o Image', icon: '🌟', desc: 'OpenAI 图像生成' },
]

const PASTEL_COLORS = ['#F8D7CC', '#D4EDDA', '#E8DEF3', '#FDEBD0', '#D1ECF1', '#F5C6CB']

// CSS var helpers
const v = (name: string) => `var(--nb-${name})`

export default function HomePage() {
  const router = useRouter()
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState('https://api.fengjungpt.com')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [showNotice, setShowNotice] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [mobileTab, setMobileTab] = useState<'create' | 'inspire'>('create')
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [currentPage, setCurrentPage] = useState<'create' | 'inspire'>('create')
  const [selectedInspiration, setSelectedInspiration] = useState<InspirationItem | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    const t = saved || 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isDark = theme === 'dark'

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/login'); return }
    fetchUser(); fetchInspirations(); fetchAnnouncement()
  }, [])

  async function fetchUser() {
    try { const res = await fetch('/api/user/info', { headers: authHeaders() }); const data = await res.json(); if (data.success) setUser(data.data); else { localStorage.removeItem('token'); router.push('/login') } } catch { localStorage.removeItem('token'); router.push('/login') }
  }
  const MOCK_INSPIRATIONS: InspirationItem[] = [
    { id: 1001, url: 'https://picsum.photos/seed/nb1/400/520', prompt: 'A mystical forest at dawn, golden light filtering through ancient trees, ethereal mist, cinematic lighting, ultra detailed' },
    { id: 1002, url: 'https://picsum.photos/seed/nb2/400/300', prompt: '赛博朋克城市夜景，霓虹灯光倒映在雨水路面，电影级光影' },
    { id: 1003, url: 'https://picsum.photos/seed/nb3/400/500', prompt: 'Beautiful anime girl with flowing silver hair, cherry blossom petals, soft pink lighting, Studio Ghibli style' },
    { id: 1004, url: 'https://picsum.photos/seed/nb4/400/350', prompt: '水墨画风格的中国山水，远山如黛，云雾缭绕，留白意境' },
    { id: 1005, url: 'https://picsum.photos/seed/nb5/400/450', prompt: 'A cozy coffee shop interior, warm autumn afternoon, sunlight through window, watercolor illustration style' },
    { id: 1006, url: 'https://picsum.photos/seed/nb6/400/380', prompt: '未来太空站全景，巨大星球背景，科幻写实风格，8K 超清' },
    { id: 1007, url: 'https://picsum.photos/seed/nb7/400/480', prompt: 'Portrait of a medieval knight in golden armor, dramatic lighting, oil painting masterpiece, intricate details' },
    { id: 1008, url: 'https://picsum.photos/seed/nb8/400/320', prompt: '日式庭院中的锦鲤池塘，红叶纷飞，宁静禅意，摄影级画质' },
    { id: 1009, url: 'https://picsum.photos/seed/nb9/400/550', prompt: 'Abstract fluid art, vivid neon colors swirling, metallic gold accents, 4K wallpaper' },
    { id: 1010, url: 'https://picsum.photos/seed/nb10/400/400', prompt: '可爱的柯基犬穿着宇航员服装，在月球表面漫步，卡通 3D 渲染' },
    { id: 1011, url: 'https://picsum.photos/seed/nb11/400/460', prompt: 'Underwater coral reef scene, tropical fish, bioluminescent jellyfish, crystal clear water, nature photography' },
    { id: 1012, url: 'https://picsum.photos/seed/nb12/400/340', prompt: '蒸汽朋克风格的飞艇，铜色齿轮机械，夕阳天空，复古科幻' },
  ]
  async function fetchInspirations() {
    try {
      const res = await fetch('/api/image/inspirations'); const data = await res.json()
      if (data.success && data.data && data.data.length > 0) setInspirations(data.data)
      else setInspirations(MOCK_INSPIRATIONS)
    } catch { setInspirations(MOCK_INSPIRATIONS) }
  }
  async function fetchWorks() {
    try { const res = await fetch('/api/image/history', { headers: authHeaders() }); const data = await res.json(); if (data.success) setWorks(data.data || []) } catch {}
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
      if (uploadedFiles.length > 0) {
        const formData = new FormData(); formData.append('prompt', prompt); formData.append('model', model); formData.append('image', uploadedFiles[0])
        const res = await fetch('/api/image/edit', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData }); const data = await res.json()
        if (data.success) { toast.success('生成成功！'); fetchWorks(); fetchUser() } else toast.error(data.error || '生成失败')
      } else {
        const res = await fetch('/api/image/generate', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ prompt, model, quantity }) }); const data = await res.json()
        if (data.success) { toast.success('生成成功！'); fetchWorks(); fetchUser() } else toast.error(data.error || '生成失败')
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
    const files = Array.from(e.target.files || []); if (files.length + uploadedFiles.length > 3) { toast.error('最多上传3张'); return }
    setUploadedFiles(prev => [...prev, ...files]); setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }
  function removeFile(idx: number) { setUploadedFiles(prev => prev.filter((_, i) => i !== idx)); setPreviewUrls(prev => prev.filter((_, i) => i !== idx)) }
  function handleLogout() { localStorage.clear(); sessionStorage.clear(); router.push('/login') }
  function applyPrompt(p: string | null) { if (p) { setPrompt(p); setCurrentPage('create'); toast.success('已应用提示词') } }

  useEffect(() => { if (currentPage === 'create') fetchWorks() }, [currentPage])

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]

  /* ===== 侧栏按钮定义 ===== */
  type SidebarBtn = { id: string; icon: React.ReactNode; title: string; page?: 'create' | 'inspire'; onClick?: () => void; href?: string }
  const sidebarButtons: SidebarBtn[] = [
    { id: 'create', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>, title: '创作', page: 'create' },
    { id: 'inspire', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>, title: '灵感', page: 'inspire' },
    { id: 'notice', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>, title: '公告', onClick: () => setShowNotice(true) },
    { id: 'api', icon: <span className="text-[11px] font-bold">API</span>, title: 'API', href: 'https://api.fengjungpt.com' },
    { id: 'theme', icon: isDark
      ? <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      : <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
      title: '切换主题', onClick: toggleTheme },
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
        <div className="mb-8 text-xl">🍌</div>
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
        <div className="relative mt-auto pt-6 w-full flex justify-center" style={{ borderTop: `1px solid ${v('border')}` }}>
          <button onClick={() => { setShowLogoutMenu(!showLogoutMenu); setShowUserCenter(false) }}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all flex items-center justify-center"
            style={{ background: v('avatar-bg') }}>
            <svg className="w-5 h-5" style={{ color: v('avatar-color') }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
          {showLogoutMenu && (
            <div className="absolute bottom-0 left-16 mb-2 w-36 shadow-xl z-50 overflow-hidden"
              style={{ background: v('modal-bg'), border: `1px solid ${v('border')}`, borderRadius: v('radius-md') }}>
              <button onClick={() => { setShowUserCenter(true); setShowLogoutMenu(false); fetchApiKeyStatus() }}
                className="w-full px-4 py-3 text-xs text-left hover:bg-blue-500/10 text-blue-500">👤 个人中心</button>
              <button onClick={handleLogout}
                className="w-full px-4 py-3 text-xs text-left hover:bg-red-500/10 text-red-500" style={{ borderTop: `1px solid ${v('border')}` }}>🚪 退出</button>
            </div>
          )}
        </div>
      </div>

      {/* ===== 主内容区 ===== */}
      {currentPage === 'create' ? (
        <>
          {/* 创作页：控制面板 */}
          <div className="w-full lg:w-96 flex flex-col shrink-0 transition-all duration-300"
            style={{ background: v('panel'), borderRadius: v('panel-radius'), boxShadow: v('panel-shadow') }}>
            <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin pt-16 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Nano Banana</h1>
                  <p className="text-[10px] tracking-widest uppercase" style={{ color: v('text-muted') }}>AI Creative Studio</p>
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
                    placeholder="描述你想生成的画面..." maxLength={2000} />
                  <div className="absolute bottom-2 right-3 text-[10px]" style={{ color: v('text-muted') }}>{prompt.length}/2000</div>
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
                  </div>
                )}
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
          <div className="hidden lg:flex flex-1 flex-col h-full overflow-hidden transition-all duration-300">
            <div className="p-6 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
              <h2 className="text-lg font-bold">我的作品</h2>
              <div className="text-xs" style={{ color: v('text-muted') }}>
                积分: <span className="text-blue-500 font-bold">{user.drawing_points}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="columns-3 gap-4">
                {works.length > 0 ? works.map((item, idx) => (
                  <div key={item.id} className="break-inside-avoid mb-4 overflow-hidden group hover:-translate-y-1 transition-all"
                    style={{ background: isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length], border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}>
                    <div className="relative overflow-hidden">
                      <img src={item.image_url} alt="" className="w-full h-auto block group-hover:scale-105 transition-transform duration-700 cursor-zoom-in"
                        loading="lazy" onClick={() => setLightboxUrl(item.image_url)}
                        style={{ borderRadius: v('radius-md'), margin: '8px', width: 'calc(100% - 16px)' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 pointer-events-none">
                        <p className="text-xs text-gray-100 line-clamp-4 leading-relaxed">{item.prompt || '无提示词'}</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 pointer-events-auto">
                          <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteWork(item.id) }} className="text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10">删除</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : <div className="col-span-3 text-center text-xs py-10" style={{ color: v('text-muted') }}>暂无作品，快去创作吧！</div>}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ===== 灵感页 ===== */
        <>
          <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">
            {/* 灵感页头部 */}
            <div className="p-6 lg:p-8 shrink-0" style={{ borderBottom: `1px solid ${v('border')}` }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">创意灵感库</h1>
                  <p className="text-xs mt-1" style={{ color: v('text-muted') }}>探索和发现优秀的 AI 创作</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: v('text-muted') }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" placeholder="搜索灵感..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 text-xs w-48 focus:w-64 transition-all outline-none focus:border-blue-500/50"
                      style={{ background: v('tag-bg'), border: `1px solid ${v('border')}`, color: v('text'), borderRadius: v('radius-md') }} />
                  </div>
                  <div className="text-xs" style={{ color: v('text-muted') }}>
                    共 <span className="font-bold" style={{ color: v('text') }}>{inspirations.length}</span> 张
                  </div>
                </div>
              </div>
              {/* 分类标签 */}
              <div className="flex gap-2 flex-wrap">
                {['全部', '人物', '风景', '动漫', '写实', '抽象'].map((tag, i) => (
                  <button key={tag}
                    className="px-4 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5"
                    style={{
                      borderRadius: v('radius-sm'),
                      ...(i === 0
                        ? { background: v('active-bg'), color: v('active-color'), border: 'none' }
                        : { color: v('text-muted'), background: v('tag-bg'), border: `1px solid ${v('border')}` }),
                    }}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 灵感瀑布流 */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="columns-2 lg:columns-3 xl:columns-4 gap-4">
                {inspirations.length > 0 ? inspirations.map((item, idx) => {
                  const cardBg = isDark ? v('card') : PASTEL_COLORS[idx % PASTEL_COLORS.length]
                  return (
                    <div key={item.id} onClick={() => setSelectedInspiration(item)}
                      className="break-inside-avoid mb-4 overflow-hidden cursor-pointer group hover:-translate-y-1 transition-all"
                      style={{ background: cardBg, border: isDark ? `1px solid ${v('border')}` : 'none', borderRadius: v('radius-lg') }}>
                      <div className="relative overflow-hidden" style={{ padding: '8px', paddingBottom: 0 }}>
                        <img src={item.url} alt="" className="w-full h-auto block group-hover:scale-105 transition-transform duration-500"
                          loading="lazy" style={{ borderRadius: v('radius-md') }} />
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
                          }}>AI 创作</span>
                          <button className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors"
                            onClick={(e) => { e.stopPropagation(); applyPrompt(item.prompt) }}>使用 →</button>
                        </div>
                      </div>
                    </div>
                  )
                }) : <div className="col-span-4 text-center text-sm py-20" style={{ color: v('text-muted') }}>暂无灵感图片</div>}
              </div>
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
              <div className="text-center text-xs mb-4" style={{ color: v('text-muted') }}>签到次数: {user.checkin_count}</div>
              <div className="flex gap-3">
                <button onClick={() => { setShowApiKeyModal(true); setShowUserCenter(false) }}
                  className="flex-1 py-2 border border-blue-500/50 text-blue-500 text-xs" style={{ borderRadius: v('radius-sm') }}>{hasApiKey ? '修改 Key' : '配置 Key'}</button>
                {hasApiKey && <button onClick={deleteApiKey} className="flex-1 py-2 border border-red-500/50 text-red-500 text-xs" style={{ borderRadius: v('radius-sm') }}>删除 Key</button>}
              </div>
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
        <div className="lg:hidden fixed inset-0 z-[90] backdrop-blur-sm" style={{ background: v('overlay') }} onClick={() => setMobileSidebar(false)}></div>
      )}
    </div>
  )
}
