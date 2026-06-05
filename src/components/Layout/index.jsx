import React, { useEffect, useState, useRef } from 'react';
import HeroBanner from '../HeroBanner';
import { APP_VERSION } from '../../version';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import bsbImg from 'assets/images/blacksmith_blessing.png';
import { BSB_REQUIRED_NORMAL, BSB_REQUIRED_EVENT } from '../../constants/refineConfig';
import Toggle from '../Toggle';
import { getRate } from '../../constants/refineRates';
import { STONE_META, getStoneMinLevel, getEffectiveStone, getPlannedStone, toggleHasMeaning } from '../../utils/stones';
import { ITEM_TYPE_LABELS, ORE_COLORS, ORE_IMAGES, getOreName, getStoneOre, STONE_REFERENCE } from '../../constants/ores';
import { frameCount, WAITING_FRAMES, PROCESSING_FRAMES, SUCCESS_FRAMES, FAIL_FRAMES, ALL_FRAMES } from '../../constants/frames';

// API ของ divine-pride สำหรับค้นไอเทมจาก ID
// หมายเหตุ: เว็บเป็น static site คีย์นี้จะถูก build ติดไปกับ JS และเป็นสาธารณะ
const DIVINE_PRIDE_API_KEY = '7a8b539b5e6171b362a6ef264e43dffc';

// ── ระบบช่วงหิน Auto: กำแพงที่จุดเปลี่ยนแร่ ───────────────────────────────
// แร่เปลี่ยน low→high ที่ destination +11 (low ≤+10 / high ≥+11) → ช่วงห้ามคร่อมกำแพงนี้
const STONE_WALLS = [11];
const isWallFrom = (from) => STONE_WALLS.includes(from);

// หิน stone ใช้ได้ในห้องของ destination `from` ไหม (validity คิดจาก source = from-1)
const stoneValidInRoom = (itemType, from, stone) => {
  if (stone === 'enriched') return from <= 10;                         // Enriched เฉพาะห้อง low (+1~+10)
  if (stone === 'hd') return from > getStoneMinLevel('hd', itemType);  // HD ใช้ได้เมื่อ source≥min → destination>min (8 ปกติ / 11 special)
  return true;                                                          // normal ใช้ได้เสมอ
};

// หินที่ดีที่สุดของห้องที่ destination `from` อยู่: Enriched (โอกาสสูง) > HD (กันหาย เฉพาะ item ปกติ) > ปกติ
const bestStoneForRoom = (itemType, from) => {
  if (stoneValidInRoom(itemType, from, 'enriched')) return 'enriched';
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  if (!isSpecial && stoneValidInRoom(itemType, from, 'hd')) return 'hd';
  return 'normal';
};

// ปรับ stone rules ให้ถูกเสมอ: rule แรก = start+1, มีกำแพงที่จุดเปลี่ยนแร่ (ช่วงไม่คร่อม),
// ตัด rule นอกช่วง, หินทุกช่วง valid ต่อห้อง (ถ้าไม่ valid → ใช้หินที่ดีที่สุดของห้อง)
const normalizeStoneRules = (rules, start, target, itemType, nextIdRef) => {
  const minFrom = Math.max(1, start + 1);
  const cap = Math.max(minFrom, target);
  const byFrom = new Map();
  for (const r of rules) {
    if (r.from >= minFrom && r.from <= cap && !byFrom.has(r.from)) byFrom.set(r.from, r);
  }
  const froms = new Set([minFrom, ...byFrom.keys()]);
  for (const w of STONE_WALLS) if (minFrom < w && w <= cap) froms.add(w); // span คร่อมกำแพง → ใส่ขอบที่กำแพง
  return [...froms].sort((a, b) => a - b).map((from) => {
    const existing = byFrom.get(from);
    let stone = existing ? existing.stone : bestStoneForRoom(itemType, from);
    if (!stoneValidInRoom(itemType, from, stone)) stone = bestStoneForRoom(itemType, from);
    return existing ? { ...existing, stone } : { id: nextIdRef.current++, from, stone, stopOnLoss: false, bsb: false };
  });
};

const Container = () => {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState('wait'); // 'wait' หรือ 'process'
  const [isSuccessLoop, setIsSuccessLoop] = useState(false);
  const [stack, setStack] = useState([]);
  const [isFail, setIsFail] = useState(false);
  const [lastResult, setLastResult] = useState(null); // 'success' | 'fail' | null
  const [useCash, setUseCash] = useState(false); // true = หิน HD (ล้มลดระดับ)
  const [useEnriched, setUseEnriched] = useState(false); // true = หิน Enriched (Cash ล้มหาย + โอกาสสูง)
  const [isItemLost, setIsItemLost] = useState(false);
  const [log, setLog] = useState([]); // log สำหรับแสดงผลทุก action
  const [useBSB, setUseBSB] = useState(false);
  const [itemType, setItemType] = useState('armor1'); // เพิ่ม state สำหรับประเภทไอเท็ม
  const [isEventRate, setIsEventRate] = useState(false); // false = ไม่มี event, true = Event Rate Up
  const bsbTable = isEventRate ? BSB_REQUIRED_EVENT : BSB_REQUIRED_NORMAL;
  const intervalRef = useRef(null);
  // เมื่อ true: เข้าโหมด success แบบนิ่งทันที (ข้าม intro animation ตีบวก) ใช้ตอนเลือกระดับเริ่มต้น
  const skipSuccessIntroRef = useRef(false);

  // BSB ใช้ได้แค่ตีจาก +7 ถึง +14 → +15 เท่านั้น (stack.length 7..14)
  const bsbInRange = stack.length >= 7 && stack.length <= 14 && (bsbTable[stack.length] || 0) > 0;

  // แสดงภาพ wait แบบวนลูปเมื่อไม่ได้ process
  useEffect(() => {
    if (mode === 'wait') {
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % frameCount.waiting);
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode]);

  // แสดงภาพ process ทีละเฟรม (ไม่วน)
  useEffect(() => {
    if (mode === 'process') {
      let i = 0;
      setIndex(0);
      intervalRef.current = setInterval(() => {
        i++;
        if (i < frameCount.processing) {
          setIndex(i);
        } else {
          clearInterval(intervalRef.current);
          setTimeout(() => {
            if (isFail) {
              setMode('fail');
              setIndex(14);
            } else {
              setMode('success');
              setIndex(0);
            }
          }, 100);
        }
      }, 80);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode, isFail]);

  // แสดงภาพ success ทีละเฟรม (ไม่วน)
  useEffect(() => {
    if (mode === 'success') {
      // เลือกระดับเริ่มต้นมาเลย: ข้าม animation ตีบวก ไปนิ่งที่ frame success loop ทันที
      if (skipSuccessIntroRef.current) {
        skipSuccessIntroRef.current = false;
        setIsSuccessLoop(true);
        setIndex(9);
        return;
      }
      setIsSuccessLoop(false);
      let i = 0;
      setIndex(0);
      intervalRef.current = setInterval(() => {
        i++;
        if (i < frameCount.success) {
          setIndex(i);
        } else {
          clearInterval(intervalRef.current);
          setIsSuccessLoop(true); // เริ่มวน success 09-16
          setIndex(9);
        }
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode]);

  // วน success 09-16
  useEffect(() => {
    if (mode === 'success' && isSuccessLoop) {
      let i = 9;
      setIndex(9);
      intervalRef.current = setInterval(() => {
        i++;
        if (i > 16) i = 9;
        setIndex(i);
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode, isSuccessLoop]);

  // แสดงภาพ fail วน 14-19
  useEffect(() => {
    if (mode === 'fail') {
      let i = 15;
      setIndex(15);
      intervalRef.current = setInterval(() => {
        i++;
        if (i > 19) i = 15;
        setIndex(i);
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode]);

  // State สำหรับนับจำนวนไอเทมที่ใช้
  const [bsbUsedTotal, setBsbUsedTotal] = useState(0);
  const [oreUsed, setOreUsed] = useState({}); // นับแร่ที่ใช้ แยกตามชื่อแร่
  // สกุลเงินที่ใช้คำนวณราคา ('zenny' | 'baht') และราคาต่อหน่วยของแต่ละไอเทม
  const [currency, setCurrency] = useState('zenny'); // หน่วยเงินรวม (global) ใช้เป็นค่าตั้งต้นของทุกแถว
  const [rowCurrency, setRowCurrency] = useState({}); // override หน่วยเงินรายแถว { key: 'zenny'|'baht' }
  const [prices, setPrices] = useState({ normal: '', enriched: '', cash: '', bsb: '' });
  // โหมดเลือกไอเทม: 'dropdown' (เลือกเอง) หรือ 'id' (ค้นจาก Item ID ผ่าน API)
  const [inputMode, setInputMode] = useState('dropdown');
  const [itemIdInput, setItemIdInput] = useState('');
  const [apiItem, setApiItem] = useState(null); // ผลลัพธ์จาก API ที่ค้นมา
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showItemInfo, setShowItemInfo] = useState(false); // accordion ข้อมูลไอเทม
  const [showStoneModal, setShowStoneModal] = useState(false);
  // ระบบ Auto ตีบวก: ตีอัตโนมัติจนถึงเป้าหมายที่ตั้งไว้
  const [autoRefine, setAutoRefine] = useState(false); // เปิด/ปิดโหมด auto
  const [autoStart, setAutoStart] = useState(0); // ระดับเริ่มต้นของ auto (แยกจาก global start)
  const [autoTarget, setAutoTarget] = useState(10); // เป้าหมายระดับ (+N) ที่จะตีถึง
  const [autoRunning, setAutoRunning] = useState(false); // กำลังตี auto อยู่
  // แผนชนิดหินแต่ละช่วงระหว่าง auto: รายการ { id, from, stone, stopOnLoss }
  const [autoStoneRules, setAutoStoneRules] = useState([{ id: 0, from: 1, stone: 'enriched', stopOnLoss: false, bsb: false }]);
  const nextRuleId = useRef(1);
  const [autoUseBSB, setAutoUseBSB] = useState(false); // เปิด/ปิดการใส่ BSB อัตโนมัติระหว่าง auto
  // BSB คุมเป็น flag ต่อช่วง (rule.bsb) แล้ว — ไม่ใช้ start/end window อีก (ภายใต้กฎ BSB ใช้ได้ +7→+14)

  const handleRefine = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setMode('process');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsItemLost(false);
    setLastResult(null);
    // คำนวณ level ปัจจุบัน (stack.length + 1)
    const currentLevel = stack.length + 1;
    // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน (Enriched บวกโบนัส)
    const rate = getRate(isEventRate, useCash, useEnriched, itemType, currentLevel - 1) / 100;
    const roll = Math.random();
    const isSuccess = roll < rate;
    // รายละเอียดการสุ่ม: บอกโอกาสติด/แตก แล้วระบุว่าผลออกฝั่งไหน ที่ค่ากี่ %
    const rollPct = roll * 100;
    const successPct = rate * 100;
    const failPct = 100 - successPct;
    const rollDetail = `โอกาสติด ${successPct.toFixed(2)}% / โอกาสแตก ${failPct.toFixed(2)}% → ผลออกฝั่ง${isSuccess ? 'สำเร็จ' : 'แตก'} ที่ ${rollPct.toFixed(2)}%`;
    let newStack = [...stack];
    let logMsg = '';
    let playFailSound = false;
    let bsbUsed = 0;
    // เช็ค BSB เงื่อนไข — เปิด toggle และอยู่ในช่วง +7..+14 (ไม่จำกัดจำนวนแล้ว)
    let canUseBSB = false;
    if (useBSB && currentLevel >= 8 && currentLevel <= 15) {
      bsbUsed = bsbTable[currentLevel - 1] || 0;
      canUseBSB = bsbUsed > 0;
    }
    // นับจำนวนไอเทมที่ใช้
    // นับแร่ที่ใช้ตามประเภทไอเท็มและระดับเป้าหมาย (แร่ = หินที่ใช้ตีจริง)
    const oreName = getOreName(itemType, stack.length, useCash, useEnriched);
    if (oreName) {
      setOreUsed(prev => ({ ...prev, [oreName]: (prev[oreName] || 0) + 1 }));
    }
    if (!isSuccess && canUseBSB) {
      setBsbUsedTotal(prev => prev + bsbUsed);
    }
    if (isSuccess) {
      newStack.push({ time: new Date().toLocaleTimeString() });
      logMsg = `+${stack.length} → +${stack.length + 1} : สำเร็จ`;
    } else if (canUseBSB) {
      // ใช้ BSB ป้องกันการลดระดับและการหายของไอเทม (ทั้งหินธรรมดาและแครช)
      logMsg = `+${stack.length} → +${stack.length} : ล้มเหลว (ใช้ BSB ${bsbUsed} ชิ้น ป้องกัน${useCash ? 'ลดระดับ' : 'ไอเทมหาย'})`;
    } else if (itemType === 'weapon5' || itemType === 'armor2') {
      if (stack.length >= 10) {
        // High range (+10+): ล้มแล้วหายทุกกรณี (ทั้ง Etel ปกติ และ HD Etel)
        // BSB ในช่วงที่ใช้ได้จะถูกเช็คและจัดการก่อนถึงบรรทัดนี้แล้ว
        setIsItemLost(true);
        newStack = [];
        logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย)`;
        playFailSound = true;
      } else {
        // Low range (+0~9): ไม่แตกทุกกรณี — enriched=-1, normal=-3, HD fallback เป็น normal=-3
        const drop = useEnriched ? 1 : 3;
        const newLevel = Math.max(0, stack.length - drop);
        const actualDrop = stack.length - newLevel;
        newStack = newStack.slice(0, newLevel);
        logMsg = `+${stack.length} → +${newLevel} : ล้มเหลว (ลดระดับ ${actualDrop} ขั้น)`;
      }
    } else if (useCash && stack.length > 0) {
      // หินแครชไม่ใช้ BSB - ลดระดับ (ประเภทอื่น)
      newStack = newStack.slice(0, -1);
      logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ)`;
    } else if (!useCash) {
      // หินธรรมดาไม่ใช้ BSB - ไอเทมหาย (ประเภทอื่น)
      setIsItemLost(true);
      newStack = [];
      logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย)`;
      playFailSound = true;
    }
    logMsg = `${logMsg} — ${rollDetail}`;
    setStack(newStack);
    setLog(prev => [...prev, {
      msg: logMsg,
      itemType,
      useCash,
      useEnriched,
      useBSB,
      bsbConsumed: (!isSuccess && canUseBSB) ? bsbUsed : 0,
      isSuccess,
      oreName: oreName || null,
    }]);
    setIsFail(!isSuccess);

    // เช็คเงื่อนไขการเล่นเสียงและสิ้นสุดเกม
    if (playFailSound) {
      // ไอเทมถูกทำลาย/หาย = เล่นเสียง fail อย่างเดียวแล้วจบ
      const soundEffectFailOnly = new Audio(souneEffectFail);
      soundEffectFailOnly.play();
      soundEffectFailOnly.onended = () => {
        setIsPlaying(false);
        setLastResult('fail');
      };
      return;
    }
    const soundEffect01 = new Audio(souneEffect01);
    const soundEffect02 = new Audio(souneEffect02);
    const soundEffectFinal = isSuccess ? new Audio(souneEffectSuccess) : new Audio(souneEffectFail);
    soundEffect01.play();
    soundEffect01.onended = () => {
      soundEffect02.play();
      soundEffect02.onended = () => {
        soundEffectFinal.play();
        soundEffectFinal.onended = () => {
          setIsPlaying(false);
          setLastResult(isSuccess ? 'success' : 'fail');
        };
      };
    };
  };

  // Auto ตีบวก: เมื่อรอบที่แล้วจบ (isPlaying = false) ให้ตีต่อจนถึงเป้าหรือไอเทมหาย
  useEffect(() => {
    if (!autoRunning) return;
    if (isPlaying || mode === 'process') return; // รอ animation/เสียงรอบนี้จบก่อน
    // หยุดเมื่อถึงเป้าหมาย
    if (stack.length >= autoTarget) {
      setAutoRunning(false);
      if (autoUseBSB) setUseBSB(false); // reset BSB ที่ auto เปิดไว้
      return;
    }
    // หยุดเมื่อไอเทมหาย (ต้องเริ่มไอเทมใหม่)
    if (isItemLost) { setAutoRunning(false); return; }
    // ปรับชนิดหินตามแผนของระดับถัดไป (currentLevel = stack.length + 1) ก่อน แล้วรอ re-render ค่อยตี
    const rawStone = getPlannedStone(autoStoneRules, stack.length + 1);
    const plannedStone = getEffectiveStone(rawStone, itemType, stack.length);
    const wantCash = plannedStone === 'hd';
    const wantEnriched = plannedStone === 'enriched';
    if (wantCash !== useCash || wantEnriched !== useEnriched) {
      setUseCash(wantCash);
      setUseEnriched(wantEnriched);
      return;
    }
    // rule ที่คุมระดับถัดไป (currentLevel = stack.length + 1)
    const applicableRule = [...autoStoneRules].sort((a, b) => b.from - a.from).find(r => r.from <= stack.length + 1);
    // ใส่/ถอด BSB ตาม flag ของช่วง (ภายใต้กฎ BSB ใช้ได้ +7→+14)
    if (autoUseBSB) {
      const wantBSB = !!applicableRule?.bsb && stack.length >= 7 && stack.length <= 14 && (bsbTable[stack.length] || 0) > 0;
      if (wantBSB !== useBSB) {
        setUseBSB(wantBSB);
        return;
      }
    }
    if (applicableRule?.stopOnLoss) {
      const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
      const wouldLoseOnFail = isSpecial ? stack.length >= 10 : !wantCash;
      const bsbProtects = useBSB && stack.length >= 7 && stack.length <= 14 && (bsbTable[stack.length] || 0) > 0;
      const currentRate = getRate(isEventRate, wantCash, wantEnriched, itemType, stack.length);
      if (wouldLoseOnFail && !bsbProtects && currentRate < 100) {
        setAutoRunning(false);
        if (autoUseBSB) setUseBSB(false);
        return;
      }
    }
    const t = setTimeout(() => handleRefine(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunning, isPlaying, mode, stack.length, isItemLost, autoTarget, autoStoneRules, useCash, useEnriched, autoUseBSB, useBSB, itemType, bsbTable, isEventRate]);

  // target ต้อง > start เสมอ
  useEffect(() => {
    setAutoTarget(t => (t <= autoStart ? Math.min(autoStart + 1, 20) : t));
  }, [autoStart]);

  // เปลี่ยน autoStart → อัปเดต stack preview ทันที (dropdown disabled ขณะ running อยู่แล้ว)
  const handleAutoStartChange = (level) => {
    setAutoStart(level);
    const now = new Date().toLocaleTimeString();
    setStack(Array.from({ length: level }, () => ({ time: now })));
    setIsFail(false);
    setIsItemLost(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseBSB(false);
    if (level > 0) {
      // เริ่มที่ระดับ > 0: โชว์ frame success แบบนิ่ง ให้ตรงกับตำแหน่งปุ่ม (เคสเดียวกับ handleStartLevelChange)
      setIsSuccessLoop(true);
      setIndex(9);
      if (mode !== 'success') {
        skipSuccessIntroRef.current = true;
        setMode('success');
      }
    } else {
      setMode('wait');
      setIndex(0);
      setIsSuccessLoop(false);
    }
  };

  // เริ่ม/หยุด auto ตีบวก
  const handleStartAuto = () => {
    if (autoRunning || isPlaying) return;
    if (autoStart >= autoTarget) return;
    // reset stack ไปที่ autoStart เสมอเมื่อเริ่ม auto session ใหม่
    const now = new Date().toLocaleTimeString();
    setStack(Array.from({ length: autoStart }, () => ({ time: now })));
    setMode('wait');
    setIndex(0);
    setIsFail(false);
    setIsItemLost(false);
    setIsSuccessLoop(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseBSB(false);
    setAutoRunning(true);
  };
  const handleStopAuto = () => {
    setAutoRunning(false);
    // reset BSB ที่ auto เปิดไว้ กันค้างหลัง auto หยุด
    if (autoUseBSB) setUseBSB(false);
  };

  const handleClearSession = () => {
    setLog([]);
    setOreUsed({});
    setBsbUsedTotal(0);
  };

  // จัดการแผนชนิดหินแต่ละช่วง (auto)
  const updateRuleStone = (id, stone) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, stone, stopOnLoss: false } : r));
  const updateRuleStopOnLoss = (id, value) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, stopOnLoss: value } : r));
  const updateRuleBSB = (id, value) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, bsb: value } : r));

  // ปรับช่วงหินให้ถูกเสมอเมื่อ start/target/itemType เปลี่ยน (ใส่กำแพง, ตัดนอกช่วง, หิน valid ต่อห้อง)
  // + เคลียร์ stopOnLoss ที่หมดความหมาย
  useEffect(() => {
    setAutoStoneRules((rs) => {
      const normalized = normalizeStoneRules(rs, autoStart, autoTarget, itemType, nextRuleId);
      return normalized.map((r, i) => {
        const toLevel = normalized[i + 1] ? normalized[i + 1].from - 1 : autoTarget;
        if (r.stopOnLoss && !toggleHasMeaning(r.stone, itemType, r.from, toLevel, isEventRate, autoUseBSB, r.bsb, bsbTable)) {
          return { ...r, stopOnLoss: false };
        }
        return r;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, autoTarget, itemType, isEventRate, autoUseBSB]);
  // แก้ระดับเริ่มของช่วง → ต้องมากกว่าช่วงก่อนหน้า แล้ว normalize (ใส่กำแพง/แก้หินให้เอง)
  const updateRuleFrom = (id, newFrom) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0 || isWallFrom(rs[idx].from)) return rs; // ช่วงแรก + กำแพง ล็อก
    const next = rs.map(r => ({ ...r }));
    next[idx].from = Math.max(newFrom, next[idx - 1].from + 1);
    return normalizeStoneRules(next, autoStart, autoTarget, itemType, nextRuleId);
  });
  // ซอยช่วงนี้เป็น 2 (แบ่ง ~กึ่งกลางในห้องเดิม) — คัดลอกหินจากช่วงเดิม แล้ว normalize
  const splitStoneRule = (id) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx < 0) return rs;
    const rule = rs[idx];
    const toLevel = rs[idx + 1] ? rs[idx + 1].from - 1 : autoTarget;
    if (rule.from >= toLevel) return rs; // ช่วงกว้าง 1 ระดับ ซอยไม่ได้
    const mid = rule.from + Math.ceil((toLevel - rule.from + 1) / 2); // ขอบใหม่ ~กึ่งกลาง
    const inserted = [
      ...rs.slice(0, idx + 1),
      { id: nextRuleId.current++, from: mid, stone: rule.stone, stopOnLoss: false, bsb: rule.bsb },
      ...rs.slice(idx + 1),
    ];
    return normalizeStoneRules(inserted, autoStart, autoTarget, itemType, nextRuleId);
  });
  const removeStoneRule = (id) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0 || isWallFrom(rs[idx].from)) return rs; // ลบช่วงแรก + กำแพง ไม่ได้
    return normalizeStoneRules(rs.filter(r => r.id !== id), autoStart, autoTarget, itemType, nextRuleId);
  });

  const handleBackToWait = () => {
    setAutoRunning(false);
    setMode('wait');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsFail(false);
    setIsItemLost(false); // เคลียร์สถานะไอเทมหาย ไม่งั้นเริ่ม auto/ตีใหม่ไม่ได้
    setLastResult(null);
    // ถ้า auto เปิดอยู่ → reset กลับไปที่ autoStart เพื่อพร้อม session ถัดไป
    if (autoRefine) {
      const now = new Date().toLocaleTimeString();
      setStack(Array.from({ length: autoStart }, () => ({ time: now })));
    } else {
      setStack([]);
    }
  };

  // เลือกเริ่มที่ระดับตีบวกใด ๆ — กระโดดไประดับนั้นทันทีและเคลียร์ผลลัพธ์ค้าง
  // (rate/ปุ่ม/ตาราง derive จาก stack.length อยู่แล้ว จึงสอดคล้องกันเอง)
  const handleStartLevelChange = (level) => {
    setAutoRunning(false);
    const now = new Date().toLocaleTimeString();
    setStack(Array.from({ length: level }, () => ({ time: now })));
    setIsFail(false);
    setIsItemLost(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseBSB(false); // ช่วงที่ใช้ BSB ได้อาจเปลี่ยน จึงรีเซ็ต toggle
    if (level > 0) {
      // เริ่มที่ระดับ > 0: โชว์ frame success แบบนิ่ง (ไอเทมตีบวกแล้ว) ให้ตรงกับตำแหน่งปุ่ม "เริ่มอีกครั้ง"
      setIsSuccessLoop(true);
      setIndex(9);
      if (mode !== 'success') {
        skipSuccessIntroRef.current = true; // เข้า success แบบข้าม intro animation
        setMode('success');
      }
    } else {
      // เริ่มที่ +0: กลับไป frame wait + ปุ่ม "อัพเกรด" ตำแหน่งกลาง (เดิม)
      setMode('wait');
      setIndex(0);
      setIsSuccessLoop(false);
    }
  };

  // เลือกประเภทไอเท็ม = เริ่มตีบวกใหม่ตั้งแต่ +0 และเคลียร์ผลลัพธ์ค้าง
  const selectItemType = (type) => {
    setAutoRunning(false);
    setItemType(type);
    setStack([]);
    setMode('wait');
    setIndex(0);
    setIsFail(false);
    setIsItemLost(false);
    setIsSuccessLoop(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseEnriched(false); // weapon5/armor2 ไม่มี Enriched และเริ่มไอเทมใหม่จึงรีเซ็ต
  };

  // Enriched ใช้ได้เฉพาะ level < 10 — พอถึง +10 ขึ้นไปให้กลับไปหินปกติอัตโนมัติ
  useEffect(() => {
    if (useEnriched && stack.length >= 10) setUseEnriched(false);
  }, [useEnriched, stack.length]);
  // weapon5/armor2 ไม่มี HD ที่ +0~9 — ถ้าเลือก HD ไว้แล้วระดับลดลงมาให้กลับหินปกติ
  useEffect(() => {
    const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
    if (isSpecial && useCash && stack.length < 10) setUseCash(false);
  }, [itemType, useCash, stack.length]);

  // ค้นไอเทมจาก ID ผ่าน divine-pride API แล้วแยกประเภท (weapon/armor) อัตโนมัติ
  const handleFetchItem = async () => {
    const id = itemIdInput.trim();
    if (!id || apiLoading) return;
    setApiLoading(true);
    setApiError('');
    try {
      const res = await fetch(`https://www.divine-pride.net/api/database/Item/${id}?apiKey=${DIVINE_PRIDE_API_KEY}`);
      if (!res.ok) throw new Error(`เรียก API ไม่สำเร็จ (HTTP ${res.status})`);
      const data = await res.json();
      // แยกประเภทจาก itemTypeId (1=อาวุธ, 2=เกราะ) สำรองด้วย attack/defense
      let lvl = Number(data.itemLevel) || 1;
      // เคสพิเศษ: โล่ (shield = itemTypeId 2 + itemSubTypeId 514) มัก return itemLevel = null
      // ถ้าชื่อมี "LT" (เช่น -LT) ตัวพิมพ์ใหญ่ ถือเป็นโล่ Armor Level 2
      if (
        data.itemLevel == null &&
        data.itemTypeId === 2 &&
        data.itemSubTypeId === 514 &&
        /LT/.test(data.name || '')
      ) {
        lvl = 2;
      }
      let mapped;
      if (data.itemTypeId === 1 || (data.itemTypeId == null && data.attack > 0)) {
        mapped = `weapon${Math.min(Math.max(lvl, 1), 5)}`;
      } else if (data.itemTypeId === 2 || (data.itemTypeId == null && data.defense > 0)) {
        mapped = `armor${Math.min(Math.max(lvl, 1), 2)}`;
      } else {
        throw new Error('ไอเทมนี้ไม่ใช่อาวุธหรือเกราะที่ตีบวกได้');
      }
      setApiItem({
        id: data.id,
        name: data.name,
        aegisName: data.aegisName,
        type: mapped,
        itemLevel: lvl,
        attack: data.attack,
        defense: data.defense,
        weight: data.weight,
        requiredLevel: data.requiredLevel,
        slots: data.slots,
        imageUrl: `https://static.divine-pride.net/images/items/item/${data.id}.png`,
      });
      setShowItemInfo(true);
      selectItemType(mapped);
    } catch (err) {
      setApiItem(null);
      setApiError(err.message || 'ดึงข้อมูลไม่สำเร็จ');
    } finally {
      setApiLoading(false);
    }
  };

  // คำนวณอัตราสำเร็จปัจจุบัน
  const currentLevel = stack.length + 1;
  // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน (Enriched บวกโบนัส)
  // เช็คว่าหินที่เลือกอยู่ใช้ได้จริงที่ระดับปัจจุบันไหม (HD ต้องอยู่ในช่วง minLevel)
  const hdMinLevel = getStoneMinLevel('hd', itemType);
  const stoneBlocksRefine = useCash && stack.length < hdMinLevel;
  const currentRate = getRate(isEventRate, useCash, useEnriched, itemType, currentLevel - 1);
  // rate ของ "ระดับปัจจุบัน" (row +stack.length ในตาราง) สำหรับ banner — ต่างจาก currentRate ที่เป็น rate ของรอบถัดไป
  const bannerRate = getRate(isEventRate, useCash, useEnriched, itemType, Math.max(0, stack.length - 1));

  // preload all frames for each mode (เฟรมเป็นค่าคงที่ precompute ใน constants/frames.js)
  useEffect(() => {
    ALL_FRAMES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  // helper render รูปเฟรมตามโหมด
  const renderFrames = (frames, label) =>
    frames.map((src, i) => (
      <img
        key={src}
        src={src}
        alt={`${label}-frame-${i}`}
        className="absolute top-0 left-0 z-[1] h-auto w-full rounded-xl border-2 border-slate-700 bg-[#181a20] object-cover"
        style={{ display: index === i ? 'block' : 'none' }}
      />
    ));

  return (
    <>
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
      {/* Hero Banner */}
      <HeroBanner />

      {/* ตารางอัตราสำเร็จ */}
      <section aria-labelledby="rate-table-heading">
      <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4 shadow-lg shadow-black/30">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="rate-table-heading" className="m-0 text-base font-bold text-amber-300">
            ตารางอัตราสำเร็จการตีบวก (%) — {isEventRate ? 'Event Rate Up' : 'ไม่มี Event'} · {useEnriched ? 'Enriched' : useCash ? 'HD' : 'หินปกติ'}
          </h2>
          <div role="group" aria-label="Rate mode" className="inline-flex overflow-hidden rounded-lg border border-slate-600">
            <button
              type="button"
              onClick={() => setIsEventRate(false)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                !isEventRate ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ไม่มี Event
            </button>
            <button
              type="button"
              onClick={() => setIsEventRate(true)}
              className={`border-l border-slate-600 px-3 py-1.5 text-sm transition-colors ${
                isEventRate ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Event Rate Up
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[520px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-[#23272f]">
                <th className="min-w-[60px] border border-slate-800 p-1.5 text-amber-400">ระดับ</th>
                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                  <th key={key} className="min-w-[90px] truncate border border-slate-800 p-1.5 text-amber-400">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(20)].map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#23272f]' : 'bg-[#181a20]'}>
                  <td className="border border-slate-800 p-1.5 text-center font-bold text-amber-300">+{i + 1}</td>
                  {Object.keys(ITEM_TYPE_LABELS).map(type => (
                    <td
                      key={type}
                      className={`truncate border border-slate-800 p-1.5 text-center ${
                        type === itemType ? 'font-bold text-white' : 'text-slate-400'
                      }`}
                    >
                      {getRate(isEventRate, useCash, useEnriched, type, i)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </section>

      {/* แถวเดสก์ท็อป: กล่อง option (ซ้าย) + กล่องตีบวก (ขวา) — responsive ซ้อนแนวตั้ง */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      {/* การ์ดควบคุม: ประเภทไอเท็ม + toggle หิน + toggle BSB */}
      <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1">
        {/* ประเภทไอเท็ม: สลับระหว่างเลือกเอง (dropdown) หรือค้นจาก Item ID */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-semibold text-slate-300">ประเภทไอเท็ม</label>
          <div role="group" aria-label="โหมดเลือกไอเทม" className="inline-flex overflow-hidden rounded-lg border border-slate-600">
            <button
              type="button"
              onClick={() => setInputMode('dropdown')}
              className={`px-3 py-1 text-xs transition-colors ${
                inputMode === 'dropdown' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              เลือกเอง
            </button>
            <button
              type="button"
              onClick={() => setInputMode('id')}
              className={`border-l border-slate-600 px-3 py-1 text-xs transition-colors ${
                inputMode === 'id' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ค้นจาก ID
            </button>
          </div>
        </div>

        {inputMode === 'dropdown' ? (
          <div className="relative">
            <select
              id="item-type"
              value={itemType}
              onChange={e => selectItemType(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2.5 pr-10 font-bold text-amber-300 outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40"
            >
              {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key} className="bg-[#0f1117] text-amber-300">{label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-300">▾</span>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={itemIdInput}
                onChange={e => setItemIdInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFetchItem(); }}
                placeholder="ใส่ Item ID เช่น 610033"
                className="w-full rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2.5 text-white outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40"
              />
              <button
                type="button"
                onClick={handleFetchItem}
                disabled={apiLoading || !itemIdInput.trim()}
                className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 font-bold text-slate-900 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
              >
                {apiLoading ? 'กำลังค้น…' : 'ค้นหา'}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              คัดลอก Item ID ได้จาก{' '}
              <a
                href="https://www.divine-pride.net/database/item"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-300 underline decoration-dotted underline-offset-2 hover:text-amber-200"
              >
                divine-pride.net
              </a>
              {' '}แล้วนำเลข ID มาวางในช่องด้านบน
            </p>

            {apiError && (
              <p className="mt-2 text-sm text-red-400">{apiError}</p>
            )}

            {apiLoading ? (
              <div className="mt-3 flex items-center gap-3 overflow-hidden rounded-xl border border-slate-700/60 bg-[#0f1117] px-3 py-2.5">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-slate-700/60" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-700/60" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-700/50" />
                </div>
                <span className="shrink-0 text-xs text-amber-300">กำลังโหลด…</span>
              </div>
            ) : apiItem ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/60 bg-[#0f1117]">
                <button
                  type="button"
                  onClick={() => setShowItemInfo(v => !v)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <img
                    key={apiItem.id}
                    src={apiItem.imageUrl}
                    alt={apiItem.name}
                    className="h-11 w-11 shrink-0 object-contain"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-amber-300">{apiItem.name}</span>
                    <span className="block text-xs text-slate-400">
                      ID {apiItem.id} · {ITEM_TYPE_LABELS[apiItem.type]}
                    </span>
                  </span>
                  <span className="shrink-0 text-amber-300">{showItemInfo ? '▴' : '▾'}</span>
                </button>
                {showItemInfo && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-700/60 px-3 py-3 text-sm">
                    {(() => {
                      const isWeapon = apiItem.type.startsWith('weapon');
                      // อาวุธโชว์เฉพาะ Attack, เกราะโชว์เฉพาะ Defense
                      const fields = [
                        ['ประเภท', ITEM_TYPE_LABELS[apiItem.type]],
                        ['itemLevel', apiItem.itemLevel],
                        isWeapon ? ['Attack', apiItem.attack ?? '-'] : ['Defense', apiItem.defense ?? '-'],
                        ['น้ำหนัก', apiItem.weight ?? '-'],
                        ['Level ที่ใช้', apiItem.requiredLevel ?? '-'],
                        ['ช่องการ์ด', apiItem.slots ?? '-'],
                        ['Aegis name', apiItem.aegisName ?? '-'],
                      ];
                      return fields.map(([label, value]) => (
                        <div key={label} className="flex flex-col">
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="truncate font-medium text-slate-200">{value}</dd>
                        </div>
                      ));
                    })()}
                  </dl>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Dropdown เลือกระดับเริ่มต้น (manual) — dim เมื่อ auto เปิดอยู่ */}
        <div className={`transition-opacity ${autoRefine ? 'pointer-events-none opacity-40' : ''}`}>
          <label htmlFor="start-level" className="mt-4 mb-1.5 block text-sm font-semibold text-slate-300">
            เริ่มที่ระดับตีบวก
            {autoRefine && <span className="ml-2 text-xs font-normal text-slate-500">(Auto)</span>}
          </label>
          <div className="relative">
            <select
              id="start-level"
              value={stack.length}
              onChange={(e) => handleStartLevelChange(Number(e.target.value))}
              disabled={autoRefine}
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2.5 pr-10 font-bold text-amber-300 outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40 disabled:cursor-not-allowed"
            >
              {Array.from({ length: 20 }, (_, i) => (
                <option key={i} value={i} className="bg-[#0f1117] text-amber-300">+{i}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-300">▾</span>
          </div>
        </div>

        {/* ชนิดหินย้ายไปเลือกใน UI ตีบวก (stone slots) แล้ว */}

        {/* Toggle BSB */}
        <div
          className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
            bsbInRange ? 'border-emerald-600/50 bg-emerald-950/30' : 'border-slate-700/60 bg-[#0f1117]'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              Black Smith Blessing (BSB)
              {isEventRate && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[0.7rem] font-bold text-sky-300">Event Rate</span>
              )}
              {autoRunning && autoUseBSB && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[0.7rem] font-bold text-indigo-300">Auto</span>
              )}
              <span className="group relative inline-flex">
                <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-500 text-[0.6rem] font-bold text-slate-300">i</span>
                <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-48 rounded-lg border border-slate-600 bg-[#0f1117] p-2 text-xs font-normal shadow-lg group-hover:block">
                  <div className="mb-1 font-bold text-amber-300">BSB ที่ใช้ต่อระดับ ({isEventRate ? 'Event' : 'Normal'})</div>
                  <div className="space-y-0.5">
                    {bsbTable.map((qty, lvl) => qty > 0 ? (
                      <div key={lvl} className="flex justify-between">
                        <span className="text-slate-400">+{lvl} → +{lvl + 1}</span>
                        <span className="font-semibold text-emerald-300">{qty} ชิ้น</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {bsbInRange
                ? 'ใช้ได้ — กันลดระดับ/ไอเทมหายเมื่อล้มเหลว'
                : 'ใช้ได้เฉพาะช่วง +7 → +14'}
            </div>
          </div>
          <Toggle
            checked={useBSB}
            onChange={setUseBSB}
            disabled={!bsbInRange || (autoRefine && autoUseBSB)}
            activeColor="bg-emerald-500"
          />
        </div>

        {/* Toggle + เป้าหมาย Auto ตีบวก */}
        <div
          className={`mt-3 rounded-xl border px-4 py-3 transition-colors ${
            autoRefine ? 'border-indigo-500/50 bg-indigo-950/30' : 'border-slate-700/60 bg-[#0f1117]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Auto ตีบวก</div>
              <div className="mt-0.5 text-xs text-slate-400">ตีอัตโนมัติจนถึงเป้าหมายที่ตั้งไว้</div>
            </div>
            <Toggle
              checked={autoRefine}
              onChange={(v) => {
              setAutoRefine(v);
              if (!v) {
                setAutoRunning(false);
              } else {
                // เปิด auto → sync stack ให้ตรงกับ autoStart ทันที
                const now = new Date().toLocaleTimeString();
                setStack(Array.from({ length: autoStart }, () => ({ time: now })));
                setMode('wait');
                setIndex(0);
                setIsFail(false);
                setIsItemLost(false);
                setIsSuccessLoop(false);
                setLastResult(null);
                setIsPlaying(false);
                setUseBSB(false);
              }
            }}
              disabled={autoRunning}
              activeColor="bg-indigo-500"
            />
          </div>
          {autoRefine && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="auto-start" className="mb-1 block text-xs font-semibold text-slate-300">
                  เริ่มต้นที่
                </label>
                <div className="relative">
                  <select
                    id="auto-start"
                    value={autoStart}
                    onChange={(e) => handleAutoStartChange(Number(e.target.value))}
                    disabled={autoRunning}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2 pr-10 font-bold text-amber-300 outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {Array.from({ length: 20 }, (_, i) => (
                      <option key={i} value={i} className="bg-[#0f1117] text-amber-300">+{i}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-300">▾</span>
                </div>
              </div>
              <div>
                <label htmlFor="auto-target" className="mb-1 block text-xs font-semibold text-slate-300">
                  ตีถึงระดับ
                </label>
                <div className="relative">
                  <select
                    id="auto-target"
                    value={autoTarget}
                    onChange={(e) => setAutoTarget(Number(e.target.value))}
                    disabled={autoRunning}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2 pr-10 font-bold text-indigo-300 outline-none transition-colors hover:border-indigo-400/70 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {Array.from({ length: 20 - autoStart }, (_, i) => autoStart + i + 1).map(v => (
                      <option key={v} value={v} className="bg-[#0f1117] text-indigo-300">+{v}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300">▾</span>
                </div>
              </div>
            </div>
          )}
          {autoRefine && (
            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <div className="mb-1 text-sm font-semibold text-white">ชนิดหินแต่ละช่วง</div>
              <div className="mb-2 text-xs text-slate-400">กำหนดว่าช่วงระดับไหนใช้หินอะไร — auto จะสลับให้เอง</div>
              <div className="space-y-2">
                {autoStoneRules.map((rule, i) => {
                  const next = autoStoneRules[i + 1];
                  const toLevel = next ? next.from - 1 : autoTarget;
                  const minFrom = i === 0 ? Math.max(1, autoStart + 1) : autoStoneRules[i - 1].from + 1;
                  const isWall = i > 0 && isWallFrom(rule.from); // กำแพงเปลี่ยนแร่ — ล็อก
                  return (
                    <div key={rule.id} className="rounded-lg border border-slate-700 bg-[#0f1117] p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">ตั้งแต่</span>
                        <div className="relative">
                          <select
                            value={rule.from}
                            onChange={(e) => updateRuleFrom(rule.id, Number(e.target.value))}
                            disabled={autoRunning || i === 0 || isWall}
                            className="cursor-pointer appearance-none rounded-lg border border-slate-600 bg-[#181a20] py-1 pl-2 pr-6 text-sm font-bold text-indigo-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {Array.from({ length: Math.max(0, (next ? next.from - 1 : autoTarget) - minFrom + 1) }, (_, n) => minFrom + n).map((lvl) => (
                              <option key={lvl} value={lvl} className="bg-[#0f1117]">+{lvl - 1}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-indigo-300">▾</span>
                        </div>
                        <span className="text-xs text-slate-500">ถึง +{toLevel}</span>
                        {isWall && (
                          <span
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-300"
                            title="จุดเปลี่ยนแร่ +10/+11 — ระบบแยกช่วงให้อัตโนมัติ ลบ/ย้ายไม่ได้"
                          >
                            จุดเปลี่ยนแร่
                          </span>
                        )}
                        {rule.stone === 'hd' && rule.from < getStoneMinLevel('hd', itemType) && (
                          <span
                            className="ml-1 cursor-help text-[0.65rem] font-semibold text-amber-400 underline decoration-dotted underline-offset-2"
                            title={`หิน HD ยังใช้ไม่ได้ก่อน +${getStoneMinLevel('hd', itemType)} — ช่วง +${rule.from} ถึง +${getStoneMinLevel('hd', itemType) - 1} จะใช้หินปกติแทนอัตโนมัติ`}
                          >
                            ⚠ ก่อน +{getStoneMinLevel('hd', itemType)} ใช้ปกติแทน
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {rule.from < toLevel && (
                            <button
                              type="button"
                              onClick={() => splitStoneRule(rule.id)}
                              disabled={autoRunning}
                              title="แบ่งช่วงนี้เป็น 2"
                              className="rounded border border-slate-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-indigo-300 transition-colors hover:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              แบ่ง
                            </button>
                          )}
                          {i > 0 && !isWall && (
                            <button
                              type="button"
                              onClick={() => removeStoneRule(rule.id)}
                              disabled={autoRunning}
                              title="ลบช่วงนี้ (รวมกับช่วงก่อนหน้า)"
                              aria-label="ลบช่วงนี้"
                              className="rounded p-1 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {['normal', 'enriched', 'hd']
                          .filter((s) => stoneValidInRoom(itemType, rule.from, s)) // ซ่อนหินที่ใช้ไม่ได้ในช่วงนี้
                          .map((s) => {
                            const ore = getStoneOre(itemType, rule.from - 1, s); // แร่จริงของห้องนี้
                            const isSpecialItem = itemType === 'weapon5' || itemType === 'armor2';
                            const hint =
                              s === 'hd'
                                ? `ล้ม${isSpecialItem && toLevel >= 11 ? 'หาย' : 'ลด −1'}`
                                : s === 'enriched'
                                ? `ล้ม${isSpecialItem && toLevel < 11 ? 'ลด −1' : 'หาย'} (+โอกาส)`
                                : `ล้ม${isSpecialItem && toLevel < 11 ? 'ลด −3' : 'หาย'}`;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateRuleStone(rule.id, s)}
                                disabled={autoRunning}
                                title={`${STONE_META[s].label}${ore ? ` (${ore})` : ''} — ${hint}`}
                                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  rule.stone === s ? STONE_META[s].active : 'border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                {ORE_IMAGES[ore] ? (
                                  <img src={ORE_IMAGES[ore]} alt={ore} className="h-4 w-4 shrink-0 object-contain" />
                                ) : (
                                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ORE_COLORS[ore] || 'bg-slate-400'}`} />
                                )}
                                <span className="truncate text-[0.6rem] font-semibold leading-tight">{ore}</span>
                              </button>
                            );
                          })}
                      </div>
                      {autoUseBSB && rule.from <= 15 && toLevel >= 8 && (
                        <div className="mt-2 flex items-center justify-between rounded-md border border-emerald-900/50 bg-emerald-950/30 px-2 py-1.5">
                          <span className="text-[0.7rem] font-semibold text-emerald-300">ใส่ BSB ช่วงนี้ (+{Math.max(7, rule.from - 1)}→+{Math.min(15, toLevel)})</span>
                          <Toggle
                            checked={!!rule.bsb}
                            onChange={(v) => updateRuleBSB(rule.id, v)}
                            disabled={autoRunning}
                            activeColor="bg-emerald-500"
                          />
                        </div>
                      )}
                      {toggleHasMeaning(rule.stone, itemType, rule.from, toLevel, isEventRate, autoUseBSB, rule.bsb, bsbTable) && (
                        <div className="mt-2 flex items-center justify-between rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-1.5">
                          <span className="text-[0.7rem] font-semibold text-rose-300">หยุด Auto ถ้าเสี่ยงหาย</span>
                          <Toggle
                            checked={rule.stopOnLoss}
                            onChange={(v) => updateRuleStopOnLoss(rule.id, v)}
                            disabled={autoRunning}
                            activeColor="bg-rose-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[0.65rem] text-slate-500">กดปุ่ม "แบ่ง" ในแต่ละช่วงเพื่อแบ่งย่อย — ระบบกั้นจุดเปลี่ยนแร่ +10 ให้อัตโนมัติ</p>
            </div>
          )}
          {autoRefine && autoTarget >= 8 && (
            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">ใส่ BSB อัตโนมัติระหว่างทาง</div>
                  <div className="mt-0.5 text-xs text-slate-400">เปิดแล้วเลือกเปิด/ปิด BSB ได้ทีละช่วงด้านบน (ใช้ได้ +7→+14)</div>
                </div>
                <Toggle
                  checked={autoUseBSB}
                  onChange={setAutoUseBSB}
                  disabled={autoRunning}
                  activeColor="bg-emerald-500"
                />
              </div>
              {autoUseBSB && (
                <p className="mt-2 text-[0.65rem] text-emerald-300/80">↑ เลื่อนขึ้นไปกดสวิตช์ "ใส่ BSB ช่วงนี้" ในแต่ละช่วง — แบ่งช่วงเพื่อคุมละเอียดได้ (เริ่ม/เลิก/มาใส่ใหม่)</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* หน้าต่างตีบวก */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1 lg:justify-center">

        {/* Animation frame = main canvas, ทุก UI overlay อยู่ข้างใน */}
        <div className="relative w-full overflow-hidden rounded-xl" style={{ maxWidth: 350, aspectRatio: '262 / 301', fontFamily: 'Tahoma, Geneva, sans-serif' }}>

          {/* Animation frames (bg) */}
          {mode === 'wait' && renderFrames(WAITING_FRAMES, 'wait')}
          {mode === 'process' && renderFrames(PROCESSING_FRAMES, 'process')}
          {mode === 'success' && renderFrames(SUCCESS_FRAMES, 'success')}
          {mode === 'fail' && renderFrames(FAIL_FRAMES, 'fail')}

          {/* Item icon ใน slot */}
          {(() => {
            const src = apiItem && apiItem.type === itemType
              ? apiItem.imageUrl
              : itemType.startsWith('weapon') ? '/images/default_weapon.png' : '/images/default_armor.png';
            const key = apiItem && apiItem.type === itemType ? apiItem.id : `default-${itemType}`;
            return (
              <img key={key} src={src} alt="item"
                className="pointer-events-none absolute z-[2]"
                style={{ left:'50%', top:'69%', width:'10%', height:'auto', transform:'translate(-50%,-50%)', imageRendering:'pixelated', filter:'drop-shadow(0 0 3px rgba(255,200,60,0.9))' }}
                onError={e => { e.currentTarget.style.display='none'; }} />
            );
          })()}

          {/* ── OVERLAY z-[3] ── */}

          {/* ปุ่มดูตารางหิน — มุมซ้ายบน */}
          <button type="button" onClick={() => setShowStoneModal(true)} title="ดูตารางหินทั้งหมด"
            className="absolute z-[4] flex cursor-pointer items-center justify-center rounded-full font-bold text-white transition-transform hover:scale-110"
            style={{ top:10, left:10, width:22, height:22, fontSize:'0.7rem',
              background:'rgba(15,17,23,0.85)', border:'1px solid rgba(148,163,184,0.6)', boxShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>?</button>

          {/* badge ควบคุมโดย Auto — มุมซ้ายบน (เลื่อนขวาจากปุ่ม ?) ตอน auto คุมหิน */}
          {autoRunning && (
            <span className="absolute z-[4] rounded-full font-bold text-indigo-200"
              style={{ top:11, left:38, padding:'2px 8px', fontSize:'0.6rem', background:'rgba(79,70,229,0.85)', border:'1px solid rgba(129,140,248,0.6)' }}>
              Auto
            </span>
          )}

          {/* Stop Auto badge — มุมขวาบน แสดงตลอดตอน auto ทำงาน (ไม่กระพริบตาม animation) */}
          {autoRefine && autoRunning && (
            <button onClick={handleStopAuto} title="หยุด Auto"
              className="group absolute z-[5] flex cursor-pointer items-center gap-1 rounded-full font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{
                top:10, right:10, padding:'3px 8px 3px 6px', fontSize:'0.5rem',
                background:'linear-gradient(135deg,#dc2626,#7f1d1d)',
                border:'1px solid rgba(248,113,113,0.6)',
                boxShadow:'0 2px 8px rgba(127,29,29,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-100" />
              </span>
              <span className="tracking-wide">หยุด</span>
              <span className="opacity-70" style={{ fontSize:'0.42rem' }}>+{autoTarget}</span>
            </button>
          )}

          {/* 1. Success % banner — top 14px */}
          <div className="absolute z-[3] flex items-center justify-center gap-2"
            style={{ top:14, left:'5%', width:'90%', padding:'3px 8px' }}>
            <span className="text-sm font-extrabold tracking-wide">
              {mode === 'fail' && isItemLost ? (
                <span style={{ color:'#000' }}>ไอเทมแตกสลาย</span>
              ) : (
                <>
                  <span style={{ color:'#000' }}>สำเร็จ </span>
                  <span style={{ color:'#1d4ed8' }}>{Math.floor(bannerRate)}%</span>
                </>
              )}
            </span>
            {useBSB && bsbInRange && (
              <span className="flex items-center gap-0.5 text-[0.65rem] font-bold text-emerald-400">
                <img src="/images/blacksmith_blessing.png" className="h-3.5 w-3.5" style={{imageRendering:'pixelated'}} alt="BSB"/>
                ×{bsbTable[stack.length]}
              </span>
            )}
          </div>

          {/* 2. Stone selector slots — top 11% (คลิกเลือกชนิดหินได้, dim อันที่ใช้ไม่ได้) */}
          <div className="absolute z-[3] flex items-end justify-center"
            style={{ top:'11%', left:'50%', transform:'translateX(-50%)', gap:4, pointerEvents: autoRefine ? 'none' : 'auto', opacity: autoRefine ? 0.5 : 1 }}>
            {(() => {
              // 3 ชนิดหิน: ปกติ / Enriched / HD — ใช้ getOreName/getStoneOre คำนวณแร่ของช่วงปัจจุบัน
              const stones = [
                { key:'normal',   label:'ปกติ',     active: !useCash && !useEnriched, disabled:false,
                  activeC:'56,189,248',  onClick:() => { setUseCash(false); setUseEnriched(false); } },
                { key:'enriched', label:'Enriched', active: useEnriched,              disabled: stack.length >= 10,
                  activeC:'251,191,36',  onClick:() => { setUseCash(false); setUseEnriched(true); } },
                { key:'hd',       label:'HD',       active: useCash && !useEnriched,  disabled: stack.length < hdMinLevel,
                  activeC:'251,146,60',  onClick:() => { setUseCash(true); setUseEnriched(false); } },
              ];
              return stones.map(s => {
                const ore = getStoneOre(itemType, stack.length, s.key);
                const C = s.activeC;
                const hexBorder = s.active ? `rgba(${C},0.95)` : 'rgba(100,116,139,0.6)';
                const hexBg     = s.active ? `rgba(${C},0.3)`  : 'rgba(0,0,0,0.55)';
                return (
                  <button key={s.key} type="button" title={ore || s.label} onClick={s.onClick} disabled={s.disabled}
                    className="flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 transition-opacity disabled:cursor-not-allowed"
                    style={{ gap:2, opacity: s.disabled ? 0.3 : 1 }}>
                    <div style={{
                      width:36, height:40,
                      clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                      background: hexBorder, display:'flex', alignItems:'center', justifyContent:'center',
                      filter: s.active ? `drop-shadow(0 0 4px rgba(${C},0.7))` : 'none',
                    }}>
                      <div style={{
                        width:30, height:34,
                        clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                        background: hexBg, display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {ore && ORE_IMAGES[ore]
                          ? <img src={ORE_IMAGES[ore]} alt={ore} style={{ width:20, height:20, imageRendering:'pixelated' }} />
                          : <span style={{ width:16, height:16, borderRadius:'50%', background: (ore && ORE_COLORS[ore]) || '#64748b' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize:'0.6rem', fontWeight:700, color: s.active ? `rgb(${C})` : '#94a3b8', lineHeight:1 }}>
                      {s.label}
                    </span>
                  </button>
                );
              });
            })()}
            {/* BSB slot — คลิก toggle ได้ */}
            {(() => {
              const bsbActive = useBSB && bsbInRange;
              return (
                <button type="button" title="Black Smith Blessing" disabled={!bsbInRange}
                  onClick={() => setUseBSB(v => !v)}
                  className="flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 transition-opacity disabled:cursor-not-allowed"
                  style={{ gap:2, opacity: bsbInRange ? 1 : 0.3 }}>
                  <div style={{
                    width:36, height:40,
                    clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                    background: bsbActive ? 'rgba(52,211,153,0.95)' : 'rgba(100,116,139,0.6)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    filter: bsbActive ? 'drop-shadow(0 0 4px rgba(52,211,153,0.7))' : 'none',
                  }}>
                    <div style={{
                      width:30, height:34,
                      clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                      background: bsbActive ? 'rgba(52,211,153,0.25)' : 'rgba(0,0,0,0.55)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <img src="/images/blacksmith_blessing.png" alt="BSB" style={{ width:20, height:20, imageRendering:'pixelated' }} />
                    </div>
                  </div>
                  <span style={{ fontSize:'0.6rem', fontWeight:700, color: bsbActive ? '#34d399' : '#94a3b8', lineHeight:1 }}>
                    BSB
                  </span>
                </button>
              );
            })()}
          </div>

          {/* 3. Warning (ถ้าหิน HD block) — top 60% */}
          {stoneBlocksRefine && (
            <div className="absolute z-[3] flex items-center justify-center gap-1"
              style={{ top:'60%', left:'50%', transform:'translateX(-50%)', background:'rgba(239,68,68,0.75)', borderRadius:4, padding:'2px 8px' }}>
              <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#fff' }}>⚠ HD ใช้ได้ตั้งแต่ +{hdMinLevel}</span>
            </div>
          )}

          {/* 5. Item name + level — top 78% */}
          <div className="absolute z-[3] flex items-center justify-center gap-1.5"
            style={{ top:'76%', left:'50%', transform:'translateX(-50%)', color:'#000', whiteSpace:'nowrap' }}>
            <span className={`text-sm font-semibold ${
              lastResult==='success' ? 'text-emerald-500' : lastResult==='fail' ? 'text-rose-500' : 'text-black-200'
            }`}>+{stack.length}</span>
            <span className="text-sm font-semibold text-black">
              {apiItem && apiItem.type === itemType ? apiItem.name : ITEM_TYPE_LABELS[itemType]}
            </span>
          </div>

          {/* 6. Buttons — ซ่อนระหว่าง animation */}
          {!isPlaying && mode !== 'process' && (() => {
            const isTibok = stack.length > 0 || (mode === 'success' && isSuccessLoop);
            const isTwoBtn = mode === 'fail' && (!autoRunning || isItemLost) && !autoRefine;
            // auto ตีแตก (item หาย/ลดระดับ) แล้วหยุด: แสดง 2 ปุ่ม (กลับไป + เริ่ม Auto dim) — บังคับ bottom 4% / left 50% / width 83%
            const isTwoBtnAuto = autoRefine && !autoRunning && mode === 'fail';
            return (
          <div className="absolute z-[3] flex items-center justify-center gap-7"
            style={{ bottom: isTwoBtnAuto ? '4%' : isTwoBtn ? '1%' : isTibok ? '2%' : '4%', left: isTwoBtnAuto ? '50%' : isTwoBtn ? '50%' : isTibok ? '73%' : '50%', transform:'translateX(-50%)', width: (isTwoBtn || isTwoBtnAuto) ? '83%' : '37%' }}>
            {mode === 'fail' && (!autoRunning || isItemLost) && (
              <button onClick={handleBackToWait}
                className="cursor-pointer rounded font-bold text-amber-200 transition-opacity hover:opacity-80"
                style={{ background:'transparent',color:'#000', padding:'15px 45px', fontSize:'0.75rem' }}>
                กลับไป
              </button>
            )}
            {/* Manual refine button */}
            {!autoRefine && (
              <button onClick={handleRefine}
                disabled={isPlaying || stoneBlocksRefine || mode==='process' || (mode==='fail' && isItemLost)}
                className="flex-1 cursor-pointer rounded font-bold transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background:'transparent', color:'#000', padding: (stack.length===0 && !(mode==='success' && isSuccessLoop)) ? '31px 0' : '19px 0', fontSize:'0.8rem' }}>
                {stack.length===0 && !(mode==='success' && isSuccessLoop) ? 'อัพเกรด' : 'เริ่มอีกครั้ง'}
                {!(stack.length===0 && !(mode==='success' && isSuccessLoop)) && (
                  <span style={{ display:'block', fontSize:'0.65rem', opacity:0.7 }}>Rate: {Math.floor(currentRate)}%</span>
                )}
              </button>
            )}
            {/* Start Auto button (ปุ่มหยุดแยกเป็น badge มุมขวาบน) */}
            {autoRefine && !autoRunning && (
              <button onClick={handleStartAuto}
                disabled={isPlaying || mode==='process' || autoStart>=autoTarget || (mode==='fail' && isItemLost)}
                className="flex-1 cursor-pointer rounded font-bold disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-70"
                style={{ background:'transparent', color:'#000', padding:'10px 0', fontSize:'0.8rem' }}>
                เริ่ม Auto
                <span style={{ display:'block', fontSize:'0.6rem', opacity:0.8 ,color:'#fff'}}>+{autoStart}→+{autoTarget}</span>
              </button>
            )}
          </div>
            );
          })()}

        </div>
        {/* ── จบ animation frame ── */}
      </div>
      </div>

      {/* สรุปจำนวนครั้งที่ตี: ทั้งหมด / สำเร็จ / แตก (คำนวณจาก log) */}
      {(() => {
        const totalAttempts = log.length;
        const successCount = log.filter((l) => l.isSuccess).length;
        const failCount = totalAttempts - successCount;
        const successPct = totalAttempts ? (successCount / totalAttempts) * 100 : 0;
        return (
          <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">สถิติ Session</span>
            <button
              type="button"
              onClick={handleClearSession}
              disabled={autoRunning || totalAttempts === 0}
              className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-400/60 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ล้าง Session
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-[#181a20]/90 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">ตีทั้งหมด</div>
              <div className="text-2xl font-bold text-amber-300">{totalAttempts}</div>
              <div className="text-xs text-slate-500">ครั้ง</div>
            </div>
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">สำเร็จ</div>
              <div className="text-2xl font-bold text-emerald-400">{successCount}</div>
              <div className="text-xs text-slate-500">{successPct.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">แตก/ล้มเหลว</div>
              <div className="text-2xl font-bold text-rose-400">{failCount}</div>
              <div className="text-xs text-slate-500">ครั้ง</div>
            </div>
          </div>
          </>
        );
      })()}

      {/* Stack log */}
      <div>
        <div
          className="max-h-[280px] min-h-[160px] w-full overflow-y-auto rounded-xl border border-slate-700/60 bg-[#0f1117] p-4 text-left text-sm [overflow-wrap:anywhere]"
          ref={el => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <div className="mb-2 text-xs font-semibold text-slate-500">Stack log</div>
          <ul className="space-y-0">
            {log.map((item, idx) => {
              const sep = item.msg.indexOf(' — ');
              const mainPart = sep >= 0 ? item.msg.slice(0, sep) : item.msg;
              const rollDetail = sep >= 0 ? item.msg.slice(sep + 3) : '';
              const levelMatch = mainPart.match(/^(\+\d+\s*→\s*\+\d+)/);
              const levelStr = levelMatch ? levelMatch[1] : '';

              // result badge
              let resultBadge;
              if (item.isSuccess) {
                resultBadge = (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-300">
                    สำเร็จ
                  </span>
                );
              } else if (item.bsbConsumed > 0) {
                resultBadge = (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-amber-300">
                    <img src="/images/blacksmith_blessing.png" alt="BSB" className="h-3.5 w-3.5 object-contain" />
                    ป้องกัน ×{item.bsbConsumed}
                  </span>
                );
              } else if (item.msg.includes('ไอเทมหาย')) {
                resultBadge = (
                  <span className="inline-flex items-center rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[0.68rem] font-bold text-rose-300">
                    ไอเทมหาย
                  </span>
                );
              } else {
                const dropMatch = mainPart.match(/ลดระดับ\s*(\d+)\s*ขั้น/);
                const isDropOne = mainPart.includes('ลดระดับ') && !dropMatch;
                resultBadge = (
                  <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-rose-400">
                    {dropMatch ? `ลด −${dropMatch[1]}` : isDropOne ? 'ลด −1' : 'ล้มเหลว'}
                  </span>
                );
              }

              return (
                <li key={idx} className="border-b border-slate-800/50 py-1.5 last:border-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* เลขลำดับ */}
                    <span className="w-7 shrink-0 text-right text-[0.68rem] tabular-nums text-slate-600">
                      #{idx + 1}
                    </span>
                    {/* ประเภทไอเทม */}
                    {item.itemType && ITEM_TYPE_LABELS[item.itemType] && (
                      <span className="rounded bg-[#3a2e1e] px-1.5 py-0.5 text-[0.68rem] font-bold text-amber-300">
                        {ITEM_TYPE_LABELS[item.itemType]}
                      </span>
                    )}
                    {/* แร่ (รูป + ชื่อ) หรือ fallback stone badge */}
                    {item.oreName && ORE_IMAGES[item.oreName] ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#1a2230] px-1.5 py-0.5 text-[0.68rem] font-semibold text-sky-300">
                        <img src={ORE_IMAGES[item.oreName]} alt={item.oreName} className="h-4 w-4 object-contain" />
                        {item.oreName}
                      </span>
                    ) : (
                      <span className={`rounded px-1.5 py-0.5 text-[0.68rem] font-bold ${
                        item.useEnriched ? 'bg-[#3a3420] text-amber-200' : item.useCash ? 'bg-[#3a3220] text-orange-300' : 'bg-[#1e2a3a] text-sky-300'
                      }`}>
                        {item.useEnriched ? 'Enriched' : item.useCash ? 'HD' : 'หินปกติ'}
                      </span>
                    )}
                    {/* BSB active */}
                    {item.useBSB && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-[#1b3322] px-1.5 py-0.5 text-[0.68rem] font-bold text-emerald-400">
                        <img src="/images/blacksmith_blessing.png" alt="BSB" className="h-4 w-4 object-contain" />
                        BSB
                      </span>
                    )}
                    {/* level arrow */}
                    {levelStr && (
                      <span className="font-mono text-xs font-semibold text-slate-300">{levelStr}</span>
                    )}
                    {/* result badge */}
                    {resultBadge}
                  </div>
                  {/* roll detail */}
                  {rollDetail && (
                    <div className="ml-9 mt-0.5 text-[0.65rem] leading-relaxed text-slate-600">
                      {rollDetail}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* สรุปการใช้ไอเทมทั้งหมด */}
      {(() => {
        const num = (v) => Number(v) || 0;
        // หน่วยเงินของแต่ละแถว: ใช้ override รายแถวก่อน ไม่งั้น fallback หน่วยรวม
        const curOf = (key) => rowCurrency[key] || currency;
        const unitOf = (cur) => (cur === 'baht' ? '฿' : 'Zenny');
        const fmtCur = (v, cur) => (cur === 'baht' ? `฿${num(v).toLocaleString('en-US')}` : `${num(v).toLocaleString('en-US')} Zenny`);
        // แถวแร่ที่ใช้ (เฉพาะที่ใช้ไปแล้ว) ต่อท้ายแถวหิน/BSB
        const oreRows = Object.entries(oreUsed)
          .filter(([, qty]) => qty > 0)
          .map(([name, qty]) => ({ key: `ore:${name}`, label: name, unit: 'ก้อน', qty, oreColor: ORE_COLORS[name] || 'bg-slate-400', icon: ORE_IMAGES[name] || null }));
        const rows = [
          { key: 'bsb', label: 'Black Smith Blessing', unit: 'ชิ้น', qty: bsbUsedTotal, icon: bsbImg },
          ...oreRows,
        ];
        // ยอดรวมแยกตามสกุลเงิน (เพราะแต่ละแถวเลือกหน่วยเองได้)
        const totals = rows.reduce((acc, r) => {
          acc[curOf(r.key)] += r.qty * num(prices[r.key]);
          return acc;
        }, { zenny: 0, baht: 0 });
        // สกุลที่มีแถวใช้อยู่จริง (แสดงยอดรวมแม้ยังไม่กรอกราคา)
        const usedBaht = rows.some((r) => curOf(r.key) === 'baht');
        const usedZenny = rows.some((r) => curOf(r.key) === 'zenny');
        return (
          <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <b className="text-lg font-bold text-amber-300">สรุปการใช้ไอเทมทั้งหมด</b>
              <div className="flex flex-col items-end gap-1">
                <div role="group" aria-label="สกุลเงินทั้งหมด" className="inline-flex overflow-hidden rounded-lg border border-slate-600">
                  <button
                    type="button"
                    onClick={() => { setCurrency('zenny'); setRowCurrency({}); }}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      currency === 'zenny' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Zenny
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurrency('baht'); setRowCurrency({}); }}
                    className={`border-l border-slate-600 px-3 py-1.5 text-sm transition-colors ${
                      currency === 'baht' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ฿ บาท
                  </button>
                </div>
                <span className="text-[0.65rem] text-slate-500">ปรับทั้งหมด · หรือเลือกรายแถวด้านล่าง</span>
              </div>
            </div>
            <ul className="space-y-2">
              {rows.map((r) => {
                const rc = curOf(r.key);
                return (
                <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-[#0f1117] px-3 py-2.5 text-sm">
                  {r.icon ? (
                    <img src={r.icon} alt={r.key} className="h-[22px] w-[22px] object-contain" />
                  ) : (
                    <span className="flex h-[22px] w-[22px] items-center justify-center">
                      <span className={`h-3 w-3 rounded-full ${r.oreColor}`} />
                    </span>
                  )}
                  <span className="min-w-[120px] font-medium text-amber-400">{r.label}:</span>
                  <span className="font-bold text-white">{r.qty}</span>
                  <span className="text-slate-400">{r.unit}</span>
                  <span className="text-slate-500">×</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={prices[r.key] ?? ''}
                    onChange={(e) => setPrices((p) => ({ ...p, [r.key]: e.target.value }))}
                    placeholder="ราคา/หน่วย"
                    className="w-24 rounded-md border border-slate-600 bg-[#181a20] px-2 py-1 text-right text-white outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRowCurrency((p) => ({ ...p, [r.key]: rc === 'zenny' ? 'baht' : 'zenny' }))}
                    title="สลับหน่วยเงินของแถวนี้"
                    className="min-w-[52px] rounded-md border border-slate-600 px-1.5 py-1 text-xs font-bold text-slate-300 transition-colors hover:border-amber-400/70 hover:text-amber-300"
                  >
                    {unitOf(rc)}
                  </button>
                  <span className="text-slate-500">=</span>
                  <span className="ml-auto font-bold text-emerald-300">{fmtCur(r.qty * num(prices[r.key]), rc)}</span>
                </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
              <span className="font-bold text-amber-300">รวมทั้งหมด</span>
              <span className="flex flex-col items-end gap-0.5 text-lg font-bold text-emerald-300">
                {usedBaht && <span>{fmtCur(totals.baht, 'baht')}</span>}
                {usedZenny && <span>{fmtCur(totals.zenny, 'zenny')}</span>}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <footer className="mt-2 mb-2 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} JarMoo — RO Refine Simulator. All rights reserved.
        <span className="ml-2 text-slate-600">v{APP_VERSION}</span>
      </footer>
    </div>

    {/* Stone info modal */}

    {showStoneModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => setShowStoneModal(false)}
      >
        <div
          className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700/60 bg-[#181a20] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
            <h2 className="text-base font-bold text-amber-300">ตารางหินตีบวกทั้งหมด</h2>
            <button
              type="button"
              onClick={() => setShowStoneModal(false)}
              className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-slate-400"
            >ปิด</button>
          </div>
          <div className="overflow-y-auto p-4">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#181a20] text-xs text-slate-400">
                  <th className="border border-slate-700 p-2 text-left">หิน</th>
                  <th className="border border-slate-700 p-2 text-center">ใช้กับ</th>
                  <th className="border border-slate-700 p-2 text-center">ช่วง</th>
                  <th className="border border-slate-700 p-2 text-center">ล้มเหลว</th>
                  <th className="border border-slate-700 p-2 text-center">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {STONE_REFERENCE.map((r, i) =>
                  r.section ? (
                    <tr key={i}>
                      <td colSpan={5} className="border border-slate-700 bg-slate-700/40 px-3 py-1.5 text-xs font-bold text-amber-300">
                        {r.section}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i} className="odd:bg-[#23272f] even:bg-[#181a20]">
                      <td className="border border-slate-700 p-2">
                        <div className="flex items-center gap-2">
                          {r.img && <img src={r.img} alt={r.ore} className="h-7 w-7 object-contain" />}
                          <span className="font-medium text-amber-200">{r.ore}</span>
                        </div>
                      </td>
                      <td className="border border-slate-700 p-2 text-center text-xs text-slate-300">{r.for}</td>
                      <td className="border border-slate-700 p-2 text-center font-bold text-indigo-300">{r.range}</td>
                      <td className={`border border-slate-700 p-2 text-center text-xs font-semibold ${
                        r.fail.includes('หาย') ? 'text-rose-400' : r.fail.includes('−1') ? 'text-orange-300' : 'text-amber-300'
                      }`}>{r.fail}</td>
                      <td className="border border-slate-700 p-2 text-center text-xs text-sky-300">{r.note}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    </>
  );
};

export default Container
