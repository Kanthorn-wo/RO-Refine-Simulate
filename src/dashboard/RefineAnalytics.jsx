import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { getOreName, ORE_COLORS, ORE_IMAGES } from '../constants/ores'
import { getRate } from '../constants/refineRates'
import { supabase } from '../lib/supabase'

/* ── helpers ── */
const fmt = (n) => Number(n || 0).toLocaleString('th-TH')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const TYPE_LABEL = {
  weapon1: 'W1 อาวุธ Lv.1', weapon2: 'W2 อาวุธ Lv.2', weapon3: 'W3 อาวุธ Lv.3',
  weapon4: 'W4 อาวุธ Lv.4', weapon5: 'W5 อาวุธ Lv.5',
  armor1: 'A1 เกราะ Lv.1', armor2: 'A2 เกราะ Lv.2',
}
const TYPE_SHORT = { weapon1: 'W1', weapon2: 'W2', weapon3: 'W3', weapon4: 'W4', weapon5: 'W5', armor1: 'A1', armor2: 'A2' }
const isWeapon = (t) => typeof t === 'string' && t.startsWith('weapon')
const defaultIcon = (t) => (isWeapon(t) ? '/images/default_weapon.png' : '/images/default_armor.png')
const dpIcon = (id) => `https://static.divine-pride.net/images/items/item/${id}.png`

const RESULT_META = {
  success: { label: 'สำเร็จ',    color: '#34d399', bg: '#34d39920' },
  fail:    { label: 'ล้มเหลว',   color: '#64748b', bg: '#64748b20' },
  drop:    { label: 'ลดระดับ',   color: '#fbbf24', bg: '#fbbf2420' },
  lost:    { label: 'ไอเทมหาย', color: '#fb7185', bg: '#fb718520' },
}
const STONE_META = {
  normal:   { label: 'หินปกติ',  cls: 'bg-slate-500/15 text-slate-300' },
  enriched: { label: 'Enriched', cls: 'bg-violet-500/15 text-violet-300' },
  hd:       { label: 'HD',       cls: 'bg-cyan-500/15 text-cyan-300' },
}
const RESULT_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' }, { id: 'success', label: 'สำเร็จ' },
  { id: 'fail', label: 'ล้มเหลว' }, { id: 'drop', label: 'ลดระดับ' },
  { id: 'lost', label: 'ไอเทมหาย' },
]
const STONE_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' }, { id: 'normal', label: 'หินปกติ' },
  { id: 'enriched', label: 'Enriched' }, { id: 'hd', label: 'HD' },
]
const MODE_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' }, { id: 'manual', label: 'Manual' }, { id: 'auto', label: 'Auto' },
]

/* ── small atoms ── */
function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function RollBar({ rate, rollPct }) {
  const fail = 100 - rate
  const tip = `ติด ${rate}% / แตก ${fail}%${rollPct != null ? ` | ผลออกที่ ${rollPct.toFixed(2)}%` : ''}`
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={tip}>
      {/* เลขฝั่งติด */}
      <span className="w-7 shrink-0 text-right tabular-nums text-[10px] font-semibold text-emerald-400">{rate}%</span>
      {/* bar */}
      <span className="relative flex h-2 w-16 shrink-0 overflow-visible rounded-sm">
        {/* ฝั่งติด */}
        <span className="h-full rounded-l-sm bg-emerald-500" style={{ width: `${rate}%` }} />
        {/* ฝั่งแตก */}
        <span className="h-full rounded-r-sm bg-rose-500/70" style={{ width: `${fail}%` }} />
        {/* เส้นแบ่งโซน */}
        <span className="absolute inset-y-[-2px] w-px bg-white/60" style={{ left: `${rate}%` }} />
        {/* marker ผลออก (สีฟ้า กว้าง 2px ยื่นพ้น bar นิด) */}
        {rollPct != null && (
          <span
            className="absolute rounded-full bg-sky-300"
            style={{ left: `${rollPct}%`, top: -3, bottom: -3, width: 2, transform: 'translateX(-50%)', boxShadow: '0 0 5px #7dd3fc' }}
          />
        )}
      </span>
      {/* เลขฝั่งแตก */}
      <span className="w-7 shrink-0 tabular-nums text-[10px] font-semibold text-rose-400">{fail}%</span>
    </span>
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

function Spinner({ size = 16, className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const Sk = ({ className = '' }) => <div className={`animate-pulse rounded bg-white/10 ${className}`} />

function RefineSkeleton({ error }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
            <Sk className="h-7 w-16" /><Sk className="h-3 w-20" />
          </div>
        ))}
      </div>
      {error && <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
        <Sk className="mb-4 h-4 w-48" /><Sk className="h-[280px] w-full" />
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
        <Sk className="mb-4 h-4 w-40" />
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-14 w-full" />)}</div>
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
        <Sk className="mb-4 h-4 w-32" />
        <div className="space-y-1.5">{Array.from({ length: 8 }).map((_, i) => <Sk key={i} className="h-10 w-full" />)}</div>
      </div>
    </div>
  )
}

function ItemIcon({ id, type, size = 28 }) {
  const [err, setErr] = useState(false)
  const src = id && !err ? dpIcon(id) : defaultIcon(type)
  return (
    <img src={src} alt="" width={size} height={size} onError={() => setErr(true)}
      className="shrink-0 rounded bg-black/20 object-contain"
      style={{ width: size, height: size, imageRendering: 'pixelated' }} />
  )
}

function useItemNames(ids) {
  const [map, setMap] = useState({})
  const cache = useRef({})
  useEffect(() => {
    let cancelled = false
    const todo = ids.filter((id) => id && !(id in cache.current))
    if (!todo.length) return
    todo.forEach((id) => { cache.current[id] = null })
    Promise.all(
      todo.map(async (id) => {
        try {
          const r = await fetch(`/api/item?id=${id}`)
          if (!r.ok) return
          const d = await r.json()
          cache.current[id] = { name: d.name }
        } catch { /* ignore */ }
      })
    ).then(() => { if (!cancelled) setMap({ ...cache.current }) })
    return () => { cancelled = true }
  }, [ids])
  return map
}

function relTime(iso, now) {
  const s = Math.max(0, Math.floor(((now || Date.now()) - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'เมื่อสักครู่'
  if (s < 60) return `${s} วินาทีที่แล้ว`
  const m = Math.floor(s / 60); if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

/* ── stacked-bar chart ── */
function LevelTooltip({ active, payload, label, logByLevel }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload || {}
  const total = (data.success || 0) + (data.fail || 0) + (data.drop || 0) + (data.lost || 0)
  const ores = logByLevel[label] || {}

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur min-w-[180px]">
      <div className="mb-2 font-semibold text-slate-200">ตีระดับ +{label} → +{Number(label) + 1}</div>
      <div className="mb-2 space-y-1">
        {[['success', 'สำเร็จ'], ['fail', 'ล้มเหลว'], ['drop', 'ลดระดับ'], ['lost', 'ไอเทมหาย']].map(([k, l]) =>
          data[k] > 0 ? (
            <div key={k} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RESULT_META[k].color }} />
              <span className="text-slate-400">{l}</span>
              <span className="ml-auto tabular-nums text-slate-100">{fmt(data[k])}</span>
              <span className="text-slate-500">({pct(data[k], total)}%)</span>
            </div>
          ) : null
        )}
      </div>
      {Object.keys(ores).length > 0 && (
        <div className="border-t border-white/10 pt-2 space-y-1">
          {Object.entries(ores).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([ore, cnt]) => (
            <div key={ore} className="flex items-center gap-2">
              {ORE_IMAGES[ore]
                ? <img src={ORE_IMAGES[ore]} alt="" width={12} height={12} className="shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
                : <span className={`h-2 w-2 shrink-0 rounded-full ${ORE_COLORS[ore] || 'bg-slate-400'}`} />}
              <span className="text-slate-400 truncate">{ore}</span>
              <span className="ml-auto tabular-nums text-slate-100">{fmt(cnt)}</span>
            </div>
          ))}
        </div>
      )}
      {(data.weapon > 0 || data.armor > 0) && (
        <div className="border-t border-white/10 pt-2 mt-1 flex gap-3 text-[10px] text-slate-500">
          {data.weapon > 0 && <span>อาวุธ {fmt(data.weapon)}</span>}
          {data.armor > 0 && <span>เกราะ {fmt(data.armor)}</span>}
        </div>
      )}
    </div>
  )
}

export default function RefineAnalytics({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [live, setLive] = useState(false)
  const [now, setNow] = useState(Date.now())
  // history filters + pagination
  const [filterResult, setFilterResult] = useState('all')
  const [filterStone, setFilterStone] = useState('all')
  const [filterMode, setFilterMode] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const mountedRef = useRef(true)

  // Realtime subscription — รับ INSERT ใหม่จาก refine_log ทันที
  useEffect(() => {
    mountedRef.current = true
    const channel = supabase
      .channel('refine_log_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'refine_log' }, (payload) => {
        if (!mountedRef.current) return
        const r = payload.new
        const matchFilter =
          (filterResult === 'all' || r.result === filterResult) &&
          (filterStone === 'all' || r.stone === filterStone) &&
          (filterMode === 'all' || r.mode === filterMode)
        if (matchFilter && page === 1) {
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              log: [r, ...prev.log].slice(0, PAGE_SIZE),
              total: (prev.total || 0) + 1,
            }
          })
        } else if (!matchFilter) {
          // นับยอดรวมแม้ไม่ตรง filter
          setData((prev) => prev ? { ...prev, total: (prev.total || 0) + 1 } : prev)
        }
      })
      .subscribe((status) => { if (mountedRef.current) setLive(status === 'SUBSCRIBED') })
    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [filterResult, filterStone, filterMode, page])

  // ticker อัปเดตเวลา relative ทุก 2 วิ (เหมือน ActivityFeed)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  const load = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const token = session?.access_token
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (filterResult !== 'all') params.set('result', filterResult)
      if (filterStone  !== 'all') params.set('stone',  filterStone)
      if (filterMode   !== 'all') params.set('mode',   filterMode)
      const r = await fetch(`/api/refine?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error(`โหลดไม่สำเร็จ (${r.status})`)
      const j = await r.json()
      setData(j)
      setPage(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(1) }, [session, tick, filterResult, filterStone, filterMode])

  const leaderboard   = useMemo(() => data?.leaderboard || [], [data])
  const breakdown     = useMemo(() => data?.breakdown || {}, [data])
  const log           = useMemo(() => data?.log || [], [data])
  const levelResult   = useMemo(() => data?.levelResult || [], [data])
  const total         = data?.total || 0
  const totalPages    = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // resolve ชื่อ item จาก divine-pride
  const ids = useMemo(() => {
    const s = new Set()
    for (const r of leaderboard) if (r.item_id) s.add(r.item_id)
    for (const r of log) if (r.item_id) s.add(r.item_id)
    return [...s]
  }, [leaderboard, log])
  const names = useItemNames(ids)

  // สรุปรวม (จาก breakdown global)
  const totalAttempts = useMemo(() => {
    const rd = breakdown.result || {}
    return Object.values(rd).reduce((a, b) => a + (b.count || 0), 0)
  }, [breakdown])
  const successCount = (breakdown.result?.success?.count) || 0
  const bsbYes = (breakdown.bsb?.yes?.count) || 0

  // stone legend: คำนวณชื่อแร่จริงจาก log (item_type + level + stone → ore name)
  const stoneLegend = useMemo(() => {
    const counts = {}
    for (const r of log) {
      const useCash = r.stone === 'hd'
      const useEnriched = r.stone === 'enriched'
      const ore = getOreName(r.item_type, r.level, useCash, useEnriched)
      if (ore) counts[ore] = (counts[ore] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [log])

  // ore lookup ต่อ level สำหรับ tooltip
  const logByLevel = useMemo(() => {
    const m = {}
    for (const r of log) {
      const useCash = r.stone === 'hd'
      const useEnriched = r.stone === 'enriched'
      const ore = getOreName(r.item_type, r.level, useCash, useEnriched)
      if (!m[r.level]) m[r.level] = {}
      if (ore) m[r.level][ore] = (m[r.level][ore] || 0) + 1
    }
    return m
  }, [log])

  const itemLabel = (r) => {
    if (r.item_name) return r.item_name
    if (r.item_id && names[r.item_id]) return names[r.item_id].name
    return TYPE_LABEL[r.item_type] || r.item_type
  }

  if (!data) return <RefineSkeleton error={error} />

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base font-semibold text-slate-200">สถิติการตีบวก</h2>
          {live && <LiveBadge />}
          <p className="text-xs text-slate-500">กราฟระดับ · หินจริง · อันดับไอเทม · ประวัติ Realtime</p>
        </div>
        <button onClick={() => setTick((t) => t + 1)} disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-slate-100 disabled:opacity-50">
          {loading ? <Spinner size={13} /> : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
          รีเฟรช
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'ตีทั้งหมด (ครั้ง)', value: fmt(totalAttempts), color: '#818cf8' },
          { label: 'อัตราสำเร็จ',        value: `${pct(successCount, totalAttempts)}%`, color: '#34d399' },
          { label: 'ชนิดไอเทม (ประเภท)', value: fmt(leaderboard.length), color: '#22d3ee' },
          { label: 'ใช้ BSB',             value: `${pct(bsbYes, totalAttempts)}%`, color: '#fbbf24' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
            <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Stacked Bar: ภาพรวมการตีบวก (level × result) ── */}
      <Panel
        title="ภาพรวมการตีบวก"
        subtitle="จำนวนครั้งต่อระดับ แบ่งตามผลลัพธ์ — hover เพื่อดูหินที่ใช้"
      >
        {levelResult.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={levelResult} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="level" tickFormatter={(v) => `+${v}`}
                  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<LevelTooltip logByLevel={logByLevel} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="success" name="สำเร็จ"    fill="#34d399" stackId="a" isAnimationActive={false} radius={[0,0,0,0]} />
                <Bar dataKey="fail"    name="ล้มเหลว"   fill="#475569" stackId="a" isAnimationActive={false} />
                <Bar dataKey="drop"    name="ลดระดับ"   fill="#fbbf24" stackId="a" isAnimationActive={false} />
                <Bar dataKey="lost"    name="ไอเทมหาย" fill="#fb7185" stackId="a" isAnimationActive={false} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* legend result */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {Object.entries(RESULT_META).map(([k, m]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
                  {m.label}
                </span>
              ))}
            </div>
          </>
        )}

        {/* stone legend: ชื่อแร่จริงพร้อมจำนวน */}
        {stoneLegend.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="mb-2 text-xs font-medium text-slate-500">หินที่ใช้ (จากประวัติ {fmt(log.length)} ครั้งล่าสุด)</div>
            <div className="flex flex-wrap gap-2">
              {stoneLegend.map(([ore, cnt]) => (
                <span key={ore} className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs">
                  {ORE_IMAGES[ore]
                    ? <img src={ORE_IMAGES[ore]} alt="" width={14} height={14} className="shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
                    : <span className={`h-2 w-2 shrink-0 rounded-full ${ORE_COLORS[ore] || 'bg-slate-400'}`} />}
                  <span className="text-slate-200">{ore}</span>
                  <span className="text-slate-500 tabular-nums">{fmt(cnt)}</span>
                </span>
              ))}
              {bsbYes > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                  <img src="/images/blacksmith_blessing.png" alt="" width={14} height={14} className="shrink-0 object-contain" />
                  BSB <span className="tabular-nums text-amber-400">{fmt(bsbYes)}</span>
                  <span className="text-amber-600">({pct(bsbYes, totalAttempts)}%)</span>
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* ── Leaderboard ── */}
      <Panel title="อันดับไอเทมที่ตีบ่อยสุด" subtitle="แยกตามไอเทม — Fixed type หรือค้นจาก divine-pride">
        {leaderboard.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 15).map((r, i) => {
              const sr = pct(r.success, r.attempts)
              const name = r.item_id && names[r.item_id] ? names[r.item_id].name : TYPE_LABEL[r.item_type] || r.item_type
              return (
                <div key={`${r.item_type}-${r.item_id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-slate-600">{i + 1}</span>
                  <ItemIcon id={r.item_id || null} type={r.item_type} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-200">{name}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${isWeapon(r.item_type) ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300'}`}>
                        {TYPE_SHORT[r.item_type] || ''}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${sr}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums text-slate-200">{fmt(r.attempts)}</div>
                    <div className="text-[10px] text-slate-500">ติด {sr}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* ── History (paginated) ── */}
      <Panel
        title="ประวัติการตีบวก"
        subtitle={`ทั้งหมด ${fmt(total)} ครั้ง · หน้า ${page}/${totalPages}`}
        action={
          <div className="flex flex-wrap gap-1">
            {RESULT_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilterResult(f.id)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${filterResult === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-500 hover:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {/* sub-filters */}
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {STONE_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilterStone(f.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filterStone === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-500 hover:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {MODE_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilterMode(f.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filterMode === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-500 hover:text-slate-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Spinner /> กำลังโหลด…
          </div>
        ) : log.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">ไม่มีรายการ</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {log.map((r, i) => {
                const rm = RESULT_META[r.result] || RESULT_META.fail
                const sm = STONE_META[r.stone] || STONE_META.normal
                const useCash = r.stone === 'hd'
                const useEnriched = r.stone === 'enriched'
                const oreName = getOreName(r.item_type, r.level, useCash, useEnriched)
                const rate = r.item_type ? getRate(r.event_buff, useCash, useEnriched, r.item_type, r.level) : null
                const rollPct = r.roll_pct != null ? Number(r.roll_pct) : null
                return (
                  <div key={r.id ?? i} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-sm">
                    <ItemIcon id={r.item_id || null} type={r.item_type} size={26} />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium text-slate-200">{itemLabel(r)}</span>
                      <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{TYPE_SHORT[r.item_type] || r.item_type}</span>
                      <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-indigo-300">+{r.level}</span>
                      {/* ชื่อแร่จริง */}
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {oreName && ORE_IMAGES[oreName]
                          ? <img src={ORE_IMAGES[oreName]} alt="" width={10} height={10} className="object-contain" style={{ imageRendering: 'pixelated' }} />
                          : <span className={`h-1.5 w-1.5 rounded-full ${ORE_COLORS[oreName] || 'bg-slate-400'}`} />}
                        {oreName || sm.label}
                      </span>
                      {r.bsb && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">BSB</span>}
                      {r.event_buff && <span className="shrink-0 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium text-orange-300">Event</span>}
                      {r.mode === 'auto' && <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">Auto</span>}
                      {r.vid && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500" title={r.vid}>
                          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          {r.vid.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {rate != null && <RollBar rate={rate} rollPct={rollPct} />}
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: rm.bg, color: rm.color }}>
                      {rm.label}{rollPct != null && <span className="opacity-80"> ({rollPct.toFixed(2)}%)</span>}
                    </span>
                    <span className="hidden w-12 shrink-0 text-right text-[11px] text-slate-500 sm:block">{relTime(r.created_at, now)}</span>
                  </div>
                )
              })}
            </div>

            {/* pagination */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition-colors hover:text-slate-100 disabled:opacity-40">ก่อนหน้า</button>
              <span className="text-slate-500">หน้า {page} / {totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition-colors hover:text-slate-100 disabled:opacity-40">ถัดไป</button>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
