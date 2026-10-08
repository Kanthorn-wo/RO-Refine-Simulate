// ประเภทไอเทมตีบวก (id ตรงกับ itemType ของ simulator และ item_type ใน log): อาวุธ Lv.1–5 / เกราะ Lv.1–2
// ชื่อเรียกและสีป้ายของแต่ละเลเวลกำหนดที่นี่ที่เดียว — ทุกหน้าใน dashboard ใช้ร่วมกัน (อย่าเขียน "W5"/"A2"/"Lv5" แยกเอง)
export const ITEM_TYPE_LABEL = {
  weapon1: 'อาวุธ Lv.1', weapon2: 'อาวุธ Lv.2', weapon3: 'อาวุธ Lv.3', weapon4: 'อาวุธ Lv.4', weapon5: 'อาวุธ Lv.5',
  armor1: 'เกราะ Lv.1', armor2: 'เกราะ Lv.2',
}

// สีป้ายต่อเลเวล (dashboard เป็น dark-only) — อาวุธไล่เย็น→ร้อนตามเลเวล, เกราะเป็นโทนม่วง
export const ITEM_TYPE_BADGE_CLS = {
  weapon1: 'bg-slate-500/20 text-slate-300',
  weapon2: 'bg-sky-500/15 text-sky-300',
  weapon3: 'bg-emerald-500/15 text-emerald-300',
  weapon4: 'bg-amber-500/15 text-amber-300',
  weapon5: 'bg-rose-500/15 text-rose-300',
  armor1: 'bg-violet-500/15 text-violet-300',
  armor2: 'bg-fuchsia-500/15 text-fuchsia-300',
}

// 'Weapon'|'Armor' + เลเวล → id เช่น 'weapon4' (ไม่รู้ประเภท/เลเวลนอกช่วง = null)
export function itemTypeId(kind, level) {
  const id = `${kind === 'Weapon' ? 'weapon' : kind === 'Armor' ? 'armor' : ''}${Number(level)}`
  return ITEM_TYPE_LABEL[id] ? id : null
}
