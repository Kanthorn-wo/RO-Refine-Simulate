import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList } from 'recharts'

// หน้า "ภาพรวม" — สรุปว่าผู้เข้าชมทั้งหมดทำอะไรบ้าง จาก GET /api/stats?overview=1 (RPC overview_stats ใน docs/sql/overview-stats.sql)
// ทุก panel บอก "ฐานข้อมูล" ของตัวเอง (prop basis) เพราะแต่ละแหล่งเริ่มเก็บคนละวัน:
// - ตัวเลขรวมตลอดกาล = usage_counters / usage_daily (view คำนวณจาก refine_log — ตรงกับประวัติเสมอ)
// - อัตราตีติดรวม = refine_breakdown (แหล่งเดียวกับ KPI หน้า Usage > ตีบวก — ต้องตรงกัน)
// - ผลการตีแยกกลุ่ม / ประเภทไอเทม = refine_log ทุกแถว (เท่ากับประวัติในหน้า Usage)
// - สถิติรายคน = refine_log ที่ join usage_visitors, ตัวหาร = คนที่เข้าเว็บตั้งแต่วันแรกของ refine_log (active_since_log)

const ACCENT = '#818cf8'
// สีผลการตี — ชุดเดียวกับ RESULT_META ในหน้า Usage (เทา = ล้มแต่ไม่เสียอะไร)
const RESULTS = [
  { key: 'success', label: 'สำเร็จ',                    color: '#34d399', ink: 'text-slate-950' },
  { key: 'fail',    label: 'ล้ม — ไม่เสียอะไร (BSB กัน)', color: '#64748b', ink: 'text-white' },
  { key: 'drop',    label: 'ล้ม — ลดระดับ',              color: '#fbbf24', ink: 'text-slate-950' },
  { key: 'lost',    label: 'ล้ม — ไอเทมหาย',             color: '#fb7185', ink: 'text-slate-950' },
]
const TYPE_LABEL = {
  weapon1: 'อาวุธ Lv.1', weapon2: 'อาวุธ Lv.2', weapon3: 'อาวุธ Lv.3', weapon4: 'อาวุธ Lv.4', weapon5: 'อาวุธ Lv.5',
  armor1: 'เกราะ Lv.1', armor2: 'เกราะ Lv.2',
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('th-TH') : '—')
const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0)
const fmtPct = (p) => `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const sumResults = (o) => (o ? RESULTS.reduce((s, r) => s + (o[r.key] || 0), 0) : 0)

function Panel({ id, title, summary, basis, children }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {/* ประโยคสรุป — อ่านบรรทัดเดียวรู้คำตอบ */}
      {summary && <p className="mt-1 text-sm text-indigo-200/90">{summary}</p>}
      {/* ฐานข้อมูลของ panel นี้ (นับจากอะไร ตั้งแต่เมื่อไร) — กันตัวเลขต่าง panel ดูขัดกัน */}
      {basis && <p className="mt-1 text-xs text-slate-500">ฐานข้อมูล: {basis}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

// แท่งแนวนอน 1 แถว (% ของผู้เข้าชม) + จำนวนคน — ใช้กับ "ผู้ใช้ทำอะไรบ้าง"
function AdoptionRow({ label, count, total, refined, note }) {
  const p = pct(count, total)
  return (
    // ชื่อ + ตัวเลขบรรทัดบน, แท่งเต็มความกว้างบรรทัดล่าง — อ่านง่ายทั้งจอใหญ่และมือถือ
    <li title={`${label}: ${fmt(count)} คน (${fmtPct(p)} ของผู้เข้าชมช่วงเดียวกัน${refined ? ` · ${fmtPct(pct(count, refined))} ของคนที่ตีบวก` : ''})`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm text-slate-300">
          {label}
          {note && <span className="ml-1.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">{note}</span>}
        </span>
        <span className="text-xs tabular-nums text-slate-300">
          <b className="text-slate-100">{fmt(count)}</b> คน · {fmtPct(p)} ของผู้เข้าชมช่วงเดียวกัน
          {refined ? <span className="text-slate-500"> · {fmtPct(pct(count, refined))} ของคนที่ตีบวก</span> : null}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded bg-white/[0.04]">
        <div className="h-full rounded" style={{ width: `${Math.max(p, count ? 0.6 : 0)}%`, background: ACCENT }} />
      </div>
    </li>
  )
}

// แท่ง 100% stacked แนวนอน — สัดส่วนผลการตีของกลุ่มหนึ่ง (label ใน segment เมื่อกว้างพอ, hover ดูตัวเลขเต็ม)
function OutcomeBar({ label, data }) {
  const total = sumResults(data)
  if (!total) return null
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 sm:grid-cols-[9rem_1fr_6rem]">
      <span className="truncate text-sm text-slate-300" title={label}>{label}</span>
      <div className="flex h-6 gap-[2px] overflow-hidden rounded">
        {RESULTS.map((r) => {
          const n = data[r.key] || 0
          if (!n) return null
          const p = pct(n, total)
          return (
            <div key={r.key} className={`flex items-center justify-center text-[11px] font-medium ${r.ink}`}
              style={{ width: `${p}%`, background: r.color }}
              title={`${label} · ${r.label}: ${fmt(n)} ครั้ง (${fmtPct(p)})`}>
              {p >= 12 ? fmtPct(p) : ''}
            </div>
          )
        })}
      </div>
      <span className="text-right text-xs tabular-nums text-slate-500">{fmt(total)} ครั้ง</span>
    </li>
  )
}

function OutcomeLegend() {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
      {RESULTS.map((r) => (
        <span key={r.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />{r.label}
        </span>
      ))}
    </div>
  )
}

function OutcomeGroup({ title, rows }) {
  const visible = rows.filter((r) => sumResults(r.data) > 0)
  if (!visible.length) return null
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-slate-500">{title}</h3>
      <ul className="space-y-2">{visible.map((r) => <OutcomeBar key={r.label} {...r} />)}</ul>
    </div>
  )
}

function ChartTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-slate-200">{d.label}</div>
      <div className="mt-0.5 tabular-nums text-slate-300">{fmt(d.count)} {unit} · {fmtPct(d.pct)}</div>
    </div>
  )
}

// histogram แท่งแนวตั้ง bucket เดียวสี — label % บนหัวแท่ง, hover ดูจำนวนเต็ม
function BucketChart({ data, unit }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTip unit={unit} />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
            {data.map((d) => <Cell key={d.label} fill={ACCENT} />)}
            <LabelList dataKey="pct" position="top" formatter={fmtPct} style={{ fill: '#cbd5e1', fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// สัดส่วนการตัดสินใจเรื่องคุกกี้ (แท่ง 100% + legend) — ยอมรับ = กลุ่มที่ GA4 เห็น
const CONSENT_SEGMENTS = [
  { key: 'accepted', label: 'ยอมรับ (GA4 นับได้)', color: '#34d399' },
  { key: 'rejected', label: 'ปฏิเสธ',               color: '#fb7185' },
  { key: 'unknown',  label: 'ยังไม่ตอบ / ไม่ทราบ',   color: '#64748b' },
]
function ConsentBar(counts) {
  const total = CONSENT_SEGMENTS.reduce((n, s) => n + (counts[s.key] || 0), 0)
  if (!total) return <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
  return (
    <div>
      <div className="flex h-6 gap-[2px] overflow-hidden rounded">
        {CONSENT_SEGMENTS.map((s) => counts[s.key] ? (
          <div key={s.key} title={`${s.label}: ${fmt(counts[s.key])} คน (${fmtPct(pct(counts[s.key], total))})`}
            style={{ width: `${pct(counts[s.key], total)}%`, background: s.color }} />
        ) : null)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {CONSENT_SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <b className="tabular-nums text-slate-100">{fmt(counts[s.key] || 0)}</b>
            <span className="tabular-nums text-slate-500">({fmtPct(pct(counts[s.key] || 0, total))})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function OverviewView({ session, scrollTo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = session?.access_token
        const res = await fetch('/api/stats?overview=1', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!res.ok) throw new Error(`โหลดข้อมูลภาพรวมไม่สำเร็จ (${res.status})`)
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!scrollTo?.id) return
    document.getElementById(scrollTo.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])

  if (error) return <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</div>
  if (!data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}
        </div>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />)}
      </div>
    )
  }

  const v = data.visitors || {}
  const a = data.adoption || {}
  const o = data.outcome || {}
  const t = data.totals || {}
  const ml = data.max_level || {}
  const total = v.total || 0
  const active = v.active_since_log || 0 // ตัวหารสถิติรายคน = คนที่เข้าเว็บตั้งแต่วันแรกของ refine_log
  const refined = a.refined || 0
  const logDate = fmtDate(data.since?.refine_log)
  // อัตราตีติดรวม — จาก refine_breakdown (ตรงกับ KPI หน้า Usage > ตีบวก)
  const bd = data.breakdown || {}
  const recorded = sumResults(bd)
  const successPct = pct(bd.success || 0, recorded)
  const lostPct = pct(bd.lost || 0, recorded)
  // ผลการตีแยกกลุ่ม — จาก refine_log ทุกแถว (ยอดเท่ากับ breakdown / ตัวนับรวม)
  const logged = sumResults(o.all)

  // ผู้ใช้ทำอะไรบ้าง — เรียงมาก→น้อย (% ของคนที่เข้าเว็บช่วงเดียวกับ refine_log)
  const adoption = [
    { label: 'เคยตีบวก', count: refined },
    { label: 'ใช้ Enriched', count: a.used_enriched || 0, refined },
    { label: 'ใช้ Auto ตีบวก', count: a.used_auto || 0, refined },
    { label: 'ใช้ BSB', count: a.used_bsb || 0, refined },
    { label: 'ใช้หิน HD', count: a.used_hd || 0, refined },
    { label: 'เคยทำไอเทมหาย', count: a.had_lost || 0, refined },
  ].sort((x, y) => y.count - x.count)

  const maxLevel = [
    { label: '+0 ถึง +4', count: ml.l0_4 || 0 },
    { label: '+5 ถึง +9', count: ml.l5_9 || 0 },
    { label: '+10 ถึง +14', count: ml.l10_14 || 0 },
    { label: '+15 ถึง +20', count: ml.l15_20 || 0 },
  ].map((d) => ({ ...d, pct: pct(d.count, refined) }))
  const topLevel = [...maxLevel].sort((x, y) => y.count - x.count)[0]

  const visits = [
    { label: 'มาวันเดียว', count: v.days_1 || 0 },
    { label: '2–3 วัน', count: v.days_2_3 || 0 },
    { label: '4–7 วัน', count: v.days_4_7 || 0 },
    { label: '8 วันขึ้นไป', count: v.days_8p || 0 },
  ].map((d) => ({ ...d, pct: pct(d.count, total) }))

  const items = Object.keys(TYPE_LABEL)
    .map((k) => ({ label: TYPE_LABEL[k], data: o[`item:${k}`] }))
    .sort((x, y) => sumResults(y.data) - sumResults(x.data))
  const topItem = items[0]
  const autoP = pct(sumResults(o['mode:auto']), logged)
  const bsbYes = o['bsb:yes']
  const bsbSuccessPct = pct(bsbYes?.success || 0, sumResults(bsbYes))

  return (
    <div className="space-y-5">
      <section id="ov-kpi" className="scroll-mt-20 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="ผู้เข้าชมทั้งหมด" value={`${fmt(total)} คน`} sub={`กลับมาซ้ำ ${fmt(v.returning)} คน (${fmtPct(pct(v.returning, total))})`} />
        <StatTile label="เคยลองตีบวก" value={fmtPct(pct(refined, active))} sub={`${fmt(refined)} คน จาก ${fmt(active)} คนที่เข้าเว็บตั้งแต่ ${logDate}`} />
        <StatTile label="ตีบวกไปทั้งหมด" value={`${fmt(t.refine)} ครั้ง`} sub={`ใช้แร่ ${fmt(t.stone)} ก้อน · BSB ${fmt(t.bsb)} ชิ้น`} />
        <StatTile label="อัตราตีติดรวม" value={fmtPct(successPct)} sub={`ไอเทมหาย ${fmtPct(lostPct)} · จาก ${fmt(recorded)} ครั้ง`} />
        <StatTile label="รันจำลอง / รัน Auto" value={`${fmt(t.simulate)} / ${fmt(t.auto)}`} sub="จำนวนครั้งรวมทั้งหมด" />
      </section>

      <Panel id="ov-adoption" title="ผู้ใช้ทำอะไรบ้าง"
        summary={`จากผู้เข้าชม ${fmt(active)} คน มี ${fmt(refined)} คน (${fmtPct(pct(refined, active))}) ที่ลองตีบวก — ในกลุ่มนี้ ${fmtPct(pct(a.used_auto, refined))} ใช้ Auto และ ${fmtPct(pct(a.used_bsb, refined))} ใช้ BSB`}
        basis={`ผู้เข้าชม ${fmt(active)} คนที่เข้าเว็บตั้งแต่ ${logDate}`}>
        <p className="mb-3 text-xs text-slate-500">ความยาวแท่ง = % ของผู้เข้าชมช่วงเดียวกัน</p>
        <ul className="space-y-3">
          {adoption.map((r) => <AdoptionRow key={r.label} {...r} total={active} />)}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          รันจำลอง {fmt(a.ran_sim || 0)} คน · รัน Auto {fmt(a.ran_auto || 0)} คน (นับรายคนตั้งแต่ {fmtDate(data.since?.actions)})
        </p>
      </Panel>

      <Panel id="ov-outcome" title="ผลการตีบวก"
        summary={`ตีติด ${fmtPct(successPct)} · ล้มแบบลดระดับ ${fmtPct(pct(bd.drop || 0, recorded))} · ไอเทมหาย ${fmtPct(lostPct)}${bsbYes ? ` — ตอนใช้ BSB ตีติด ${fmtPct(bsbSuccessPct)} ส่วนที่ล้มไม่เสียอะไรเลย` : ''}`}
        basis={`การตีทั้งหมด ${fmt(logged)} ครั้ง — ตัวเลขเดียวกับหน้า Usage`}>
        <OutcomeLegend />
        <div className="space-y-5">
          <OutcomeGroup title="ทั้งหมด" rows={[{ label: 'การตีทั้งหมด', data: bd }]} />
          <OutcomeGroup title="แยกตามชนิดหิน" rows={[
            { label: 'หินปกติ', data: o['stone:normal'] },
            { label: 'Enriched', data: o['stone:enriched'] },
            { label: 'HD', data: o['stone:hd'] },
          ]} />
          <OutcomeGroup title="ใช้ BSB หรือไม่" rows={[
            { label: 'ใช้ BSB', data: o['bsb:yes'] },
            { label: 'ไม่ใช้ BSB', data: o['bsb:no'] },
          ]} />
          <OutcomeGroup title="ตีเอง หรือ Auto" rows={[
            { label: 'กดตีเอง', data: o['mode:manual'] },
            { label: 'Auto', data: o['mode:auto'] },
          ]} />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Auto คิดเป็น {fmtPct(autoP)} ของการตีทั้งหมด · ชี้ที่แท่งเพื่อดูจำนวนครั้ง
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel id="ov-level" title="คนตีไปได้ไกลแค่ไหน"
          summary={topLevel?.count ? `คนที่ตีบวกส่วนใหญ่ (${fmtPct(topLevel.pct)}) ไปได้สูงสุดช่วง ${topLevel.label} · ไปถึง +15 ขึ้นไป ${fmt(ml.l15_20)} คน` : 'ยังไม่มีข้อมูล'}
          basis={`${fmt(refined)} คนที่ตีบวก ตั้งแต่ ${logDate}`}>
          <BucketChart data={maxLevel} unit="คน" />
          <p className="mt-2 text-xs text-slate-500">ระดับสูงสุดที่แต่ละคนเคยไปถึง · % ของคนที่เคยตีบวก</p>
        </Panel>

        <Panel id="ov-return" title="ผู้เข้าชมกลับมากี่วัน"
          summary={`${fmtPct(pct(v.days_1, total))} เข้ามาวันเดียวแล้วไม่กลับมา · กลับมาตั้งแต่ 2 วันขึ้นไป ${fmt(v.returning)} คน`}
          basis={`ผู้เข้าชมทั้งหมด ${fmt(total)} คน ตั้งแต่ ${fmtDate(data.since?.visitors)}`}>
          <BucketChart data={visits} unit="คน" />
          <p className="mt-2 text-xs text-slate-500">จำนวนวันที่เข้าเว็บ (นับ 1 ครั้ง/วัน) · % ของผู้เข้าชมทั้งหมด</p>
        </Panel>
      </div>

      <Panel id="ov-consent" title="การยอมรับคุกกี้ (GA4 เห็นกี่คน)"
        summary={`GA4 นับได้เฉพาะคนที่กดยอมรับ — ตอนนี้ ${fmt(v.consent_accepted || 0)} คน (${fmtPct(pct(v.consent_accepted || 0, total))}) จากผู้เข้าชม ${fmt(total)} คน`}
        basis={`ผู้เข้าชมทั้งหมด ${fmt(total)} คน · เริ่มบันทึก 2 ต.ค. 2026 — คนที่ตอบก่อนหน้านั้นจะถูกนับตอนกลับมาเข้าเว็บ`}>
        <ConsentBar accepted={v.consent_accepted || 0} rejected={v.consent_rejected || 0} unknown={v.consent_unknown || 0} />
      </Panel>

      <Panel id="ov-items" title="ตีไอเทมประเภทไหนกันบ้าง"
        summary={topItem && sumResults(topItem.data) ? `ตี${topItem.label} มากที่สุด ${fmt(sumResults(topItem.data))} ครั้ง (${fmtPct(pct(sumResults(topItem.data), logged))} ของการตีทั้งหมด)` : 'ยังไม่มีข้อมูล'}
        basis={`การตีทั้งหมด ${fmt(logged)} ครั้ง`}>
        <OutcomeLegend />
        <OutcomeGroup title="เรียงตามจำนวนครั้งที่ตี" rows={items} />
      </Panel>

      <p className="text-xs leading-relaxed text-slate-500">
        หมายเหตุ: ตีบวกทั้งหมด {fmt(t.refine)} ครั้ง = ผลการตี {fmt(recorded)} ครั้ง = ประวัติรายครั้ง {fmt(t.logged)} ครั้ง (ตั้งแต่เปิดเว็บ)
        · สถิติรายคน (ผู้ใช้ทำอะไรบ้าง / ตีไปได้ไกลแค่ไหน) นับตั้งแต่ {logDate}
        · "รันจำลอง / รัน Auto" รายคนเริ่มนับ {fmtDate(data.since?.actions)} (ก่อนหน้านั้นมีแค่ยอดรวม)
        · สถิติรายคนไม่นับ bot และผู้ใช้ที่เบราว์เซอร์ไม่เก็บ ID
      </p>
    </div>
  )
}
