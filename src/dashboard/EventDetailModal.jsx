import { getOreName, ORE_COLORS, ORE_IMAGES } from '../constants/ores'
import ItemIcon from './ItemIcon'
import { ITEM_TYPE_LABEL } from '../constants/itemTypes'

// รายละเอียดกิจกรรม "รันจำลอง" / "Auto" จาก usage_events.meta (server whitelist ใน api/stats.js)
// เปิดจาก DetailBadge ใน ActivityFeed (DashboardView) และ UserActivityModal — แถวใน list ไม่ต้องอัดข้อมูล

const STONE_LABEL = { normal: 'หินปกติ', enriched: 'Enriched', hd: 'HD' }
const AUTO_REASON = {
  target:  { label: 'ถึงเป้าหมาย',                         cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  lost:    { label: 'ไอเทมหาย',                             cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  risk:    { label: 'หยุดเอง — ช่วงถัดไปเสี่ยงไอเทมหาย',     cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  stopped: { label: 'ผู้ใช้กดหยุด / เปลี่ยนการตั้งค่า',       cls: 'border-white/10 bg-white/[0.03] text-slate-300' },
  closed:  { label: 'ปิดหน้าเว็บระหว่างรัน',                 cls: 'border-white/10 bg-white/[0.03] text-slate-300' },
}

// รหัสย่อใน meta.steps ของ auto (ดู AUTO_STEP_RESULT ใน Layout)
const STEP_RESULT = {
  s: { label: 'สำเร็จ',               cls: 'bg-emerald-500/15 text-emerald-300' },
  f: { label: 'ล้มเหลว',              cls: 'bg-slate-500/15 text-slate-300' },
  d: { label: 'ล้ม — ลดระดับ',        cls: 'bg-amber-500/15 text-amber-300' },
  l: { label: 'ล้ม — ไอเทมหาย',       cls: 'bg-rose-500/15 text-rose-300' },
  b: { label: 'ล้ม — BSB กันไว้',     cls: 'bg-sky-500/15 text-sky-300' },
}
const STEP_STONE = { n: 'normal', e: 'enriched', h: 'hd' }

const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: 1 }))
const fmtDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  return m ? `${m} นาที ${sec % 60} วินาที` : `${sec} วินาที`
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-slate-400">{title}</h4>
      {children}
    </div>
  )
}

// แถว label : value — อ่านเป็นประโยคได้ ไม่ใช้ตัวย่อ
function InfoRows({ rows }) {
  return (
    <dl className="divide-y divide-white/5 rounded-lg border border-white/5 bg-white/[0.02] text-sm">
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 px-3 py-2">
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="text-right text-slate-200">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatCard({ label, value, sub, tone = 'text-slate-100' }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] tabular-nums text-slate-500">{sub}</div>}
    </div>
  )
}

// รูปแร่ + จำนวน (ชี้ดูชื่อแร่) — ไม่มีรูปใช้จุดสีแทน
function OreList({ ores, unit }) {
  const entries = Object.entries(ores || {}).sort((a, b) => b[1] - a[1])
  if (!entries.length) return <p className="text-sm text-slate-500">—</p>
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([name, count]) => (
        <span key={name} title={name}
          className="inline-flex cursor-help items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-sm">
          {ORE_IMAGES[name]
            ? <img src={ORE_IMAGES[name]} alt={name} width={20} height={20} className="shrink-0 object-contain" style={{ imageRendering: 'pixelated' }} />
            : <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ORE_COLORS[name] || 'bg-slate-400'}`} />}
          <span className="tabular-nums text-slate-200">{fmtNum(count)}</span>
          <span className="text-xs text-slate-500">{unit}</span>
        </span>
      ))}
    </div>
  )
}

const BsbIcon = () => (
  <img src="/images/blacksmith_blessing.png" alt="Blacksmith Blessing" title="Blacksmith Blessing" width={16} height={16}
    className="inline-block shrink-0 object-contain align-text-bottom" />
)
const yesNo = (v, yes = 'ใช้', no = 'ไม่ใช้') => (v ? yes : no)

function ItemHeader({ m }) {
  return (
    <div className="flex items-center gap-3">
      <ItemIcon id={m.item_id || null} type={m.item_type} size={40} />
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-100">{m.item_name || ITEM_TYPE_LABEL[m.item_type] || 'ไม่ระบุไอเทม'}</div>
        <div className="text-xs text-slate-500">{ITEM_TYPE_LABEL[m.item_type] || m.item_type}{m.item_name ? '' : ' (ไม่ได้เลือกไอเทมเฉพาะ)'}</div>
      </div>
    </div>
  )
}

// ประโยคสรุปบนสุด — อ่านจบเข้าใจผลรวมโดยไม่ต้องไล่ตัวเลข
function Summary({ children }) {
  return <p className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 text-sm leading-relaxed text-indigo-100">{children}</p>
}

function SimulateDetail({ m }) {
  return (
    <>
      <Summary>
        จำลองตีจาก <b>+{m.start}</b> ไป <b>+{m.target}</b> ด้วย{STONE_LABEL[m.stone] || m.stone}{m.bsb ? ' + BSB' : ''}
        {' '}ทั้งหมด {fmtNum(m.rounds)} รอบ — โดยเฉลี่ยต้องตี <b>{fmtNum(m.avg_attempts)} ครั้ง</b>
        {' '}ใช้แร่ <b>{fmtNum(m.avg_ores)} ก้อน</b>
        {m.avg_lost > 0 ? <> และไอเทมหาย <b>{fmtNum(m.avg_lost)} ชิ้น</b> (ต้องเตรียมไอเทมสำรองไว้)</> : ' โดยไม่มีไอเทมหาย'}
        {m.bsb && m.avg_bsb > 0 ? <> ใช้ BSB <b>{fmtNum(m.avg_bsb)} ชิ้น</b></> : null}
      </Summary>
      <Section title="ตั้งค่าที่ใช้จำลอง">
        <InfoRows rows={[
          ['ช่วงที่จำลอง', `ตีจาก +${m.start} ไปให้ถึง +${m.target}`],
          ['ชนิดหิน', STONE_LABEL[m.stone] || m.stone],
          ['Blacksmith Blessing', <span key="bsb" className="inline-flex items-center gap-1">{m.bsb && <BsbIcon />}{yesNo(m.bsb)}</span>],
          ['เรท Event', yesNo(m.event_rate, 'เปิด', 'ไม่เปิด')],
          ['จำนวนรอบจำลอง', `${fmtNum(m.rounds)} รอบ`],
        ]} />
      </Section>
      <Section title={`ผลลัพธ์ (เฉลี่ยต่อ 1 รอบ จาก ${fmtNum(m.rounds)} รอบ)`}>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="ต้องตีกี่ครั้งถึงเป้า" value={`${fmtNum(m.avg_attempts)} ครั้ง`} tone="text-amber-300"
            sub={m.min_attempts != null ? `น้อยสุด ${fmtNum(m.min_attempts)} · มากสุด ${fmtNum(m.max_attempts)}` : null} />
          <StatCard label="ครึ่งหนึ่งของรอบถึงเป้าภายใน" value={`${fmtNum(m.median)} ครั้ง`} sub={`90% ของรอบถึงเป้าภายใน ${fmtNum(m.p90)} ครั้ง`} />
          {m.avg_successes != null && <StatCard label="ตีติด" value={`${fmtNum(m.avg_successes)} ครั้ง`} tone="text-emerald-300" />}
          {m.avg_fails != null && <StatCard label="ตีล้ม" value={`${fmtNum(m.avg_fails)} ครั้ง`} tone="text-rose-300" />}
          <StatCard label="ไอเทมหาย" value={`${fmtNum(m.avg_lost)} ชิ้น`} tone="text-rose-300" />
          {m.bsb && <StatCard label="ใช้ Blacksmith Blessing" value={`${fmtNum(m.avg_bsb)} ชิ้น`} />}
        </div>
        {m.aborted > 0 && (
          <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            มี {fmtNum(m.aborted)} รอบที่ตีเกินเพดานจนถูกตัดจบ — ค่าเฉลี่ยจริงอาจสูงกว่านี้
          </p>
        )}
      </Section>
      <Section title={`แร่ที่ใช้ (เฉลี่ยต่อรอบ รวม ${fmtNum(m.avg_ores)} ก้อน)`}>
        <OreList ores={m.ores} unit="ก้อน" />
      </Section>
    </>
  )
}

// รายการตีทีละครั้งของรอบ auto นี้ — ครั้งที่, ระดับก่อน→หลัง, แร่ (รูป ชี้ดูชื่อ), BSB, ผล
function AutoSteps({ m }) {
  const steps = m.steps || []
  if (!steps.length) return <p className="text-sm text-slate-500">ไม่มีการตีในรอบนี้</p>
  // ถ้าโดนตัดเก็บแค่ช่วงท้าย — เลขครั้งที่ต้องนับต่อจากส่วนที่หายไป
  const offset = m.steps_truncated && m.attempts ? m.attempts - steps.length : 0
  return (
    <>
      {m.steps_truncated && (
        <p className="mb-2 text-xs text-slate-500">แสดงเฉพาะ {fmtNum(steps.length)} ครั้งล่าสุด จากทั้งหมด {fmtNum(m.attempts)} ครั้ง</p>
      )}
      <ol className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
        {steps.map(([from, to, res, stone, bsb], i) => {
          const r = STEP_RESULT[res] || STEP_RESULT.f
          const s = STEP_STONE[stone]
          const ore = getOreName(m.item_type, from, s === 'hd', s === 'enriched')
          return (
            <li key={i} className="flex items-center gap-2 rounded-md bg-white/[0.02] px-2 py-1">
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">ครั้งที่ {offset + i + 1}</span>
              <span className="w-20 shrink-0 tabular-nums text-slate-200">+{from} → +{to}</span>
              <span title={ore || STONE_LABEL[s]} className="inline-flex shrink-0 cursor-help items-center">
                {ore && ORE_IMAGES[ore]
                  ? <img src={ORE_IMAGES[ore]} alt={ore} width={18} height={18} className="object-contain" style={{ imageRendering: 'pixelated' }} />
                  : <span className="text-xs text-slate-400">{STONE_LABEL[s]}</span>}
              </span>
              {bsb > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-amber-300"><BsbIcon />{bsb}</span>}
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.cls}`}>{r.label}</span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

function AutoDetail({ m }) {
  const reason = AUTO_REASON[m.reason]
  const rules = m.rules || []
  const fails = m.attempts != null && m.successes != null ? m.attempts - m.successes : null
  return (
    <>
      {reason && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${reason.cls}`}>
          ผลรอบนี้: {reason.label}{m.reason === 'target' ? ` +${m.target}` : ''}
        </div>
      )}
      <Summary>
        ตั้ง Auto ตีจาก <b>+{m.start}</b> ไป <b>+{m.target}</b> — ตีไปทั้งหมด <b>{fmtNum(m.attempts)} ครั้ง</b>
        {' '}(ติด {fmtNum(m.successes)} · ล้ม {fmtNum(fails)}) ใช้เวลา {fmtDuration(m.duration_sec)}
        {m.lost ? <> สุดท้าย<b className="text-rose-300">ไอเทมหาย</b> (เคยไปถึง +{fmtNum(m.max_level)})</> : <> หยุดที่ <b>+{fmtNum(m.final_level)}</b></>}
      </Summary>
      <Section title="ตั้งค่า Auto">
        <InfoRows rows={[
          ['ช่วงที่ตั้งไว้', `ตีจาก +${m.start} ไปให้ถึง +${m.target}`],
          ['Blacksmith Blessing', <span key="bsb" className="inline-flex items-center gap-1">{m.use_bsb && <BsbIcon />}{yesNo(m.use_bsb, 'เปิดใช้ (ตามแผนหินแต่ละช่วง)')}</span>],
          ['เรท Event', yesNo(m.event_rate, 'เปิด', 'ไม่เปิด')],
        ]} />
        {rules.length > 0 && (
          <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-1.5 text-xs text-slate-500">แผนหินแต่ละช่วง</div>
            <ul className="space-y-1 text-sm">
              {rules.map((r, i) => {
                // rule.from = ระดับปลายทาง → ช่วงที่ตีจริง +(from-1) ถึงก่อน rule ถัดไป
                const to = rules[i + 1] ? rules[i + 1].from - 1 : m.target
                return (
                  <li key={r.from} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="w-24 shrink-0 tabular-nums text-slate-400">+{r.from - 1} → +{to}</span>
                    <span className="text-slate-200">{STONE_LABEL[r.stone] || r.stone}</span>
                    {r.bsb && <span className="inline-flex items-center gap-1 text-xs text-amber-300"><BsbIcon />ใช้ BSB</span>}
                    {r.stop && <span className="text-xs text-rose-300">หยุดถ้าเสี่ยงไอเทมหาย</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Section>
      <Section title="ผลลัพธ์">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="ระดับตอนหยุด" value={m.lost ? 'ไอเทมหาย' : `+${fmtNum(m.final_level)}`} tone={m.lost ? 'text-rose-300' : 'text-indigo-300'}
            sub={m.max_level != null ? `ระดับสูงสุดที่ไปถึง +${fmtNum(m.max_level)}` : null} />
          <StatCard label="ตีทั้งหมด" value={`${fmtNum(m.attempts)} ครั้ง`} tone="text-amber-300"
            sub={fails != null ? `ติด ${fmtNum(m.successes)} · ล้ม ${fmtNum(fails)}` : null} />
          <StatCard label="ล้มแล้วลดระดับ" value={`${fmtNum(m.drops)} ครั้ง`} />
          <StatCard label="ใช้เวลา" value={fmtDuration(m.duration_sec)} />
          {m.use_bsb && <StatCard label="ใช้ Blacksmith Blessing" value={`${fmtNum(m.bsb_used)} ชิ้น`} />}
        </div>
      </Section>
      <Section title="แร่ที่ใช้">
        <OreList ores={m.ores} unit="ก้อน" />
      </Section>
      {m.steps && (
        <Section title={`ลำดับการตีในรอบนี้ (${fmtNum(m.attempts)} ครั้ง)`}>
          <AutoSteps m={m} />
        </Section>
      )}
    </>
  )
}

// badge กดได้ข้างชื่อกิจกรรม (เฉพาะ event ที่มี meta)
export function DetailBadge({ onClick }) {
  return (
    <button onClick={onClick} title="ดูรายละเอียด"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25">
      <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>
      ดูผล
    </button>
  )
}

export default function EventDetailModal({ ev, onClose }) {
  const m = ev.meta
  const isAuto = ev.type === 'auto'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-200">{isAuto ? 'รายละเอียดการตีบวก Auto' : 'รายละเอียดการรันจำลอง'}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {new Date(ev.at).toLocaleString('th-TH')}{ev.vid && <span className="font-mono"> · {ev.vid}</span>}
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:text-slate-200">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <ItemHeader m={m} />
          {isAuto ? <AutoDetail m={m} /> : <SimulateDetail m={m} />}
        </div>
      </div>
    </div>
  )
}
