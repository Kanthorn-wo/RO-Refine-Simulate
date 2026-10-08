import ItemIcon from '../ItemIcon'
import ItemTypeBadge from '../ItemTypeBadge'
import { ITEM_TYPE_BADGE_CLS, itemTypeId } from '../../constants/itemTypes'
import { SOURCE_LABEL, STATUS_META } from './consts'

// ชิ้นส่วน UI ร่วมของแท็บ "ไอเทม" (ป้าย, ปุ่ม, กลุ่มตัวกรอง, แถวไอเทม, Panel)

const badgeCls = 'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium'

export const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-white/5 text-slate-400' }
  return <span className={`${badgeCls} ${meta.cls}`}>{meta.label}</span>
}

export const UncertainBadge = () => (
  <span title="ไม่มีข้อมูลเลเวลจาก API ระบบเดาเป็น Lv.1 — ตรวจเลเวลก่อนอนุมัติ" className={`${badgeCls} bg-amber-500/15 text-amber-300`}>เลเวลไม่แน่ใจ</span>
)

// ป้ายประเภท+เลเวลของแถว: อาวุธ Lv.1–5 / เกราะ Lv.1–2 (ไม่รู้ประเภท = ไม่แสดง)
export const TypeBadge = ({ item }) => (
  <ItemTypeBadge kind={item.item_type} type={itemTypeId(item.item_type, item.item_type === 'Weapon' ? item.weapon_level : item.armor_level)} />
)

// ไอคอน loading (หมุน) — ใช้แทนข้อความในปุ่มระหว่างรอคำขอ; ผู้ใช้โปรแกรมอ่านหน้าจอได้ยินจาก aria-label ของปุ่ม
export const Spinner = () => (
  <svg className="inline-block h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

export function Skeleton({ h = 'h-40' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${h}`} />
}

export function Panel({ id, title, hint, children }) {
  return (
    <div id={id} className="scroll-mt-20 rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export const EmptyNote = ({ children }) => (
  <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">{children}</p>
)

// แถวตัวกรอง: ป้ายกลุ่มทางซ้าย + ปุ่มเลือกทางขวา (options: [{ id, label, level? }])
// counts = จำนวนต่อ id ตอนนี้ (แสดง "ชื่อ (จำนวน)" ทุกตัวเลือก), sizeCounts = จำนวนตอนไม่กรอง ใช้กันความกว้างปุ่ม:
// ปุ่มจองความกว้างตามข้อความที่ยาวสุด (เลขตอนไม่กรอง) + ขอบโปร่งใสตลอด → เลือก/เปลี่ยนตัวกรองแล้ว layout ไม่ขยับ
// ตัวเลือก level = เลเวลของอาวุธ/เกราะ แสดงด้วยสีป้ายเดียวกับในรายการ; ตัวที่เลือกมีขอบเด่น
const countText = (counts, id) => (counts ? ` (${(counts[id] || 0).toLocaleString('th-TH')})` : '')
export function FilterTabs({ label, options, value, onChange, counts, sizeCounts }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-14 shrink-0 pt-1.5 text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.id
          const tone = o.level ? ITEM_TYPE_BADGE_CLS[o.id] : 'bg-white/[0.04] text-slate-300'
          return (
            <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={active}
              className={`inline-grid rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition ${tone} ${active ? 'border-current' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">{o.label}{countText(sizeCounts || counts, o.id)}</span>
              <span className="col-start-1 row-start-1 whitespace-nowrap text-center">{o.label}{countText(counts, o.id)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// แถวไอเทม: ไอคอน + ชื่อ + ป้าย + คอลัมน์สถานะ (showStatus) + ปุ่ม (actions) + กล่องรายละเอียดท้ายแถว (children); variant card = คิวรออนุมัติ, row = รายการทั้งหมด
export function ItemRow({ item, variant = 'row', showStatus = false, actions, children }) {
  const card = variant === 'card'
  return (
    <li className={`flex flex-wrap items-center gap-3 ${card ? 'rounded-xl border border-white/5 bg-white/[0.02] p-3' : 'py-2.5'}`}>
      <ItemIcon id={item.id} size={card ? 32 : 28} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-sm text-slate-200 ${card ? 'font-medium' : ''}`}>{item.label}</span>
          <TypeBadge item={item} />
          {item.level_uncertain && <UncertainBadge />}
        </div>
        <p className="text-[11px] text-slate-500">#{item.id} · {SOURCE_LABEL[item.source] || item.source}</p>
      </div>
      {showStatus && <div className="w-24 shrink-0"><StatusBadge status={item.status} /></div>}
      <div className={`flex shrink-0 gap-2 ${card ? '' : 'sm:w-72 sm:justify-end'}`}>{actions}</div>
      {children}
    </li>
  )
}
