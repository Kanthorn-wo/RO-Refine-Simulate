import ItemIcon from '../ItemIcon'
import { SOURCE_LABEL, STATUS_META } from './consts'

// ชิ้นส่วน UI ร่วมของแท็บ "ไอเทม" (ป้าย, ปุ่ม, กลุ่มตัวกรอง, แถวไอเทม, Panel)

const badgeCls = 'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium'

export const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-white/5 text-slate-400' }
  return <span className={`${badgeCls} ${meta.cls}`}>{meta.label}</span>
}

export const UncertainBadge = () => (
  <span title="ไม่มีข้อมูลเลเวลจาก API ระบบเดาเป็น Lv1 — ตรวจเลเวลก่อนอนุมัติ" className={`${badgeCls} bg-amber-500/15 text-amber-300`}>เลเวลไม่แน่ใจ</span>
)

// ป้ายประเภท+เลเวล: อาวุธ Lv1–5 / เกราะ Lv1–2 (ไม่รู้ประเภท = ไม่แสดง)
export const TypeBadge = ({ item }) => {
  if (item.item_type === 'Weapon') return <span className={`${badgeCls} bg-sky-500/15 text-sky-300`}>อาวุธ Lv{item.weapon_level || '?'}</span>
  if (item.item_type === 'Armor') return <span className={`${badgeCls} bg-indigo-500/15 text-indigo-300`}>เกราะ Lv{item.armor_level === 2 ? 2 : 1}</span>
  return null
}

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

// กลุ่มปุ่มเลือกตัวกรอง (options: [{ id, label }], counts: จำนวนต่อ id ถ้าต้องโชว์)
export function FilterTabs({ options, value, onChange, counts }) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value === o.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
          {o.label}{counts && o.id !== 'all' && counts[o.id] ? ` ${counts[o.id]}` : ''}
        </button>
      ))}
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
