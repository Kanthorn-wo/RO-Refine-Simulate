import { describe, it, expect } from 'vitest'
import { parseArmorLevel, resolveArmorLevel, isLevelUncertain, normalizeItemKind, describeItem, mentionsRefine, buildLabel, isRefinableCandidate } from './itemInfo.js'

describe('parseArmorLevel', () => {
  it('อ่านเลเวลจากบรรทัด Armor Level (มีรหัสสี)', () => {
    expect(parseArmorLevel('Type : ^777777Shield^000000\nArmor Level : ^7777772^000000\nRequired Level : 200')).toBe(2)
  })
  it('Armor Level : 1 = 1', () => {
    expect(parseArmorLevel('Armor Level : ^7777771^000000')).toBe(1)
  })
  it('ไม่มีบรรทัด Armor Level = เลเวล 1', () => {
    expect(parseArmorLevel('Type : ^777777Shield^000000\nDef : 250')).toBe(1)
    expect(parseArmorLevel('')).toBe(1)
    expect(parseArmorLevel(undefined)).toBe(1)
  })
  it('เลเวลสูงกว่า 2 ถูกจำกัดที่ 2 (ตาราง extra_items รองรับ 1|2)', () => {
    expect(parseArmorLevel('Armor Level : ^7777773^000000')).toBe(2)
  })
})

describe('mentionsRefine', () => {
  it('เจอคำว่า refine (ไม่สนตัวพิมพ์)', () => {
    expect(mentionsRefine('For every 2 REFINE level, ATK + 10')).toBe(true)
    expect(mentionsRefine('When refined to +7 or higher')).toBe(true)
  })
  it('ไม่มี = false', () => {
    expect(mentionsRefine('MaxHP + 10%')).toBe(false)
    expect(mentionsRefine(null)).toBe(false)
  })
})

describe('buildLabel', () => {
  it('ต่อ [slots] ท้ายชื่อ', () => {
    expect(buildLabel('Scarlet Hero Cape', 1)).toBe('Scarlet Hero Cape [1]')
  })
  it('ไม่ซ้ำ [n] ถ้าชื่อมีอยู่แล้ว', () => {
    expect(buildLabel('Red Flower Hat [1]', 1)).toBe('Red Flower Hat [1]')
  })
  it('ไม่มีช่อง = ชื่อเฉย ๆ', () => {
    expect(buildLabel('Light and Darkness Wing', 0)).toBe('Light and Darkness Wing')
  })
})

describe('isRefinableCandidate', () => {
  const base = { type: 'Armor', subType: 'Shield', name: "Guardian's Shield", description: 'For every 2 refine level, ATK + 10' }
  it('เกราะ/อาวุธที่ description พูดถึง refine = ใช่', () => {
    expect(isRefinableCandidate(base)).toBe(true)
    expect(isRefinableCandidate({ ...base, type: 'Weapon', subType: 'Dagger' })).toBe(true)
  })
  it('ตัดเครื่องประดับ / Costume / NFS', () => {
    expect(isRefinableCandidate({ ...base, subType: 'Accessory' })).toBe(false)
    expect(isRefinableCandidate({ ...base, subType: 'Costume Headgear' })).toBe(false)
    expect(isRefinableCandidate({ ...base, name: '[NFS]Doram Shield' })).toBe(false)
    expect(isRefinableCandidate({ ...base, description: 'A costume cloak. refine ...' })).toBe(false)
  })
  it('ตัดชื่อกลวง / ชื่อไม่ใช่อังกฤษ / ไม่ใช่อาวุธเกราะ', () => {
    expect(isRefinableCandidate({ ...base, name: 'Item #460122' })).toBe(false)
    expect(isRefinableCandidate({ ...base, name: '의상 스텔라 서클' })).toBe(false)
    expect(isRefinableCandidate({ ...base, type: 'Consumable' })).toBe(false)
  })
  it('ไม่พูดถึง refine = ไม่ใช่', () => {
    expect(isRefinableCandidate({ ...base, description: 'MaxHP + 10%' })).toBe(false)
  })
})

describe('resolveArmorLevel — กฎ requiredLevel เกิน 200 = Lv2', () => {
  it('requiredLevel เกิน 200 และไม่มีบรรทัด Armor Level = Lv2', () => {
    expect(resolveArmorLevel('Type : Shield', 201)).toBe(2)
    expect(resolveArmorLevel('', 250)).toBe(2)
  })
  it('ขอบเขต: 200 พอดีไม่เข้ากฎ (ต้อง "เกิน" 200)', () => {
    expect(resolveArmorLevel('Type : Shield', 200)).toBe(1)
    expect(resolveArmorLevel('Type : Shield', 190)).toBe(1)
  })
  it('requiredLevel ว่าง/ไม่ใช่ตัวเลข = Lv1', () => {
    expect(resolveArmorLevel('Type : Shield', null)).toBe(1)
    expect(resolveArmorLevel('Type : Shield', undefined)).toBe(1)
    expect(resolveArmorLevel('Type : Shield', 'abc')).toBe(1)
  })
  it('ค่าที่ระบุชัดใน description ชนะกฎ (Armor Level : 1 + requiredLevel 250 = Lv1)', () => {
    expect(resolveArmorLevel('Armor Level : ^7777771^000000', 250)).toBe(1)
    expect(resolveArmorLevel('Armor Level : ^7777772^000000', 100)).toBe(2)
  })
})

describe('isLevelUncertain — เลเวลที่ระบบเดา', () => {
  it('เกราะ: มีบรรทัด Armor Level = แน่ใจ / ไม่มี = ไม่แน่ใจ', () => {
    expect(isLevelUncertain({ type: 'Armor', description: 'Armor Level : ^7777771^000000', requiredLevel: 100 })).toBe(false)
    expect(isLevelUncertain({ type: 'Armor', description: 'Type : Shield', requiredLevel: 100 })).toBe(true)
  })
  it('อาวุธ: มี weaponLevel = แน่ใจ / ไม่มี = ไม่แน่ใจ', () => {
    expect(isLevelUncertain({ type: 'Weapon', description: '', requiredLevel: 100, weaponLevel: 4 })).toBe(false)
    expect(isLevelUncertain({ type: 'Weapon', description: '', requiredLevel: 100, weaponLevel: 0 })).toBe(true)
  })
  it('requiredLevel เกิน 200 = เข้ากฎ จึงแน่ใจเสมอ', () => {
    expect(isLevelUncertain({ type: 'Armor', description: '', requiredLevel: 201 })).toBe(false)
    expect(isLevelUncertain({ type: 'Weapon', description: '', requiredLevel: 250 })).toBe(false)
    expect(isLevelUncertain({ type: 'Armor', description: '', requiredLevel: 200 })).toBe(true)
  })
})

describe('normalizeItemKind', () => {
  it('เกราะ: armor_level 1|2, ไม่มี weapon_level', () => {
    expect(normalizeItemKind({ itemType: 'Armor', armorLevel: 2, weaponLevel: 4 })).toEqual({ item_type: 'Armor', armor_level: 2, weapon_level: null })
  })
  it('อาวุธ: weapon_level 1–5 เท่านั้น นอกช่วง = null', () => {
    expect(normalizeItemKind({ itemType: 'Weapon', weaponLevel: 4 }).weapon_level).toBe(4)
    expect(normalizeItemKind({ itemType: 'Weapon', weaponLevel: 9 }).weapon_level).toBeNull()
  })
  it('ประเภทแปลก/ว่าง = null', () => {
    expect(normalizeItemKind({ itemType: 'Card' }).item_type).toBeNull()
    expect(normalizeItemKind({}).armor_level).toBe(1)
  })
})

describe('describeItem', () => {
  const thai = { displayName: 'Falling Star Shield [1]', slots: 1, type: 'Armor', subType: 'Shield', isAvailableOnServer: true, requiredLevel: 200, description: '' }
  const global = { displayName: 'Falling Star Shield [1]', type: 'Armor', description: 'Armor Level : ^7777772^000000\nFor every 2 refine level, ATK + 10' }
  it('รวมชื่อ/ประเภทจาก thROG และ description จาก iRO', () => {
    expect(describeItem(thai, global)).toMatchObject({ label: 'Falling Star Shield [1]', nameFrom: 'thROG', type: 'Armor', armorLevel: 2, levelUncertain: false, refinable: true, availableOnThai: true })
  })
  it('thROG ไม่มีชื่อจริง → ใช้ชื่อ iRO', () => {
    const info = describeItem({ displayName: 'Item #1', type: 'Armor' }, global)
    expect(info).toMatchObject({ label: 'Falling Star Shield [1]', nameFrom: 'iRO' })
  })
  it('ไม่มีชื่อจริงทั้งสองเซิร์ฟ = null', () => {
    expect(describeItem({ displayName: 'Item #1' }, null)).toBeNull()
  })
  it('อาวุธ: ใช้ weaponLevel ของ API', () => {
    expect(describeItem({ displayName: 'Cool Sword [2]', type: 'Weapon', weaponLevel: 4 }, null)).toMatchObject({ type: 'Weapon', weaponLevel: 4, levelUncertain: false })
  })
})
