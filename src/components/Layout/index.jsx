import React, { useEffect, useState, useRef } from 'react';
import DateTimeDisplay from '../DateTimeDisplay';
import DailyInfoPanel from '../DailyInfoPanel';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import normalStoneImg from 'assets/images/blacksmith_blessing.png';
import cashStoneImg from 'assets/images/blacksmith_blessing.png';
import bsbImg from 'assets/images/blacksmith_blessing.png';
import { BSB_REQUIRED_NORMAL, BSB_REQUIRED_EVENT } from '../../constants/refineConfig';

// ตารางอัตราสำเร็จการตีบวก (%) แยก rate ปกติ / rate ช่วง event
// หินปกติ -> RATE_NORMAL, หินแครช -> RATE_EVENT
const RATE_NORMAL = {
  armor1:  [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
  armor2:  [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
  weapon1: [100, 100, 100, 100, 100, 100, 100,  60,  40,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon2: [100, 100, 100, 100, 100, 100,  60,  50,  20,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon3: [100, 100, 100, 100, 100,  60,  50,  20,  20,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon4: [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
  weapon5: [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
};
const RATE_EVENT = {
  armor1:  [100, 100, 100, 100,  95,  80,  80,  60,  50,  35,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
  armor2:  [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
  weapon1: [100, 100, 100, 100, 100, 100, 100,  95,  85,  55,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon2: [100, 100, 100, 100, 100, 100,  95,  85,  60,  45,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon3: [100, 100, 100, 100, 100,  95,  90,  70,  60,  45,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
  weapon4: [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
  weapon5: [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
};
// API ของ divine-pride สำหรับค้นไอเทมจาก ID
// หมายเหตุ: เว็บเป็น static site คีย์นี้จะถูก build ติดไปกับ JS และเป็นสาธารณะ
const DIVINE_PRIDE_API_KEY = '7a8b539b5e6171b362a6ef264e43dffc';

const ITEM_TYPE_LABELS = {
  armor1: 'Armor Lv.1',
  armor2: 'Armor Lv.2',
  weapon1: 'Weapon Lv.1',
  weapon2: 'Weapon Lv.2',
  weapon3: 'Weapon Lv.3',
  weapon4: 'Weapon Lv.4',
  weapon5: 'Weapon Lv.5',
};

// ฟังก์ชันสร้าง path ของภาพแต่ละเฟรมแบบ dynamic
const getFrameSrc = (type, index) => {
  // type: 'waiting', 'processing', 'success', 'fail'
  // index: 0-based
  let folder = '';
  let prefix = '';
  if (type === 'waiting') {
    folder = 'waiting';
    prefix = 'bg_refining_wait_';
  } else if (type === 'processing') {
    folder = 'processing';
    prefix = index < 9 ? 'bg_refininga_process_' : 'bg_refining_process_';
  } else if (type === 'success') {
    folder = 'success';
    prefix = 'bg_refining_success_';
  } else if (type === 'fail') {
    folder = 'fail';
    prefix = 'bg_refining_fail_';
  }
  let num = index.toString().padStart(2, '0');
  // เปลี่ยน path เป็น public
  return `/images/${folder}/${prefix}${num}.bmp`;
};

// ฟังก์ชันสร้าง array ของ path รูปแต่ละประเภท
const getAllFrameSrcs = (type) => {
  const count = frameCount[type];
  return Array.from({ length: count }, (_, i) => getFrameSrc(type, i));
};

const frameCount = {
  waiting: 4,
  processing: 13,
  success: 17,
  fail: 20,
};

// สีของ keyword ที่ใช้เน้นในข้อความ Stack log
const LOG_KEYWORD_COLORS = {
  'สำเร็จ': '#4ade80',
  'ล้มเหลว': '#f87171',
  'แตก': '#f87171',
  'ไอเทมหาย': '#fb7185',
};

const renderColoredLog = (msg) => {
  const pattern = new RegExp(`(${Object.keys(LOG_KEYWORD_COLORS).join('|')})`, 'g');
  return msg.split(pattern).map((part, i) => {
    const color = LOG_KEYWORD_COLORS[part];
    return color
      ? <span key={i} style={{ color, fontWeight: 'bold' }}>{part}</span>
      : <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

// Toggle switch แบบ reusable
const Toggle = ({ checked, onChange, disabled = false, activeColor = 'bg-amber-400' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
    } ${checked ? activeColor : 'bg-slate-600'}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const Container = () => {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState('wait'); // 'wait' หรือ 'process'
  const [isSuccessLoop, setIsSuccessLoop] = useState(false);
  const [stack, setStack] = useState([]);
  const [isFail, setIsFail] = useState(false);
  const [lastResult, setLastResult] = useState(null); // 'success' | 'fail' | null
  const [useCash, setUseCash] = useState(false);
  const [isItemLost, setIsItemLost] = useState(false);
  const [log, setLog] = useState([]); // log สำหรับแสดงผลทุก action
  const [useBSB, setUseBSB] = useState(false);
  const [itemType, setItemType] = useState('armor1'); // เพิ่ม state สำหรับประเภทไอเท็ม
  const [isEventRate, setIsEventRate] = useState(false); // false = Normal Rate, true = Event Rate Up
  const rateTableType = isEventRate ? 'event' : 'normal'; // 'normal' หรือ 'event'
  const bsbTable = isEventRate ? BSB_REQUIRED_EVENT : BSB_REQUIRED_NORMAL;
  const intervalRef = useRef(null);

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
  const [normalStoneUsed, setNormalStoneUsed] = useState(0);
  const [cashStoneUsed, setCashStoneUsed] = useState(0);
  const [bsbUsedTotal, setBsbUsedTotal] = useState(0);
  // สกุลเงินที่ใช้คำนวณราคา ('zenny' | 'baht') และราคาต่อหน่วยของแต่ละไอเทม
  const [currency, setCurrency] = useState('zenny');
  const [prices, setPrices] = useState({ normal: '', cash: '', bsb: '' });
  // โหมดเลือกไอเทม: 'dropdown' (เลือกเอง) หรือ 'id' (ค้นจาก Item ID ผ่าน API)
  const [inputMode, setInputMode] = useState('dropdown');
  const [itemIdInput, setItemIdInput] = useState('');
  const [apiItem, setApiItem] = useState(null); // ผลลัพธ์จาก API ที่ค้นมา
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showItemInfo, setShowItemInfo] = useState(false); // accordion ข้อมูลไอเทม

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
    // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน
    const rateArr = isEventRate ? RATE_EVENT : RATE_NORMAL;
    const rate = rateArr[itemType][Math.min(currentLevel - 1, 19)] / 100;
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
    if (useCash) {
      setCashStoneUsed(prev => prev + 1);
    } else {
      setNormalStoneUsed(prev => prev + 1);
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
      // เงื่อนไขพิเศษสำหรับ Weapon Lv.5 และ Armor Lv.2
      if (stack.length >= 11) {
        // +11 ถึง +20: ล้มเหลว = ไอเทมถูกทำลายทันที ไม่ว่าจะใช้หินชนิดใด
        // (กันได้ด้วย BSB ในช่วงที่ใช้ได้ +7→+14 ซึ่งถูกเช็คก่อนหน้านี้แล้ว)
        setIsItemLost(true);
        newStack = [];
        logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย)`;
        playFailSound = true;
      } else if (useCash && stack.length > 0) {
        // หินแครช ลด 1 ระดับ
        newStack = newStack.slice(0, -1);
        logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ 1 ขั้น)`;
      } else if (!useCash && stack.length > 0) {
        // หินธรรมดา ลด 3 ระดับ
        const newLevel = Math.max(0, stack.length - 3);
        newStack = newStack.slice(0, newLevel);
        logMsg = `+${stack.length} → +${newLevel} : ล้มเหลว (ลดระดับ 3 ขั้น)`;
      } else if (!useCash && stack.length === 0) {
        // กรณี +0 อยู่แล้ว (กัน array underflow)
        setIsItemLost(true);
        newStack = [];
        logMsg = `+0 → +0 : ล้มเหลว (ไอเทมหาย)`;
        playFailSound = true;
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
      useBSB,
      bsbConsumed: (!isSuccess && canUseBSB) ? bsbUsed : 0,
      isSuccess,
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

  const handleBackToWait = () => {
    setMode('wait');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsFail(false);
    setStack([]);
  };

  // เลือกเริ่มที่ระดับตีบวกใด ๆ — กระโดดไประดับนั้นทันทีและเคลียร์ผลลัพธ์ค้าง
  // (rate/ปุ่ม/ตาราง derive จาก stack.length อยู่แล้ว จึงสอดคล้องกันเอง)
  const handleStartLevelChange = (level) => {
    const now = new Date().toLocaleTimeString();
    setStack(Array.from({ length: level }, () => ({ time: now })));
    setMode('wait');
    setIndex(0);
    setIsFail(false);
    setIsItemLost(false);
    setIsSuccessLoop(false);
    setLastResult(null);
    setIsPlaying(false);
    setUseBSB(false); // ช่วงที่ใช้ BSB ได้อาจเปลี่ยน จึงรีเซ็ต toggle
  };

  // เลือกประเภทไอเท็ม = เริ่มตีบวกใหม่ตั้งแต่ +0 และเคลียร์ผลลัพธ์ค้าง
  const selectItemType = (type) => {
    setItemType(type);
    setStack([]);
    setMode('wait');
    setIndex(0);
    setIsFail(false);
    setIsItemLost(false);
    setIsSuccessLoop(false);
    setLastResult(null);
    setIsPlaying(false);
  };

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
      const lvl = Number(data.itemLevel) || 1;
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
  // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน
  const currentRate = (rateTableType === 'event' ? RATE_EVENT : RATE_NORMAL)[itemType][Math.min(currentLevel - 1, 19)];

  // preload all frames for each mode
  const waitingFrames = getAllFrameSrcs('waiting');
  const processingFrames = getAllFrameSrcs('processing');
  const successFrames = getAllFrameSrcs('success');
  const failFrames = getAllFrameSrcs('fail');

  useEffect(() => {
    const allFrames = [
      ...waitingFrames,
      ...processingFrames,
      ...successFrames,
      ...failFrames,
    ];
    allFrames.forEach((src) => {
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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
      {/* แสดงวันที่และเวลาปัจจุบัน */}
      <DateTimeDisplay />

      {/* แสดงข้อมูลประจำวัน */}
      <DailyInfoPanel />

      {/* ตารางอัตราสำเร็จ */}
      <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4 shadow-lg shadow-black/30">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <b className="text-amber-300">
            ตารางอัตราสำเร็จการตีบวก (%) — {isEventRate ? 'Event Rate Up' : 'Normal Rate'}
          </b>
          <div role="group" aria-label="Rate mode" className="inline-flex overflow-hidden rounded-lg border border-slate-600">
            <button
              type="button"
              onClick={() => setIsEventRate(false)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                !isEventRate ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal Rate
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
                      {(isEventRate ? RATE_EVENT : RATE_NORMAL)[type][i]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

            {apiError && (
              <p className="mt-2 text-sm text-red-400">{apiError}</p>
            )}

            {apiItem && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/60 bg-[#0f1117]">
                <button
                  type="button"
                  onClick={() => setShowItemInfo(v => !v)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <img
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
            )}
          </div>
        )}

        {/* Dropdown เลือกระดับเริ่มต้น */}
        <label htmlFor="start-level" className="mt-4 mb-1.5 block text-sm font-semibold text-slate-300">
          เริ่มที่ระดับตีบวก
        </label>
        <div className="relative">
          <select
            id="start-level"
            value={stack.length}
            onChange={(e) => handleStartLevelChange(Number(e.target.value))}
            className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2.5 pr-10 font-bold text-amber-300 outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40"
          >
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i} value={i} className="bg-[#0f1117] text-amber-300">+{i}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-300">▾</span>
        </div>

        {/* Toggle ชนิดหิน */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-700/60 bg-[#0f1117] px-4 py-3">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className={useCash ? 'text-slate-500' : 'text-sky-300'}>หินปกติ</span>
            <Toggle checked={useCash} onChange={setUseCash} activeColor="bg-orange-500" />
            <span className={useCash ? 'text-orange-300' : 'text-slate-500'}>หินแครช (Cash)</span>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">
            {useCash ? 'ล้มเหลว = ลดระดับ' : 'ล้มเหลว = ไอเทมหาย'}
          </span>
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
            disabled={!bsbInRange}
            activeColor="bg-emerald-500"
          />
        </div>
      </div>

      {/* หน้าต่างตีบวก — การ์ดสไตล์เดียวกับกล่อง option ให้ดูสมดุลกัน */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1 lg:justify-center">
        {/* ป้ายบอกว่ากำลังตีบวกไอเทมชิ้นไหน (เฉพาะเมื่อไอเทมปัจจุบันมาจากการค้นด้วย ID) */}
        {apiItem && apiItem.type === itemType && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-1.5">
            <img
              src={apiItem.imageUrl}
              alt={apiItem.name}
              className="h-6 w-6 object-contain"
              onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
            />
            <span className="text-sm font-semibold text-amber-300">{apiItem.name}</span>
            <span className="text-xs text-slate-400">(ID {apiItem.id})</span>
          </div>
        )}
        {/* แถบสถานะ BSB เหนือระดับ — ใช้ min-h สำรองพื้นที่ กันเลย์เอาต์ขยับ */}
        <div className="min-h-[1.4em] text-sm font-bold text-emerald-400">
          {useBSB && bsbInRange && (
            <>กำลังใช้ BSB ({bsbTable[stack.length]} ชิ้น)</>
          )}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ระดับการตีบวก</span>
          {/* Level badge ใหญ่ + glow เปลี่ยนสีตามผลลัพธ์ล่าสุด */}
          <div
            className={`relative flex h-[88px] w-32 items-center justify-center rounded-2xl border bg-gradient-to-b transition-colors duration-300 ${
              lastResult === 'success'
                ? 'border-emerald-400/50 from-emerald-400/15 to-transparent shadow-[0_0_28px_rgba(52,211,153,0.25)]'
                : lastResult === 'fail'
                ? 'border-rose-400/50 from-rose-500/15 to-transparent shadow-[0_0_28px_rgba(244,63,94,0.22)]'
                : 'border-amber-400/40 from-amber-400/15 to-transparent shadow-[0_0_24px_rgba(251,191,36,0.18)]'
            }`}
          >
            <span
              className={`text-5xl font-extrabold leading-none transition-colors duration-300 ${
                lastResult === 'success' ? 'text-emerald-300' : lastResult === 'fail' ? 'text-rose-300' : 'text-amber-300'
              }`}
              style={{ textShadow: '0 2px 10px rgba(251,191,36,0.35)' }}
            >
              +{stack.length}
            </span>
          </div>
          {/* Badge ผลลัพธ์ — สำรองความสูงกันเลย์เอาต์ขยับ */}
          <div className="flex min-h-[2.25rem] items-center">
            {lastResult === 'success' && (
              <span
                key={`ok-${stack.length}`}
                className="animate-pop-in inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-4 py-1.5 text-sm font-bold text-emerald-300"
              >
                <span className="text-base">✓</span> สำเร็จ!
              </span>
            )}
            {lastResult === 'fail' && !isItemLost && (
              <span
                key={`fail-${stack.length}`}
                className="animate-pop-in inline-flex items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300"
              >
                <span className="text-base">✕</span> ล้มเหลว
              </span>
            )}
            {isItemLost && (
              <span
                key="lost"
                className="animate-pop-in inline-flex animate-pulse items-center gap-1.5 rounded-full border border-rose-400/60 bg-rose-500/25 px-4 py-1.5 text-sm font-bold text-rose-200"
              >
                <span className="text-base">⚠</span> ไอเทมหาย!
              </span>
            )}
          </div>
        </div>

        <div className="relative w-full max-w-[350px]" style={{ aspectRatio: '262 / 301' }}>
          {mode === 'wait' && renderFrames(waitingFrames, 'wait')}
          {mode === 'process' && renderFrames(processingFrames, 'process')}
          {mode === 'success' && renderFrames(successFrames, 'success')}
          {mode === 'fail' && renderFrames(failFrames, 'fail')}
        </div>

        <div className="flex min-h-[48px] w-full items-center justify-center gap-3">
          {mode === 'fail' && (
            <button
              className="w-[130px] rounded-md border border-amber-400 bg-[#23272f] px-3 py-2.5 font-bold text-amber-300 transition-colors hover:bg-[#2c313c]"
              onClick={handleBackToWait}
            >
              กลับไป
            </button>
          )}
          <button
            className={`w-[130px] rounded-md px-3 py-2.5 font-bold shadow transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-600 ${
              (stack.length === 0 && (mode !== 'success' || !isSuccessLoop))
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-400 text-white'
                : 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900'
            }`}
            onClick={handleRefine}
            disabled={isPlaying || mode === 'process' || (mode === 'fail' && isItemLost)}
          >
            {(stack.length === 0 && (mode !== 'success' || !isSuccessLoop)) ? 'อัพเกรด' : 'เริ่มอีกครั้ง'}
            <div className="text-sm text-black/80">Rate: ({Math.floor(currentRate)}%)</div>
          </button>
        </div>
      </div>
      </div>

      {/* Stack log */}
      <div>
        <div className="mb-1.5 text-left text-base font-bold text-white">Stack log:</div>
        <div
          className="max-h-[280px] min-h-[160px] w-full overflow-y-auto rounded-xl border border-slate-700/60 bg-[#0f1117] p-4 text-left text-sm [overflow-wrap:anywhere]"
          ref={el => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <ul className="space-y-1.5">
            {log.map((item, idx) => (
              <li key={idx} className="leading-relaxed text-slate-200">
                {item.itemType && ITEM_TYPE_LABELS[item.itemType] && (
                  <span className="mr-1.5 inline-block rounded bg-[#3a2e1e] px-1.5 py-0.5 align-middle text-[0.78em] font-bold text-amber-300">
                    {ITEM_TYPE_LABELS[item.itemType]}
                  </span>
                )}
                <span
                  className={`mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[0.78em] font-bold ${
                    item.useCash ? 'bg-[#3a3220] text-amber-300' : 'bg-[#1e2a3a] text-sky-300'
                  }`}
                >
                  {item.useCash ? 'หิน Cash' : 'หินปกติ'}
                </span>
                {item.useBSB && (
                  <span className="mr-1.5 inline-block rounded bg-[#1e3a23] px-1.5 py-0.5 align-middle text-[0.78em] font-bold text-emerald-400">
                    BSB{item.bsbConsumed > 0 ? ` ×${item.bsbConsumed}` : ''}
                  </span>
                )}
                {renderColoredLog(item.msg)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* สรุปการใช้ไอเทมทั้งหมด */}
      {(() => {
        const num = (v) => Number(v) || 0;
        const unitLabel = currency === 'baht' ? '฿' : 'Zenny';
        const fmt = (v) => (currency === 'baht' ? `฿${num(v).toLocaleString('en-US')}` : `${num(v).toLocaleString('en-US')} Zenny`);
        const rows = [
          { key: 'normal', label: 'หินตีบวกธรรมดา', unit: 'ก้อน', qty: normalStoneUsed, icon: normalStoneImg },
          { key: 'cash', label: 'หินตีบวก Cash', unit: 'ก้อน', qty: cashStoneUsed, icon: cashStoneImg },
          { key: 'bsb', label: 'Black Smith Blessing', unit: 'ชิ้น', qty: bsbUsedTotal, icon: bsbImg },
        ];
        const grandTotal = rows.reduce((sum, r) => sum + r.qty * num(prices[r.key]), 0);
        return (
          <div className="rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <b className="text-lg font-bold text-amber-300">สรุปการใช้ไอเทมทั้งหมด</b>
              <div role="group" aria-label="สกุลเงิน" className="inline-flex overflow-hidden rounded-lg border border-slate-600">
                <button
                  type="button"
                  onClick={() => setCurrency('zenny')}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    currency === 'zenny' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Zenny
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('baht')}
                  className={`border-l border-slate-600 px-3 py-1.5 text-sm transition-colors ${
                    currency === 'baht' ? 'bg-amber-400 font-bold text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ฿ บาท
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-[#0f1117] px-3 py-2.5 text-sm">
                  <img src={r.icon} alt={r.key} className="h-[22px] w-[22px] object-contain" />
                  <span className="min-w-[120px] font-medium text-amber-400">{r.label}:</span>
                  <span className="font-bold text-white">{r.qty}</span>
                  <span className="text-slate-400">{r.unit}</span>
                  <span className="text-slate-500">×</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={prices[r.key]}
                    onChange={(e) => setPrices((p) => ({ ...p, [r.key]: e.target.value }))}
                    placeholder="ราคา/หน่วย"
                    className="w-24 rounded-md border border-slate-600 bg-[#181a20] px-2 py-1 text-right text-white outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-slate-400">{unitLabel}</span>
                  <span className="text-slate-500">=</span>
                  <span className="ml-auto font-bold text-emerald-300">{fmt(r.qty * num(prices[r.key]))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5">
              <span className="font-bold text-amber-300">รวมทั้งหมด</span>
              <span className="text-lg font-bold text-emerald-300">{fmt(grandTotal)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Container
