import React, { useEffect, useState, useRef } from 'react';
import './index.css'
import DateTimeDisplay from '../DateTimeDisplay';
import DailyInfoPanel from '../DailyInfoPanel';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import normalStoneImg from 'assets/images/blacksmith_blessing.png';
import cashStoneImg from 'assets/images/blacksmith_blessing.png';
import bsbImg from 'assets/images/blacksmith_blessing.png';
import { REFINE_RATES_NORMAL, REFINE_RATES_CASH, BSB_REQUIRED } from '../../constants/refineConfig';

// ตารางอัตราสำเร็จการตีบวก (%) แยก normal/cash ตามประเภทไอเท็ม
const REFINE_RATES_TABLE_NORMAL = {
  armor1: [100, 100, 100, 100, 60, 40, 20, 20, 20, 9, 20, 20, 16, 16, 15, 15, 14, 14, 10, 10],
  armor2: [100, 100, 80, 80, 80, 60, 40, 40, 40, 18, 16, 16, 16, 16, 14, 14, 14, 14, 10, 10],
  weapon1: [100, 100, 100, 100, 100, 100, 100, 100, 100, 19, 40, 40, 35, 35, 30, 30, 20, 20, 15, 15],
  weapon2: [100, 100, 100, 100, 100, 100, 95, 60, 20, 19, 40, 40, 35, 35, 30, 30, 20, 20, 15, 15],
  weapon3: [100, 100, 100, 100, 80, 60, 40, 20, 20, 9, 20, 20, 16, 16, 15, 15, 14, 14, 10, 10],
  weapon4: [100, 100, 100, 80, 80, 60, 40, 40, 40, 18, 16, 16, 16, 16, 14, 14, 14, 14, 10, 10],
  weapon5: [100, 100, 100, 80, 60, 60, 40, 40, 40, 18, 16, 16, 16, 16, 14, 14, 14, 14, 10, 10],
};
const REFINE_RATES_TABLE_CASH = {
  armor1: [100, 100, 100, 100, 95, 80, 80, 60, 50, 35, 20, 20, 16, 16, 15, 15, 14, 14, 10, 10],
  armor2: [100, 100, 100, 95, 85, 70, 65, 55, 45, 25, 20, 20, 20, 20, 15, 15, 15, 15, 10, 10],
  weapon1: [100, 100, 100, 100, 100, 100, 100, 95, 85, 55, 40, 40, 35, 35, 30, 30, 20, 20, 15, 15],
  weapon2: [100, 100, 100, 100, 100, 100, 95, 85, 60, 45, 40, 40, 35, 35, 30, 30, 20, 20, 15, 15],
  weapon3: [100, 100, 100, 100, 100, 95, 90, 70, 60, 45, 40, 40, 35, 35, 30, 30, 20, 20, 15, 15],
  weapon4: [100, 100, 100, 95, 95, 80, 80, 60, 50, 35, 20, 20, 16, 16, 15, 15, 14, 14, 10, 10],
  weapon5: [100, 100, 100, 95, 85, 70, 65, 55, 45, 25, 20, 20, 20, 20, 15, 15, 15, 15, 10, 10],
};
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
  const [bsbCount, setBsbCount] = useState(30000); // จำนวน BSB เริ่มต้น
  const [itemType, setItemType] = useState('armor1'); // เพิ่ม state สำหรับประเภทไอเท็ม
  const rateTableType = useCash ? 'cash' : 'normal'; // 'normal' หรือ 'cash'
  const intervalRef = useRef(null);

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
    const rateArr = useCash ? REFINE_RATES_TABLE_CASH : REFINE_RATES_TABLE_NORMAL;
    const rate = rateArr[itemType][Math.min(currentLevel - 1, 19)] / 100;
    const isSuccess = Math.random() < rate;
    let newStack = [...stack];
    let logMsg = '';
    let playFailSound = false;
    let bsbUsed = 0;
    // เช็ค BSB เงื่อนไข
    let canUseBSB = false;
    if (useBSB && currentLevel >= 7 && currentLevel <= 14) {
      bsbUsed = BSB_REQUIRED[currentLevel - 1] || 0;
      canUseBSB = bsbCount >= bsbUsed && bsbUsed > 0;
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
      logMsg = `+${stack.length} → +${stack.length + 1} : สำเร็จ (${rate * 100}%)`;
    } else if (canUseBSB) {
      // ใช้ BSB ป้องกันการลดระดับและการหายของไอเทม (ทั้งหินธรรมดาและแครช)
      setBsbCount(prev => prev - bsbUsed);
      logMsg = `+${stack.length} → +${stack.length} : ล้มเหลว (ใช้ Black Smith Blessing ${bsbUsed} ชิ้น ป้องกัน${useCash ? 'ลดระดับ' : 'ไอเทมหาย'}) (${rate * 100}%)`;
    } else if ((itemType === 'weapon5' || itemType === 'armor2') && !isSuccess) {
      // เงื่อนไขพิเศษสำหรับ Weapon Lv.5 และ Armor Lv.2
      if (useCash && stack.length > 0) {
        // หินแครช ลด 1 ระดับ
        newStack = newStack.slice(0, -1);
        logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ 1 ขั้น) (${rate * 100}%)`;
      } else if (!useCash && stack.length > 0) {
        // หินธรรมดา ลด 3 ระดับ
        const newLevel = Math.max(0, stack.length - 3);
        newStack = newStack.slice(0, newLevel);
        logMsg = `+${stack.length} → +${newLevel} : ล้มเหลว (ลดระดับ 3 ขั้น) (${rate * 100}%)`;
      } else if (!useCash && stack.length === 0) {
        // กรณี +0 อยู่แล้ว (กัน array underflow)
        setIsItemLost(true);
        newStack = [];
        logMsg = `+0 → +0 : ล้มเหลว (ไอเทมหาย) (${rate * 100}%)`;
        playFailSound = true;
      }
    } else if (useCash && stack.length > 0) {
      // หินแครชไม่ใช้ BSB - ลดระดับ (ประเภทอื่น)
      newStack = newStack.slice(0, -1);
      logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ) (${rate * 100}%)`;
    } else if (!useCash) {
      // หินธรรมดาไม่ใช้ BSB - ไอเทมหาย (ประเภทอื่น)
      setIsItemLost(true);
      newStack = [];
      logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย) (${rate * 100}%)`;
      playFailSound = true;
    }
    setStack(newStack);
    setLog(prev => [...prev, { msg: logMsg }]);
    setIsFail(!isSuccess);

    // เช็คเงื่อนไขการเล่นเสียงและสิ้นสุดเกม
    if (!isSuccess && !useCash && !canUseBSB) {
      // หินธรรมดาล้มเหลวและไม่ใช้ BSB = ไอเทมหาย
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

  // คำนวณอัตราสำเร็จปัจจุบัน
  const currentLevel = stack.length + 1;
  // ดึงอัตราสำเร็จจากตารางตามประเภทและชนิดหิน
  const currentRate = (rateTableType === 'cash' ? REFINE_RATES_TABLE_CASH : REFINE_RATES_TABLE_NORMAL)[itemType][Math.min(currentLevel - 1, 19)];

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

  return (
    <div className="container-refine">
      {/* แสดงวันที่และเวลาปัจจุบัน */}
      <DateTimeDisplay />

      {/* แสดงข้อมูลประจำวัน */}
      <DailyInfoPanel />

      {/* Dropdown เลือกประเภทไอเท็ม */}

      {/* ตารางอัตราสำเร็จ */}
      <div style={{ marginBottom: 18, background: '#181a20', borderRadius: 8, padding: 12, color: '#fff', marginLeft: 'auto', marginRight: 'auto', fontSize: '0.98em', overflowX: 'auto' }}>
        <b style={{ color: '#ffcc33' }}>ตารางอัตราสำเร็จการตีบวก (%)</b>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ minWidth: 520, width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: '0.98em', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#23272f' }}>
                <th style={{ color: '#ffb347', padding: 4, border: '1px solid #333', minWidth: 60 }}>ระดับ</th>
                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                  <th key={key} style={{ color: '#ffb347', padding: 4, border: '1px solid #333', minWidth: 90, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(20)].map((_, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#23272f' : '#181a20' }}>
                  <td style={{ color: '#ffcc33', padding: 4, border: '1px solid #333', fontWeight: 'bold', textAlign: 'center' }}>+{i + 1}</td>
                  {Object.keys(ITEM_TYPE_LABELS).map(type => (
                    <td key={type} style={{ color: type === itemType ? '#fff' : '#bbb', padding: 4, border: '1px solid #333', fontWeight: type === itemType ? 'bold' : 'normal', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(useCash ? REFINE_RATES_TABLE_CASH : REFINE_RATES_TABLE_NORMAL)[type][i]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className='refine-frame'>

        <div className="refine-options">
          <label className="refine-option-label">
            <input type="checkbox" checked={useCash} onChange={e => setUseCash(e.target.checked)} />
            ใช้หินตีบวก Cash
          </label>
          <label className="refine-option-label">
            <input
              type="checkbox"
              checked={useBSB}
              disabled={stack.length < 7 || stack.length > 13 || bsbCount < (BSB_REQUIRED[stack.length] || 0)}
              onChange={e => setUseBSB(e.target.checked)}
            />
            ใช้ BSB
            <span className="refine-bsb-info">
              (มี {bsbCount} ชิ้น)
            </span>
            {stack.length >= 7 && stack.length <= 13 && BSB_REQUIRED[stack.length] > 0 && (
              <span className={`refine-bsb-need ${bsbCount >= BSB_REQUIRED[stack.length] ? 'enough' : 'not-enough'}`}>
                ต้องใช้ {BSB_REQUIRED[stack.length]} ชิ้น
              </span>
            )}
          </label>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="item-type" style={{ color: '#fff', fontWeight: 'bold', marginRight: 8 }}>
              ประเภทไอเท็ม:
            </label>
            <select
              id="item-type"
              value={itemType}
              onChange={e => setItemType(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #888',
                fontSize: '1em',
                background: '#181a20',
                color: '#ffcc33',
                fontWeight: 'bold',
                marginRight: 8
              }}
            >
              {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12, fontSize: '1.2rem', color: '#ffcc33', fontWeight: 'bold' }}>
          ระดับการตีบวก: +{stack.length}
          {lastResult === 'success' && <span style={{ color: '#4caf50', marginLeft: 12 }}>สำเร็จ!</span>}
          {lastResult === 'fail' && !isItemLost && <span style={{ color: '#e53935', marginLeft: 12 }}>ล้มเหลว</span>}
          {isItemLost && <div style={{ color: '#e53935', marginLeft: 12 }}>ไอเทมหาย!</div>}
        </div>
        <div style={{ position: 'relative', width: '100%', height: 'auto', minHeight: 220, maxWidth: 350 }}>
          {/* Render all frames for current mode, show only the current index */}
          {mode === 'wait' && waitingFrames.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`wait-frame-${i}`}
              style={{
                display: index === i ? 'block' : 'none',
                width: '100%',
                height: 'auto',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                borderRadius: 12,
                border: '2px solid #444',
                background: '#181a20',
              }}
            />
          ))}
          {mode === 'process' && processingFrames.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`process-frame-${i}`}
              style={{
                display: index === i ? 'block' : 'none',
                width: '100%',
                height: 'auto',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                borderRadius: 12,
                border: '2px solid #444',
                background: '#181a20',
              }}
            />
          ))}
          {mode === 'success' && successFrames.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`success-frame-${i}`}
              style={{
                display: index === i ? 'block' : 'none',
                width: '100%',
                height: 'auto',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                borderRadius: 12,
                border: '2px solid #444',
                background: '#181a20',
              }}
            />
          ))}
          {mode === 'fail' && failFrames.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`fail-frame-${i}`}
              style={{
                display: index === i ? 'block' : 'none',
                width: '100%',
                height: 'auto',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                borderRadius: 12,
                border: '2px solid #444',
                background: '#181a20',
              }}
            />
          ))}
        </div>
        <div
          className={`button-row ${mode}`}
        >
          {mode === 'fail' && (
            <button className="wait-btn" onClick={handleBackToWait}>
              กลับไป
            </button>
          )}
          <button
            className={`refine-btn${((stack.length === 0 && (mode !== 'success' || !isSuccessLoop))) ? ' upgrade' : ''}`}
            onClick={handleRefine}
            disabled={isPlaying || mode === 'process' || (mode === 'fail' && isItemLost)}
          >
            {(stack.length === 0 && (mode !== 'success' || !isSuccessLoop)) ? 'อัพเกรด' : 'เริ่มอีกครั้ง'}
            <div style={{ fontSize: '14px', color: '#000000' }}>Rate: ({Math.floor(currentRate)}%)</div>
          </button>
        </div>
      </div>
      {/* หัวข้อ log แยกออกมานอกกล่อง log */}
      <div className="stack-log-label">Stack log:</div>
      <div className="stack-log" ref={el => {
        if (el) el.scrollTop = el.scrollHeight;
      }}>
        <ul>
          {log.map((item, idx) => (
            <li key={idx}>{item.msg} <span style={{ color: '#888', marginLeft: 8 }}>{item.time}</span></li>
          ))}
        </ul>
      </div>
      {/* สรุปการใช้ไอเทมทั้งหมด */}
      <div className="item-summary-wrapper">
        <b className="item-summary-title">สรุปการใช้ไอเทมทั้งหมด:</b>
        <ul className="item-summary-list">
          <li>
            <img src={normalStoneImg} alt="normal stone" className="item-icon" />
            <span className="item-summary-label">หินตีบวกธรรมดา:</span> {normalStoneUsed} ก้อน
          </li>
          <li>
            <img src={cashStoneImg} alt="cash stone" className="item-icon" />
            <span className="item-summary-label">หินตีบวก Cash:</span> {cashStoneUsed} ก้อน
          </li>
          <li>
            <img src={bsbImg} alt="Black Smith Blessing" className="item-icon" />
            <span className="item-summary-label">Black Smith Blessing:</span> {bsbUsedTotal} ชิ้น
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Container
