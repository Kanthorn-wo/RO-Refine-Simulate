// สร้าง src/constants/refinableItems.json จาก rAthena item_db_equip.yml
// รูปแบบ [id, name] หรือ [id, name, 2] (ตัวที่ 3 = เกราะเลเวล 2 เท่านั้น — divine-pride ไม่ส่งเลเวลเกราะมา)
// รวมไอเทมจาก scripts/extra-items.json ด้วย
// เก็บเฉพาะ Weapon/Armor ที่ Refineable (ตัด Shadowgear ออก เพราะเว็บยังไม่มีประเภทนี้)
// ใช้: node scripts/build-item-index.mjs <path-to-item_db_equip.yml> [--meta-only]
// ไฟล์คู่กัน src/constants/refinableItemMeta.json = { id: ['W', weaponLevel] | ['A', armorLevel] } ใช้โชว์ประเภท/เลเวลใน dashboard (ช่องค้นหาไม่โหลดไฟล์นี้)
// --meta-only = เขียนเฉพาะไฟล์ meta ไม่แตะ refinableItems.json (index ปัจจุบันผ่าน filter-item-index.mjs แล้ว สร้างใหม่จะทำให้ของผิดเซิร์ฟกลับมา)
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(process.argv[2], 'utf8')
const items = []
const meta = {}
for (const block of src.split(/\n  - Id: /).slice(1)) {
  if (!/\n    Refineable: true/.test(block)) continue
  if (!/\n    Type: (Weapon|Armor)\b/.test(block)) continue
  const id = Number(block.match(/^\d+/)[0])
  const name = block.match(/\n    Name: (.+)/)?.[1].trim().replace(/^["']|["']$/g, '')
  const slots = Number(block.match(/\n    Slots: (\d+)/)?.[1] ?? 0)
  const armorLevel = Number(block.match(/\n    ArmorLevel: (\d+)/)?.[1] ?? 1)
  const label = slots > 0 ? `${name} [${slots}]` : name
  const isWeapon = /\n    Type: Weapon\b/.test(block)
  const weaponLevel = Number(block.match(/\n    WeaponLevel: (\d+)/)?.[1] ?? 1)
  if (id && name) {
    items.push(armorLevel === 2 ? [id, label, 2] : [id, label])
    meta[id] = isWeapon ? ['W', weaponLevel] : ['A', armorLevel >= 2 ? 2 : 1]
  }
}
// ไอเทมเสริมที่ rAthena ไม่มี (เช่น ของเซิร์ฟไทยโดยเฉพาะ) — เพิ่มได้ใน scripts/extra-items.json รูปแบบเดียวกับ index
const extras = JSON.parse(readFileSync(new URL('./extra-items.json', import.meta.url), 'utf8'))
for (const extra of extras) if (!items.some(([id]) => id === extra[0])) items.push(extra)
items.sort((a, b) => a[0] - b[0])
if (process.argv.includes('--meta-only')) {
  // เก็บเฉพาะ id ที่อยู่ใน index ปัจจุบัน (ตัวที่ filter ทิ้งไปแล้วไม่ต้องมี meta)
  const inIndex = new Set(JSON.parse(readFileSync(new URL('../src/constants/refinableItems.json', import.meta.url), 'utf8')).map(([id]) => id))
  for (const id of Object.keys(meta)) if (!inIndex.has(Number(id))) delete meta[id]
  writeFileSync(new URL('../src/constants/refinableItemMeta.json', import.meta.url), JSON.stringify(meta))
  console.log(`wrote meta for ${Object.keys(meta).length} items (index untouched)`)
} else {
  writeFileSync(new URL('../src/constants/refinableItemMeta.json', import.meta.url), JSON.stringify(meta))
  writeFileSync(new URL('../src/constants/refinableItems.json', import.meta.url), JSON.stringify(items))
  console.log(`wrote ${items.length} items`)
}
