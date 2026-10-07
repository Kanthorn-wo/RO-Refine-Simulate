// สร้าง src/constants/refinableItems.json (รายการ [id, name] ของไอเทมที่ตีบวกได้) จาก rAthena item_db_equip.yml
// ใช้: node scripts/build-item-index.mjs <path-to-item_db_equip.yml>
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(process.argv[2], 'utf8')
const items = []
for (const block of src.split(/\n  - Id: /).slice(1)) {
  if (!/\n    Refineable: true/.test(block)) continue
  const id = Number(block.match(/^\d+/)[0])
  const name = block.match(/\n    Name: (.+)/)?.[1].trim().replace(/^["']|["']$/g, '')
  const slots = Number(block.match(/\n    Slots: (\d+)/)?.[1] ?? 0)
  if (id && name) items.push([id, slots > 0 ? `${name} [${slots}]` : name])
}
items.sort((a, b) => a[0] - b[0])
writeFileSync(new URL('../src/constants/refinableItems.json', import.meta.url), JSON.stringify(items))
console.log(`wrote ${items.length} items`)
