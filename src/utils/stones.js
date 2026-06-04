import { getRate } from '../constants/refineRates';

// ป้ายชื่อ/สีของชนิดหิน (ใช้ในแผน auto)
export const STONE_META = {
  normal:   { label: 'ปกติ',     active: 'border-sky-400 bg-sky-500/20 text-sky-200' },
  enriched: { label: 'Enriched', active: 'border-amber-400 bg-amber-400/20 text-amber-200' },
  hd:       { label: 'HD',       active: 'border-orange-400 bg-orange-500/20 text-orange-200' },
};

// ระดับต่ำสุดที่หินชนิดนี้ใช้ได้จริงในเกม (level = stack.length ก่อนตี)
export const getStoneMinLevel = (stone, itemType) => {
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  if (stone === 'hd') return isSpecial ? 10 : 7;
  return 0;
};

// validate หินที่ auto วางแผนไว้ว่าใช้ได้จริงที่ระดับนี้ไหม — ถ้าไม่ fallback เป็น normal
export const getEffectiveStone = (stone, itemType, level) => {
  if (level < getStoneMinLevel(stone, itemType)) return 'normal';
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  if (stone === 'enriched' && level >= 10) return 'normal';
  if (stone === 'hd' && isSpecial && level < 10) return 'normal';
  return stone;
};

// หาชนิดหินที่ควรใช้ที่ระดับ level (currentLevel) ตามแผน rules — ช่วงที่ from <= level สูงสุด
export const getPlannedStone = (rules, level) => {
  let stone = 'normal';
  for (const r of [...rules].sort((a, b) => a.from - b.from)) {
    if (r.from <= level) stone = r.stone;
  }
  if (stone === 'enriched' && level > 10) stone = 'normal';
  return stone;
};

// ตรวจว่า toggle "หยุด Auto ถ้าเสี่ยงหาย" ควรแสดงสำหรับช่วงนี้ไหม
// มีความหมายก็ต่อเมื่อมีอย่างน้อย 1 ระดับในช่วงที่: (1) ล้มแล้ว item หาย
// (2) rate < 100% — ไม่งั้นล้มไม่ได้อยู่แล้ว  (3) BSB ไม่คุ้มกัน
export const toggleHasMeaning = (stone, itemType, fromDest, toDest, isEventRate, autoUseBSB, autoBSBStart, autoBSBEnd, bsbTable) => {
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  for (let dest = fromDest; dest <= toDest; dest++) {
    const stackLen = dest - 1;
    if (stackLen < 0) continue;
    const eff = getEffectiveStone(stone, itemType, stackLen);
    const wC = eff === 'hd';
    const wE = eff === 'enriched';
    const wouldLose = isSpecial ? stackLen >= 10 : !wC;
    if (!wouldLose) continue;
    if (getRate(isEventRate, wC, wE, itemType, stackLen) >= 100) continue;
    const bsbProtects = autoUseBSB && stackLen >= autoBSBStart && stackLen < autoBSBEnd
      && stackLen >= 7 && stackLen <= 14 && (bsbTable[stackLen] || 0) > 0;
    if (!bsbProtects) return true;
  }
  return false;
};
