import { describe, it, expect } from 'vitest';
import {
  getStoneMinLevel,
  getEffectiveStone,
  getPlannedStone,
  toggleHasMeaning,
} from './stones';

describe('getStoneMinLevel', () => {
  it('HD: item ปกติ = 7, special (weapon5/armor2) = 10', () => {
    expect(getStoneMinLevel('hd', 'armor1')).toBe(7);
    expect(getStoneMinLevel('hd', 'weapon1')).toBe(7);
    expect(getStoneMinLevel('hd', 'weapon5')).toBe(10);
    expect(getStoneMinLevel('hd', 'armor2')).toBe(10);
  });

  it('normal/enriched = 0', () => {
    expect(getStoneMinLevel('normal', 'armor1')).toBe(0);
    expect(getStoneMinLevel('enriched', 'weapon5')).toBe(0);
  });
});

describe('getEffectiveStone', () => {
  it('HD ต่ำกว่า min → fallback normal', () => {
    expect(getEffectiveStone('hd', 'armor1', 6)).toBe('normal');
    expect(getEffectiveStone('hd', 'armor1', 7)).toBe('hd');
  });

  it('HD บน special ต่ำกว่า 10 → normal', () => {
    expect(getEffectiveStone('hd', 'weapon5', 9)).toBe('normal');
    expect(getEffectiveStone('hd', 'weapon5', 10)).toBe('hd');
  });

  it('Enriched ที่ >= 10 ใช้ไม่ได้ → normal', () => {
    expect(getEffectiveStone('enriched', 'armor1', 9)).toBe('enriched');
    expect(getEffectiveStone('enriched', 'armor1', 10)).toBe('normal');
  });

  it('normal คืน normal เสมอ', () => {
    expect(getEffectiveStone('normal', 'armor1', 0)).toBe('normal');
    expect(getEffectiveStone('normal', 'weapon5', 15)).toBe('normal');
  });
});

describe('getPlannedStone', () => {
  const rules = [
    { from: 1, stone: 'normal' },
    { from: 8, stone: 'hd' },
  ];

  it('เลือก rule ที่ from <= level สูงสุด', () => {
    expect(getPlannedStone(rules, 5)).toBe('normal');
    expect(getPlannedStone(rules, 8)).toBe('hd');
    expect(getPlannedStone(rules, 12)).toBe('hd');
  });

  it('Enriched ถูก downgrade เป็น normal เมื่อ level > 10', () => {
    const enr = [{ from: 1, stone: 'enriched' }];
    expect(getPlannedStone(enr, 10)).toBe('enriched');
    expect(getPlannedStone(enr, 11)).toBe('normal');
  });
});

describe('toggleHasMeaning', () => {
  const bsbTable = Array(21).fill(0);

  it('normal stone ช่วงที่ item หายได้ + rate < 100 → true', () => {
    // armor1 +6 (stackLen5) noevent normal rate 40% — หินปกติล้มหาย
    expect(toggleHasMeaning('normal', 'armor1', 6, 6, false, false, false, bsbTable)).toBe(true);
  });

  it('HD ไม่ทำให้ item หาย (ปกติ) → false', () => {
    // armor1 +8 (stackLen7) HD ล้ม = ลดระดับ ไม่หาย
    expect(toggleHasMeaning('hd', 'armor1', 8, 8, false, false, false, bsbTable)).toBe(false);
  });

  it('ช่วงที่ rate 100% → false (ล้มไม่ได้)', () => {
    // armor1 +1 (stackLen0) = 100%
    expect(toggleHasMeaning('normal', 'armor1', 1, 1, false, false, false, bsbTable)).toBe(false);
  });
});
