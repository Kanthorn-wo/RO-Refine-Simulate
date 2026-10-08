import itemMeta from '../../constants/refinableItemMeta.json'

// รวมรายชื่อหลัก (refinableItems.json) + ไอเทมเสริมจากตาราง extra_items เป็นแถวเดียวกันสำหรับแท็บ "ไอเทม" + ตัวกรอง
// รูปแถว: { id, label, armor_level, item_type: 'Weapon'|'Armor'|null, weapon_level, status, source: 'manual'|'auto'|'index', level_uncertain }

export const STATUS_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'approved', label: 'อนุมัติแล้ว' },
  { id: 'pending', label: 'รออนุมัติ' },
  { id: 'denied', label: 'ซ่อนอยู่' },
]
export const TYPE_FILTERS = [
  { id: 'all', label: 'ทุกประเภท' },
  { id: 'Weapon', label: 'อาวุธ' },
  { id: 'Armor', label: 'เกราะ' },
]
export const SOURCE_FILTERS = [
  { id: 'all', label: 'ทุกที่มา' },
  { id: 'extra', label: 'เสริม (เพิ่มเอง/ระบบหาเจอ)' },
  { id: 'index', label: 'รายชื่อหลัก' },
]

// แถวในตารางทับแถวรายชื่อหลักที่ id เดียวกัน (เช่น ที่ถูกซ่อน) — ไม่ซ้ำ
export function buildRows(extraItems, indexItems) {
  const extraIds = new Set(extraItems.map((x) => x.id))
  const indexRows = indexItems.filter(([id]) => !extraIds.has(id)).map(([id, label, lvl]) => {
    const [kind, level] = itemMeta[id] || [] // ['W', weaponLevel] | ['A', armorLevel]; ไม่มี = ไอเทมเสริมนอก rAthena
    return {
      id, label, status: 'approved', source: 'index',
      armor_level: kind === 'A' ? level : (lvl === 2 ? 2 : 1),
      item_type: kind === 'W' ? 'Weapon' : kind === 'A' ? 'Armor' : null,
      weapon_level: kind === 'W' ? level : null,
    }
  })
  return [...extraItems, ...indexRows]
}

export function filterRows(rows, { status, type, source, query }) {
  const q = query.trim().toLowerCase()
  return rows.filter((x) => (status === 'all' || x.status === status)
    && (type === 'all' || x.item_type === type)
    && (source === 'all' || (source === 'index' ? x.source === 'index' : x.source !== 'index'))
    && (!q || x.label.toLowerCase().includes(q) || String(x.id).includes(q)))
}

export const countByStatus = (rows) => rows.reduce((acc, x) => ({ ...acc, [x.status]: (acc[x.status] || 0) + 1 }), {})
