// ตัวช่วยอ่านข้อมูลไอเทมจาก divine-pride — ใช้ร่วมกัน api/extra-items.js (lookup) และ scripts/find-missing-items.mjs (Action)
// pure functions ล้วน (ไม่เรียกเครือข่าย) ชื่อไฟล์ขึ้นต้น _ กัน Vercel เอาไปทำเป็น route

// ชื่อกลวงที่ divine-pride ตอบเมื่อไม่มีข้อมูลไอเทมบนเซิร์ฟนั้น เช่น "Item #460166"
export const PLACEHOLDER_NAME = /^Item #\d+$/

// ตัดรหัสสี ^RRGGBB ออกจาก description (เช่น "^777777Shield^000000")
const stripColorCodes = (text) => String(text || '').replace(/\^[0-9A-Fa-f]{6}/g, '')

// เลเวลเกราะจาก description บรรทัด "Armor Level : ^7777772^000000" — ไม่มีบรรทัดนี้ = เลเวล 1
// (ตาราง extra_items รองรับ 1 | 2 เท่านั้น — เกราะเลเวลสูงกว่านี้ตีบวกใช้ตารางเลเวล 2)
export function parseArmorLevel(description) {
  const match = String(description || '').match(/Armor Level\s*:\s*(?:\^[0-9A-Fa-f]{6})?(\d)/)
  const level = match ? Number(match[1]) : 1
  return level >= 2 ? 2 : 1
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
