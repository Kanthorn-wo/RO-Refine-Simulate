// Monte Carlo simulation engine — pure functions, no React state.
// กติกาผลตี/ล้มเหลว mirror มาจาก handleRefine ใน Layout ทุกสาขา (อย่าแก้ฝั่งเดียว):
//   - สำเร็จ → +1
//   - ล้ม + BSB คุ้มกัน (destination +8..+15, bsbTable > 0) → ระดับเดิม, นับ BSB
//   - weapon5/armor2: level >= 10 → ไอเทมหาย, ต่ำกว่า → ลด (enriched −1, อื่น −3, clamp 0)
//   - ประเภทอื่น: HD → ลด 1 (ถ้า > 0), หินปกติ/Enriched → ไอเทมหาย
// model เมื่อไอเทมหาย: เริ่มไอเทมใหม่ที่ startLevel แล้วนับต่อในรอบเดิม
import { getRate } from '../constants/refineRates';
import { getOreName } from '../constants/ores';
import { getEffectiveStone } from './stones';

// เพดานจำนวนตีต่อรอบ กัน loop ไม่จบ (เช่น เป้าสูง + rate ต่ำมาก)
export const MAX_ATTEMPTS_PER_ROUND = 50000;

export const simulateRound = ({ itemType, startLevel, targetLevel, stone, useBSB, isEventRate, bsbTable }) => {
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  let level = startLevel;
  let attempts = 0;
  let successes = 0;
  let bsbUsed = 0;
  let itemsLost = 0;
  let levelDrops = 0;
  let oresTotal = 0;
  const ores = {};
  let aborted = false;

  while (level < targetLevel) {
    if (attempts >= MAX_ATTEMPTS_PER_ROUND) { aborted = true; break; }
    attempts++;
    const eff = getEffectiveStone(stone, itemType, level);
    const useCash = eff === 'hd';
    const useEnriched = eff === 'enriched';
    const oreName = getOreName(itemType, level, useCash, useEnriched);
    if (oreName) {
      ores[oreName] = (ores[oreName] || 0) + 1;
      oresTotal++;
    }
    const rate = getRate(isEventRate, useCash, useEnriched, itemType, level) / 100;
    if (Math.random() < rate) {
      level++;
      successes++;
      continue;
    }
    // fail — ลำดับสาขาเดียวกับ handleRefine
    const currentLevel = level + 1;
    let bsbCost = 0;
    if (useBSB && currentLevel >= 8 && currentLevel <= 15) {
      bsbCost = bsbTable[currentLevel - 1] || 0;
    }
    if (bsbCost > 0) {
      bsbUsed += bsbCost; // BSB คุ้มกัน — ระดับเดิม
    } else if (isSpecial) {
      if (level >= 10) {
        itemsLost++;
        level = startLevel;
      } else {
        const drop = useEnriched ? 1 : 3;
        const newLevel = Math.max(0, level - drop);
        levelDrops += level - newLevel;
        level = newLevel;
      }
    } else if (useCash && level > 0) {
      levelDrops++;
      level--;
    } else if (!useCash) {
      itemsLost++;
      level = startLevel;
    }
  }

  const fails = attempts - successes;
  return { attempts, successes, fails, bsbUsed, itemsLost, levelDrops, ores, oresTotal, aborted };
};

// สถิติพื้นฐานของชุดตัวเลข: mean / sd (population) / median / p90 / min / max
export const summarize = (values) => {
  const n = values.length;
  if (!n) return { mean: 0, sd: 0, median: 0, p90: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(n - 1, Math.round(p * (n - 1)))];
  return { mean, sd, median: q(0.5), p90: q(0.9), min: sorted[0], max: sorted[n - 1] };
};

// แบ่งค่าเป็น bin สำหรับ histogram → [{ x0, x1, count }]
export const buildHistogram = (values, binCount) => {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ x0: min, x1: max + 1, count: values.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }));
  values.forEach((v) => {
    const i = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[i].count++;
  });
  return bins;
};
