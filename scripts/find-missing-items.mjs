// หาไอเทม (อาวุธ/เกราะ) ที่มีบนเซิร์ฟไทย (thROG) แต่ยังไม่อยู่ใน index ค้นหา — รายงานให้คนคัดเลือกเติมใน scripts/extra-items.json
// ใช้: node --env-file=.env.local scripts/find-missing-items.mjs [--since=YYYY-MM-DD] [--out=reports/item-gaps/x.json]
// (รันอัตโนมัติผ่าน .github/workflows/item-gaps.yml)
//
// ขั้นตอน:
//   1. ไล่ id ไอเทมของ thROG ผ่าน latestupdates (ทีละหน้าต่าง 14 วัน ตั้งแต่ --since)
//   2. ตัด id ที่ rAthena รู้จักอยู่แล้ว (equip/usable/etc) หรืออยู่ใน index/extra-items แล้ว — เหลือเฉพาะที่ rAthena ไม่มี (ของเซิร์ฟไทยโดยเฉพาะ)
//   3. ยิง Item API ตรวจ type เก็บเฉพาะ Armor/Weapon; ถ้า thROG ไม่มีชื่อ ("Item #id") ลองขอชื่อจาก iRO
// API ไม่บอกว่า "ตีบวกได้" หรือไม่ → ผลเป็นรายชื่อผู้ต้องสงสัยให้คนตัดสินเอง
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const key = process.env.DIVINE_PRIDE_API_KEY
if (!key) throw new Error('DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง')

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const since = arg('since') || '2008-01-01'
const outPath = arg('out') || `reports/item-gaps/${new Date().toISOString().slice(0, 10)}.json`
const DELAY_MS = 1200
const RATHENA_DB = 'https://raw.githubusercontent.com/rathena/rathena/master/db/re'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function dpGet(path, server) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`https://www.divine-pride.net/api/database/${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`, {
      headers: { 'x-server': server, 'Accept-Language': 'en' },
    })
    const data = await res.json().catch(() => null)
    // rate limit ตอบมาในเนื้อหา (ไม่ใช่แค่ status) → รอแล้วลองใหม่
    if (res.status === 429 || data?.reason === 'Rate limit exceeded') { await sleep(60000 * (attempt + 1)); continue }
    if (!data || data.status === 'error') throw new Error(`${path}: ${JSON.stringify(data)}`)
    await sleep(DELAY_MS)
    return data
  }
  throw new Error(`${path}: rate limit ไม่หายหลังลองหลายรอบ`)
}

// 1) id ทั้งหมดของ thROG
const thIds = new Set()
for (let start = new Date(`${since}T00:00:00Z`); start < new Date(); start = new Date(start.getTime() + 14 * 86400000)) {
  const data = await dpGet(`latestupdates?type=item&startDate=${start.toISOString().slice(0, 10)}`, 'thROG')
  for (const x of data.results || []) thIds.add(x.id)
}
console.log(`thROG ids since ${since}: ${thIds.size}`)

// 2) ตัดที่ rAthena รู้จัก / อยู่ใน index แล้ว
const known = new Set()
for (const file of ['equip', 'usable', 'etc']) {
  const text = await (await fetch(`${RATHENA_DB}/item_db_${file}.yml`)).text()
  for (const m of text.matchAll(/^ {2}- Id: (\d+)/gm)) known.add(Number(m[1]))
}
const readIds = url => JSON.parse(readFileSync(url, 'utf8')).map(([id]) => id)
const have = new Set([
  ...readIds(new URL('../src/constants/refinableItems.json', import.meta.url)),
  ...readIds(new URL('./extra-items.json', import.meta.url)),
])
const candidates = [...thIds].filter(id => !known.has(id) && !have.has(id)).sort((a, b) => a - b)
console.log(`ไม่อยู่ใน rAthena และยังไม่อยู่ใน index: ${candidates.length}`)

// 3) ตรวจ type เก็บเฉพาะ Armor/Weapon
const found = []
let checked = 0
for (const id of candidates) {
  const d = await dpGet(`Item/${id}`, 'thROG')
  if (d.type === 'Armor' || d.type === 'Weapon') {
    let name = d.displayName, nameFrom = 'thROG'
    if (/^Item #\d+$/.test(name || '')) {
      const alt = await dpGet(`Item/${id}`, 'iRO')
      if (alt.displayName && !/^Item #\d+$/.test(alt.displayName)) { name = alt.displayName; nameFrom = 'iRO' } else { nameFrom = null }
    }
    // ชุด Costume ตีบวกไม่ได้ → ไม่ต้องรายงาน
    if (/^costume /i.test(name || '')) { if (++checked % 100 === 0) console.log(`${checked}/${candidates.length}`); continue }
    found.push({
      id, name: name || null, nameFrom, type: d.type, subType: d.subType || null, location: d.location || null,
      weaponLevel: d.weaponLevel || null, isAvailableOnServer: d.isAvailableOnServer === true,
    })
  }
  if (++checked % 100 === 0) console.log(`${checked}/${candidates.length} — อาวุธ/เกราะที่น่าจะขาด: ${found.length}`)
}

const report = {
  generatedAt: new Date().toISOString(), since, server: 'thROG',
  thIds: thIds.size, candidates: candidates.length, found: found.length,
  note: 'ผู้ต้องสงสัยเท่านั้น — API ไม่บอกว่าตีบวกได้หรือไม่ ให้คัดเลือกแล้วเติมเข้า scripts/extra-items.json รูปแบบ [id, "ชื่อ [slots]"] (เกราะเลเวล 2 ใส่ 2 ต่อท้าย)',
  items: found,
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n')
console.log(`เขียนรายงาน ${outPath} — ${found.length} รายการ`)
