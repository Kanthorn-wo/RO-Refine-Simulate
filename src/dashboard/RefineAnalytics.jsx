import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'

/* ── helpers / labels ── */
const fmt = (n) => Number(n || 0).toLocaleString('th-TH')
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const TYPE_LABEL = {
  weapon1: 'อาวุธ Lv.1', weapon2: 'อาวุธ Lv.2', weapon3: 'อาวุธ Lv.3', weapon4: 'อาวุธ Lv.4', weapon5: 'อาวุธ Lv.5',
  armor1: 'เกราะ Lv.1', armor2: 'เกราะ Lv.2',
}
const TYPE_SHORT = { weapon1: 'W1', weapon2: 'W2', weapon3: 'W3', weapon4: 'W4', weapon5: 'W5', armor1: 'A1', armor2: 'A2' }
const isWeapon = (t) => typeof t === 'string' && t.startsWith('weapon')
const defaultIcon = (t) => (isWeapon(t) ? '/images/default_weapon.png' : '/images/default_armor.png')
const dpIcon = (id) => `https://static.divine-pride.net/images/items/item/${id}.png`

const RESULT_META = {
  success: { label: 'สำเร็จ', color: '#34d399' },
  fail: { label: 'ล้มเหลว', color: '#94a3b8' },
  drop: { label: 'ลดระดับ', color: '#fbbf24' },
  lost: { label: 'ไอเทมหาย', color: '#fb7185' },
}
const STONE_META = {
  normal: { label: 'หินปกติ', cls: 'bg-slate-500/15 text-slate-300' },
  enriched: { label: 'Enriched', cls: 'bg-violet-500/15 text-violet-300' },
  hd: { label: 'HD', cls: 'bg-cyan-500/15 text-cyan-300' },
}

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

function ItemIcon({ id, type, size = 28 }) {
  const [err, setErr] = useState(false)
  const src = id && !err ? dpIcon(id) : defaultIcon(type)
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="shrink-0 rounded bg-black/20 object-contain"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

/* ── divine-pride item resolver (cache ต่อ id) ── */
function useItemNames(ids) {
  const [map, setMap] = useState({})
  const cache = useRef({})
  useEffect(() => {
    let cancelled = false
    const todo = ids.filter((id) => id && !(id in cache.current))
    if (!todo.length) return
    todo.forEach((id) => { cache.current[id] = null }) // กันยิงซ้ำ
    Promise.all(
      todo.map(async (id) => {
        try {
          const r = await fetch(`/api/item?id=${id}`)
          if (!r.ok) return
          const d = await r.json()
          cache.current[id] = { name: d.name, level: d.itemLevel, weapon: d.itemTypeId === 1 || d.attack > 0 }
        } catch { /* ignore */ }
      })
    ).then(() => { if (!cancelled) setMap({ ...cache.current }) })
    return () => { cancelled = true }
  }, [ids])
  return map
}

function relTime(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} วิ`
  const m = Math.floor(s / 60); if (m < 60) return `${m} นาที`
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชม.`
  return `${Math.floor(h / 24)} วัน`
}

const RESULT_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'success', label: 'สำเร็จ' },
  { id: 'fail', label: 'ล้มเหลว' },
  { id: 'drop', label: 'ลดระดับ' },
  { id: 'lost', label: 'ไอเทมหาย' },
]

const Sk = ({ className = '' }) => <div className={`animate-pulse rounded bg-white/10 ${className}`} />

// skeleton โครงเดียวกับของจริง (ความสูงใกล้เคียง) — กัน layout shift ตอนโหลด
function RefineSkeleton({ error }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2"><Sk className="h-5 w-40" /><Sk className="h-3 w-56" /></div>
        <Sk className="h-8 w-16" />
      </div>
      {error && <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3"><Sk className="h-7 w-16" /><Sk className="h-3 w-20" /></div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
        <Sk className="mb-4 h-4 w-48" />
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-14 w-full" />)}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5"><Sk className="mb-4 h-4 w-24" /><Sk className="h-[200px] w-full" /></div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
        <Sk className="mb-4 h-4 w-40" />
        <div className="space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Sk key={i} className="h-11 w-full" />)}</div>
      </div>
    </div>
  )
}

export default function RefineAnalytics({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError('')
      try {
        const token = session?.access_token
        const r = await fetch('/api/refine', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!r.ok) throw new Error(`โหลดไม่สำเร็จ (${r.status})`)
        const j = await r.json()
        if (!cancelled) setData(j)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [session, tick])

  const leaderboard = useMemo(() => data?.leaderboard || [], [data])
  const breakdown = useMemo(() => data?.breakdown || {}, [data])
  const log = useMemo(() => data?.log || [], [data])

  // resolve ชื่อ item จาก divine-pride (leaderboard + log)
  const ids = useMemo(() => {
    const s = new Set()
    for (const r of leaderboard) if (r.item_id) s.add(r.item_id)
    for (const r of log) if (r.item_id) s.add(r.item_id)
    return [...s]
  }, [leaderboard, log])
  const names = useItemNames(ids)

  // สรุปรวม
  const totalAttempts = useMemo(() => Object.values(breakdown.result || {}).reduce((a, b) => a + b, 0), [breakdown])
  const successTotal = (breakdown.result || {}).success || 0
  const bsbYes = (breakdown.bsb || {}).yes || 0

  const resultData = useMemo(
    () => Object.entries(breakdown.result || {}).map(([k, v]) => ({ key: k, name: RESULT_META[k]?.label || k, value: v, color: RESULT_META[k]?.color || '#94a3b8' })),
    [breakdown]
  )
  const stoneData = useMemo(
    () => Object.entries(breakdown.stone || {}).map(([k, v]) => ({ name: STONE_META[k]?.label || k, value: v })),
    [breakdown]
  )
  const levelData = useMemo(
    () => Object.entries(breakdown.level || {})
      .map(([k, v]) => ({ level: Number(k), name: `+${k}`, value: v }))
      .sort((a, b) => a.level - b.level),
    [breakdown]
  )

  const filteredLog = filter === 'all' ? log : log.filter((r) => r.result === filter)
  const shownLog = filteredLog.slice(0, limit)

  const itemLabel = (r) => {
    if (r.item_id && names[r.item_id]) return names[r.item_id].name
    return TYPE_LABEL[r.item_type] || r.item_type
  }

  if (!data) return <RefineSkeleton error={error} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-200">สถิติการตีบวก (ละเอียด)</h2>
          <p className="text-xs text-slate-500">ทุก attempt — อันดับไอเทม, ผลลัพธ์, หิน, BSB, รายการล่าสุด</p>
        </div>
        <button onClick={() => setTick((t) => t + 1)} disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-slate-100 disabled:opacity-50">
          รีเฟรช
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>}

      {/* สรุปรวม */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'ตีทั้งหมด (ครั้ง)', value: fmt(totalAttempts), color: '#818cf8' },
          { label: 'อัตราสำเร็จ', value: `${pct(successTotal, totalAttempts)}%`, color: '#34d399' },
          { label: 'ไอเทมที่ตี (ชนิด)', value: fmt(leaderboard.length), color: '#22d3ee' },
          { label: 'ใช้ BSB', value: `${pct(bsbYes, totalAttempts)}%`, color: '#fbbf24' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
            <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <Panel title="อันดับไอเทมที่ตีบ่อยสุด" subtitle="แยกตามไอเทม (fixed W1-5/A1-2 หรือไอเทมจาก divine-pride)">
        {leaderboard.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 12).map((r, i) => {
              const sr = pct(r.success, r.attempts)
              return (
                <div key={`${r.item_type}-${r.item_id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-slate-500">{i + 1}</span>
                  <ItemIcon id={r.item_id || null} type={r.item_type} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-200">
                        {r.item_id && names[r.item_id] ? names[r.item_id].name : TYPE_LABEL[r.item_type] || r.item_type}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${isWeapon(r.item_type) ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300'}`}>
                        {isWeapon(r.item_type) ? 'อาวุธ' : 'เกราะ'} · {TYPE_SHORT[r.item_type] || ''}
                      </span>
                      {r.item_id ? <span className="shrink-0 text-[10px] text-slate-600">#{r.item_id}</span> : null}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${sr}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums text-slate-200">{fmt(r.attempts)}</div>
                    <div className="text-[10px] text-slate-500">สำเร็จ {sr}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Breakdown charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="ผลลัพธ์">
          {resultData.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">—</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={resultData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {resultData.map((d) => <Cell key={d.key} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {resultData.map((d) => (
              <span key={d.key} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name} {fmt(d.value)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="หินที่ใช้">
          {stoneData.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">—</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stoneData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="ครั้ง" fill="#a78bfa" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="ระดับที่ตี (+N)">
          {levelData.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">—</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={levelData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="ครั้ง" fill="#38bdf8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Detail list */}
      <Panel
        title="รายการตีบวกล่าสุด"
        subtitle={`เก็บ 500 ครั้งล่าสุด · แสดง ${Math.min(shownLog.length, filteredLog.length)}/${filteredLog.length}`}
        action={
          <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {RESULT_FILTERS.map((f) => (
              <button key={f.id} onClick={() => { setFilter(f.id); setLimit(50) }}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${filter === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {filteredLog.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีรายการ</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {shownLog.map((r, i) => {
                const rm = RESULT_META[r.result] || RESULT_META.fail
                const sm = STONE_META[r.stone] || STONE_META.normal
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-sm">
                    <ItemIcon id={r.item_id || null} type={r.item_type} size={26} />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium text-slate-200">{itemLabel(r)}</span>
                      <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{TYPE_SHORT[r.item_type] || r.item_type}</span>
                      <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-indigo-300">+{r.level}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${sm.cls}`}>{sm.label}</span>
                      {r.bsb && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">BSB</span>}
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${rm.color}22`, color: rm.color }}>
                      {rm.label}
                    </span>
                    <span className="hidden w-12 shrink-0 text-right text-[11px] text-slate-500 sm:block">{relTime(r.created_at)}</span>
                  </div>
                )
              })}
            </div>
            {limit < filteredLog.length && (
              <div className="mt-3 text-center">
                <button onClick={() => setLimit((l) => l + 50)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-slate-100">
                  โหลดเพิ่ม
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
