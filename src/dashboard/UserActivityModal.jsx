import { useEffect, useMemo, useState } from 'react'
import EventDetailModal, { DetailBadge } from './EventDetailModal'

// รวม log กิจกรรมของผู้ใช้ 1 คน (vid) จาก 2 แหล่ง: usage_events (visit/auto/simulate) + refine_log (ตีบวกรายครั้ง)
// ทั้งสองตารางเก็บทุกแถว (ไม่ตัดแล้ว) — ไล่โหลดทีละหน้าจนครบทุกรายการของ vid นี้
// (refine_log ก่อน 2026-07-30 ถูกตัดไปตั้งแต่สมัยยังมี trim, usage_events ก่อนยกเลิก trigger เหลือแค่ 200 แถวล่าสุดรวมทุกคน)

const EVENT_PAGE = 200   // API cap ต่อหน้าของ /api/stats?events=
const REFINE_PAGE = 1000 // API cap ต่อหน้าของ /api/refine
const RENDER_STEP = 200  // render ทีละ 200 แถว กัน modal หน่วงเมื่อผู้ใช้มีหลายพันรายการ

// ไล่โหลด usage_events ของ vid ด้วย cursor ?before=<id> จน hasMore=false
async function fetchAllEvents(vid, headers) {
  const all = []
  let before = 0
  for (;;) {
    const res = await fetch(`/api/stats?events=${EVENT_PAGE}&vid=${encodeURIComponent(vid)}${before ? `&before=${before}` : ''}`, { headers })
    if (!res.ok) throw new Error(`โหลดกิจกรรมไม่สำเร็จ (${res.status})`)
    const json = await res.json()
    const rows = json.events || []
    all.push(...rows)
    if (!json.hasMore || !rows.length) return all
    before = rows[rows.length - 1].id
  }
}

// ไล่โหลด refine_log ของ vid ทีละหน้าจนครบ total
async function fetchAllRefines(vid, headers) {
  const all = []
  for (let page = 1; ; page++) {
    const res = await fetch(`/api/refine?vid=${encodeURIComponent(vid)}&limit=${REFINE_PAGE}&page=${page}`, { headers })
    if (!res.ok) throw new Error(`โหลดประวัติตีบวกไม่สำเร็จ (${res.status})${res.status === 401 || res.status === 403 ? ' — session อาจหมดอายุ ลอง login ใหม่' : ''}`)
    const json = await res.json()
    const rows = json.log || []
    all.push(...rows)
    if (rows.length < REFINE_PAGE || all.length >= (json.total || 0)) return all
  }
}

const RESULT_META = {
  success: { label: 'สำเร็จ',    color: '#34d399', bg: '#34d39920' },
  fail:    { label: 'ล้มเหลว',   color: '#64748b', bg: '#64748b20' },
  drop:    { label: 'ลดระดับ',   color: '#fbbf24', bg: '#fbbf2420' },
  lost:    { label: 'ไอเทมหาย', color: '#fb7185', bg: '#fb718520' },
}
const STONE_LABEL = { normal: 'หินปกติ', enriched: 'Enriched', hd: 'HD' }
const TYPE_SHORT = { weapon1: 'W1', weapon2: 'W2', weapon3: 'W3', weapon4: 'W4', weapon5: 'W5', armor1: 'A1', armor2: 'A2' }
const EVENT_META = {
  auto:     { label: 'รัน Auto', dot: '#fbbf24' },
  simulate: { label: 'รันจำลอง',   dot: '#34d399' },
  visit:    { label: 'เข้าเว็บ',   dot: '#f472b6' },
}
const VISIT_STATUS_LABEL = { new: 'คนใหม่', returning: 'คนเก่า', bot: 'Bot' }

function relTime(iso, now) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'เมื่อสักครู่'
  if (s < 60) return `${s} วินาทีที่แล้ว`
  const m = Math.floor(s / 60); if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60); if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  const d = Math.floor(h / 24); return `${d} วันที่แล้ว`
}

function RefineRow({ r, now }) {
  const rm = RESULT_META[r.result] || RESULT_META.fail
  // จำนวนขั้นที่ลด (เฉพาะผล 'drop') — คำนวณจาก level (ก่อนตี) - refine_after (หลังตี)
  const dropAmt = r.result === 'drop' && r.refine_after != null ? r.level - r.refine_after : null
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: '#818cf8' }} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate font-medium text-slate-200">{r.item_name || TYPE_SHORT[r.item_type] || r.item_type}</span>
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{TYPE_SHORT[r.item_type] || r.item_type}</span>
        {/* badge โชว์ระดับปลายทาง (r.level เก็บเป็นระดับ "ก่อน" ตี) — ให้ตรงกับกราฟ "ภาพรวมการตีบวก" */}
        <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-indigo-300">+{r.level + 1}</span>
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">{STONE_LABEL[r.stone] || r.stone}</span>
        {r.bsb && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">BSB</span>}
        {r.mode === 'auto' && <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">Auto</span>}
      </div>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: rm.bg, color: rm.color }}>
        {rm.label}{dropAmt > 0 && <span className="opacity-90"> (-{dropAmt})</span>}
      </span>
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-slate-500 sm:block">{relTime(r.at, now)}</span>
    </div>
  )
}

function EventRow({ e, now }) {
  const [showDetail, setShowDetail] = useState(false)
  const meta = EVENT_META[e.type] || { label: e.type, dot: '#94a3b8' }
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.dot }} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-slate-200">{meta.label}</span>
        {e.meta && <DetailBadge onClick={() => setShowDetail(true)} />}
        {e.type === 'visit' && e.status && (
          <span className={`text-xs ${e.status === 'new' ? 'text-cyan-400' : e.status === 'bot' ? 'text-amber-400' : 'text-violet-400'}`}>
            ({VISIT_STATUS_LABEL[e.status] || e.status})
          </span>
        )}
      </div>
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-slate-500 sm:block">{relTime(e.at, now)}</span>
      {showDetail && <EventDetailModal ev={e} onClose={() => setShowDetail(false)} />}
    </div>
  )
}

export default function UserActivityModal({ vid, session, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [now, setNow] = useState(Date.now())
  const [shown, setShown] = useState(RENDER_STEP)

  useEffect(() => {
    if (!vid) return
    let cancelled = false
    setLoading(true); setError(''); setShown(RENDER_STEP)
    ;(async () => {
      try {
        const token = session?.access_token
        const authHeader = token ? { Authorization: `Bearer ${token}` } : {}
        const [evRows, logRows] = await Promise.all([fetchAllEvents(vid, authHeader), fetchAllRefines(vid, authHeader)])
        const events = evRows
          .filter((e) => e.type !== 'refine')
          .map((e) => ({ kind: 'event', at: e.at, type: e.type, status: e.status, meta: e.meta }))
        const refines = logRows.map((r) => ({ kind: 'refine', at: r.created_at, ...r }))
        const merged = [...events, ...refines].sort((a, b) => new Date(b.at) - new Date(a.at))
        if (!cancelled) setItems(merged)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [vid, session])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  // สรุปจำนวนรวมแยกตามประเภท action — นับจากทุกรายการของ vid นี้ที่ DB ยังมี
  const summary = useMemo(() => {
    const s = { refineTotal: 0, success: 0, fail: 0, drop: 0, lost: 0, auto: 0, simulate: 0, visit: 0 }
    for (const it of items) {
      if (it.kind === 'refine') {
        s.refineTotal++
        if (it.result && it.result in s) s[it.result]++
      } else if (it.type === 'auto') s.auto++
      else if (it.type === 'simulate') s.simulate++
      else if (it.type === 'visit') s.visit++
    }
    return s
  }, [items])

  if (!vid) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-200">กิจกรรมของผู้ใช้</h3>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500" title={vid}>{vid}</p>
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:text-slate-200">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 text-xs">
            <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 font-medium text-indigo-300">ตีบวก {summary.refineTotal} ครั้ง</span>
            {summary.refineTotal > 0 && (
              <span className="text-slate-500">
                (สำเร็จ {summary.success} · ล้มเหลว {summary.fail}
                {summary.drop ? ` · ลดระดับ ${summary.drop}` : ''}
                {summary.lost ? ` · หาย ${summary.lost}` : ''})
              </span>
            )}
            {summary.auto > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-medium text-amber-300">รัน Auto {summary.auto} ครั้ง</span>}
            {summary.simulate > 0 && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">รันจำลอง {summary.simulate} ครั้ง</span>}
            {summary.visit > 0 && <span className="rounded-full bg-pink-500/15 px-2.5 py-1 font-medium text-pink-300">เข้าเว็บ {summary.visit} ครั้ง</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {error && <div className="mb-3 rounded-lg border border-rose-900/50 bg-rose-950/40 p-2.5 text-xs text-rose-300">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">กำลังโหลด…</div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">ไม่พบกิจกรรมของผู้ใช้นี้ (อาจหลุดจาก log ล่าสุดไปแล้ว)</p>
          ) : (
            <div className="space-y-1.5">
              {items.slice(0, shown).map((it, i) => it.kind === 'refine'
                ? <RefineRow key={`r${it.id ?? i}`} r={it} now={now} />
                : <EventRow key={`e${i}`} e={it} now={now} />
              )}
              {items.length > shown && (
                <button onClick={() => setShown((n) => n + RENDER_STEP)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 text-xs text-slate-400 transition-colors hover:text-slate-200">
                  แสดงเพิ่มอีก {Math.min(RENDER_STEP, items.length - shown)} รายการ (เหลือ {items.length - shown})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-3 text-center text-[11px] text-slate-500">
          รวม {items.length} รายการ · ครบทุกรายการที่ระบบเก็บไว้ของผู้ใช้นี้
        </div>
      </div>
    </div>
  )
}
