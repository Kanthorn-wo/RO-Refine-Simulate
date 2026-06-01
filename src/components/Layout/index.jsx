import React, { useEffect, useState, useRef } from 'react';
import DateTimeDisplay from '../DateTimeDisplay';
import DailyInfoPanel from '../DailyInfoPanel';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import bsbImg from 'assets/images/blacksmith_blessing.png';
import { BSB_REQUIRED_NORMAL, BSB_REQUIRED_EVENT } from '../../constants/refineConfig';

// ตารางอัตราสำเร็จการตีบวก (%) — 4 ชุด ตามแกน: มี/ไม่มี event × หินปกติ/หินแครช (Cash)
// index 0 = ระดับ +1 ... index 19 = ระดับ +20
//  - noevent: รูป "แร่ธรรมดา" (normal) และ "HD/Enriched" (cash)
//  - event:   รูป Grade & Refine Rate Up (ตารางซ้าย = normal, ตารางขวา = cash)
// หมายเหตุ: คู่ noevent ในต้นฉบับไม่มีคอลัมน์ Armor Lv.2 / Weapon Lv.5 จึงใช้เรทเดิม (คัดจากคู่ event)
const RATE_TABLES = {
  noevent: {
    normal: {
      armor1:  [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,   8,   8,   8,   8,   7,   7,   7,   7,   5,   5],
      armor2:  [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
      weapon1: [100, 100, 100, 100, 100, 100, 100,  60,  40,  19,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon2: [100, 100, 100, 100, 100, 100,  60,  40,  20,  19,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon3: [100, 100, 100, 100, 100,  60,  50,  20,  20,  19,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon4: [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,   8,   8,   8,   8,   7,   7,   7,   7,   5,   5],
      weapon5: [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
    },
    cash: {
      armor1:  [100, 100, 100, 100,  90,  70,  70,  40,  40,  20,   8,   8,   8,   8,   7,   7,   7,   7,   5,   5],
      armor2:  [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
      weapon1: [100, 100, 100, 100, 100, 100, 100,  90,  70,  30,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon2: [100, 100, 100, 100, 100, 100,  90,  70,  40,  30,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon3: [100, 100, 100, 100, 100,  90,  80,  40,  40,  30,  18,  18,  18,  18,  18,  17,  17,  17,  15,  15],
      weapon4: [100, 100, 100, 100,  90,  70,  70,  40,  40,  20,   8,   8,   8,   8,   7,   7,   7,   7,   5,   5],
      weapon5: [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
    },
  },
  event: {
    normal: {
      armor1:  [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
      armor2:  [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
      weapon1: [100, 100, 100, 100, 100, 100, 100,  60,  40,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon2: [100, 100, 100, 100, 100, 100,  60,  50,  20,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon3: [100, 100, 100, 100, 100,  60,  50,  20,  20,  19,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon4: [100, 100, 100, 100,  60,  40,  40,  20,  20,   9,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
      weapon5: [100, 100, 100,  80,  80,  60,  60,  40,  40,  18,  16,  16,  16,  16,  14,  14,  14,  14,  10,  10],
    },
    cash: {
      armor1:  [100, 100, 100, 100,  95,  80,  80,  60,  50,  35,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
      armor2:  [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
      weapon1: [100, 100, 100, 100, 100, 100, 100,  95,  85,  55,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon2: [100, 100, 100, 100, 100, 100,  95,  85,  60,  45,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon3: [100, 100, 100, 100, 100,  95,  90,  70,  60,  45,  40,  40,  35,  35,  30,  30,  20,  20,  15,  15],
      weapon4: [100, 100, 100, 100,  95,  80,  80,  60,  50,  35,  20,  20,  16,  16,  15,  15,  14,  14,  10,  10],
      weapon5: [100, 100, 100,  95,  85,  70,  65,  55,  45,  25,  20,  20,  20,  20,  15,  15,  15,  15,  10,  10],
    },
  },
};

// เลือกตาราง rate ตามสถานะ event และชนิดหิน
const getRateTable = (isEventRate, useCash) =>
  RATE_TABLES[isEventRate ? 'event' : 'noevent'][useCash ? 'cash' : 'normal'];

// Enriched เพิ่มโอกาสสำเร็จจากตารางหินปกติ (clamp ไม่เกิน 100%)
const ENRICHED_RATE_BONUS = 10;
const getRate = (isEventRate, useCash, useEnriched, itemType, idx) => {
  const base = getRateTable(isEventRate, useCash)[itemType][Math.min(idx, 19)];
  return useEnriched ? Math.min(100, base + ENRICHED_RATE_BONUS) : base;
};

// ป้ายชื่อ/สีของชนิดหิน (ใช้ในแผน auto)
const STONE_META = {
  normal:   { label: 'ปกติ',     active: 'border-sky-400 bg-sky-500/20 text-sky-200' },
  enriched: { label: 'Enriched', active: 'border-amber-400 bg-amber-400/20 text-amber-200' },
  hd:       { label: 'HD',       active: 'border-orange-400 bg-orange-500/20 text-orange-200' },
};

// หาชนิดหินที่ควรใช้ที่ระดับ level (currentLevel) ตามแผน rules — ช่วงที่ from <= level สูงสุด
const getPlannedStone = (rules, level) => {
  let stone = 'normal';
  for (const r of [...rules].sort((a, b) => a.from - b.from)) {
    if (r.from <= level) stone = r.stone;
  }
  if (stone === 'enriched' && level > 10) stone = 'normal'; // Enriched ใช้ได้ +1-10 เท่านั้น
  return stone;
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

// แร่ที่ใช้ตีบวกตามประเภทไอเท็ม (ประเภททั่วไป): low = +1-10, high = +11-20
// แยกตามชนิดหิน: normal = หินปกติ (ล้มหาย), cash = HD (ล้มลดระดับ), enriched = Enriched (Cash ล้มหาย+โอกาสสูง, ใช้ +1-10 เท่านั้น)
const ORE_BY_TYPE = {
  armor1:  { normal: { low: 'Elunium',      high: 'Carnium' }, cash: { low: 'HD Elunium',  high: 'HD Carnium' }, enriched: { low: 'Enriched Elunium' } },
  weapon1: { normal: { low: 'Phracon',      high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon2: { normal: { low: 'Emveretarcon', high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon3: { normal: { low: 'Oridecon',     high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon4: { normal: { low: 'Oridecon',     high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
};

// แร่พิเศษของ Weapon Lv.5 / Armor Lv.2 — แยก 3 ช่วงระดับ × ชนิดหิน (normal = หินปกติ, cash = หินแครช)
// ช่วง: low = +0-10, mid = +11-14, high = +15-20
const SPECIAL_ORE = {
  weapon5: {
    low:  { normal: 'Etherdeocon',      cash: 'Enriched Etherdeocon' },
    mid:  { normal: 'HD Etherdeocon',   cash: 'Ether Bradium' },
    high: { normal: 'HD Ether Bradium', cash: 'Ether Bradium' },
  },
  armor2: {
    low:  { normal: 'Ethernium',        cash: 'Enriched Ethernium' },
    mid:  { normal: 'HD Ethernium',     cash: 'Ether Carnium' },
    high: { normal: 'HD Ether Carnium', cash: 'Ether Carnium' },
  },
};

// สีจุดนำหน้าแร่แต่ละชนิด (ใช้ในชิป/สรุป)
const ORE_COLORS = {
  Elunium: 'bg-sky-400',
  Carnium: 'bg-cyan-300',
  Phracon: 'bg-slate-300',
  Emveretarcon: 'bg-zinc-300',
  Oridecon: 'bg-orange-400',
  Bradium: 'bg-rose-400',
  'HD Oridecon': 'bg-orange-300',
  'HD Bradium': 'bg-rose-300',
  'HD Elunium': 'bg-sky-300',
  'HD Carnium': 'bg-cyan-200',
  'Enriched Oridecon': 'bg-amber-200',
  'Enriched Elunium': 'bg-indigo-200',
  Etherdeocon: 'bg-amber-400',
  'Enriched Etherdeocon': 'bg-amber-300',
  'HD Etherdeocon': 'bg-yellow-400',
  'Ether Bradium': 'bg-red-400',
  'HD Ether Bradium': 'bg-red-300',
  Ethernium: 'bg-teal-300',
  'Enriched Ethernium': 'bg-teal-200',
  'HD Ethernium': 'bg-emerald-400',
  'Ether Carnium': 'bg-emerald-300',
  'HD Ether Carnium': 'bg-green-300',
};

// รูปไอคอนแร่ (ถ้าไม่มีรูปจะ fallback เป็นจุดสีจาก ORE_COLORS)
const ORE_IMAGES = {
  Phracon: '/images/ores/phracon.png',
  Emveretarcon: '/images/ores/emveretarcon.png',
  Oridecon: '/images/ores/oridecon.png',
  Bradium: '/images/ores/bradium.png',
  Elunium: '/images/ores/elunium.png',
  Carnium: '/images/ores/carnium.png',
  'HD Oridecon': '/images/ores/hd-oridecon.png',
  'HD Bradium': '/images/ores/hd-bradium.png',
  'HD Elunium': '/images/ores/hd-elunium.png',
  'HD Carnium': '/images/ores/hd-carnium.png',
  'Enriched Oridecon': '/images/ores/enriched-oridecon.png',
  'Enriched Elunium': '/images/ores/enriched-elunium.png',
};

// แร่ที่ใช้ตามประเภทไอเท็ม + ระดับปัจจุบัน (level = +N ที่กำลังจะตีต่อ) + ชนิดหิน
const getOreName = (itemType, level, useCash, useEnriched) => {
  const special = SPECIAL_ORE[itemType];
  if (special) {
    const range = level <= 10 ? 'low' : level <= 14 ? 'mid' : 'high';
    return special[range][useCash ? 'cash' : 'normal'];
  }
  const m = ORE_BY_TYPE[itemType];
  if (!m) return null;
  // Enriched ใช้เฉพาะ +1-10 (ไม่มีสาย high) — เกิน 10 fallback เป็นหินปกติ high
  if (useEnriched && m.enriched && level <= 10) return m.enriched.low;
  const set = useCash ? m.cash : m.normal;
  return level <= 10 ? set.low : set.high;
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
  const [useCash, setUseCash] = useState(false); // true = หิน HD (ล้มลดระดับ)
  const [useEnriched, setUseEnriched] = useState(false); // true = หิน Enriched (Cash ล้มหาย + โอกาสสูง)
  const [isItemLost, setIsItemLost] = useState(false);
  const [log, setLog] = useState([]); // log สำหรับแสดงผลทุก action
  const [useBSB, setUseBSB] = useState(false);
  const [itemType, setItemType] = useState('armor1'); // เพิ่ม state สำหรับประเภทไอเท็ม
  const [isEventRate, setIsEventRate] = useState(false); // false = ไม่มี event, true = Event Rate Up
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
  // ระบบ Auto ตีบวก: ตีอัตโนมัติจนถึงเป้าหมายที่ตั้งไว้
  const [autoRefine, setAutoRefine] = useState(false); // เปิด/ปิดโหมด auto
  const [autoTarget, setAutoTarget] = useState(10); // เป้าหมายระดับ (+N) ที่จะตีถึง
  const [autoRunning, setAutoRunning] = useState(false); // กำลังตี auto อยู่
  // แผนชนิดหินแต่ละช่วงระหว่าง auto: รายการ { id, from, stone } — ระดับใด ๆ ใช้หินของช่วงที่ from <= ระดับ สูงสุด
  const [autoStoneRules, setAutoStoneRules] = useState([{ id: 0, from: 1, stone: 'normal' }]);
  const nextRuleId = useRef(1);
  const [autoUseBSB, setAutoUseBSB] = useState(false); // เปิด/ปิดการใส่ BSB อัตโนมัติระหว่าง auto
  const [autoBSBStart, setAutoBSBStart] = useState(7); // ระดับที่จะเริ่มใส่ BSB (BSB ใช้ได้ +7→+14)
  const [autoBSBEnd, setAutoBSBEnd] = useState(15); // ระดับที่จะเลิกใส่ BSB (exclusive; 15 = ครอบถึง +14)

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
      // เงื่อนไขพิเศษสำหรับ Weapon Lv.5 และ Armor Lv.2
      if (stack.length >= 10) {
        // +10 ขึ้นไป: ล้มเหลว = ไอเทมถูกทำลายทันที ไม่ว่าจะใช้หินชนิดใด
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
      useEnriched,
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

  // Auto ตีบวก: เมื่อรอบที่แล้วจบ (isPlaying = false) ให้ตีต่อจนถึงเป้าหรือไอเทมหาย
  useEffect(() => {
    if (!autoRunning) return;
    if (isPlaying || mode === 'process') return; // รอ animation/เสียงรอบนี้จบก่อน
    // หยุดเมื่อถึงเป้าหมาย
    if (stack.length >= autoTarget) { setAutoRunning(false); return; }
    // หยุดเมื่อไอเทมหาย (ต้องเริ่มไอเทมใหม่)
    if (isItemLost) { setAutoRunning(false); return; }
    // ปรับชนิดหินตามแผนของระดับถัดไป (currentLevel = stack.length + 1) ก่อน แล้วรอ re-render ค่อยตี
    const plannedStone = getPlannedStone(autoStoneRules, stack.length + 1);
    const wantCash = plannedStone === 'hd';
    const wantEnriched = plannedStone === 'enriched';
    if (wantCash !== useCash || wantEnriched !== useEnriched) {
      setUseCash(wantCash);
      setUseEnriched(wantEnriched);
      return;
    }
    // ใส่/ถอด BSB ตามช่วง [start, end)
    if (autoUseBSB) {
      const wantBSB = stack.length >= autoBSBStart && stack.length < autoBSBEnd;
      if (wantBSB !== useBSB) {
        setUseBSB(wantBSB);
        return;
      }
    }
    const t = setTimeout(() => handleRefine(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunning, isPlaying, mode, stack.length, isItemLost, autoTarget, autoStoneRules, useCash, useEnriched, autoUseBSB, autoBSBStart, autoBSBEnd, useBSB]);

  // เปลี่ยนเป้าหมาย → ปลายทาง BSB อัพเดตตาม target (อยู่ในกรอบ 8..15)
  useEffect(() => {
    setAutoBSBEnd(Math.min(Math.max(autoTarget, 8), 15));
  }, [autoTarget]);
  useEffect(() => {
    setAutoBSBEnd((v) => Math.min(Math.max(v, autoBSBStart + 1), 15));
  }, [autoBSBStart]);

  // เริ่ม/หยุด auto ตีบวก
  const handleStartAuto = () => {
    if (autoRunning || isPlaying) return;
    if (stack.length >= autoTarget) return; // ถึงเป้าหมายอยู่แล้ว
    setIsItemLost(false); // กันสถานะไอเทมหายค้างทำให้ auto หยุดทันที
    setLastResult(null);
    setAutoRunning(true);
  };
  const handleStopAuto = () => setAutoRunning(false);

  // จัดการแผนชนิดหินแต่ละช่วง (auto)
  const updateRuleStone = (id, stone) => setAutoStoneRules(rs => rs.map(r => r.id === id ? { ...r, stone } : r));
  // แก้ระดับเริ่มของช่วง → บังคับให้มากกว่าช่วงก่อนหน้า และดันช่วงถัด ๆ ให้เพิ่มขึ้นตาม (cascade)
  const updateRuleFrom = (id, newFrom) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0) return rs; // ช่วงแรกล็อคที่ +1
    const next = rs.map(r => ({ ...r }));
    next[idx].from = Math.max(newFrom, next[idx - 1].from + 1);
    for (let j = idx + 1; j < next.length; j++) {
      if (next[j].from <= next[j - 1].from) next[j].from = Math.min(next[j - 1].from + 1, 20);
    }
    return next;
  });
  const addStoneRule = () => setAutoStoneRules(rs => {
    const last = rs[rs.length - 1];
    if (last.from >= 20) return rs; // เต็มแล้ว
    return [...rs, { id: nextRuleId.current++, from: Math.min(last.from + 1, 20), stone: 'normal' }];
  });
  const removeStoneRule = (id) => setAutoStoneRules(rs => {
    const idx = rs.findIndex(r => r.id === id);
    if (idx <= 0) return rs; // ลบช่วงแรก (baseline +1) ไม่ได้
    return rs.filter(r => r.id !== id);
  });

  const handleBackToWait = () => {
    setAutoRunning(false);
    setMode('wait');
    setIndex(0);
    setIsSuccessLoop(false);
    setIsFail(false);
    setIsItemLost(false); // เคลียร์สถานะไอเทมหาย ไม่งั้นเริ่ม auto/ตีใหม่ไม่ได้
    setLastResult(null);
    setStack([]);
  };

  // เลือกเริ่มที่ระดับตีบวกใด ๆ — กระโดดไประดับนั้นทันทีและเคลียร์ผลลัพธ์ค้าง
  // (rate/ปุ่ม/ตาราง derive จาก stack.length อยู่แล้ว จึงสอดคล้องกันเอง)
  const handleStartLevelChange = (level) => {
    setAutoRunning(false);
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

  // Enriched ใช้ได้เฉพาะ +1-10 — พอถึง +10 ขึ้นไปให้กลับไปหินปกติอัตโนมัติ
  useEffect(() => {
    if (useEnriched && stack.length >= 10) setUseEnriched(false);
  }, [useEnriched, stack.length]);

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
  // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน (Enriched บวกโบนัส)
  const currentRate = getRate(isEventRate, useCash, useEnriched, itemType, currentLevel - 1);
  // แร่ที่จะใช้ในการตีครั้งถัดไป (ตามระดับปัจจุบัน + ชนิดหิน)
  const nextOre = getOreName(itemType, stack.length, useCash, useEnriched);

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
            ตารางอัตราสำเร็จการตีบวก (%) — {isEventRate ? 'Event Rate Up' : 'ไม่มี Event'} · {useEnriched ? 'Enriched' : useCash ? 'HD' : 'หินปกติ'}
          </b>
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

        {/* เลือกชนิดหิน: ปกติ / Enriched / HD */}
        <div className="mt-4 rounded-xl border border-slate-700/60 bg-[#0f1117] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">ชนิดหิน</span>
            {autoRunning && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[0.7rem] font-bold text-indigo-300">ควบคุมโดย Auto</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => { setUseCash(false); setUseEnriched(false); }}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                !useCash && !useEnriched ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="block text-sm font-bold">หินปกติ</span>
              <span className="block text-[0.65rem]">ล้มหาย</span>
            </button>
            <button
              type="button"
              disabled={itemType === 'weapon5' || itemType === 'armor2' || stack.length >= 10}
              title={itemType === 'weapon5' || itemType === 'armor2' ? 'ไอเทมนี้ไม่มี Enriched' : stack.length >= 10 ? 'Enriched ใช้ได้ +1-10 เท่านั้น' : ''}
              onClick={() => { setUseCash(false); setUseEnriched(true); }}
              className={`rounded-lg border px-2 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                useEnriched ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="block text-sm font-bold">Enriched</span>
              <span className="block text-[0.65rem]">ล้มหาย +โอกาส</span>
            </button>
            <button
              type="button"
              onClick={() => { setUseCash(true); setUseEnriched(false); }}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                useCash && !useEnriched ? 'border-orange-400 bg-orange-500/20 text-orange-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="block text-sm font-bold">HD</span>
              <span className="block text-[0.65rem]">ล้มลดระดับ</span>
            </button>
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
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[0.7rem] font-bold text-indigo-300">ควบคุมโดย Auto</span>
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
            disabled={!bsbInRange}
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
              onChange={(v) => { setAutoRefine(v); if (!v) setAutoRunning(false); }}
              disabled={autoRunning}
              activeColor="bg-indigo-500"
            />
          </div>
          {autoRefine && (
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="auto-target" className="text-sm font-semibold text-slate-300">
                ตีถึงระดับ
              </label>
              <div className="relative flex-1">
                <select
                  id="auto-target"
                  value={autoTarget}
                  onChange={(e) => setAutoTarget(Number(e.target.value))}
                  disabled={autoRunning}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2 pr-10 font-bold text-indigo-300 outline-none transition-colors hover:border-indigo-400/70 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Array.from({ length: 20 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-[#0f1117] text-indigo-300">+{i + 1}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300">▾</span>
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
                  const minFrom = i === 0 ? 1 : autoStoneRules[i - 1].from + 1;
                  return (
                    <div key={rule.id} className="rounded-lg border border-slate-700 bg-[#0f1117] p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">ตั้งแต่</span>
                        <div className="relative">
                          <select
                            value={rule.from}
                            onChange={(e) => updateRuleFrom(rule.id, Number(e.target.value))}
                            disabled={autoRunning || i === 0}
                            className="cursor-pointer appearance-none rounded-lg border border-slate-600 bg-[#181a20] py-1 pl-2 pr-6 text-sm font-bold text-indigo-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {Array.from({ length: 20 - minFrom + 1 }, (_, n) => minFrom + n).map((lvl) => (
                              <option key={lvl} value={lvl} className="bg-[#0f1117]">+{lvl}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-indigo-300">▾</span>
                        </div>
                        <span className="text-xs text-slate-500">ถึง +{toLevel}</span>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removeStoneRule(rule.id)}
                            disabled={autoRunning}
                            title="ลบช่วงนี้"
                            aria-label="ลบช่วงนี้"
                            className="ml-auto rounded p-1 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {['normal', 'enriched', 'hd'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateRuleStone(rule.id, s)}
                            disabled={autoRunning}
                            className={`rounded-md border px-1 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              rule.stone === s ? STONE_META[s].active : 'border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            {STONE_META[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addStoneRule}
                disabled={autoRunning}
                className="mt-2 w-full rounded-lg border border-dashed border-slate-600 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-indigo-400/70 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + เพิ่มช่วง
              </button>
            </div>
          )}
          {autoRefine && (
            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">ใส่ BSB อัตโนมัติระหว่างทาง</div>
                  <div className="mt-0.5 text-xs text-slate-400">ใส่ BSB เฉพาะช่วงที่กำหนด (BSB ใช้ได้ +7→+14)</div>
                </div>
                <Toggle
                  checked={autoUseBSB}
                  onChange={setAutoUseBSB}
                  disabled={autoRunning}
                  activeColor="bg-emerald-500"
                />
              </div>
              {autoUseBSB && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="auto-bsb-start" className="mb-1 block text-xs font-semibold text-slate-300">
                      เริ่มใส่ BSB ที่
                    </label>
                    <div className="relative">
                      <select
                        id="auto-bsb-start"
                        value={autoBSBStart}
                        onChange={(e) => setAutoBSBStart(Number(e.target.value))}
                        disabled={autoRunning}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2 pr-10 font-bold text-emerald-300 outline-none transition-colors hover:border-emerald-400/70 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {Array.from({ length: 8 }, (_, i) => {
                          const lvl = 7 + i; // 7..14
                          return <option key={lvl} value={lvl} className="bg-[#0f1117] text-emerald-300">+{lvl}</option>;
                        })}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300">▾</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="auto-bsb-end" className="mb-1 block text-xs font-semibold text-slate-300">
                      เลิกใส่ BSB ที่
                    </label>
                    <div className="relative">
                      <select
                        id="auto-bsb-end"
                        value={autoBSBEnd}
                        onChange={(e) => setAutoBSBEnd(Number(e.target.value))}
                        disabled={autoRunning}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-600 bg-[#0f1117] px-4 py-2 pr-10 font-bold text-emerald-300 outline-none transition-colors hover:border-emerald-400/70 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {Array.from({ length: Math.max(0, 15 - autoBSBStart) }, (_, i) => {
                          const lvl = autoBSBStart + 1 + i; // (start+1)..15
                          return <option key={lvl} value={lvl} className="bg-[#0f1117] text-emerald-300">+{lvl}</option>;
                        })}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300">▾</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* หน้าต่างตีบวก — การ์ดสไตล์เดียวกับกล่อง option ให้ดูสมดุลกัน */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700/60 bg-[#181a20]/90 p-5 shadow-lg shadow-black/30 lg:flex-1 lg:justify-center">
        {/* ป้ายบอกว่ากำลังตีบวกไอเทมชิ้นไหน (เฉพาะเมื่อไอเทมปัจจุบันมาจากการค้นด้วย ID) */}
        {!apiLoading && apiItem && apiItem.type === itemType && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-1.5">
            <img
              key={apiItem.id}
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

        {/* แร่ที่จะใช้ในการตีครั้งถัดไป (ตามระดับปัจจุบัน + ชนิดหิน) */}
        {nextOre && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-[#0f1117] px-3 py-1.5 text-sm">
            {ORE_IMAGES[nextOre] ? (
              <img src={ORE_IMAGES[nextOre]} alt={nextOre} className="h-5 w-5 object-contain" />
            ) : (
              <span className={`h-2.5 w-2.5 rounded-full ${ORE_COLORS[nextOre] || 'bg-slate-400'}`} />
            )}
            <span className="text-slate-400">แร่ที่จะใช้:</span>
            <span className="font-semibold text-amber-300">{nextOre}</span>
          </div>
        )}
        <div className="flex min-h-[48px] w-full flex-nowrap items-center justify-center gap-2">
          {mode === 'fail' && (
            <button
              className="w-full min-w-0 max-w-[130px] flex-1 rounded-md border border-amber-400 bg-[#23272f] px-3 py-2.5 font-bold text-amber-300 transition-colors hover:bg-[#2c313c]"
              onClick={handleBackToWait}
            >
              กลับไป
            </button>
          )}
          <button
            className={`w-full min-w-0 max-w-[130px] flex-1 rounded-md px-3 py-2.5 font-bold shadow transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-600 ${
              (stack.length === 0 && (mode !== 'success' || !isSuccessLoop))
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-400 text-white'
                : 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900'
            }`}
            onClick={handleRefine}
            disabled={isPlaying || autoRunning || mode === 'process' || (mode === 'fail' && isItemLost)}
          >
            {(stack.length === 0 && (mode !== 'success' || !isSuccessLoop)) ? 'อัพเกรด' : 'เริ่มอีกครั้ง'}
            <div className="text-sm text-black/80">Rate: ({Math.floor(currentRate)}%)</div>
          </button>
          {autoRefine && (
            autoRunning ? (
              <button
                className="w-full min-w-0 max-w-[130px] flex-1 rounded-md bg-gradient-to-r from-rose-500 to-orange-400 px-3 py-2.5 font-bold text-white shadow transition-transform hover:-translate-y-0.5"
                onClick={handleStopAuto}
              >
                หยุด Auto
                <div className="text-sm text-black/80">กำลังตี → +{autoTarget}</div>
              </button>
            ) : (
              <button
                className="w-full min-w-0 max-w-[130px] flex-1 rounded-md bg-gradient-to-r from-indigo-500 to-violet-400 px-3 py-2.5 font-bold text-white shadow transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 disabled:text-slate-600"
                onClick={handleStartAuto}
                disabled={isPlaying || mode === 'process' || stack.length >= autoTarget || (mode === 'fail' && isItemLost)}
              >
                เริ่ม Auto
                <div className="text-sm text-white/80">ตีถึง +{autoTarget}</div>
              </button>
            )
          )}
        </div>
      </div>
      </div>

      {/* สรุปจำนวนครั้งที่ตี: ทั้งหมด / สำเร็จ / แตก (คำนวณจาก log) */}
      {(() => {
        const totalAttempts = log.length;
        const successCount = log.filter((l) => l.isSuccess).length;
        const failCount = totalAttempts - successCount;
        const successPct = totalAttempts ? (successCount / totalAttempts) * 100 : 0;
        return (
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
          <div className="pb-3">Stack log:</div>
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
                    item.useEnriched ? 'bg-[#3a3420] text-amber-200' : item.useCash ? 'bg-[#3a3220] text-orange-300' : 'bg-[#1e2a3a] text-sky-300'
                  }`}
                >
                  {item.useEnriched ? 'Enriched' : item.useCash ? 'HD' : 'หินปกติ'}
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
    </div>
  );
};

export default Container
