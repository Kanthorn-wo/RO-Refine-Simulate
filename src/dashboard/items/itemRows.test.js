import { describe, it, expect } from 'vitest'
import { countFacets, filterRows } from './itemRows.js'

const rows = [
  { id: 1, label: 'Sword', status: 'approved', source: 'index', item_type: 'Weapon', weapon_level: 4 },
  { id: 2, label: 'Shield', status: 'approved', source: 'manual', item_type: 'Armor', armor_level: 2 },
  { id: 3, label: 'Cape', status: 'pending', source: 'auto', item_type: 'Armor', armor_level: 1 },
  { id: 4, label: 'Hat', status: 'denied', source: 'manual', item_type: null },
]
const none = { status: 'all', type: 'all', source: 'all', query: '' }

describe('countFacets', () => {
  it('ไม่เลือกตัวกรอง: นับทุกตัวเลือก (all = ทั้งหมด, ประเภทที่ไม่รู้นับใน all เท่านั้น)', () => {
    expect(countFacets(rows, none)).toEqual({
      status: { all: 4, approved: 2, pending: 1, denied: 1 },
      type: { all: 4, Weapon: 1, weapon4: 1, Armor: 2, armor2: 1, armor1: 1 },
      source: { all: 4, index: 1, extra: 3 },
    })
  })
  it('แต่ละกลุ่มนับตามตัวกรองกลุ่มอื่น ไม่นับตัวกรองของกลุ่มตัวเอง', () => {
    const c = countFacets(rows, { ...none, type: 'Armor' })
    expect(c.status).toEqual({ all: 2, approved: 1, pending: 1 }) // เฉพาะเกราะ
    expect(c.type).toEqual({ all: 4, Weapon: 1, weapon4: 1, Armor: 2, armor2: 1, armor1: 1 }) // กลุ่มประเภทไม่ถูกกรองด้วยตัวเอง
  })
  it('ช่องค้นหากรองทุกกลุ่ม', () => {
    expect(countFacets(rows, { ...none, query: 'cape' }).status).toEqual({ all: 1, pending: 1 })
  })
})

describe('filterRows', () => {
  it('กรองรวมหลายเงื่อนไข', () => {
    expect(filterRows(rows, { ...none, type: 'Armor', source: 'extra' }).map((x) => x.id)).toEqual([2, 3])
    expect(filterRows(rows, { ...none, query: '1' }).map((x) => x.id)).toEqual([1])
  })
  it('กรองตามเลเวล: เกราะ Lv.2 / อาวุธ Lv.4 / อาวุธ Lv.1 (ไม่มี)', () => {
    expect(filterRows(rows, { ...none, type: 'armor2' }).map((x) => x.id)).toEqual([2])
    expect(filterRows(rows, { ...none, type: 'weapon4' }).map((x) => x.id)).toEqual([1])
    expect(filterRows(rows, { ...none, type: 'weapon1' })).toEqual([])
  })
})
