import { describe, it, expect, vi, afterEach } from 'vitest';
import { simulateRound, summarize, buildHistogram, MAX_ATTEMPTS_PER_ROUND } from './simulate';

// ป้อนลำดับค่า Math.random ที่กำหนดเอง (ค่าสุดท้ายถูกใช้ซ้ำถ้า roll เกินคิว)
const queueRandom = (vals) => {
  let i = 0;
  return vi.spyOn(Math, 'random').mockImplementation(() =>
    i < vals.length ? vals[i++] : vals[vals.length - 1]
  );
};

const noBsb = Array(21).fill(0);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('simulateRound', () => {
  it('สำเร็จทุกครั้ง → ตี = จำนวนช่วง ไม่มีหายไม่มีลด', () => {
    queueRandom([0]); // roll 0 < rate เสมอ
    const r = simulateRound({
      itemType: 'armor1', startLevel: 4, targetLevel: 7,
      stone: 'normal', useBSB: false, isEventRate: false, bsbTable: noBsb,
    });
    expect(r.successes).toBe(3);
    expect(r.attempts).toBe(3);
    expect(r.fails).toBe(0);
    expect(r.itemsLost).toBe(0);
    expect(r.levelDrops).toBe(0);
    expect(r.oresTotal).toBe(3);
    expect(r.aborted).toBe(false);
  });

  it('HD ล้ม (item ปกติ) → ลดระดับ 1 ไม่หาย', () => {
    // weapon1 +7→+8 HD: rate noevent cash idx7 = 90%
    // attempt1 lvl7 roll0.95 ล้ม → ลด→6 ; lvl6 HD ต่ำกว่า min7 → normal idx6=100% สำเร็จ→7 ; lvl7 roll0 สำเร็จ→8
    queueRandom([0.95, 0.5, 0.0]);
    const r = simulateRound({
      itemType: 'weapon1', startLevel: 7, targetLevel: 8,
      stone: 'hd', useBSB: false, isEventRate: false, bsbTable: noBsb,
    });
    expect(r.itemsLost).toBe(0);
    expect(r.levelDrops).toBe(1);
    expect(r.fails).toBe(1);
    expect(r.successes).toBe(2);
    expect(r.attempts).toBe(3);
  });

  it('BSB ป้องกันผลล้ม + ถูกหักทุก attempt (ตีติดก็เสีย)', () => {
    const bsb = Array(21).fill(0);
    bsb[10] = 5; // ใช้ตอน currentLevel 11 (= bsbTable[currentLevel-1])
    // weapon5 +10→+11 HD, rate noevent cash idx10 = 20%
    // attempt1 roll0.99 ล้ม → BSB คุ้ม (อยู่ที่ 10) หัก5 ; attempt2 roll0 สำเร็จ→11 หักอีก5
    queueRandom([0.99, 0.0]);
    const r = simulateRound({
      itemType: 'weapon5', startLevel: 10, targetLevel: 11,
      stone: 'hd', useBSB: true, isEventRate: false, bsbTable: bsb,
    });
    expect(r.itemsLost).toBe(0);
    expect(r.bsbUsed).toBe(10);
    expect(r.successes).toBe(1);
    expect(r.fails).toBe(1);
    expect(r.attempts).toBe(2);
  });

  it('special low-range หินปกติล้ม → ลด 3 (clamp 0)', () => {
    // weapon5 +1 (stackLen เริ่ม 1) → ล้มลด 3 แต่ clamp 0
    // ใช้ start 1 target 2: rate weapon5 idx1 = 100% จึงไม่ล้ม → ใช้ start ที่ rate<100
    // weapon5 +3 (idx3=80) start3 target4 normal
    // attempt1 lvl3 roll0.99 ล้ม → ลด3 → 0 (levelDrops+=3) ; lvl0 idx0=100% สำเร็จ→1 ...
    // ไล่จน success ถึง 4 — ตรวจว่ามี levelDrop และไม่มี itemLost (special low ไม่หาย)
    queueRandom([0.99, 0.0]); // ล้มครั้งแรก จากนั้น 0 = สำเร็จช่วง <100, ช่วง 100 สำเร็จอยู่แล้ว
    const r = simulateRound({
      itemType: 'weapon5', startLevel: 3, targetLevel: 4,
      stone: 'normal', useBSB: false, isEventRate: false, bsbTable: noBsb,
    });
    expect(r.itemsLost).toBe(0);
    expect(r.levelDrops).toBeGreaterThanOrEqual(3);
    expect(r.successes).toBeGreaterThanOrEqual(1);
  });

  it('item ปกติหินปกติล้มตลอด → item หายวนไม่ถึงเป้า → abort ที่เพดาน', () => {
    queueRandom([0.999]); // ล้มเสมอ (rate < 100)
    const r = simulateRound({
      itemType: 'armor1', startLevel: 5, targetLevel: 6,
      stone: 'normal', useBSB: false, isEventRate: false, bsbTable: noBsb,
    });
    expect(r.aborted).toBe(true);
    expect(r.attempts).toBe(MAX_ATTEMPTS_PER_ROUND);
    expect(r.successes).toBe(0);
    expect(r.itemsLost).toBe(MAX_ATTEMPTS_PER_ROUND);
  });
});

describe('summarize', () => {
  it('ชุดว่าง → ศูนย์ทั้งหมด', () => {
    expect(summarize([])).toEqual({ mean: 0, sd: 0, median: 0, p90: 0, min: 0, max: 0 });
  });

  it('คำนวณ mean/sd/median/p90/min/max', () => {
    const s = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.mean).toBe(5);
    expect(s.sd).toBe(2);
    expect(s.median).toBe(5);
    expect(s.p90).toBe(7);
    expect(s.min).toBe(2);
    expect(s.max).toBe(9);
  });
});

describe('buildHistogram', () => {
  it('ค่าเท่ากันหมด → bin เดียว', () => {
    expect(buildHistogram([3, 3, 3], 5)).toEqual([{ x0: 3, x1: 4, count: 3 }]);
  });

  it('แบ่ง bin + ขอบบนเข้า bin สุดท้าย', () => {
    const bins = buildHistogram([0, 10], 2);
    expect(bins).toHaveLength(2);
    expect(bins[0].count).toBe(1);
    expect(bins[1].count).toBe(1);
  });

  it('ชุดว่าง → []', () => {
    expect(buildHistogram([], 5)).toEqual([]);
  });
});
