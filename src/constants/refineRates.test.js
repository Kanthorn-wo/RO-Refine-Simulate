import { describe, it, expect } from 'vitest';
import { getRate, getRateTable, RATE_TABLES } from './refineRates';

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

  it('Enriched ใช้เรทชุดเดียวกับ HD (ตาราง cash) ตาม iROWiki', () => {
    // armor1 +4→+5 noevent: cash = 90 (ไม่ใช่ normal 60 +10 = 70)
    expect(getRate(false, false, true, 'armor1', 4)).toBe(RATE_TABLES.noevent.cash.armor1[4]);
    // armor2 +4→+5 event: cash = 85 (ไม่ใช่ normal 80 +10 = 90)
    expect(getRate(true, false, true, 'armor2', 4)).toBe(RATE_TABLES.event.cash.armor2[4]);
    // Enriched == HD ทุกชนิด/ทุกระดับ ทั้ง noevent และ event
    for (const type of ['armor1', 'armor2', 'weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5']) {
      for (let i = 0; i < 20; i++) {
        expect(getRate(false, false, true, type, i)).toBe(getRate(false, true, false, type, i));
        expect(getRate(true, false, true, type, i)).toBe(getRate(true, true, false, type, i));
      }
    }
  });

  it('idx เกิน 19 ถูก clamp ที่ +20', () => {
    const last = RATE_TABLES.noevent.normal.armor1[19];
    expect(getRate(false, false, false, 'armor1', 25)).toBe(last);
    expect(getRate(false, false, false, 'armor1', 19)).toBe(last);
  });

  it('event บูสต์หินธรรมดาเฉพาะ weapon5/armor2 (มี * ใน iROWiki)', () => {
    // weapon5: noevent.normal idx10 = 8, event.normal idx10 = 16 (asterisk column)
    expect(getRate(true, false, false, 'weapon5', 10)).toBe(RATE_TABLES.event.normal.weapon5[10]);
    expect(getRate(true, false, false, 'weapon5', 10)).not.toBe(getRate(false, false, false, 'weapon5', 10));
    expect(getRate(true, false, false, 'armor2', 10)).not.toBe(getRate(false, false, false, 'armor2', 10));
  });

  it('event ไม่บูสต์หินธรรมดาของ weapon1-4/armor1 (ไม่มี * → เท่า noevent)', () => {
    for (const type of ['armor1', 'weapon1', 'weapon2', 'weapon3', 'weapon4']) {
      expect(getRate(true, false, false, type, 10)).toBe(getRate(false, false, false, type, 10));
    }
  });

  it('cash (HD) ใช้ตาราง cash', () => {
    expect(getRate(false, true, false, 'armor1', 4)).toBe(RATE_TABLES.noevent.cash.armor1[4]);
  });

  it('useEnriched อ่านตาราง cash (useCash || useEnriched)', () => {
    // ไม่ว่า useCash จะ true/false ถ้า useEnriched=true ต้องได้ค่าจากตาราง cash
    expect(getRate(false, true, true, 'armor1', 4)).toBe(getRateTable(false, true).armor1[4]);
    expect(getRate(false, false, true, 'armor1', 4)).toBe(getRateTable(false, true).armor1[4]);
  });
});
