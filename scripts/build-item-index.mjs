// สร้าง src/constants/refinableItems.json จาก rAthena item_db_equip.yml
// รูปแบบ [id, name] หรือ [id, name, 2] (ตัวที่ 3 = เกราะเลเวล 2 เท่านั้น — divine-pride ไม่ส่งเลเวลเกราะมา)
// รวมไอเทมจาก scripts/extra-items.json ด้วย
// เก็บเฉพาะ Weapon/Armor ที่ Refineable (ตัด Shadowgear ออก เพราะเว็บยังไม่มีประเภทนี้)
// ใช้: node scripts/build-item-index.mjs <path-to-item_db_equip.yml>
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(process.argv[2], 'utf8')
const items = []
for (const block of src.split(/\n  - Id: /).slice(1)) {
  if (!/\n    Refineable: true/.test(block)) continue
  if (!/\n    Type: (Weapon|Armor)\b/.test(block)) continue
  const id = Number(block.match(/^\d+/)[0])
  const name = block.match(/\n    Name: (.+)/)?.[1].trim().replace(/^["']|["']$/g, '')
  const slots = Number(block.match(/\n    Slots: (\d+)/)?.[1] ?? 0)
  const armorLevel = Number(block.match(/\n    ArmorLevel: (\d+)/)?.[1] ?? 1)
  const label = slots > 0 ? `${name} [${slots}]` : name
  if (id && name) items.push(armorLevel === 2 ? [id, label, 2] : [id, label])
}
// ไอเทมเสริมที่ rAthena ไม่มี (เช่น ของเซิร์ฟไทยโดยเฉพาะ) — เพิ่มได้ใน scripts/extra-items.json รูปแบบเดียวกับ index
const extras = JSON.parse(readFileSync(new URL('./extra-items.json', import.meta.url), 'utf8'))
for (const extra of extras) if (!items.some(([id]) => id === extra[0])) items.push(extra)
items.sort((a, b) => a[0] - b[0])
writeFileSync(new URL('../src/constants/refinableItems.json', import.meta.url), JSON.stringify(items))
console.log(`wrote ${items.length} items`)
