import React, { useEffect, useState, useRef } from 'react';
import './index.css'
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import normalStoneImg from 'assets/images/blacksmith_blessing.png';
import cashStoneImg from 'assets/images/blacksmith_blessing.png';
import bsbImg from 'assets/images/blacksmith_blessing.png';
import { REFINE_RATES_NORMAL, REFINE_RATES_CASH, BSB_REQUIRED } from '../../constants/refineConfig';

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
  return `/src/assets/images/${folder}/${prefix}${num}.bmp`;
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
    const rateArr = useCash ? REFINE_RATES_CASH : REFINE_RATES_NORMAL;
    const rate = rateArr[Math.min(currentLevel - 1, rateArr.length - 1)];
    const isSuccess = Math.random() < rate;
    let newStack = [...stack];
    let logMsg = '';
    let playFailSound = false;
    let bsbUsed = 0;
    // เช็ค BSB เงื่อนไข
    let canUseBSB = false;
    if (useBSB && currentLevel >= 7 && currentLevel <= 14) {
      bsbUsed = bsbRequired[currentLevel - 1] || 0;
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
    } if (isSuccess) {
      newStack.push({ time: new Date().toLocaleTimeString() });
      logMsg = `+${stack.length} → +${stack.length + 1} : สำเร็จ (${rate * 100}%)`;
    } else if (canUseBSB) {
      // ใช้ BSB ป้องกันการลดระดับและการหายของไอเทม (ทั้งหินธรรมดาและแครช)
      setBsbCount(prev => prev - bsbUsed);
      logMsg = `+${stack.length} → +${stack.length} : ล้มเหลว (ใช้ Black Smith Blessing ${bsbUsed} ชิ้น ป้องกัน${useCash ? 'ลดระดับ' : 'ไอเทมหาย'}) (${rate * 100}%)`;
    } else if (useCash && stack.length > 0) {
      // หินแครชไม่ใช้ BSB - ลดระดับ
      newStack = newStack.slice(0, -1);
      logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ) (${rate * 100}%)`;
    } else if (!useCash) {
      // หินธรรมดาไม่ใช้ BSB - ไอเทมหาย
      setIsItemLost(true);
      newStack = [];
      logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย) (${rate * 100}%)`;
      playFailSound = true;
    } setStack(newStack);
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
  const rateArr = useCash ? REFINE_RATES_CASH : REFINE_RATES_NORMAL;
  const currentRate = rateArr[Math.min(currentLevel - 1, rateArr.length - 1)] * 100;

  return (
    <div className="container-refine">
      <div className='refine-frame'>
        <div style={{ marginBottom: 12, fontSize: '1.2rem', color: '#ffcc33', fontWeight: 'bold' }}>
          ระดับการตีบวก: +{stack.length}
          {lastResult === 'success' && <span style={{ color: '#4caf50', marginLeft: 12 }}>สำเร็จ!</span>}
          {lastResult === 'fail' && !isItemLost && <span style={{ color: '#e53935', marginLeft: 12 }}>ล้มเหลว</span>}
          {isItemLost && <div style={{ color: '#e53935', marginLeft: 12 }}>ไอเทมหาย!</div>}
        </div>
        <div className="refine-options">
          <label className="refine-option-label">
            <input type="checkbox" checked={useCash} onChange={e => setUseCash(e.target.checked)} />
            ใช้หินตีบวก Cash
          </label>
          <label className="refine-option-label">
            <input
              type="checkbox"
              checked={useBSB}
              disabled={stack.length < 7 || stack.length > 13 || bsbCount < (bsbRequired[stack.length] || 0)}
              onChange={e => setUseBSB(e.target.checked)}
            />
            ใช้ BSB
            <span className="refine-bsb-info">
              (มี {bsbCount} ชิ้น)
            </span>
            {stack.length >= 7 && stack.length <= 13 && bsbRequired[stack.length] > 0 && (
              <span className={`refine-bsb-need ${bsbCount >= bsbRequired[stack.length] ? 'enough' : 'not-enough'}`}>
                ต้องใช้ {bsbRequired[stack.length]} ชิ้น
              </span>
            )}
          </label>
        </div>
        <img
          src={
            mode === 'wait' ? getFrameSrc('waiting', index) :
              mode === 'process' ? getFrameSrc('processing', index) :
                mode === 'fail' ? getFrameSrc('fail', index) :
                  getFrameSrc('success', index)
          }
          alt={`Frame ${index + 1}`}
          style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
        />
        <div className="button-row">
          {mode === 'fail' && (
            <button className="wait-btn" onClick={handleBackToWait}>
              กลับไป
            </button>
          )}          <button
            className="refine-btn"
            onClick={handleRefine}
            disabled={isPlaying || mode === 'process' || (mode === 'fail' && isItemLost)}
          >
            {stack.length === 0 ? 'อัพเกรด' : 'เริ่มอีกครั้ง'}
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
