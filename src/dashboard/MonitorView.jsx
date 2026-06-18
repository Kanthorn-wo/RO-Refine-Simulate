import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

/* ─── palette ─── */
const C = {
  indigo: '#818cf8', emerald: '#34d399', amber: '#fbbf24',
  rose: '#f87171', sky: '#38bdf8', violet: '#a78bfa',
}
const PAGE_COLORS = { 'home-th': C.indigo, 'home-en': C.violet, dashboard: C.sky, 'api-item': C.emerald }
const LH_COLORS = { performance: C.amber, seo: C.indigo, accessibility: C.emerald, best_practices: C.sky }

/* ─── utils ─── */
const _fmt = (n, unit = '') => (n == null ? '—' : `${Number(n).toLocaleString()}${unit}`)
const fmtMs = (n) => n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`
const fmtDate = (s) => s ? s.slice(5) : '' // MM-DD

/* ─── icons ─── */
const Ic = {
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5" /></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  gauge: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 12l4-4" /></svg>,
  activity: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
}

/* ─── micro components ─── */
function Skeleton({ h = 'h-40' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${h}`} />
}

function Panel({ title, hint, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    passed:  { cls: 'bg-emerald-500/15 text-emerald-400', label: 'ผ่าน' },
    partial: { cls: 'bg-amber-500/15 text-amber-400',     label: 'บางหน้าพัง' },
    failed:  { cls: 'bg-rose-500/15 text-rose-400',       label: 'ล้มเหลว' },
  }
  const s = map[status] || { cls: 'bg-slate-500/15 text-slate-400', label: status || '—' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  )
}

function ScoreRing({ score, label }) {
  if (score == null) return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-14 w-14 rounded-full border-4 border-white/10 flex items-center justify-center">
        <span className="text-xs text-slate-500">—</span>
      </div>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  )
  const radius = 22; const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ
  const good = score >= 90; const ok = score >= 70
  const strokeColor = good ? '#34d399' : ok ? '#fbbf24' : '#f87171'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <circle cx="28" cy="28" r={radius} fill="none" stroke={strokeColor} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: strokeColor }}>
          {score}
        </span>
      </div>
      <span className="text-[11px] text-slate-500 text-center">{label}</span>
    </div>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label && <div className="mb-1.5 font-medium text-slate-300">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-100 pl-4">{p.value}{p.unit || ''}</span>
        </div>
      ))}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color = C.indigo, hint }) {
  return (
    <div title={hint} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
          {icon({ width: 18, height: 18 })}
        </span>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

/* ─── pivot lighthouse trend → per-day rows with label columns ─── */
function pivotLhTrend(rows, metric) {
  const dayMap = {}
  for (const r of rows) {
    if (!dayMap[r.day]) dayMap[r.day] = { day: fmtDate(r.day) }
    dayMap[r.day][r.label] = r[metric]
  }
  return Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day))
}

/* ─── pivot response time trend → per-day rows with label columns ─── */
function pivotRespTrend(rows) {
  const dayMap = {}
  for (const r of rows) {
    if (!dayMap[r.day]) dayMap[r.day] = { day: fmtDate(r.day) }
    dayMap[r.day][r.label] = r.avgMs
  }
  return Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day))
}

/* ─── main ─── */
export default function MonitorView({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lhMetric, setLhMetric] = useState('performance')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError('')
      try {
        const token = session?.access_token
        const res = await fetch('/api/monitor', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
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

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} h="h-32" />)}</div>
      <Skeleton h="h-72" /><Skeleton h="h-72" />
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton h="h-64" /><Skeleton h="h-64" /></div>
    </div>
  )

  if (error) return (
    <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 p-5 text-sm text-rose-300">
      <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="mt-1 text-rose-400/80">{error}</p>
      {error.includes('SUPABASE_SERVICE_ROLE_KEY') && (
        <p className="mt-2 text-xs text-rose-400/60">ตั้ง SUPABASE_SERVICE_ROLE_KEY ใน Vercel Environment Variables แล้ว redeploy</p>
      )}
    </div>
  )

  if (!data) return null

  /* ─── derived ─── */
  const latest = data.latestRun
  const uptime = data.uptimeTrend
  const avgUptime = uptime.length
    ? Math.round(uptime.reduce((s, r) => s + (Number(r.uptime_pct) || 0), 0) / uptime.length)
    : null
  const avgRespMs = data.latestPages.length
    ? Math.round(data.latestPages.reduce((s, r) => s + (r.response_time_ms || 0), 0) / data.latestPages.filter(r => r.response_time_ms).length)
    : null
  const lhLatest = data.latestLighthouse
  const avgSeo = lhLatest.length ? Math.round(lhLatest.reduce((s, r) => s + (r.seo || 0), 0) / lhLatest.length) : null

  const lhTrendData = pivotLhTrend(data.lighthouseTrend, lhMetric)
  const respTrendData = pivotRespTrend(data.responseTimeTrend)
  const lhLabels = [...new Set(data.lighthouseTrend.map(r => r.label))]
  const pageLabels = [...new Set(data.responseTimeTrend.map(r => r.label))]

  const LH_METRIC_OPTIONS = [
    { id: 'performance', label: 'Perf' },
    { id: 'seo', label: 'SEO' },
    { id: 'accessibility', label: 'A11y' },
    { id: 'best_practices', label: 'BP' },
  ]

  return (
    <div className="space-y-6">

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Ic.shield} label="Uptime (30 วัน)" color={C.emerald}
          value={avgUptime != null ? `${avgUptime}%` : '—'}
          sub="ค่าเฉลี่ย page check ที่ผ่าน"
          hint="เปอร์เซ็นต์ของ page check ที่ตอบสนอง 200 OK ใน 30 วันล่าสุด"
        />
        <KpiCard
          icon={Ic.activity} label="Run ล่าสุด" color={latest?.status === 'passed' ? C.emerald : C.rose}
          value={latest ? <StatusBadge status={latest.status} /> : '—'}
          sub={latest ? `${latest.pages_passed}/${latest.pages_total} หน้าผ่าน` : 'ยังไม่มีข้อมูล'}
          hint="ผลการ monitor ล่าสุด: passed = ทุกหน้าปกติ, partial = บางหน้ามีปัญหา, failed = มีหน้าล้มเหลว"
        />
        <KpiCard
          icon={Ic.clock} label="Response Time" color={C.amber}
          value={avgRespMs != null ? fmtMs(avgRespMs) : '—'}
          sub="ค่าเฉลี่ย run ล่าสุด"
          hint="ค่าเฉลี่ยเวลาโหลดหน้า (ms) จากการ monitor ล่าสุด — ต่ำกว่าดีกว่า"
        />
        <KpiCard
          icon={Ic.gauge} label="Lighthouse SEO" color={C.indigo}
          value={avgSeo != null ? `${avgSeo}` : '—'}
          sub="คะแนนเฉลี่ย 0–100"
          hint="คะแนน SEO จาก Lighthouse run ล่าสุด — 90+ ดีเยี่ยม, 70–89 ต้องปรับ, <70 มีปัญหา"
        />
      </div>

      {/* ─── uptime trend ─── */}
      <Panel title="Uptime รายวัน (30 วัน)"
        hint="เปอร์เซ็นต์ของ page check ที่ผ่าน (200 OK, ไม่มี js error) — ค่าต่ำแสดงว่าเว็บมีปัญหาช่วงนั้น">
        {uptime.length === 0
          ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล — รอให้ monitoring รันอย่างน้อย 1 วัน</p>
          : <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={uptime.map(r => ({ ...r, day: fmtDate(r.day), uptime_pct: Number(r.uptime_pct) }))}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="gUptime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.emerald} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={36} unit="%" />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="uptime_pct" name="Uptime" unit="%" stroke={C.emerald} strokeWidth={2.5} fill="url(#gUptime)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
        }
      </Panel>

      {/* ─── response time trend ─── */}
      <Panel title="Response Time รายวัน (30 วัน) — ต่อหน้า"
        hint="เวลาโหลดเฉลี่ย (ms) ของแต่ละหน้าในแต่ละวัน — เส้นพุ่งสูงหมายถึงเซิร์ฟเวอร์ช้าหรือมีปัญหา">
        {respTrendData.length === 0
          ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
          : <ResponsiveContainer width="100%" height={240}>
              <LineChart data={respTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={48} unit="ms" />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {pageLabels.map(lbl => (
                  <Line key={lbl} type="monotone" dataKey={lbl} name={lbl}
                    stroke={PAGE_COLORS[lbl] || C.violet} strokeWidth={2}
                    dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
        }
      </Panel>

      {/* ─── Lighthouse trend + latest scores ─── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* trend */}
        <Panel className="lg:col-span-2"
          title="Lighthouse Scores (30 วัน)"
          hint="คะแนน 0–100 จาก Google Lighthouse — ยิ่งสูงยิ่งดี เส้นตกต่ำบอกว่ามีการเปลี่ยนแปลงที่กระทบ">
          <div className="mb-3 flex gap-1 flex-wrap">
            {LH_METRIC_OPTIONS.map(o => (
              <button key={o.id} onClick={() => setLhMetric(o.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  lhMetric === o.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200 border border-white/10'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          {lhTrendData.length === 0
            ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล — รอให้ monitoring รันอย่างน้อย 1 วัน</p>
            : <ResponsiveContainer width="100%" height={200}>
                <LineChart data={lhTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {lhLabels.map(lbl => (
                    <Line key={lbl} type="monotone" dataKey={lbl} name={lbl}
                      stroke={PAGE_COLORS[lbl] || C.violet} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
          }
        </Panel>

        {/* latest lighthouse rings */}
        <Panel title="คะแนน Run ล่าสุด" hint="วัดด้วย Lighthouse จากเซิร์ฟเวอร์ CI — Performance ผันผวน ดู SEO/A11y เป็นหลัก">
          {lhLatest.length === 0
            ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
            : lhLatest.map(lh => (
                <div key={lh.label} className="mb-4 last:mb-0">
                  <div className="mb-2 text-xs font-medium text-slate-400">{lh.label}</div>
                  <div className="flex justify-around gap-2">
                    <ScoreRing score={lh.performance}    label="Perf"  />
                    <ScoreRing score={lh.seo}            label="SEO"   />
                    <ScoreRing score={lh.accessibility}  label="A11y"  />
                    <ScoreRing score={lh.best_practices} label="BP"    />
                  </div>
                </div>
              ))
          }
        </Panel>
      </div>

      {/* ─── latest page results ─── */}
      <Panel title="ผล Run ล่าสุด — รายหน้า"
        hint="สถานะของแต่ละหน้าในการ monitor ครั้งล่าสุด — response time, ขนาดหน้า, js error, failed request">
        {data.latestPages.length === 0
          ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    {['หน้า', 'Status', 'Response', 'ขนาด', 'JS Error', 'Failed Req'].map(h => (
                      <th key={h} className="pb-2 pr-4 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {data.latestPages.map(p => (
                    <tr key={p.label} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-slate-200 whitespace-nowrap">{p.label}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {p.ok
                            ? <Ic.check width={10} height={10} />
                            : <Ic.x width={10} height={10} />
                          }
                          {p.http_status || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-slate-300">{fmtMs(p.response_time_ms)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-slate-400">
                        {p.page_size_bytes ? `${(p.page_size_bytes / 1024).toFixed(0)} KB` : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={p.js_errors > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'}>
                          {p.js_errors ?? 0}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={p.failed_requests > 0 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                          {p.failed_requests ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Panel>

      {/* ─── run history ─── */}
      <Panel title="ประวัติการ Monitor (30 รายการล่าสุด)"
        hint="ทุก run จะบันทึก status, จำนวนหน้าที่ผ่าน/ล้มเหลว — กด Run workflow บน GitHub Actions เพื่อรันเพิ่ม">
        {data.runs.length === 0
          ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
          : <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {data.runs.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03] transition-colors">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${
                    r.status === 'passed' ? 'bg-emerald-400' : r.status === 'partial' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    {new Date(r.started_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <StatusBadge status={r.status} />
                  <span className="ml-auto text-xs text-slate-500">
                    {r.pages_passed}/{r.pages_total} หน้า
                  </span>
                  {r.notes && <span className="text-[11px] text-slate-600 truncate max-w-[120px]">{r.notes}</span>}
                </div>
              ))}
            </div>
        }
      </Panel>
    </div>
  )
}
