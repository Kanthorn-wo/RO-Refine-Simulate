import { ITEM_TYPE_BADGE_CLS, ITEM_TYPE_LABEL } from '../constants/itemTypes'

// ป้ายประเภท+เลเวลไอเทม ("อาวุธ Lv.4" / "เกราะ Lv.2") สีต่างกันต่อเลเวล — type = id เช่น 'weapon4' / 'armor2'
// kind ('Weapon'|'Armor') ใช้แสดงป้ายกลาง ๆ เมื่อรู้ประเภทแต่ไม่รู้เลเวล
export default function ItemTypeBadge({ type, kind }) {
  const label = ITEM_TYPE_LABEL[type] || (kind === 'Weapon' ? 'อาวุธ Lv.?' : kind === 'Armor' ? 'เกราะ Lv.?' : null)
  if (!label) return null
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ITEM_TYPE_BADGE_CLS[type] || 'bg-white/5 text-slate-400'}`}>{label}</span>
}
