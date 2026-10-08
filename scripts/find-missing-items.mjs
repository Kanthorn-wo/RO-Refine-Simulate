// หาไอเทม (อาวุธ/เกราะ) ที่มีบนเซิร์ฟไทย (thROG) แต่ยังไม่อยู่ใน index ค้นหา แล้วเติมเข้าตาราง extra_items ตามโหมดที่ตั้งใน dashboard
// ใช้: node --env-file=.env.local scripts/find-missing-items.mjs [--since=YYYY-MM-DD] [--out=reports/item-gaps/x.json] [--dry-run]
// (รันอัตโนมัติผ่าน .github/workflows/item-gaps.yml)
//
// ขั้นตอน:
//   1. ไล่ id ไอเทมของ thROG ผ่าน latestupdates (ทีละหน้าต่าง 14 วัน ตั้งแต่ --since)
//   2. ตัด id ที่ rAthena รู้จักอยู่แล้ว (equip/usable/etc) หรืออยู่ใน index ไฟล์ / extra-items.json / ตาราง extra_items แล้ว (ทุกสถานะ — ที่ปฏิเสธไว้ไม่ถูกเติมซ้ำ)
//   3. ยิง Item API ตรวจ type เก็บเฉพาะ Armor/Weapon; ดึง description จาก iRO (thROG ไม่ส่ง description) เพื่อตัดสินว่าตีบวกได้ไหม + เลเวลเกราะ
//   4. เขียนเข้า extra_items (source 'auto'): โหมด site_settings.item_auto_approve = true → approved, ไม่งั้น → pending (รออนุมัติใน dashboard)
//      เติมอย่างเดียว ไม่ทับแถวเดิม; เกินเพดาน MAX_AUTO_APPROVE ต่อรอบ → ส่วนที่เกินเข้า pending เสมอ
// API ไม่บอกตรง ๆ ว่า "ตีบวกได้" — ตัดสินจากกฎใน api/_lib/itemInfo.js (description พูดถึง refine, ไม่ใช่เครื่องประดับ/Costume/NFS)
// เรียก divine-pride ผ่าน api/_lib/divinePride.js เท่านั้น (≤ 1 req/วินาที ไม่ขนาน หยุดเมื่อโดน rate limit)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { dpGet, dpWithBackoff, DivinePrideLimitError } from '../api/_lib/divinePride.js'
import { describeItem, normalizeItemKind } from '../api/_lib/itemInfo.js'

if (!process.env.DIVINE_PRIDE_API_KEY) throw new Error('DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง')

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const since = arg('since') || '2008-01-01'
const outPath = arg('out') || `reports/item-gaps/${new Date().toISOString().slice(0, 10)}.json`
const dryRun = process.argv.includes('--dry-run')
const RATHENA_DB = 'https://raw.githubusercontent.com/rathena/rathena/master/db/re'
const MAX_AUTO_APPROVE = 50 // เติมแบบผ่านอัตโนมัติได้ไม่เกินเท่านี้ต่อรอบ (กันกฎพลาดแล้วเติมของผิดทีเดียวเป็นร้อย)

const supabaseReady = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const sb = (pathAndQuery, init) => fetch(`${process.env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
  ...init,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(init && init.headers),
  },
})

// เรียก divine-pride ผ่านตัวคุมอัตรากลาง (api/_lib/divinePride.js): ≤ 1 req/วินาที ข้ามทุกผู้เรียก, ไม่ขนาน,
// โดน rate limit → หยุดยิงแล้วรอตาม Retry-After (ลองใหม่จำกัดจำนวนครั้ง เกินแล้วสคริปต์หยุด)
// คืน data (null ถ้าไอเทมนั้นไม่มีข้อมูล/ไม่พบ)
async function dpData(path, server) {
  try {
    const { data } = await dpWithBackoff(() => dpGet(path, { server, maxWaitMs: 120000 }), {
      onWait: (sec, attempt) => console.log(`โดน rate limit — รอ ${sec} วินาที แล้วลองใหม่ (ครั้งที่ ${attempt})`),
    })
    return data
  } catch (err) {
    if (err instanceof DivinePrideLimitError) {
      console.error(`หยุด: ยังโดน rate limit หลังรอแล้ว (${err.message}) — ไม่ยิงต่อ ไม่เขียนรายงาน/ตาราง รันใหม่ภายหลัง`)
      process.exit(2)
    }
    throw err
  }
}

// 1) id ทั้งหมดของ thROG
const thIds = new Set()
for (let start = new Date(`${since}T00:00:00Z`); start < new Date(); start = new Date(start.getTime() + 14 * 86400000)) {
  const data = await dpData(`latestupdates?type=item&startDate=${start.toISOString().slice(0, 10)}`, 'thROG')
  if (!data) throw new Error('latestupdates ไม่มีข้อมูล')
  for (const x of data.results || []) thIds.add(x.id)
}
console.log(`thROG ids since ${since}: ${thIds.size}`)

// 2) ตัดที่ rAthena รู้จัก / อยู่ใน index / อยู่ในตาราง extra_items แล้ว
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
let autoApprove = false
if (supabaseReady) {
  const [rowsRes, settingRes] = await Promise.all([sb('extra_items?select=id&limit=20000'), sb('site_settings?select=value&key=eq.item_auto_approve')])
  if (!rowsRes.ok || !settingRes.ok) throw new Error('อ่านตาราง extra_items / site_settings ไม่สำเร็จ')
  for (const r of await rowsRes.json()) have.add(Number(r.id))
  autoApprove = (await settingRes.json())[0]?.value === true
} else {
  console.warn('ไม่มี SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — จะทำรายงานอย่างเดียว ไม่เขียนตาราง')
}
const candidates = [...thIds].filter(id => !known.has(id) && !have.has(id)).sort((a, b) => a - b)
console.log(`ไม่อยู่ใน rAthena และยังไม่อยู่ใน index/ตาราง: ${candidates.length} (โหมด: ${autoApprove ? 'ผ่านอัตโนมัติ' : 'รออนุมัติเอง'})`)

// 3) ตรวจ type + ตัดสินว่าตีบวกได้ไหม (เฉพาะ Armor/Weapon)
const found = []
let checked = 0
for (const id of candidates) {
  const d = (await dpData(`Item/${id}`, 'thROG')) || {}
  if (d.type === 'Armor' || d.type === 'Weapon') {
    // thROG ไม่ส่ง description (และไอเทมไทยบางชิ้นไม่มีชื่อ) → ขอจาก iRO ด้วย
    const info = describeItem(d, (await dpData(`Item/${id}`, 'iRO')) || {})
    // ชุด Costume ตีบวกไม่ได้ → ไม่ต้องรายงาน
    if (!/^costume /i.test(info?.label || '')) {
      found.push({ id, location: d.location || null, isAvailableOnServer: d.isAvailableOnServer === true, ...(info || { label: null, type: d.type, refinable: false }) })
    }
  }
  if (++checked % 100 === 0) console.log(`${checked}/${candidates.length} — อาวุธ/เกราะที่พบ: ${found.length}`)
}

// 4) เติมเข้า extra_items (เติมอย่างเดียว ไม่ทับแถวเดิม)
const toAdd = found.filter(x => x.refinable)
// เลเวลไม่แน่ใจ → pending เสมอ (แม้โหมดอัตโนมัติ) ให้คนตรวจ; ที่เหลือผ่านอัตโนมัติได้ไม่เกินเพดาน
let autoApprovedCount = 0
const rows = toAdd.map(x => {
  const canAuto = autoApprove && !x.levelUncertain && autoApprovedCount < MAX_AUTO_APPROVE
  if (canAuto) autoApprovedCount++
  const kind = normalizeItemKind({ itemType: x.type, armorLevel: x.armorLevel, weaponLevel: x.weaponLevel })
  return { id: x.id, label: x.label, ...kind, level_uncertain: x.levelUncertain, source: 'auto', status: canAuto ? 'approved' : 'pending' }
})
const uncertainCount = toAdd.filter(x => x.levelUncertain).length
console.log(`เลเวลไม่แน่ใจ ${uncertainCount} รายการ → เข้าคิวรออนุมัติ`)
if (autoApprove && toAdd.length - uncertainCount > MAX_AUTO_APPROVE) console.warn(`เกินเพดาน ${MAX_AUTO_APPROVE} รายการ — ส่วนที่เกินเข้าคิว "รออนุมัติ" แทน`)
let inserted = 0
if (rows.length && supabaseReady && !dryRun) {
  const res = await sb('extra_items?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`เขียน extra_items ไม่สำเร็จ (${res.status})`)
  inserted = (await res.json()).length
}
console.log(dryRun ? `dry-run: จะเติม ${rows.length} รายการ (ไม่ได้เขียนตาราง)` : `เติมเข้าตาราง ${inserted} รายการ`)

const report = {
  generatedAt: new Date().toISOString(), since, server: 'thROG', dryRun,
  mode: autoApprove ? 'auto' : 'manual', thIds: thIds.size, candidates: candidates.length, found: found.length,
  refinable: toAdd.length, levelUncertain: uncertainCount, inserted,
  note: 'refinable = description พูดถึง refine + ไม่ใช่เครื่องประดับ/Costume/NFS (API ไม่บอกตรง ๆ ว่าตีบวกได้) — รายการ refinable ถูกเติมเข้าตาราง extra_items (โหมดอัตโนมัติ = approved, ไม่งั้น pending ให้อนุมัติใน dashboard); รายการที่ refinable=false ดูเองได้ในรายงานนี้',
  items: found,
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n')
console.log(`เขียนรายงาน ${outPath} — พบ ${found.length} รายการ (refinable ${toAdd.length})`)
