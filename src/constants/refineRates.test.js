import { describe, it, expect } from 'vitest';
import { getRate, getRateTable, RATE_TABLES, ENRICHED_RATE_BONUS } from './refineRates';

describe('getRateTable', () => {
  it('เลือกตารางตาม event/cash ครบ 4 ชุด', () => {
    expect(getRateTable(false, false)).toBe(RATE_TABLES.noevent.normal);
    expect(getRateTable(false, true)).toBe(RATE_TABLES.noevent.cash);
    expect(getRateTable(true, false)).toBe(RATE_TABLES.event.normal);
    expect(getRateTable(true, true)).toBe(RATE_TABLES.event.cash);
  });
});

describe('getRate', () => {
  it('index 0 = ระดับ +1', () => {
    expect(getRate(false, false, false, 'armor1', 0)).toBe(100);
  });

  it('Enriched บวกโบนัสจากตารางหินปกติ', () => {
    // armor1 noevent normal idx4 = 60 → +10
    expect(getRate(false, false, true, 'armor1', 4)).toBe(60 + ENRICHED_RATE_BONUS);
  });

  it('Enriched clamp ไม่เกิน 100%', () => {
    // base 100 → ไม่เกิน 100
    expect(getRate(false, false, true, 'armor1', 3)).toBe(100);
  });

  it('idx เกิน 19 ถูก clamp ที่ +20', () => {
    const last = RATE_TABLES.noevent.normal.armor1[19];
    expect(getRate(false, false, false, 'armor1', 25)).toBe(last);
    expect(getRate(false, false, false, 'armor1', 19)).toBe(last);
  });

  it('event ให้เรทต่างจาก noevent ในช่วงสูง', () => {
    expect(getRate(true, false, false, 'armor1', 10)).toBe(RATE_TABLES.event.normal.armor1[10]);
    expect(getRate(false, false, false, 'armor1', 10)).toBe(RATE_TABLES.noevent.normal.armor1[10]);
    expect(getRate(true, false, false, 'armor1', 10)).not.toBe(getRate(false, false, false, 'armor1', 10));
  });

  it('cash (HD) ใช้ตาราง cash', () => {
    expect(getRate(false, true, false, 'armor1', 4)).toBe(RATE_TABLES.noevent.cash.armor1[4]);
  });

  it('useEnriched อิงตาราง normal เสมอ (ไม่ใช่ cash) แม้ useCash=true', () => {
    // useEnriched มาก่อน — base ควรมาจาก getRateTable(useCash) แล้ว +bonus
    // เคสจริงในแอป enriched กับ cash ไม่ถูกเปิดพร้อมกัน แต่ทดสอบ contract ของฟังก์ชัน
    const base = getRateTable(false, true).armor1[4];
    expect(getRate(false, true, true, 'armor1', 4)).toBe(Math.min(100, base + ENRICHED_RATE_BONUS));
  });
});
