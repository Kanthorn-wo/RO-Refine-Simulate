// ตัวช่วยอ่านข้อมูลไอเทมจาก divine-pride — ใช้ร่วมกัน api/extra-items.js (lookup) และ scripts/find-missing-items.mjs (Action)
// pure functions ล้วน (ไม่เรียกเครือข่าย) ชื่อไฟล์ขึ้นต้น _ กัน Vercel เอาไปทำเป็น route

// ชื่อกลวงที่ divine-pride ตอบเมื่อไม่มีข้อมูลไอเทมบนเซิร์ฟนั้น เช่น "Item #460166"
export const PLACEHOLDER_NAME = /^Item #\d+$/

import { isHighTierRequiredLevel } from '../../src/constants/itemLevels.js'

// ตัดรหัสสี ^RRGGBB ออกจาก description (เช่น "^777777Shield^000000")
const stripColorCodes = (text) => String(text || '').replace(/\^[0-9A-Fa-f]{6}/g, '')

// เลเวลเกราะจาก description บรรทัด "Armor Level : ^7777772^000000" — ไม่มีบรรทัดนี้ = เลเวล 1
// (ตาราง extra_items รองรับ 1 | 2 เท่านั้น — เกราะเลเวลสูงกว่านี้ตีบวกใช้ตารางเลเวล 2)
export function parseArmorLevel(description) {
  const match = String(description || '').match(/Armor Level\s*:\s*(?:\^[0-9A-Fa-f]{6})?(\d)/)
  const level = match ? Number(match[1]) : 1
  return level >= 2 ? 2 : 1
}

// เลเวลเกราะที่ใช้จริง: มีบรรทัด "Armor Level : N" ใน description → ใช้ค่านั้น; ไม่มี → requiredLevel เกิน 200 = Lv2 (กฎใน src/constants/itemLevels.js); ไม่เข้ากฎ = Lv1
export function resolveArmorLevel(description, requiredLevel) {
  if (/Armor Level\s*:/.test(String(description || ''))) return parseArmorLevel(description)
  return isHighTierRequiredLevel(requiredLevel) ? 2 : 1
}

// เลเวลที่ระบบ "เดา" (ไม่มีหลักฐาน): เกราะ = ไม่มีบรรทัด Armor Level, อาวุธ = ไม่มี weaponLevel จาก API — และ requiredLevel ไม่เกิน 200
// ใช้ให้ Action ส่งไอเทมเข้าคิวรออนุมัติเสมอ + dashboard ติดป้ายให้คนตรวจ
export function isLevelUncertain({ type, description, requiredLevel, weaponLevel }) {
  if (isHighTierRequiredLevel(requiredLevel)) return false
  if (type === 'Weapon') return !(Number(weaponLevel) > 0)
  return !/Armor Level\s*:/.test(String(description || ''))
}

// description พูดถึง "refine" = สัญญาณว่าตีบวกได้ (เช่น "For every 2 refine level, ATK + 10")
export const mentionsRefine = (description) => /refine/i.test(stripColorCodes(description))

// ชื่อแสดงในช่องค้นหา: ชื่อ + [จำนวนช่อง] (ถ้าชื่อมี [n] อยู่แล้วใช้ตามนั้น)
export function buildLabel(name, slots) {
  const base = String(name || '').trim()
  if (/\[\d+\]$/.test(base)) return base
  return Number(slots) > 0 ? `${base} [${Number(slots)}]` : base
}

// ไอเทมที่ "น่าจะตีบวกได้" — ใช้ตัดสินตอน Action เติมอัตโนมัติ (API ไม่บอกตรง ๆ ว่าตีบวกได้หรือไม่)
// ต้องเป็นอาวุธ/เกราะ มีชื่อภาษาอังกฤษจริง ไม่ใช่เครื่องประดับ/ชุด Costume/ของ NFS และ description พูดถึง refine
export function isRefinableCandidate({ type, subType, name, description }) {
  if (type !== 'Armor' && type !== 'Weapon') return false
  const itemName = String(name || '').trim()
  if (!itemName || PLACEHOLDER_NAME.test(itemName)) return false
  if (/[^\x20-\x7E]/.test(itemName)) return false // ชื่อมีอักษรไม่ใช่ ASCII (ญี่ปุ่น/เกาหลี) = ยังไม่มีชื่ออังกฤษ
  if (/accessory|costume/i.test(String(subType || ''))) return false
  if (/^[[(]?NFS\b/i.test(itemName) || /costume/i.test(itemName)) return false
  if (/costume/i.test(stripColorCodes(description))) return false
  return mentionsRefine(description)
}

// ค่าประเภท/เลเวลของแถว extra_items จากข้อมูลดิบ (ใช้ร่วม API add กับ Action): เกราะ = armor_level 1|2, อาวุธ = weapon_level 1–5
export function normalizeItemKind({ itemType, armorLevel, weaponLevel }) {
  const item_type = itemType === 'Weapon' || itemType === 'Armor' ? itemType : null
  const weapon = Number(weaponLevel)
  return {
    item_type,
    armor_level: Number(armorLevel) >= 2 ? 2 : 1,
    weapon_level: item_type === 'Weapon' && weapon >= 1 && weapon <= 5 ? weapon : null,
  }
}

// วิเคราะห์ไอเทมจากข้อมูล divine-pride ของ thROG + iRO (ตัวเดียวกันทั้ง lookup ใน dashboard และ Action หาไอเทมใหม่)
// ชื่อ/ช่อง/ประเภทเอาจากเซิร์ฟที่มี (thROG ของไอเทมไทยบางชิ้นไม่มีชื่อ → ใช้ iRO), description มีเฉพาะ iRO
// คืน null ถ้าสองเซิร์ฟไม่มีชื่อจริง
export function describeItem(thai, global) {
  const nameOf = (d) => (d && (d.displayName || d.name)) || ''
  const source = [thai, global].find((d) => nameOf(d) && !PLACEHOLDER_NAME.test(nameOf(d)))
  if (!source) return null
  const pick = (field) => (thai && thai[field]) || (global && global[field]) || null
  const type = pick('type')
  const subType = pick('subType')
  const description = (global && global.description) || (thai && thai.description) || ''
  const requiredLevel = (thai && thai.requiredLevel) ?? (global && global.requiredLevel) ?? null
  const weaponLevel = Number(pick('weaponLevel')) || null
  const name = nameOf(source)
  return {
    label: buildLabel(name, pick('slots')),
    nameFrom: source === thai ? 'thROG' : 'iRO',
    type,
    subType,
    requiredLevel,
    weaponLevel,
    armorLevel: type === 'Armor' ? resolveArmorLevel(description, requiredLevel) : 1,
    levelUncertain: isLevelUncertain({ type, description, requiredLevel, weaponLevel }),
    // บอกแนวโน้มเฉย ๆ (API ไม่ระบุว่าตีบวกได้หรือไม่) ให้คนตัดสินใจเอง
    refinable: isRefinableCandidate({ type, subType, name, description }),
    availableOnThai: !!(thai && thai.isAvailableOnServer),
  }
}
