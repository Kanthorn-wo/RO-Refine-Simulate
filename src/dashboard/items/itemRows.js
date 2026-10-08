import itemMeta from '../../constants/refinableItemMeta.json'
import { ITEM_TYPE_LABEL, itemTypeId } from '../../constants/itemTypes'

// รวมรายชื่อหลัก (refinableItems.json) + ไอเทมเสริมจากตาราง extra_items เป็นแถวเดียวกันสำหรับแท็บ "ไอเทม" + ตัวกรอง
// รูปแถว: { id, label, armor_level, item_type: 'Weapon'|'Armor'|null, weapon_level, status, source: 'manual'|'auto'|'index', level_uncertain }

export const STATUS_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'approved', label: 'อนุมัติแล้ว' },
  { id: 'pending', label: 'รออนุมัติ' },
  { id: 'denied', label: 'ซ่อนอยู่' },
]
// ตัวกรองประเภท: อาวุธทั้งหมด + อาวุธ Lv.1–5, เกราะทั้งหมด + เกราะ Lv.1–2 (id เลเวลตรงกับ ITEM_TYPE_LABEL; level = ตัวเลือกย่อยที่แสดงสีป้ายตามเลเวล)
const levelOptions = (prefix) => Object.keys(ITEM_TYPE_LABEL).filter((id) => id.startsWith(prefix)).map((id) => ({ id, label: ITEM_TYPE_LABEL[id], level: true }))
export const TYPE_FILTERS = [
  { id: 'all', label: 'ทุกประเภท' },
  { id: 'Weapon', label: 'อาวุธทั้งหมด' },
  ...levelOptions('weapon'),
  { id: 'Armor', label: 'เกราะทั้งหมด' },
  ...levelOptions('armor'),
]
export const DEFAULT_FILTERS = { status: 'all', type: 'all', source: 'all', query: '' }
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

const sourceKey = (x) => (x.source === 'index' ? 'index' : 'extra')
// ตัวเลือกประเภทที่แถวนี้ตรง: ประเภทรวม ('Weapon'|'Armor') + เลเวล ('weapon4' ...) — ไม่รู้ประเภท = ไม่ตรงอะไรเลย
const typeKeys = (x) => {
  if (!x.item_type) return []
  const levelId = itemTypeId(x.item_type, x.item_type === 'Weapon' ? x.weapon_level : x.armor_level)
  return levelId ? [x.item_type, levelId] : [x.item_type]
}

// เงื่อนไขของแต่ละตัวกรอง (all = ผ่านทุกแถว) — ใช้ร่วมกันทั้งการกรองและการนับจำนวน
const matchers = {
  status: (x, v) => v === 'all' || x.status === v,
  type: (x, v) => v === 'all' || typeKeys(x).includes(v),
  source: (x, v) => v === 'all' || sourceKey(x) === v,
  query: (x, v) => {
    const q = v.trim().toLowerCase()
    return !q || x.label.toLowerCase().includes(q) || String(x.id).includes(q)
  },
}
const FACETS = { status: (x) => [x.status], type: typeKeys, source: (x) => [sourceKey(x)] }

export function filterRows(rows, filters) {
  return rows.filter((x) => Object.keys(matchers).every((k) => matchers[k](x, filters[k])))
}

// จำนวนต่อตัวเลือกของแต่ละกลุ่มตัวกรอง โดยคิดตามตัวกรองกลุ่มอื่นที่เลือกอยู่ (ตัวเลขในวงเล็บ = จะเหลือกี่รายการถ้าเลือกตัวเลือกนั้น)
// คืน { status: { all, approved, ... }, type: { all, Weapon, Armor }, source: { all, extra, index } }
export function countFacets(rows, filters) {
  const counts = { status: { all: 0 }, type: { all: 0 }, source: { all: 0 } }
  for (const x of rows) {
    for (const facet of Object.keys(FACETS)) {
      if (!Object.keys(matchers).every((k) => k === facet || matchers[k](x, filters[k]))) continue
      counts[facet].all++
      for (const key of FACETS[facet](x)) counts[facet][key] = (counts[facet][key] || 0) + 1
    }
  }
  return counts
}
