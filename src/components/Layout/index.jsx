import React, { useEffect, useState, useRef } from 'react';
import HeroBanner from '../HeroBanner';
import EventRateBanner from '../EventRateBanner';
import Reveal from '../Reveal';
import { APP_VERSION } from '../../version';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import bsbImg from 'assets/images/blacksmith_blessing.png';
import { BSB_REQUIRED_NORMAL, BSB_REQUIRED_EVENT } from '../../constants/refineConfig';
import Toggle from '../Toggle';
import SimulatorPanel from '../SimulatorPanel';
import { getRate } from '../../constants/refineRates';
import { STONE_META, getStoneMinLevel, getEffectiveStone, getPlannedStone, toggleHasMeaning } from '../../utils/stones';
import { ITEM_TYPE_LABELS, ITEM_TYPE_SHORT, ORE_COLORS, ORE_IMAGES, getOreName, getStoneOre, STONE_REFERENCE } from '../../constants/ores';
import { frameCount, WAITING_FRAMES, PROCESSING_FRAMES, SUCCESS_FRAMES, FAIL_FRAMES, ALL_FRAMES } from '../../constants/frames';
import { useLang } from '../../contexts/LangContext';

// API ของ divine-pride สำหรับค้นไอเทมจาก ID
// หมายเหตุ: เว็บเป็น static site คีย์นี้จะถูก build ติดไปกับ JS และเป็นสาธารณะ
const DIVINE_PRIDE_API_KEY = '7a8b539b5e6171b362a6ef264e43dffc';

// ── ระบบช่วงหิน Auto: กำแพงที่จุดเปลี่ยนแร่ ───────────────────────────────
// กำแพงจุดเปลี่ยนแร่ (destination level): ทุก item เปลี่ยน low→high ที่ +11
// weapon5/armor2 มีจุดที่สองที่ +16 (HD เปลี่ยน HD Etherdeocon/HD Ethernium → HD Etel)
const stoneWallsFor = (itemType) =>
  itemType === 'weapon5' || itemType === 'armor2' ? [11, 16] : [11];
const isWallFrom = (from, itemType) => stoneWallsFor(itemType).includes(from);

const stoneValidInRoom = (itemType, from, stone) => {
  if (stone === 'enriched') return from <= 10;
  if (stone === 'hd') return from > getStoneMinLevel('hd', itemType);
  return true;
};

const bestStoneForRoom = (itemType, from) => {
  if (stoneValidInRoom(itemType, from, 'enriched')) return 'enriched';
  const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
  if (!isSpecial && stoneValidInRoom(itemType, from, 'hd')) return 'hd';
  return 'normal';
};

const normalizeStoneRules = (rules, start, target, itemType, nextIdRef) => {
  const minFrom = Math.max(1, start + 1);
  const cap = Math.max(minFrom, target);
  const byFrom = new Map();
  for (const r of rules) {
    if (r.from >= minFrom && r.from <= cap && !byFrom.has(r.from)) byFrom.set(r.from, r);
  }
  const froms = new Set([minFrom, ...byFrom.keys()]);
  for (const w of stoneWallsFor(itemType)) if (minFrom < w && w <= cap) froms.add(w);
  return [...froms].sort((a, b) => a - b).map((from) => {
    const existing = byFrom.get(from);
    let stone = existing ? existing.stone : bestStoneForRoom(itemType, from);
    if (!stoneValidInRoom(itemType, from, stone)) stone = bestStoneForRoom(itemType, from);
    return existing ? { ...existing, stone } : { id: nextIdRef.current++, from, stone, stopOnLoss: false, bsb: false };
  });
};

const Container = () => {
  const { lang, setLang, t } = useLang();

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState('wait');
  const [isSuccessLoop, setIsSuccessLoop] = useState(false);
  const [stack, setStack] = useState([]);
  const [isFail, setIsFail] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [useCash, setUseCash] = useState(false);
  const [useEnriched, setUseEnriched] = useState(false);
  const [isItemLost, setIsItemLost] = useState(false);
  const [log, setLog] = useState([]);
  const [useBSB, setUseBSB] = useState(false);
  const [itemType, setItemType] = useState('armor1');
  const [isEventRate, setIsEventRate] = useState(false);
  const [eventBarCollapsed, setEventBarCollapsed] = useState(false);
  // ตาราง rate ย่อเหลือ +1~+10 เป็นค่าเริ่มต้น — กันตารางยาวดันหน้าต่างตีบวกตกใต้ fold
  const [showFullRateTable, setShowFullRateTable] = useState(false);
  const bsbTable = isEventRate ? BSB_REQUIRED_EVENT : BSB_REQUIRED_NORMAL;
  const intervalRef = useRef(null);
  const skipSuccessIntroRef = useRef(false);

  const bsbInRange = stack.length >= 7 && stack.length <= 14 && (bsbTable[stack.length] || 0) > 0;

  useEffect(() => {
    if (mode === 'wait') {
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % frameCount.waiting);
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode]);

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

  useEffect(() => {
    if (mode === 'success') {
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
          setIsSuccessLoop(true);
          setIndex(9);
        }
      }, 100);
      return () => clearInterval(intervalRef.current);
    }
  }, [mode]);

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

  const [bsbUsedTotal, setBsbUsedTotal] = useState(0);
  const [oreUsed, setOreUsed] = useState({});
  const [currency, setCurrency] = useState('zenny');
  const [rowCurrency, setRowCurrency] = useState({});
  const [prices, setPrices] = useState({ normal: '', enriched: '', cash: '', bsb: '' });
  const [inputMode, setInputMode] = useState('dropdown');
  const [itemIdInput, setItemIdInput] = useState('');
  const [apiItem, setApiItem] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showItemInfo, setShowItemInfo] = useState(false);
  const [showStoneModal, setShowStoneModal] = useState(false);
  const [autoRefine, setAutoRefine] = useState(false);
  const [autoStart, setAutoStart] = useState(0);
  const [autoTarget, setAutoTarget] = useState(10);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStoneRules, setAutoStoneRules] = useState([{ id: 0, from: 1, stone: 'enriched', stopOnLoss: false, bsb: false }]);
  const nextRuleId = useRef(1);
  const [autoUseBSB, setAutoUseBSB] = useState(false);

  const handleRefine = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setMode('process');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsItemLost(false);
    setLastResult(null);
    const currentLevel = stack.length + 1;
    const rate = getRate(isEventRate, useCash, useEnriched, itemType, currentLevel - 1) / 100;
    const roll = Math.random();
    const isSuccess = roll < rate;
    const rollPct = roll * 100;
    const successPct = rate * 100;
    const failPct = 100 - successPct;
    const rollData = { successPct, failPct, rollPct, isSuccess };
    let newStack = [...stack];
    let logMsg = '';
    let playFailSound = false;
    let bsbUsed = 0;
    let resultType = 'fail';
    let dropAmount = null;

    let canUseBSB = false;
    if (useBSB && currentLevel >= 8 && currentLevel <= 15) {
      bsbUsed = bsbTable[currentLevel - 1] || 0;
      canUseBSB = bsbUsed > 0;
    }
    const oreName = getOreName(itemType, stack.length, useCash, useEnriched);
    if (oreName) {
      setOreUsed(prev => ({ ...prev, [oreName]: (prev[oreName] || 0) + 1 }));
    }
    // BSB ถูกใช้ทุกครั้งที่ตีในช่วงที่ active — ตีติดก็เสีย (ตามกติกาเกมจริง)
    if (canUseBSB) {
      setBsbUsedTotal(prev => prev + bsbUsed);
    }
    if (isSuccess) {
      newStack.push({ time: new Date().toLocaleTimeString() });
      logMsg = `+${stack.length} → +${stack.length + 1} : สำเร็จ`;
      resultType = 'success';
    } else if (canUseBSB) {
      logMsg = `+${stack.length} → +${stack.length} : ล้มเหลว (ใช้ BSB ${bsbUsed} ชิ้น ป้องกัน${useCash ? 'ลดระดับ' : 'ไอเทมหาย'})`;
      resultType = 'bsb_protect';
    } else if (itemType === 'weapon5' || itemType === 'armor2') {
      if (stack.length >= 10) {
        setIsItemLost(true);
        newStack = [];
        logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย)`;
        playFailSound = true;
        resultType = 'item_lost';
      } else {
        const drop = useEnriched ? 1 : 3;
        const newLevel = Math.max(0, stack.length - drop);
        const actualDrop = stack.length - newLevel;
        newStack = newStack.slice(0, newLevel);
        logMsg = `+${stack.length} → +${newLevel} : ล้มเหลว (ลดระดับ ${actualDrop} ขั้น)`;
        resultType = 'level_drop';
        dropAmount = actualDrop;
      }
    } else if (useCash && stack.length > 0) {
      newStack = newStack.slice(0, -1);
      logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ)`;
      resultType = 'level_drop';
      dropAmount = 1;
    } else if (!useCash) {
      setIsItemLost(true);
      newStack = [];
      logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย)`;
      playFailSound = true;
      resultType = 'item_lost';
    }
    const rollDetail = `โอกาสติด ${successPct.toFixed(2)}% / โอกาสแตก ${failPct.toFixed(2)}% → ผลออกฝั่ง${isSuccess ? 'สำเร็จ' : 'แตก'} ที่ ${rollPct.toFixed(2)}%`;
    logMsg = `${logMsg} — ${rollDetail}`;
    setStack(newStack);
    setLog(prev => [...prev, {
      msg: logMsg,
      fromLevel: stack.length,
      toLevel: newStack.length,
      resultType,
      dropAmount,
      rollData,
      itemType,
      useCash,
      useEnriched,
      useBSB,
      bsbConsumed: canUseBSB ? bsbUsed : 0,
      isSuccess,
      oreName: oreName || null,
    }]);
    setIsFail(!isSuccess);

    if (playFailSound) {
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

  useEffect(() => {
    if (!autoRunning) return;
    if (isPlaying || mode === 'process') return;
    if (stack.length >= autoTarget) {
      setAutoRunning(false);
      if (autoUseBSB) setUseBSB(false);
      return;
    }
    if (isItemLost) { setAutoRunning(false); return; }
    const rawStone = getPlannedStone(autoStoneRules, stack.length + 1);
    const plannedStone = getEffectiveStone(rawStone, itemType, stack.length);
    const wantCash = plannedStone === 'hd';
    const wantEnriched = plannedStone === 'enriched';
    if (wantCash !== useCash || wantEnriched !== useEnriched) {
      setUseCash(wantCash);
      setUseEnriched(wantEnriched);
      return;
    }
    const applicableRule = [...autoStoneRules].sort((a, b) => b.from - a.from).find(r => r.from <= stack.length + 1);
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
    const t2 = setTimeout(() => handleRefine(), 450);
    return () => clearTimeout(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunning, isPlaying, mode, stack.length, isItemLost, autoTarget, autoStoneRules, useCash, useEnriched, autoUseBSB, useBSB, itemType, bsbTable, isEventRate]);

  useEffect(() => {
    setAutoTarget(t2 => (t2 <= autoStart ? Math.min(autoStart + 1, 20) : t2));
  }, [autoStart]);

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

  const handleStartAuto = () => {
    if (autoRunning || isPlaying) return;
    if (autoStart >= autoTarget) return;
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
    if (autoUseBSB) setUseBSB(false);
  };

  const handleClearSession = () => {
    setLog([]);
    setOreUsed({});
    setBsbUsedTotal(0);
  };

  const updateRuleStone = (id, stone) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, stone, stopOnLoss: false } : r));
  const updateRuleStopOnLoss = (id, value) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, stopOnLoss: value } : r));
  const updateRuleBSB = (id, value) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, bsb: value } : r));

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

  const updateRuleFrom = (id, newFrom) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0 || isWallFrom(rs[idx].from, itemType)) return rs;
    const next = rs.map(r => ({ ...r }));
    next[idx].from = Math.max(newFrom, next[idx - 1].from + 1);
    return normalizeStoneRules(next, autoStart, autoTarget, itemType, nextRuleId);
  });
  const splitStoneRule = (id) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx < 0) return rs;
    const rule = rs[idx];
    const toLevel = rs[idx + 1] ? rs[idx + 1].from - 1 : autoTarget;
    if (rule.from >= toLevel) return rs;
    const mid = rule.from + Math.ceil((toLevel - rule.from + 1) / 2);
    const inserted = [
      ...rs.slice(0, idx + 1),
      { id: nextRuleId.current++, from: mid, stone: rule.stone, stopOnLoss: false, bsb: rule.bsb },
      ...rs.slice(idx + 1),
    ];
    return normalizeStoneRules(inserted, autoStart, autoTarget, itemType, nextRuleId);
  });
  const removeStoneRule = (id) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0 || isWallFrom(rs[idx].from, itemType)) return rs;
    return normalizeStoneRules(rs.filter(r => r.id !== id), autoStart, autoTarget, itemType, nextRuleId);
  });

  const handleBackToWait = () => {
    setAutoRunning(false);
    setMode('wait');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsFail(false);
    setIsItemLost(false);
    setLastResult(null);
    if (autoRefine) {
      const now = new Date().toLocaleTimeString();
      setStack(Array.from({ length: autoStart }, () => ({ time: now })));
    } else {
      setStack([]);
    }
  };

  const handleStartLevelChange = (level) => {
    setAutoRunning(false);
    const now = new Date().toLocaleTimeString();
    setStack(Array.from({ length: level }, () => ({ time: now })));
    setIsFail(false);
    setIsItemLost(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseBSB(false);
    if (level > 0) {
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
    setUseEnriched(false);
  };

  useEffect(() => {
    if (useEnriched && stack.length >= 10) setUseEnriched(false);
  }, [useEnriched, stack.length]);
  useEffect(() => {
    const isSpecial = itemType === 'weapon5' || itemType === 'armor2';
    if (isSpecial && useCash && stack.length < 10) setUseCash(false);
  }, [itemType, useCash, stack.length]);

  const handleFetchItem = async () => {
    const id = itemIdInput.trim();
    if (!id || apiLoading) return;
    setApiLoading(true);
    setApiError('');
    try {
      const res = await fetch(`https://www.divine-pride.net/api/database/Item/${id}?apiKey=${DIVINE_PRIDE_API_KEY}`);
      if (!res.ok) throw new Error(t('api_error_http', { status: res.status }));
      const data = await res.json();
      let lvl = Number(data.itemLevel) || 1;
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
        throw new Error(t('api_error_not_refinable'));
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
      setApiError(err.message || t('api_fetch_fail'));
    } finally {
      setApiLoading(false);
    }
  };

  const currentLevel = stack.length + 1;
  const hdMinLevel = getStoneMinLevel('hd', itemType);
  const stoneBlocksRefine = useCash && stack.length < hdMinLevel;
  const currentRate = getRate(isEventRate, useCash, useEnriched, itemType, currentLevel - 1);
  // Banner shows the same next-attempt rate as the refine button (keep them in sync)
  const bannerRate = currentRate;

  useEffect(() => {
    ALL_FRAMES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

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

  // helper แปล fail/note ใน STONE_REFERENCE ตามภาษา
  const stoneFailLabel = (fail) => {
    if (fail === 'ไอเทมหาย') return t('stone_fail_item_lost');
    if (fail === 'ลดระดับ −1') return t('stone_fail_drop_1');
    if (fail === 'ลดระดับ −3') return t('stone_fail_drop_3');
    return fail;
  };
  const stoneNoteLabel = (note) => {
    if (note === '+โอกาส') return t('stone_note_rate_up');
    return note;
  };

  return (
    <>
    {/* แถบ Event Rate Up — fixed ลอยบนสุดเต็มจอ โชว์เฉพาะตอนเปิด Event ที่ตาราง (ย่อเป็น pill ได้) */}
    {isEventRate && (
      <EventRateBanner
        collapsed={eventBarCollapsed}
        onToggle={() => setEventBarCollapsed((c) => !c)}
      />
    )}
    {/* pb กันเนื้อหาท้ายหน้าโดน FAB (FloatingMenu) บังบน mobile */}
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 pb-16 sm:pb-4">
      {/* spacer กันเนื้อหาโดนแถบ Event (fixed) บัง — ยุบ/ขยายนุ่ม ๆ ตามสถานะแถบ (-mb-5 หักล้าง gap ตอนยุบ) */}
      {isEventRate && (
        <div
          aria-hidden="true"
          className={`transition-all duration-500 ease-in-out ${eventBarCollapsed ? 'h-0 -mb-5' : 'h-8 sm:h-10'}`}
        />
      )}
      {/* Hero Banner + ปุ่มเปลี่ยนภาษา ซ้อนมุมขวาบน (ตำแหน่งมาตรฐานของ language switch) */}
      <div className="relative">
        <HeroBanner />
        <div
          role="group"
          aria-label={t('lang_toggle_label')}
          className="absolute right-2 top-2 inline-flex gap-1 rounded-xl border border-amber-400/70 bg-slate-950/85 p-1 shadow-lg shadow-black/60 ring-2 ring-black/70 backdrop-blur-sm sm:right-3 sm:top-3"
        >
          <button
            type="button"
            onClick={() => setLang('th')}
            aria-pressed={lang === 'th'}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 sm:px-3 sm:py-1.5 sm:text-sm ${
              lang === 'th'
                ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                : 'text-slate-300 hover:-translate-y-px hover:bg-slate-700/70 hover:text-white active:translate-y-0 active:scale-95'
            }`}
          >
            🇹🇭 TH
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 sm:px-3 sm:py-1.5 sm:text-sm ${
              lang === 'en'
                ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                : 'text-slate-300 hover:-translate-y-px hover:bg-slate-700/70 hover:text-white active:translate-y-0 active:scale-95'
            }`}
          >
            🇬🇧 EN
          </button>
        </div>
      </div>

      {/* ตารางอัตราสำเร็จ */}
      <Reveal>
      <section aria-labelledby="rate-table-heading">
      <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4 shadow-lg shadow-black/30">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="rate-table-heading" className="m-0 text-base font-bold text-amber-300">
            {t('rate_table_title')} — {isEventRate ? t('event_rate_up') : t('no_event')} · {useEnriched ? 'Enriched' : useCash ? 'HD' : t('stone_normal_label')}
          </h2>
          {/* สวิตช์โหมดเรท — ทำให้เห็นชัดว่ากดได้: ราง inset + ปุ่ม active นูน + hover เด้ง */}
          <div role="group" aria-label="Rate mode" className="inline-flex gap-1 rounded-xl border border-slate-600/80 bg-slate-950/70 p-1 shadow-inner shadow-black/50">
            <button
              type="button"
              onClick={() => setIsEventRate(false)}
              aria-pressed={!isEventRate}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150 ${
                !isEventRate
                  ? 'bg-slate-200 text-slate-900 shadow-md shadow-black/40'
                  : 'text-slate-400 hover:-translate-y-px hover:bg-slate-700/70 hover:text-slate-100 active:translate-y-0 active:scale-95'
              }`}
            >
              {t('no_event')}
            </button>
            <button
              type="button"
              onClick={() => setIsEventRate(true)}
              aria-pressed={isEventRate}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150 ${
                isEventRate
                  ? 'event-fire-bar text-white shadow-md shadow-orange-900/60 ring-1 ring-amber-300/70'
                  : 'text-amber-300 ring-1 ring-amber-400/40 hover:-translate-y-px hover:bg-amber-500/15 hover:text-amber-200 hover:ring-amber-300/70 active:translate-y-0 active:scale-95'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={`h-3.5 w-3.5 ${isEventRate ? 'animate-pulse' : ''}`} aria-hidden="true">
                <path d="M12 2c.6 3.2-.6 4.9-2.1 6.4C8.3 10 7 11.6 7 14a5 5 0 0 0 10 0c0-1.2-.4-2.3-1-3.2-.9 1-2 1.4-2 1.4.8-2.6.3-5.5-2-8.2z" />
              </svg>
              {t('event_rate_up')}
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[520px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-[#23272f]">
                <th className="min-w-[60px] border border-slate-800 p-1.5 text-amber-400">{t('level_col')}</th>
                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                  <th
                    key={key}
                    className={`border border-slate-800 p-1.5 sm:min-w-[90px] ${
                      key === itemType ? 'bg-amber-400/15 text-amber-300' : 'text-amber-400'
                    }`}
                  >
                    {/* จอเล็กใช้ชื่อย่อ — ชื่อเต็มโดน truncate จนแยกคอลัมน์ไม่ออก */}
                    <span className="sm:hidden">{ITEM_TYPE_SHORT[key]}</span>
                    <span className="hidden truncate sm:inline">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(showFullRateTable ? 20 : 10)].map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#23272f]' : 'bg-[#181a20]'}>
                  <td className="border border-slate-800 p-1.5 text-center font-bold text-amber-300">+{i + 1}</td>
                  {Object.keys(ITEM_TYPE_LABELS).map(type => (
                    <td
                      key={type}
                      className={`truncate border border-slate-800 p-1.5 text-center ${
                        type === itemType ? 'bg-amber-400/10 font-bold text-white' : 'text-slate-400'
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
        {/* ปุ่มขยาย/ย่อตาราง — default โชว์ +1~+10 พอ ให้หน้าต่างตีบวกอยู่ใกล้ fold */}
        <button
          type="button"
          onClick={() => setShowFullRateTable((v) => !v)}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-950/50 py-1.5 text-xs font-semibold text-slate-300 transition-all duration-150 hover:border-amber-400/60 hover:text-amber-300 active:scale-[0.99]"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-transform duration-300 ${showFullRateTable ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M3 6l5 5 5-5" />
          </svg>
          {showFullRateTable ? t('rate_show_less') : t('rate_show_all')}
        </button>
      </div>
      </section>
      </Reveal>

      {/* แถวเดสก์ท็อป: กล่อง option (ซ้าย) + กล่องตีบวก (ขวา) */}
      <Reveal>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      {/* การ์ดควบคุม */}
      <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1">
        {/* ประเภทไอเท็ม */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="item-type" className="text-sm font-semibold text-slate-300">{t('item_type_label')}</label>
          <div role="group" aria-label="Item selection mode" className="inline-flex gap-1 rounded-xl border border-slate-600/80 bg-slate-950/70 p-1 shadow-inner shadow-black/50">
            <button
              type="button"
              onClick={() => setInputMode('dropdown')}
              aria-pressed={inputMode === 'dropdown'}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                inputMode === 'dropdown'
                  ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                  : 'text-slate-400 hover:-translate-y-px hover:bg-slate-700/70 hover:text-slate-100 active:translate-y-0 active:scale-95'
              }`}
            >
              {t('select_manual')}
            </button>
            <button
              type="button"
              onClick={() => setInputMode('id')}
              aria-pressed={inputMode === 'id'}
              className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                inputMode === 'id'
                  ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                  : 'text-slate-400 hover:-translate-y-px hover:bg-slate-700/70 hover:text-slate-100 active:translate-y-0 active:scale-95'
              }`}
            >
              {t('search_by_id')}
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
                placeholder={t('item_id_placeholder')}
                className="w-full rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2.5 text-white outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40"
              />
              <button
                type="button"
                onClick={handleFetchItem}
                disabled={apiLoading || !itemIdInput.trim()}
                className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 font-bold text-slate-900 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
              >
                {apiLoading ? t('searching') : t('search_btn')}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              {t('copy_id_hint_pre')}{' '}
              <a
                href="https://www.divine-pride.net/database/item"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-300 underline decoration-dotted underline-offset-2 hover:text-amber-200"
              >
                divine-pride.net
              </a>
              {' '}{t('copy_id_hint_post')}
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
                <span className="shrink-0 text-xs text-amber-300">{t('loading_text')}</span>
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
                      const fields = [
                        [t('item_info_type'), ITEM_TYPE_LABELS[apiItem.type]],
                        ['itemLevel', apiItem.itemLevel],
                        isWeapon ? ['Attack', apiItem.attack ?? '-'] : ['Defense', apiItem.defense ?? '-'],
                        [t('item_info_weight'), apiItem.weight ?? '-'],
                        [t('item_info_req_lvl'), apiItem.requiredLevel ?? '-'],
                        [t('item_info_slots'), apiItem.slots ?? '-'],
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

        {/* Dropdown เลือกระดับเริ่มต้น (manual) */}
        <div className={`transition-opacity ${autoRefine ? 'pointer-events-none opacity-40' : ''}`}>
          <label htmlFor="start-level" className="mt-4 mb-1.5 block text-sm font-semibold text-slate-300">
            {t('start_level_label')}
            {autoRefine && <span className="ml-2 text-xs font-normal text-slate-500">{t('auto_tag')}</span>}
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
                  <div className="mb-1 font-bold text-amber-300">{t('bsb_per_level')} ({isEventRate ? 'Event' : 'Normal'})</div>
                  <div className="space-y-0.5">
                    {bsbTable.map((qty, lvl) => qty > 0 ? (
                      <div key={lvl} className="flex justify-between">
                        <span className="text-slate-400">+{lvl} → +{lvl + 1}</span>
                        <span className="font-semibold text-emerald-300">{qty} {t('bsb_unit')}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {bsbInRange ? t('bsb_active_hint') : t('bsb_range_hint')}
            </div>
          </div>
          <Toggle
            checked={useBSB}
            onChange={setUseBSB}
            disabled={!bsbInRange || (autoRefine && autoUseBSB)}
            activeColor="bg-emerald-500"
            ariaLabel="Black Smith Blessing (BSB)"
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
              <div className="text-sm font-semibold text-white">{t('auto_label')}</div>
              <div className="mt-0.5 text-xs text-slate-400">{t('auto_hint')}</div>
            </div>
            <Toggle
              checked={autoRefine}
              onChange={(v) => {
              setAutoRefine(v);
              if (!v) {
                setAutoRunning(false);
              } else {
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
              ariaLabel={t('auto_label')}
            />
          </div>
          {autoRefine && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="auto-start" className="mb-1 block text-xs font-semibold text-slate-300">
                  {t('auto_start_label')}
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
                  {t('auto_target_label')}
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
              <div className="mb-1 text-sm font-semibold text-white">{t('stone_per_range')}</div>
              <div className="mb-2 text-xs text-slate-400">{t('stone_per_range_hint')}</div>
              <div className="space-y-2">
                {autoStoneRules.map((rule, i) => {
                  const next = autoStoneRules[i + 1];
                  const toLevel = next ? next.from - 1 : autoTarget;
                  const minFrom = i === 0 ? Math.max(1, autoStart + 1) : autoStoneRules[i - 1].from + 1;
                  const isWall = i > 0 && isWallFrom(rule.from, itemType);
                  return (
                    <div key={rule.id} className="rounded-lg border border-slate-700 bg-[#0f1117] p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{t('range_from')}</span>
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
                        <span className="text-xs text-slate-500">{t('range_to')}{toLevel}</span>
                        {isWall && (
                          <span
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-300"
                            title={t('ore_wall_title')}
                          >
                            {t('ore_wall_label')}
                          </span>
                        )}
                        {rule.stone === 'hd' && rule.from < getStoneMinLevel('hd', itemType) && (
                          <span
                            className="ml-1 cursor-help text-[0.65rem] font-semibold text-amber-400 underline decoration-dotted underline-offset-2"
                            title={t('hd_before_warn_title', { n: getStoneMinLevel('hd', itemType) })}
                          >
                            ⚠ {t('hd_before_warn', { n: getStoneMinLevel('hd', itemType) })}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {rule.from < toLevel && (
                            <button
                              type="button"
                              onClick={() => splitStoneRule(rule.id)}
                              disabled={autoRunning}
                              title={t('split_title')}
                              className="rounded border border-slate-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-indigo-300 transition-colors hover:border-indigo-400/70 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {t('split_btn')}
                            </button>
                          )}
                          {i > 0 && !isWall && (
                            <button
                              type="button"
                              onClick={() => removeStoneRule(rule.id)}
                              disabled={autoRunning}
                              title={t('remove_range_title')}
                              aria-label={t('remove_range_aria')}
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
                          .filter((s) => stoneValidInRoom(itemType, rule.from, s))
                          .map((s) => {
                            const ore = getStoneOre(itemType, rule.from - 1, s);
                            const isSpecialItem = itemType === 'weapon5' || itemType === 'armor2';
                            const hint =
                              s === 'hd'
                                ? `${t('badge_fail')} ${isSpecialItem && toLevel >= 11 ? t('stone_fail_item_lost') : t('stone_fail_drop_1')}`
                                : s === 'enriched'
                                ? `${t('badge_fail')} ${isSpecialItem && toLevel < 11 ? t('stone_fail_drop_1') : t('stone_fail_item_lost')} (+${t('stone_note_rate_up')})`
                                : `${t('badge_fail')} ${isSpecialItem && toLevel < 11 ? t('stone_fail_drop_3') : t('stone_fail_item_lost')}`;
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
                          <span className="text-[0.7rem] font-semibold text-emerald-300">
                            {t('bsb_range_toggle', { from: Math.max(7, rule.from - 1), to: Math.min(15, toLevel) })}
                          </span>
                          <Toggle
                            checked={!!rule.bsb}
                            onChange={(v) => updateRuleBSB(rule.id, v)}
                            disabled={autoRunning}
                            activeColor="bg-emerald-500"
                            ariaLabel={t('bsb_range_toggle', { from: Math.max(7, rule.from - 1), to: Math.min(15, toLevel) })}
                          />
                        </div>
                      )}
                      {toggleHasMeaning(rule.stone, itemType, rule.from, toLevel, isEventRate, autoUseBSB, rule.bsb, bsbTable) && (
                        <div className="mt-2 flex items-center justify-between rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-1.5">
                          <span className="text-[0.7rem] font-semibold text-rose-300">{t('stop_on_loss')}</span>
                          <Toggle
                            checked={rule.stopOnLoss}
                            onChange={(v) => updateRuleStopOnLoss(rule.id, v)}
                            disabled={autoRunning}
                            activeColor="bg-rose-500"
                            ariaLabel={t('stop_on_loss')}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[0.65rem] text-slate-500">{t('split_hint')}</p>
            </div>
          )}
          {autoRefine && autoTarget >= 8 && (
            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{t('bsb_auto_label')}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{t('bsb_auto_hint')}</div>
                </div>
                <Toggle
                  checked={autoUseBSB}
                  onChange={setAutoUseBSB}
                  disabled={autoRunning}
                  activeColor="bg-emerald-500"
                  ariaLabel={t('bsb_auto_label')}
                />
              </div>
              {autoUseBSB && (
                <p className="mt-2 text-[0.65rem] text-emerald-300/80">{t('bsb_auto_scroll_hint')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* หน้าต่างตีบวก */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1 lg:justify-center">

        {/* Animation frame */}
        <div className="relative w-full overflow-hidden rounded-xl" style={{ maxWidth: 350, aspectRatio: '262 / 301', fontFamily: 'Tahoma, Geneva, sans-serif' }}>

          {mode === 'wait' && renderFrames(WAITING_FRAMES, 'wait')}
          {mode === 'process' && renderFrames(PROCESSING_FRAMES, 'process')}
          {mode === 'success' && renderFrames(SUCCESS_FRAMES, 'success')}
          {mode === 'fail' && renderFrames(FAIL_FRAMES, 'fail')}

          {/* Item icon */}
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

          {/* ปุ่มดูตารางหิน */}
          <button type="button" onClick={() => setShowStoneModal(true)} title={t('view_stone_table')}
            className="absolute z-[4] flex cursor-pointer items-center justify-center rounded-full font-bold text-white transition-transform hover:scale-110"
            style={{ top:10, left:10, width:22, height:22, fontSize:'0.7rem',
              background:'rgba(15,17,23,0.85)', border:'1px solid rgba(148,163,184,0.6)', boxShadow:'0 1px 4px rgba(0,0,0,0.5)' }}>?</button>

          {/* badge Auto */}
          {autoRunning && (
            <span className="absolute z-[4] rounded-full font-bold text-indigo-200"
              style={{ top:11, left:38, padding:'2px 8px', fontSize:'0.6rem', background:'rgba(79,70,229,0.85)', border:'1px solid rgba(129,140,248,0.6)' }}>
              Auto
            </span>
          )}

          {/* Stop Auto badge */}
          {autoRefine && autoRunning && (
            <button onClick={handleStopAuto} title={t('stop_auto_btn')}
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
              <span className="tracking-wide">{t('stop_auto_btn')}</span>
              <span className="opacity-70" style={{ fontSize:'0.42rem' }}>+{autoTarget}</span>
            </button>
          )}

          {/* Success % banner */}
          <div className="absolute z-[3] flex items-center justify-center gap-2"
            style={{ top:14, left:'5%', width:'90%', padding:'3px 8px' }}>
            <span className="text-sm font-extrabold tracking-wide">
              {mode === 'fail' && isItemLost ? (
                <span style={{ color:'#000' }}>{t('item_destroyed')}</span>
              ) : (
                <>
                  <span style={{ color:'#000' }}>{t('success_banner')} </span>
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

          {/* Stone selector slots */}
          <div className="absolute z-[3] flex items-end justify-center"
            style={{ top:'11%', left:'50%', transform:'translateX(-50%)', gap:4, pointerEvents: autoRefine ? 'none' : 'auto', opacity: autoRefine ? 0.5 : 1 }}>
            {(() => {
              const stones = [
                { key:'normal',   label: t('stone_normal'), active: !useCash && !useEnriched, disabled:false,
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
            {/* BSB slot */}
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

          {/* Warning HD block */}
          {stoneBlocksRefine && (
            <div className="absolute z-[3] flex items-center justify-center gap-1"
              style={{ top:'60%', left:'50%', transform:'translateX(-50%)', background:'rgba(239,68,68,0.75)', borderRadius:4, padding:'2px 8px' }}>
              <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#fff' }}>{t('hd_min_warn')}{hdMinLevel}</span>
            </div>
          )}

          {/* Item name + level */}
          <div className="absolute z-[3] flex items-center justify-center gap-1.5"
            style={{ top:'76%', left:'50%', transform:'translateX(-50%)', color:'#000', whiteSpace:'nowrap' }}>
            <span className={`text-sm font-semibold ${
              lastResult==='success' ? 'text-emerald-500' : lastResult==='fail' ? 'text-rose-500' : 'text-black-200'
            }`}>+{stack.length}</span>
            <span className="text-sm font-semibold text-black">
              {apiItem && apiItem.type === itemType ? apiItem.name : ITEM_TYPE_LABELS[itemType]}
            </span>
          </div>

          {/* Buttons */}
          {!isPlaying && mode !== 'process' && (() => {
            const isTibok = stack.length > 0 || (mode === 'success' && isSuccessLoop);
            const isTwoBtn = mode === 'fail' && (!autoRunning || isItemLost) && !autoRefine;
            const isTwoBtnAuto = autoRefine && !autoRunning && mode === 'fail';
            return (
          <div className="absolute z-[3] flex items-center justify-center gap-7"
            style={{ bottom: isTwoBtnAuto ? '4%' : isTwoBtn ? '1%' : isTibok ? '2%' : '4%', left: isTwoBtnAuto ? '50%' : isTwoBtn ? '50%' : isTibok ? '73%' : '50%', transform:'translateX(-50%)', width: (isTwoBtn || isTwoBtnAuto) ? '83%' : '37%' }}>
            {mode === 'fail' && (!autoRunning || isItemLost) && (
              <button onClick={handleBackToWait}
                className="cursor-pointer rounded font-bold text-amber-200 transition-opacity hover:opacity-80"
                style={{ background:'transparent',color:'#000', padding:'15px 45px', fontSize:'0.75rem' }}>
                {t('back_btn')}
              </button>
            )}
            {!autoRefine && (
              <button onClick={handleRefine}
                disabled={isPlaying || stoneBlocksRefine || mode==='process' || (mode==='fail' && isItemLost)}
                className="flex-1 cursor-pointer rounded font-bold transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background:'transparent', color:'#000', padding: (stack.length===0 && !(mode==='success' && isSuccessLoop)) ? '31px 0' : '19px 0', fontSize:'0.8rem' }}>
                {stack.length===0 && !(mode==='success' && isSuccessLoop) ? t('upgrade_btn') : t('retry_btn')}
                {!(stack.length===0 && !(mode==='success' && isSuccessLoop)) && (
                  <span style={{ display:'block', fontSize:'0.65rem', opacity:0.7 }}>Rate: {Math.floor(currentRate)}%</span>
                )}
              </button>
            )}
            {autoRefine && !autoRunning && (
              <button onClick={handleStartAuto}
                disabled={isPlaying || mode==='process' || autoStart>=autoTarget || (mode==='fail' && isItemLost)}
                className="flex-1 cursor-pointer rounded font-bold disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-70"
                style={{ background:'transparent', color:'#000', padding:'10px 0', fontSize:'0.8rem' }}>
                {t('start_auto_btn')}
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
      </Reveal>

      {/* Simulator หาค่าเฉลี่ย (Monte Carlo) — ซ่อนใน panel slide เหนือสถิติ Session */}
      <Reveal>
        <SimulatorPanel itemType={itemType} isEventRate={isEventRate} bsbTable={bsbTable} />
      </Reveal>

      {/* สรุปจำนวนครั้งที่ตี */}
      <Reveal className="flex flex-col gap-5">
      {(() => {
        const totalAttempts = log.length;
        const successCount = log.filter((l) => l.isSuccess).length;
        const failCount = totalAttempts - successCount;
        const successPct = totalAttempts ? (successCount / totalAttempts) * 100 : 0;
        return (
          <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t('session_stats')}</span>
            <button
              type="button"
              onClick={handleClearSession}
              disabled={autoRunning || totalAttempts === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 shadow-sm shadow-black/30 transition-all duration-150 hover:-translate-y-px hover:border-rose-400 hover:bg-rose-500/25 hover:text-rose-200 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-rose-500/50 disabled:hover:bg-rose-500/10"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1.5 1.5 0 0 0 1.5 1.4h3.6A1.5 1.5 0 0 0 11.3 13l.7-9M6.5 7v4.5M9.5 7v4.5" />
              </svg>
              {t('clear_session')}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-[#181a20]/90 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">{t('total_attempts')}</div>
              <div className="text-2xl font-bold text-amber-300">{totalAttempts}</div>
              <div className="text-xs text-slate-500">{t('times_unit')}</div>
            </div>
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">{t('success_count')}</div>
              <div className="text-2xl font-bold text-emerald-400">{successCount}</div>
              <div className="text-xs text-slate-500">{successPct.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-slate-400">{t('fail_count')}</div>
              <div className="text-2xl font-bold text-rose-400">{failCount}</div>
              <div className="text-xs text-slate-500">{t('times_unit')}</div>
            </div>
          </div>
          </>
        );
      })()}
      </Reveal>

      {/* Stack log */}
      <Reveal>
      <div>
        <div
          className="max-h-[280px] min-h-[160px] w-full overflow-y-auto rounded-xl border border-slate-700/60 bg-[#0f1117] p-4 text-left text-sm [overflow-wrap:anywhere]"
          ref={el => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <div className="mb-2 text-xs font-semibold text-slate-500">{t('stack_log_title')}</div>
          {/* empty state — บอกว่าต้องทำอะไรต่อ แทนกล่องว่างเปล่า */}
          {log.length === 0 && (
            <div className="flex h-[100px] flex-col items-center justify-center gap-1 text-center text-xs text-slate-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 opacity-60" aria-hidden="true">
                <path d="M14 4l6 6-9 9H5v-6l9-9zM12 6l6 6" />
              </svg>
              {t('log_empty_hint')}
            </div>
          )}
          <ul className="space-y-0">
            {log.map((item, idx) => {
              // Level arrow: prefer structured data, fallback to msg parsing
              const levelStr = item.fromLevel !== undefined
                ? `+${item.fromLevel} → +${item.toLevel}`
                : (() => {
                    const sep = item.msg.indexOf(' — ');
                    const mainPart = sep >= 0 ? item.msg.slice(0, sep) : item.msg;
                    const m = mainPart.match(/^(\+\d+\s*→\s*\+\d+)/);
                    return m ? m[1] : '';
                  })();

              // Result badge from structured resultType
              let resultBadge;
              switch (item.resultType) {
                case 'success':
                  resultBadge = (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-300">
                      {t('badge_success')}
                    </span>
                  );
                  break;
                case 'bsb_protect':
                  resultBadge = (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-amber-300">
                      <img src="/images/blacksmith_blessing.png" alt="BSB" className="h-3.5 w-3.5 object-contain" />
                      {t('badge_protected')} ×{item.bsbConsumed}
                    </span>
                  );
                  break;
                case 'item_lost':
                  resultBadge = (
                    <span className="inline-flex items-center rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[0.68rem] font-bold text-rose-300">
                      {t('badge_item_lost')}
                    </span>
                  );
                  break;
                case 'level_drop':
                  resultBadge = (
                    <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-rose-400">
                      {t('badge_level_drop')}{item.dropAmount ?? 1}
                    </span>
                  );
                  break;
                default:
                  // fallback: parse from msg (backward compat)
                  resultBadge = (() => {
                    if (item.isSuccess) {
                      return (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-300">
                          {t('badge_success')}
                        </span>
                      );
                    }
                    if (item.bsbConsumed > 0) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-amber-300">
                          <img src="/images/blacksmith_blessing.png" alt="BSB" className="h-3.5 w-3.5 object-contain" />
                          {t('badge_protected')} ×{item.bsbConsumed}
                        </span>
                      );
                    }
                    if (item.msg && item.msg.includes('ไอเทมหาย')) {
                      return (
                        <span className="inline-flex items-center rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[0.68rem] font-bold text-rose-300">
                          {t('badge_item_lost')}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-rose-400">
                        {t('badge_fail')}
                      </span>
                    );
                  })();
              }

              return (
                <li key={idx} className="border-b border-slate-800/50 py-1.5 last:border-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="w-7 shrink-0 text-right text-[0.68rem] tabular-nums text-slate-600">
                      #{idx + 1}
                    </span>
                    {item.itemType && ITEM_TYPE_LABELS[item.itemType] && (
                      <span className="rounded bg-[#3a2e1e] px-1.5 py-0.5 text-[0.68rem] font-bold text-amber-300">
                        {ITEM_TYPE_LABELS[item.itemType]}
                      </span>
                    )}
                    {item.oreName && ORE_IMAGES[item.oreName] ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#1a2230] px-1.5 py-0.5 text-[0.68rem] font-semibold text-sky-300">
                        <img src={ORE_IMAGES[item.oreName]} alt={item.oreName} className="h-4 w-4 object-contain" />
                        {item.oreName}
                      </span>
                    ) : (
                      <span className={`rounded px-1.5 py-0.5 text-[0.68rem] font-bold ${
                        item.useEnriched ? 'bg-[#3a3420] text-amber-200' : item.useCash ? 'bg-[#3a3220] text-orange-300' : 'bg-[#1e2a3a] text-sky-300'
                      }`}>
                        {item.useEnriched ? 'Enriched' : item.useCash ? 'HD' : t('log_stone_normal')}
                      </span>
                    )}
                    {item.useBSB && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-[#1b3322] px-1.5 py-0.5 text-[0.68rem] font-bold text-emerald-400">
                        <img src="/images/blacksmith_blessing.png" alt="BSB" className="h-4 w-4 object-contain" />
                        BSB{item.bsbConsumed > 0 ? ` ×${item.bsbConsumed}` : ''}
                      </span>
                    )}
                    {levelStr && (
                      <span className="font-mono text-xs font-semibold text-slate-300">{levelStr}</span>
                    )}
                    {resultBadge}
                  </div>
                  {/* Roll detail */}
                  {item.rollData ? (
                    <div className="ml-9 mt-0.5 text-[0.65rem] leading-relaxed text-slate-600">
                      {t('roll_success_pct')} {item.rollData.successPct.toFixed(2)}% / {t('roll_fail_pct')} {item.rollData.failPct.toFixed(2)}% → {t('roll_result')}: {item.rollData.isSuccess ? t('roll_success_side') : t('roll_fail_side')} {t('roll_at')} {item.rollData.rollPct.toFixed(2)}%
                    </div>
                  ) : (() => {
                    const sep = item.msg ? item.msg.indexOf(' — ') : -1;
                    const detail = sep >= 0 ? item.msg.slice(sep + 3) : '';
                    return detail ? (
                      <div className="ml-9 mt-0.5 text-[0.65rem] leading-relaxed text-slate-600">{detail}</div>
                    ) : null;
                  })()}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      </Reveal>

      {/* สรุปการใช้ไอเทมทั้งหมด */}
      <Reveal>
      {(() => {
        const num = (v) => Number(v) || 0;
        const curOf = (key) => rowCurrency[key] || currency;
        const unitOf = (cur) => (cur === 'baht' ? '฿' : 'Zenny');
        const fmtCur = (v, cur) => (cur === 'baht' ? `฿${num(v).toLocaleString('en-US')}` : `${num(v).toLocaleString('en-US')} Zenny`);
        const oreRows = Object.entries(oreUsed)
          .filter(([, qty]) => qty > 0)
          .map(([name, qty]) => ({ key: `ore:${name}`, label: name, unit: t('ore_unit'), qty, oreColor: ORE_COLORS[name] || 'bg-slate-400', icon: ORE_IMAGES[name] || null }));
        // ซ่อนแถวที่ qty = 0 (รวม BSB) — โชว์เฉพาะของที่ใช้จริง
        const rows = [
          { key: 'bsb', label: 'Black Smith Blessing', unit: t('bsb_unit'), qty: bsbUsedTotal, icon: bsbImg },
          ...oreRows,
        ].filter((r) => r.qty > 0);
        const totals = rows.reduce((acc, r) => {
          acc[curOf(r.key)] += r.qty * num(prices[r.key]);
          return acc;
        }, { zenny: 0, baht: 0 });
        const usedBaht = rows.some((r) => curOf(r.key) === 'baht');
        const usedZenny = rows.some((r) => curOf(r.key) === 'zenny');
        return (
          <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <b className="text-lg font-bold text-amber-300">{t('usage_title')}</b>
              {/* mobile (ตอน wrap ลงมาอยู่ชิดซ้าย) ให้ align ซ้ายตาม — ≥sm ค่อยชิดขวา */}
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <div role="group" aria-label="Currency" className="inline-flex gap-1 rounded-xl border border-slate-600/80 bg-slate-950/70 p-1 shadow-inner shadow-black/50">
                  <button
                    type="button"
                    onClick={() => { setCurrency('zenny'); setRowCurrency({}); }}
                    aria-pressed={currency === 'zenny'}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150 ${
                      currency === 'zenny'
                        ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                        : 'text-slate-400 hover:-translate-y-px hover:bg-slate-700/70 hover:text-slate-100 active:translate-y-0 active:scale-95'
                    }`}
                  >
                    Zenny
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCurrency('baht'); setRowCurrency({}); }}
                    aria-pressed={currency === 'baht'}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150 ${
                      currency === 'baht'
                        ? 'bg-amber-400 font-bold text-slate-900 shadow-md shadow-black/40'
                        : 'text-slate-400 hover:-translate-y-px hover:bg-slate-700/70 hover:text-slate-100 active:translate-y-0 active:scale-95'
                    }`}
                  >
                    ฿ {lang === 'th' ? 'บาท' : 'Baht'}
                  </button>
                </div>
                <span className="text-[0.65rem] text-slate-500">{t('set_all_hint')}</span>
              </div>
            </div>
            {rows.length === 0 && (
              <div className="flex h-[72px] items-center justify-center text-center text-xs text-slate-600">
                {t('usage_empty_hint')}
              </div>
            )}
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
                    placeholder={t('price_placeholder')}
                    className="w-24 rounded-md border border-slate-600 bg-[#181a20] px-2 py-1 text-right text-white outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRowCurrency((p) => ({ ...p, [r.key]: rc === 'zenny' ? 'baht' : 'zenny' }))}
                    title={t('row_currency_title')}
                    className="inline-flex min-w-[58px] cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-500/80 bg-slate-800/80 px-1.5 py-1 text-xs font-bold text-slate-200 shadow-sm shadow-black/40 transition-all duration-150 hover:-translate-y-px hover:border-amber-400/70 hover:bg-slate-700 hover:text-amber-300 active:translate-y-0 active:scale-95"
                  >
                    {/* ลูกศรสลับ บอกว่ากดเปลี่ยนหน่วยได้ */}
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-70" aria-hidden="true">
                      <path d="M2 5h10M9.5 2.5 12 5 9.5 7.5M14 11H4M6.5 8.5 4 11l2.5 2.5" />
                    </svg>
                    {unitOf(rc)}
                  </button>
                  <span className="text-slate-500">=</span>
                  <span className="ml-auto font-bold text-emerald-300">{fmtCur(r.qty * num(prices[r.key]), rc)}</span>
                </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
              <span className="font-bold text-amber-300">{t('total_label')}</span>
              <span className="flex flex-col items-end gap-0.5 text-lg font-bold text-emerald-300">
                {usedBaht && <span>{fmtCur(totals.baht, 'baht')}</span>}
                {usedZenny && <span>{fmtCur(totals.zenny, 'zenny')}</span>}
              </span>
            </div>
          </div>
        );
      })()}
      </Reveal>

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
            <h2 className="text-base font-bold text-amber-300">{t('stone_table_title')}</h2>
            <button
              type="button"
              onClick={() => setShowStoneModal(false)}
              className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-slate-400"
            >{t('close_btn')}</button>
          </div>
          <div className="overflow-y-auto p-4">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#181a20] text-xs text-slate-400">
                  <th className="border border-slate-700 p-2 text-left">{t('stone_col')}</th>
                  <th className="border border-slate-700 p-2 text-center">{t('for_col')}</th>
                  <th className="border border-slate-700 p-2 text-center">{t('range_col')}</th>
                  <th className="border border-slate-700 p-2 text-center">{t('on_fail_col')}</th>
                  <th className="border border-slate-700 p-2 text-center">{t('note_col')}</th>
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
                      }`}>{stoneFailLabel(r.fail)}</td>
                      <td className="border border-slate-700 p-2 text-center text-xs text-sky-300">{stoneNoteLabel(r.note)}</td>
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
