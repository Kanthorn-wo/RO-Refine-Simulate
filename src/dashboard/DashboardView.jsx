import { useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useOnlineCount } from '../utils/useOnlineCount'
import MonitorView from './MonitorView'
import RefineAnalytics from './RefineAnalytics'
import Toggle from '../components/Toggle'

const ACCENT = '#818cf8'
const ACCENT2 = '#34d399'
const PIE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#a78bfa']

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '-')
const fmtDuration = (s) => {
  if (typeof s !== 'number' || !isFinite(s)) return '-'
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

/* ─── nav icons ─── */
const NavIc = {
  analytics: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  monitor: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  usage: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18" /><path d="M7 14l3-4 4 3 5-7" />
    </svg>
  ),
  menu: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  x: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
}

const NAV_ITEMS = [
  { id: 'analytics', label: 'Analytics', sub: 'GA4 ผู้ใช้งาน', icon: NavIc.analytics },
  { id: 'usage',     label: 'Usage',     sub: 'สถิติการใช้งานรวม', icon: NavIc.usage },
  { id: 'monitor',   label: 'Monitor',   sub: 'สุขภาพเว็บไซต์',  icon: NavIc.monitor },
]

// อ่าน tab จาก URL hash (เช่น #usage) — validate ว่ามีจริง ไม่งั้น default analytics
function tabFromHash() {
  try {
    const h = (window.location.hash || '').replace(/^#/, '')
    if (h && NAV_ITEMS.some((n) => n.id === h)) return h
  } catch { /* ignore */ }
  return 'analytics'
}

/* ─── icons (analytics section) ─── */
const Icon = {
  users: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  session: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
}

/* ─── small reusable pieces ─── */
function DeltaBadge({ value }) {
  if (value == null) return <span className="text-[11px] font-medium text-slate-500">—</span>
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
      </svg>
      {Math.abs(value)}%
    </span>
  )
}

function Sparkline({ data, dataKey, color }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#spark-${dataKey})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function KpiCard({ icon, label, value, delta, spark, sparkKey, color = ACCENT }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm transition-colors hover:border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
            {icon({ width: 18, height: 18 })}
          </span>
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        <DeltaBadge value={delta} />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</div>
      {spark && <div className="-mx-1 mt-2"><Sparkline data={spark} dataKey={sparkKey} color={color} /></div>}
    </div>
  )
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const TREND_OPTIONS = [
  { id: 'today', label: 'วันนี้' },
  { id: '7',    label: '7 วัน' },
  { id: '30',   label: '30 วัน' },
  { id: '90',   label: '90 วัน' },
]

function RangeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {TREND_OPTIONS.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value === o.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Leaderboard({ items, valueKey, labelKey, hintMap }) {
  if (!items?.length) return <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>
  const max = Math.max(...items.map((i) => i[valueKey] || 0), 1)
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => {
        const label = it[labelKey]
        const hint = hintMap?.[label]
        return (
          <div key={i} className="relative">
            <div className="absolute inset-y-0 left-0 rounded-lg bg-indigo-500/10" style={{ width: `${((it[valueKey] || 0) / max) * 100}%` }} />
            <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-300" title={label}>{label || '(ไม่ระบุ)'}</span>
                {hint && <span className="block truncate text-[11px] text-slate-500" title={hint}>{hint}</span>}
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-100">{fmt(it[valueKey])}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CHANNEL_HINTS = {
  Direct: 'พิมพ์ URL เอง / บุ๊กมาร์ก / เปิดจากแอปที่ไม่ส่งที่มา',
  'Organic Search': 'ค้นหาเจอใน Google/Bing (ไม่ใช่โฆษณา)',
  'Organic Social': 'คลิกลิงก์จากโซเชียล เช่น Facebook/X/TikTok',
  'Organic Video': 'มาจากวิดีโอ เช่น YouTube',
  Referral: 'คลิกลิงก์จากเว็บอื่นที่ไม่ใช่โซเชียล',
  Email: 'คลิกลิงก์จากอีเมล',
  'Paid Search': 'โฆษณาบนหน้าค้นหา (เสียเงิน)',
  'Paid Social': 'โฆษณาบนโซเชียล (เสียเงิน)',
  Display: 'โฆษณาแบนเนอร์ตามเว็บต่าง ๆ',
  'Cross-network': 'แคมเปญโฆษณาข้ามหลายแพลตฟอร์มของ Google',
  Unassigned: 'GA จัดกลุ่มไม่ได้ (ข้อมูลที่มาไม่พอ)',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <div className="mb-1 font-medium text-slate-300">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-100">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  )
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <Skeleton className="h-80" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" /><Skeleton className="h-72" />
      </div>
    </div>
  )
}

/* ─── Analytics content (ไม่เปลี่ยนจากเดิม) ─── */
function AnalyticsContent({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trendRange, setTrendRange] = useState('30')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError('')
      try {
        const token = session?.access_token
        const res = await fetch('/api/ga', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `โหลดข้อมูลไม่สำเร็จ (${res.status})`)
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [session])

  const totals = data?.totals || {}
  const deltas = data?.deltas || {}
  const ts = data?.timeseries || []
  const sparkData = ts.slice(-30)
  const isHourly = trendRange === 'today'
  const trendData = isHourly ? (data?.hourly || []) : ts.slice(-Number(trendRange))
  const trendXKey = isHourly ? 'hour' : 'date'
  const trendSubtitle = isHourly ? 'ผู้ใช้และเซสชันวันนี้ (รายชั่วโมง)' : `ผู้ใช้และเซสชันใน ${trendRange} วันล่าสุด`
  const devices = data?.devices || []
  const deviceTotal = devices.reduce((s, d) => s + (d.users || 0), 0)
  const audience = data?.audience || {}
  const audienceData = [
    { type: 'กลับมาซ้ำ', users: audience.returningUsers || 0 },
    { type: 'ผู้ใช้ใหม่',  users: audience.newUsers || 0 },
  ]
  const audienceTotal = (audience.newUsers || 0) + (audience.returningUsers || 0)

  if (loading) return <LoadingState />
  if (error && !loading) return (
    <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 p-5 text-sm text-rose-300">
      <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="mt-1 text-rose-400/80">{error}</p>
    </div>
  )
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Icon.users}   label="ผู้ใช้"           value={fmt(totals.activeUsers)}       delta={deltas.activeUsers}       spark={sparkData} sparkKey="activeUsers"       color="#818cf8" />
        <KpiCard icon={Icon.session} label="เซสชัน"           value={fmt(totals.sessions)}          delta={deltas.sessions}          spark={sparkData} sparkKey="sessions"          color="#34d399" />
        <KpiCard icon={Icon.eye}     label="เพจวิว"           value={fmt(totals.screenPageViews)}   delta={deltas.screenPageViews}   spark={sparkData} sparkKey="screenPageViews"   color="#fbbf24" />
        <KpiCard icon={Icon.clock}   label="เวลาเฉลี่ย/เซสชัน" value={fmtDuration(totals.averageSessionDuration)} delta={deltas.averageSessionDuration} color="#f472b6" />
      </div>

      <Panel title="แนวโน้ม" subtitle={trendSubtitle} action={<RangeToggle value={trendRange} onChange={setTrendRange} />}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.45} /><stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT2} stopOpacity={0.35} /><stop offset="95%" stopColor={ACCENT2} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={trendXKey} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="activeUsers" name="ผู้ใช้"   stroke={ACCENT}  strokeWidth={2.5} fill="url(#gUsers)" />
            <Area type="monotone" dataKey="sessions"    name="เซสชัน"   stroke={ACCENT2} strokeWidth={2.5} fill="url(#gSessions)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="การใช้งานฟีเจอร์" subtitle="จำนวนครั้งที่เกิด event" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.events || []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name="จำนวน" fill="url(#gBar)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="อุปกรณ์" subtitle="สัดส่วนผู้ใช้">
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={devices} dataKey="users" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none">
                  {devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">{fmt(deviceTotal)}</span>
              <span className="text-[11px] text-slate-500">ผู้ใช้</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {devices.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-slate-400">{d.category}</span>
                <span className="ml-auto font-medium text-slate-200">{deviceTotal ? Math.round((d.users / deviceTotal) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="ผู้ใช้ใหม่ vs กลับมาซ้ำ" subtitle="สัดส่วน 30 วัน">
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={audienceData} dataKey="users" nameKey="type" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="none">
                  <Cell fill="#34d399" /><Cell fill="#818cf8" />
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">
                {audienceTotal ? Math.round(((audience.returningUsers || 0) / audienceTotal) * 100) : 0}%
              </span>
              <span className="text-[11px] text-slate-500">กลับมาซ้ำ</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="text-slate-400">กลับมาซ้ำ</span><span className="ml-auto font-medium text-slate-200">{fmt(audience.returningUsers)}</span></div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400" /><span className="text-slate-400">ผู้ใช้ใหม่</span><span className="ml-auto font-medium text-slate-200">{fmt(audience.newUsers)}</span></div>
            <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
              <span className="text-slate-400">เฉลี่ยกลับมา/คนเก่า</span>
              <span className="font-semibold text-indigo-300">{audience.returningAvgVisits || 0} ครั้ง</span>
            </div>
          </div>
        </Panel>
        <Panel title="ช่องทางที่มา" subtitle="ผู้ใช้มาจากแหล่งใด" className="lg:col-span-2">
          <Leaderboard items={data.channels} valueKey="users" labelKey="channel" hintMap={CHANNEL_HINTS} />
        </Panel>
      </div>

      <Panel title="หน้าที่เข้าชมมากสุด" subtitle="ตามจำนวนเพจวิว">
        <Leaderboard items={data.topPages} valueKey="views" labelKey="path" />
      </Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="ประเทศ" subtitle="ตามจำนวนผู้ใช้">
          <Leaderboard items={data.countries} valueKey="users" labelKey="country" />
        </Panel>
        <Panel title="เมือง" subtitle="ตามจำนวนผู้ใช้">
          <Leaderboard items={data.cities} valueKey="users" labelKey="city" />
        </Panel>
      </div>
    </div>
  )
}

/* ─── Activity feed (realtime-ish via polling) ─── */
function Spinner({ size = 16, className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function relTime(iso, now) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'เมื่อสักครู่'
  if (s < 60) return `${s} วินาทีที่แล้ว`
  const m = Math.floor(s / 60); if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  const d = Math.floor(h / 24); return `${d} วันที่แล้ว`
}

const EVENT_META = {
  refine:   { label: 'ตีบวก',        dot: '#818cf8' },
  auto:     { label: 'เริ่ม Auto',   dot: '#fbbf24' },
  simulate: { label: 'รันจำลอง',     dot: '#34d399' },
  visit:    { label: 'มีคนเข้าเว็บ', dot: '#f472b6' },
}
const PAGE_SIZES = [10, 25, 50]
const EVENT_FILTERS = [
  { id: 'all',      label: 'ทั้งหมด' },
  { id: 'refine',   label: 'ตีบวก' },
  { id: 'auto',     label: 'Auto' },
  { id: 'simulate', label: 'จำลอง' },
  { id: 'visit',    label: 'เข้าเว็บ' },
]

function ActivityFeed() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [now, setNow] = useState(Date.now())
  const [filter, setFilter] = useState('all')
  const [sortKey, setSortKey] = useState('at')   // 'at' | 'type' | 'count'
  const [sortDir, setSortDir] = useState('desc')  // 'asc' | 'desc'
  const [live, setLive] = useState(false)
  const mountedRef = useRef(true)

  const load = async () => {
    if (mountedRef.current) { setRefreshing(true); setError('') }
    try {
      const res = await fetch('/api/stats?events=200')
      if (!res.ok) throw new Error(`โหลดไม่สำเร็จ (${res.status})`)
      const json = await res.json()
      if (mountedRef.current) setEvents(json.events || [])
    } catch (err) {
      if (mountedRef.current) setError(err.message)
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }

  // โหลดรายการเริ่มต้น + subscribe realtime (INSERT) — กิจกรรมใหม่เด้งทันที ไม่ต้อง poll
  useEffect(() => {
    mountedRef.current = true
    load()
    const channel = supabase
      .channel('usage_events_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'usage_events' }, (payload) => {
        if (!mountedRef.current) return
        const r = payload.new
        const ev = { at: r.created_at, type: r.type, count: Number(r.count || 1), vid: r.vid || null, status: r.visitor_status || null }
        setEvents((prev) => [ev, ...(prev || [])].slice(0, 200))
      })
      .subscribe((status) => { if (mountedRef.current) setLive(status === 'SUBSCRIBED') })
    return () => { mountedRef.current = false; supabase.removeChannel(channel) }
  }, [])

  // ticker อัปเดตเวลา relative ทุก 2 วิ
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  const all = events || []
  const filtered = filter === 'all' ? all : all.filter((e) => e.type === filter)
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...filtered].sort((a, b) => {
    let av, bv
    if (sortKey === 'count') { av = a.count; bv = b.count }
    else if (sortKey === 'type') { av = a.type; bv = b.type }
    else { av = a.at; bv = b.at }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const rows = sorted.slice(start, start + pageSize)

  const sortBy = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'type' ? 'asc' : 'desc') }
    setPage(1)
  }
  const sortIcon = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <Panel
      title="กิจกรรมล่าสุด"
      subtitle="เรียลไทม์ — กิจกรรมใหม่เด้งทันทีผ่าน Supabase Realtime"
      action={
        <div className="flex items-center gap-2">
          {live && <LiveBadge />}
          <button onClick={load} disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50">
            {refreshing
              ? <Spinner size={13} />
              : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
            รีเฟรช
          </button>
        </div>
      }
    >
      {error && <div className="mb-3 rounded-lg border border-rose-900/50 bg-rose-950/40 p-2.5 text-xs text-rose-300">{error}</div>}

      {events === null ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Spinner /> กำลังโหลด…</div>
      ) : all.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">ยังไม่มีกิจกรรม</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {EVENT_FILTERS.map((f) => (
                <button key={f.id} onClick={() => { setFilter(f.id); setPage(1) }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${filter === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">{fmt(sorted.length)} รายการ</span>
          </div>

          {sorted.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">ไม่มีกิจกรรมในตัวกรองนี้</p>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                  <th className="w-10 px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">
                    <button onClick={() => sortBy('type')} className="font-medium transition-colors hover:text-slate-200">กิจกรรม{sortIcon('type')}</button>
                  </th>
                  <th className="px-2 py-2 font-medium">ผู้ใช้</th>
                  <th className="px-2 py-2 text-right font-medium">
                    <button onClick={() => sortBy('count')} className="font-medium transition-colors hover:text-slate-200">จำนวน{sortIcon('count')}</button>
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    <button onClick={() => sortBy('at')} className="font-medium transition-colors hover:text-slate-200">เวลา{sortIcon('at')}</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev, i) => {
                  const meta = EVENT_META[ev.type] || { label: ev.type, dot: '#94a3b8' }
                  return (
                    <tr key={start + i} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-2 tabular-nums text-slate-500">{start + i + 1}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-2 text-slate-200">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.dot }} />
                          <span className="truncate">{meta.label}</span>
                          {ev.type === 'visit' && ev.status && (
                            <span className={ev.status === 'new' ? 'shrink-0 text-xs text-cyan-400' : 'shrink-0 text-xs text-violet-400'}>
                              ({ev.status === 'new' ? 'คนใหม่' : 'คนเก่า'})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-400">
                        <span className="block truncate" title={ev.vid || ''}>{ev.vid || '—'}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300">{ev.type === 'refine' ? `×${fmt(ev.count)}` : '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-400" title={new Date(ev.at).toLocaleString('th-TH')}>{relTime(ev.at, now)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>แสดง</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200 [color-scheme:dark]">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>รายการ · ทั้งหมด {fmt(all.length)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 transition-colors hover:text-slate-200 disabled:opacity-40">ก่อนหน้า</button>
              <span>หน้า {safePage}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 transition-colors hover:text-slate-200 disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
          </>
          )}
        </>
      )}
    </Panel>
  )
}

/* ─── Usage: 3 sub-tabs ─── */
const TRAFFIC_METRICS = [
  { id: 'visits',           label: 'คนเข้าเว็บ', color: '#f472b6' },
  { id: 'visits_new',       label: 'คนใหม่',     color: '#22d3ee' },
  { id: 'visits_returning', label: 'กลับมาซ้ำ',  color: '#a78bfa' },
  { id: 'auto',             label: 'เริ่ม Auto', color: '#f59e0b' },
  { id: 'simulate',         label: 'รันจำลอง',   color: '#4ade80' },
]

const USAGE_SUB_TABS = [
  { id: 'traffic',  label: 'ทราฟฟิก',    sub: 'ผู้เข้าชม / กิจกรรม' },
  { id: 'refine',   label: 'การตีบวก',   sub: 'สถิติ / ประวัติ' },
  { id: 'settings', label: 'ตั้งค่า',    sub: 'การแสดงผลหน้าเว็บ' },
]

const usageToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const usageDaysAgo = (n) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10)

function UsageContent({ session }) {
  const [usageTab, setUsageTab] = useState('traffic')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState(null)
  const [from, setFrom] = useState(usageDaysAgo(29))
  const [to, setTo] = useState(usageToday())
  const [metric, setMetric] = useState('visits')
  const [reloadTick, setReloadTick] = useState(0)
  const refresh = () => setReloadTick((t) => t + 1)
  // badge ออนไลน์ผูกกับ flag ระบบนับ — ปิดอยู่ก็ไม่ต้องต่อ WebSocket และโชว์สถานะ "ปิด" แทนเลข 0
  const trackingOn = !!data?.trackOnline
  const online = useOnlineCount({ track: false, enabled: trackingOn })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError('')
      try {
        const res = await fetch(`/api/stats?from=${from}&to=${to}`)
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status})`)
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [from, to, reloadTick])

  const toggleSetting = async (key, field) => {
    if (!data || savingKey) return
    const next = !data[field]
    setSavingKey(key); setError('')
    try {
      const token = session?.access_token
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ key, value: next }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `บันทึกไม่สำเร็จ (${res.status})`)
      }
      setData((d) => ({ ...d, [field]: next }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingKey(null)
    }
  }

  const today = usageToday()
  const daily = data?.daily || []
  const activeMetric = TRAFFIC_METRICS.find((m) => m.id === metric) || TRAFFIC_METRICS[0]
  const rangeTotal = daily.reduce((s, d) => s + (d[metric] || 0), 0)
  const setQuickRange = (n) => { setFrom(usageDaysAgo(n - 1)); setTo(usageToday()) }
  const rangeNew = daily.reduce((s, d) => s + (d.visits_new || 0), 0)
  const rangeReturning = daily.reduce((s, d) => s + (d.visits_returning || 0), 0)
  const rangeVisits = rangeNew + rangeReturning
  const newPct = rangeVisits ? Math.round((rangeNew / rangeVisits) * 100) : 0

  const headerBar = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="text-base font-semibold text-slate-200">Usage</h2>
        {data == null ? (
          // กำลังโหลด — placeholder ขนาดเท่ากัน กัน flicker "ปิด → เลข"
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-medium text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-700" />
            <span className="tabular-nums">—</span> ออนไลน์
          </span>
        ) : trackingOn ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="tabular-nums">{fmt(online)}</span> ออนไลน์
          </span>
        ) : (
          // ระบบนับปิดอยู่ — ไม่ใช่ "0 คนออนไลน์"
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-medium text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            ระบบนับปิด
          </span>
        )}
      </div>
      {/* tab refine ไม่ใช้ refresh นี้ — ซ่อนด้วย invisible (คงพื้นที่ไว้) กันความสูงแถว header เปลี่ยน = layout shift */}
      <button onClick={refresh} disabled={loading || usageTab === 'refine'}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-slate-100 disabled:opacity-50 ${usageTab === 'refine' ? 'invisible' : ''}`}>
        {loading
          ? <Spinner size={14} />
          : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
        รีเฟรช
      </button>
    </div>
  )

  // sub-tab pills
  const subTabs = (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 gap-0.5">
      {USAGE_SUB_TABS.map((t) => (
        <button key={t.id} onClick={() => setUsageTab(t.id)}
          className={`rounded-lg px-3.5 py-2 text-left transition-all ${
            usageTab === t.id
              ? 'bg-indigo-500/20 text-indigo-200'
              : 'text-slate-400 hover:text-slate-200'
          }`}>
          <span className="block text-xs font-semibold leading-tight">{t.label}</span>
          <span className="block text-[10px] text-slate-500 leading-tight">{t.sub}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {headerBar}
      {error && <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}
      {subTabs}

      {/* ── Traffic ── */}
      {usageTab === 'traffic' && (
        <div className="space-y-6">
          {loading && !data ? <LoadingState /> : (
            <>
              {/* KPI วันนี้ */}
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">วันนี้ · {today}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'คนเข้าวันนี้',     value: data?.visitsToday,    color: '#f472b6' },
                    { label: 'คนใหม่วันนี้',      value: data?.newToday,       color: '#22d3ee' },
                    { label: 'กลับมาซ้ำวันนี้',   value: data?.returningToday, color: '#a78bfa' },
                    { label: 'ผู้ใช้ไม่ซ้ำทั้งหมด', value: data?.totalVisitors,  color: '#818cf8' },
                    { label: 'เริ่ม Auto วันนี้',  value: data?.autoToday,      color: '#f59e0b' },
                    { label: 'รันจำลองวันนี้',     value: data?.simToday,       color: '#4ade80' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                      <div className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{fmt(s.value)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* กราฟแนวโน้ม ผู้เข้าชม */}
              <Panel
                title="แนวโน้มผู้เข้าชม"
                subtitle={`${from} → ${to} · รวม ${fmt(rangeTotal)} ${activeMetric.label}`}
                action={
                  <div className="flex flex-wrap items-center gap-1">
                    {[7, 30, 90].map((n) => (
                      <button key={n} onClick={() => setQuickRange(n)}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">
                        {n} วัน
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <input type="date" value={from} max={to}
                      onChange={(e) => e.target.value && setFrom(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200 [color-scheme:dark]" />
                    <span>ถึง</span>
                    <input type="date" value={to} min={from} max={today}
                      onChange={(e) => e.target.value && setTo(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200 [color-scheme:dark]" />
                  </div>
                  <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                    {TRAFFIC_METRICS.map((m) => (
                      <button key={m.id} onClick={() => setMetric(m.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${metric === m.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        style={metric === m.id ? { background: `${m.color}33` } : undefined}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {daily.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">ไม่มีข้อมูลในช่วงนี้</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey={metric} name={activeMetric.label} fill={activeMetric.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {daily.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {daily.length} วัน · คนใหม่ {newPct}% · กลับมาซ้ำ {100 - newPct}%
                  </p>
                )}
              </Panel>

              <ActivityFeed />
            </>
          )}
        </div>
      )}

      {/* ── การตีบวก ── */}
      {usageTab === 'refine' && (
        <RefineAnalytics session={session} />
      )}

      {/* ── ตั้งค่า ── */}
      {usageTab === 'settings' && (
        <Panel title="การแสดงผลบนหน้าเว็บ" subtitle="ควบคุมสิ่งที่ผู้เล่นเห็นใต้แบนเนอร์">
          {loading && !data ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
          ) : (
            <div className="space-y-3">
              {/* ── ตัวเลขสถิติ ── */}
              {[{ key: 'show_stats', field: 'showStats', icon: Icon.eye, title: 'ตัวเลขสถิติรวม', desc: 'แถบ ตีบวก / ใช้แร่ / คนใช้วันนี้ ใต้แบนเนอร์', onLabel: 'แสดงอยู่', offLabel: 'ซ่อนอยู่' }].map((s) => {
                const on = !!data?.[s.field]
                return (
                  <div key={s.key} className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${on ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors"
                        style={{ background: on ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.05)', color: on ? '#34d399' : '#94a3b8' }}>
                        {s.icon({ width: 18, height: 18 })}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{s.title}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${on ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>{on ? s.onLabel : s.offLabel}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
                      </div>
                    </div>
                    <Toggle checked={on} onChange={() => toggleSetting(s.key, s.field)} disabled={savingKey === s.key} activeColor="bg-emerald-500" ariaLabel={s.title} />
                  </div>
                )
              })}

              {/* ── กลุ่ม: คนออนไลน์ ── */}
              {(() => {
                const anyOn = !!(data?.trackOnline || data?.showOnline)
                return (
              <div className={`rounded-xl border transition-colors ${anyOn ? 'border-emerald-500/25' : 'border-white/5'} bg-white/[0.02]`}>
                {/* header กลุ่ม */}
                <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-400">
                    {Icon.users({ width: 15, height: 15 })}
                  </span>
                  <span className="text-sm font-medium text-slate-300">คนออนไลน์</span>
                </div>
                {/* sub-toggles */}
                {[
                  { key: 'track_online', field: 'trackOnline', title: 'ระบบนับ (WebSocket)', desc: 'เปิด Presence — ปิด = ไม่มีข้อมูลออนไลน์เลย', onLabel: 'ทำงาน', offLabel: 'ปิดอยู่' },
                  { key: 'show_online',  field: 'showOnline',  title: 'แสดงให้ผู้เล่นเห็น',   desc: 'badge "● N กำลังออนไลน์" ในหน้าเว็บ',         onLabel: 'แสดงอยู่', offLabel: 'ซ่อนอยู่' },
                ].map((s, idx, arr) => {
                  const on = !!data?.[s.field]
                  // "แสดงให้ผู้เล่นเห็น" ต้องมีระบบนับก่อน — ปิดระบบนับ = ไม่มีข้อมูลจะแสดง จึงล็อก toggle นี้ไว้
                  const locked = s.key === 'show_online' && !data?.trackOnline
                  return (
                    <div key={s.key}
                      className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${on && !locked ? 'bg-emerald-500/[0.04]' : ''} ${locked ? 'opacity-50' : ''} ${idx < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-200">{s.title}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${on ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>{on ? s.onLabel : s.offLabel}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{locked ? 'ต้องเปิด “ระบบนับ” ด้านบนก่อน' : s.desc}</p>
                      </div>
                      <Toggle checked={on} onChange={() => toggleSetting(s.key, s.field)} disabled={savingKey === s.key || locked} activeColor="bg-emerald-500" ariaLabel={s.title} />
                    </div>
                  )
                })}
              </div>
                )
              })()}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            ปิดไว้ได้ตอนตัวเลขยังน้อย แล้วค่อยเปิดเมื่อดูน่าเชื่อถือ — การเปลี่ยนมีผลกับผู้เล่นภายใน ~1 นาที (cache)
          </p>
        </Panel>
      )}
    </div>
  )
}

/* ─── shell with side nav ─── */
export default function DashboardView({ session }) {
  // tab เก็บใน URL hash (#usage) — F5/แชร์ลิงก์/back-forward อยู่ tab เดิม
  const [activeTab, setActiveTab] = useState(tabFromHash)
  const [sideOpen, setSideOpen] = useState(false)   // mobile drawer
  const [deskOpen, setDeskOpen] = useState(true)    // desktop sidebar

  // sync hash → state (back/forward, แก้ hash เอง, เปิดลิงก์ที่มี hash)
  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // sync state → hash (replaceState กันสร้าง history ซ้ำ ๆ เวลากด tab)
  useEffect(() => {
    if (tabFromHash() !== activeTab) {
      window.history.replaceState(null, '', `#${activeTab}`)
    }
  }, [activeTab])

  const activeItem = NAV_ITEMS.find(n => n.id === activeTab)

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex">
      {/* glow */}
      <div className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: 'radial-gradient(800px 400px at 20% -5%, rgba(99,102,241,0.18), transparent), radial-gradient(700px 400px at 100% 0%, rgba(16,185,129,0.10), transparent)' }} />

      {/* overlay backdrop (mobile only) */}
      {sideOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSideOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-white/5 bg-slate-950/95 backdrop-blur-md transition-transform duration-300 ${sideOpen ? 'translate-x-0' : '-translate-x-full'} ${deskOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}>
        {/* logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/5 px-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/20">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-slate-100">RO Dashboard</span>
          <button onClick={() => { setSideOpen(false); setDeskOpen(false) }} className="ml-auto text-slate-400 hover:text-slate-200 p-1">
            <NavIc.x width={16} height={16} />
          </button>
        </div>

        {/* nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setSideOpen(false) }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-200'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? 'bg-indigo-500/25' : 'bg-white/[0.04]'}`}>
                  {item.icon({ width: 16, height: 16 })}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{item.label}</span>
                  <span className="block text-[11px] text-slate-500 leading-tight">{item.sub}</span>
                </span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />}
              </button>
            )
          })}
        </nav>

        {/* user + logout */}
        <div className="shrink-0 border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
              {(session?.user?.email || '?')[0].toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-300">{session?.user?.email}</span>
            </span>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 transition-colors">
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ─── main content ─── */}
      <div className={`relative flex-1 min-w-0 transition-all duration-300 ${deskOpen ? 'lg:ml-56' : 'lg:ml-0'}`}>
        {/* top bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-white/5 bg-slate-950/80 px-4 backdrop-blur-md sm:px-6">
          <button onClick={() => { setSideOpen(true); setDeskOpen(true) }} className={`${deskOpen ? 'lg:hidden' : ''} rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors`}>
            <NavIc.menu width={20} height={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold leading-tight text-slate-100">{activeItem?.label}</h1>
            <p className="text-xs text-slate-500">{activeItem?.sub}</p>
          </div>
          <a href="https://ro-refine.com" target="_blank" rel="noopener noreferrer"
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-slate-100">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            ro-refine.com
          </a>
        </header>

        {/* page content */}
        <main className="px-4 py-6 sm:px-6 sm:py-8">
          {activeTab === 'analytics' && <AnalyticsContent session={session} />}
          {activeTab === 'usage'     && <UsageContent     session={session} />}
          {activeTab === 'monitor'   && <MonitorView      session={session} />}
        </main>
      </div>
    </div>
  )
}
