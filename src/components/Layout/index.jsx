import React, { useEffect, useState, useRef } from 'react';
import './index.css'
import bgRefiningWait00 from 'assets/images/waiting/bg_refining_wait_00.bmp';
import bgRefiningWait01 from 'assets/images/waiting/bg_refining_wait_01.bmp';
import bgRefiningWait02 from 'assets/images/waiting/bg_refining_wait_02.bmp';
import bgRefiningWait03 from 'assets/images/waiting/bg_refining_wait_03.bmp';
import souneEffect01 from 'assets/sounds/bs_refine_1.wav';
import souneEffect02 from 'assets/sounds/bs_refine_2.wav';
import souneEffectSuccess from 'assets/sounds/bs_refine_success.wav';
import souneEffectFail from 'assets/sounds/bs_refine_failed.wav';

import bgRefineProcessing00 from 'assets/images/processing/bg_refininga_process_00.bmp';
import bgRefineProcessing01 from 'assets/images/processing/bg_refininga_process_01.bmp';
import bgRefineProcessing02 from 'assets/images/processing/bg_refininga_process_02.bmp';
import bgRefineProcessing03 from 'assets/images/processing/bg_refininga_process_03.bmp';
import bgRefineProcessing04 from 'assets/images/processing/bg_refininga_process_04.bmp';
import bgRefineProcessing05 from 'assets/images/processing/bg_refininga_process_05.bmp';
import bgRefineProcessing06 from 'assets/images/processing/bg_refininga_process_06.bmp';
import bgRefineProcessing07 from 'assets/images/processing/bg_refininga_process_07.bmp';
import bgRefineProcessing08 from 'assets/images/processing/bg_refininga_process_08.bmp';
import bgRefineProcessing09 from 'assets/images/processing/bg_refining_process_09.bmp';
import bgRefineProcessing10 from 'assets/images/processing/bg_refining_process_10.bmp';
import bgRefineProcessing11 from 'assets/images/processing/bg_refining_process_11.bmp';
import bgRefineProcessing12 from 'assets/images/processing/bg_refining_process_12.bmp';

import bgRefineSuccess00 from 'assets/images/success/bg_refining_success_00.bmp';
import bgRefineSuccess01 from 'assets/images/success/bg_refining_success_01.bmp';
import bgRefineSuccess02 from 'assets/images/success/bg_refining_success_02.bmp';
import bgRefineSuccess03 from 'assets/images/success/bg_refining_success_03.bmp';
import bgRefineSuccess04 from 'assets/images/success/bg_refining_success_04.bmp';
import bgRefineSuccess05 from 'assets/images/success/bg_refining_success_05.bmp';
import bgRefineSuccess06 from 'assets/images/success/bg_refining_success_06.bmp';
import bgRefineSuccess07 from 'assets/images/success/bg_refining_success_07.bmp';
import bgRefineSuccess08 from 'assets/images/success/bg_refining_success_08.bmp';
import bgRefineSuccess09 from 'assets/images/success/bg_refining_success_09.bmp';
import bgRefineSuccess10 from 'assets/images/success/bg_refining_success_10.bmp';
import bgRefineSuccess11 from 'assets/images/success/bg_refining_success_11.bmp';
import bgRefineSuccess12 from 'assets/images/success/bg_refining_success_12.bmp';
import bgRefineSuccess13 from 'assets/images/success/bg_refining_success_13.bmp';
import bgRefineSuccess14 from 'assets/images/success/bg_refining_success_14.bmp';
import bgRefineSuccess15 from 'assets/images/success/bg_refining_success_15.bmp';
import bgRefineSuccess16 from 'assets/images/success/bg_refining_success_16.bmp';

import bgRefineFail00 from 'assets/images/fail/bg_refining_fail_00.bmp';
import bgRefineFail01 from 'assets/images/fail/bg_refining_fail_01.bmp';
import bgRefineFail02 from 'assets/images/fail/bg_refining_fail_02.bmp';
import bgRefineFail03 from 'assets/images/fail/bg_refining_fail_03.bmp';
import bgRefineFail04 from 'assets/images/fail/bg_refining_fail_04.bmp';
import bgRefineFail05 from 'assets/images/fail/bg_refining_fail_05.bmp';
import bgRefineFail06 from 'assets/images/fail/bg_refining_fail_06.bmp';
import bgRefineFail07 from 'assets/images/fail/bg_refining_fail_07.bmp';
import bgRefineFail08 from 'assets/images/fail/bg_refining_fail_08.bmp';
import bgRefineFail09 from 'assets/images/fail/bg_refining_fail_09.bmp';
import bgRefineFail10 from 'assets/images/fail/bg_refining_fail_10.bmp';
import bgRefineFail11 from 'assets/images/fail/bg_refining_fail_11.bmp';
import bgRefineFail12 from 'assets/images/fail/bg_refining_fail_12.bmp';
import bgRefineFail13 from 'assets/images/fail/bg_refining_fail_13.bmp';
import bgRefineFail14 from 'assets/images/fail/bg_refining_fail_14.bmp';
import bgRefineFail15 from 'assets/images/fail/bg_refining_fail_15.bmp';
import bgRefineFail16 from 'assets/images/fail/bg_refining_fail_16.bmp';
import bgRefineFail17 from 'assets/images/fail/bg_refining_fail_17.bmp';
import bgRefineFail18 from 'assets/images/fail/bg_refining_fail_18.bmp';
import bgRefineFail19 from 'assets/images/fail/bg_refining_fail_19.bmp';

import normalStoneImg from 'assets/images/blacksmith_blessing.png';
import cashStoneImg from 'assets/images/blacksmith_blessing.png';
import bsbImg from 'assets/images/blacksmith_blessing.png';

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

  const frame_wait = [
    bgRefiningWait00,
    bgRefiningWait01,
    bgRefiningWait02,
    bgRefiningWait03
  ];

  const frame_processing = [
    bgRefineProcessing00,
    bgRefineProcessing01,
    bgRefineProcessing02,
    bgRefineProcessing03,
    bgRefineProcessing04,
    bgRefineProcessing05,
    bgRefineProcessing06,
    bgRefineProcessing07,
    bgRefineProcessing08,
    bgRefineProcessing09,
    bgRefineProcessing10,
    bgRefineProcessing11,
    bgRefineProcessing12,

  ];

  const frame_success = [
    bgRefineSuccess00,
    bgRefineSuccess01,
    bgRefineSuccess02,
    bgRefineSuccess03,
    bgRefineSuccess04,
    bgRefineSuccess05,
    bgRefineSuccess06,
    bgRefineSuccess07,
    bgRefineSuccess08,
    bgRefineSuccess09,
    bgRefineSuccess10,
    bgRefineSuccess11,
    bgRefineSuccess12,
    bgRefineSuccess13,
    bgRefineSuccess14,
    bgRefineSuccess15,
    bgRefineSuccess16,
  ];

  const frame_fail = [
    bgRefineFail00, bgRefineFail01, bgRefineFail02, bgRefineFail03, bgRefineFail04, bgRefineFail05, bgRefineFail06, bgRefineFail07, bgRefineFail08, bgRefineFail09, bgRefineFail10, bgRefineFail11, bgRefineFail12, bgRefineFail13, bgRefineFail14, bgRefineFail15, bgRefineFail16, bgRefineFail17, bgRefineFail18, bgRefineFail19
  ];

  // อัตราสำเร็จแต่ละเลเวล (index 0 = level 1)
  const refineRates = [
    1,    // 1: 100%
    1,    // 2: 100%
    1,    // 3: 100%
    1,    // 4: 100%
    0.6,  // 5: 60%
    0.4,  // 6: 40%
    0.4,  // 7: 40%
    0.2,  // 8: 20%
    0.2,  // 9: 20%
    0.09, // 10: 9%
    0.08, // 11: 8%
    0.08, // 12: 8%
    0.08, // 13: 8%
    0.08, // 14: 8%
    0.07, // 15: 7%
    0.07, // 16: 7%
    0.07, // 17: 7%
    0.07, // 18: 7%
    0.05, // 19: 5%
    0.05  // 20: 5%
  ];

  // อัตราสำเร็จแต่ละเลเวล (index 0 = level 1) สำหรับ cash
  const refineRatesCash = [
    1,    // 1: 100%
    1,    // 2: 100%
    1,    // 3: 100%
    1,    // 4: 100%
    0.9,  // 5: 90%
    0.7,  // 6: 70%
    0.7,  // 7: 70%
    0.4,  // 8: 40%
    0.4,  // 9: 40%
    0.2,  // 10: 20%
    0.08, // 11: 8%
    0.08, // 12: 8%
    0.08, // 13: 8%
    0.08, // 14: 8%
    0.07, // 15: 7%
    0.07, // 16: 7%
    0.07, // 17: 7%
    0.07, // 18: 7%
    0.05, // 19: 5%
    0.05  // 20: 5%
  ];

  // จำนวน BSB ที่ต้องใช้แต่ละระดับ (index 0 = +1)
  const bsbRequired = [
    0, 0, 0, 0, 0, 0, 0, // +1 ถึง +6 ไม่ใช้
    1, // +7→+8
    2, // +8→+9
    4, // +9→+10
    7, // +10→+11
    11, // +11→+12
    16, // +12→+13
    22  // +13→+14
  ];

  // แสดงภาพ wait แบบวนลูปเมื่อไม่ได้ process
  useEffect(() => {
    if (mode === 'wait') {
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % frame_wait.length);
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
        if (i < frame_processing.length) {
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
        if (i < frame_success.length) {
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
    const rateArr = useCash ? refineRatesCash : refineRates;
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
    }
    if (isSuccess) {
      newStack.push({ time: new Date().toLocaleTimeString() });
      logMsg = `+${stack.length} → +${stack.length + 1} : สำเร็จ (${rate * 100}%)`;
    } else if (canUseBSB) {
      setBsbCount(prev => prev - bsbUsed);
      logMsg = `+${stack.length} → +${stack.length} : ล้มเหลว (ใช้ Black Smith Blessing ${bsbUsed} ชิ้น ป้องกันลดระดับ) (${rate * 100}%)`;
    } else if (useCash && stack.length > 0) {
      newStack = newStack.slice(0, -1);
      logMsg = `+${stack.length} → +${stack.length - 1} : ล้มเหลว (ลดระดับ) (${rate * 100}%)`;
    } else if (!useCash) {
      setIsItemLost(true);
      newStack = [];
      logMsg = `+${stack.length} → +0 : ล้มเหลว (ไอเทมหาย) (${rate * 100}%)`;
      playFailSound = true;
    }
    setStack(newStack);
    setLog(prev => [...prev, { msg: logMsg }]);
    setIsFail(!isSuccess);
    if (!isSuccess && !useCash && !canUseBSB) {
      // ถ้าไอเทมหาย ให้เล่นเสียง fail
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
  const rateArr = useCash ? refineRatesCash : refineRates;
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
            mode === 'wait' ? frame_wait[index] :
              mode === 'process' ? frame_processing[index] :
                mode === 'fail' ? frame_fail[index] :
                  frame_success[index]
          }
          alt={`Frame ${index + 1}`}
          style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
        />
        <div className="button-row">
          {mode === 'fail' && (
            <button className="wait-btn" onClick={handleBackToWait}>
              กลับไป
            </button>
          )}

          <button
            className="refine-btn"
            onClick={handleRefine}
            disabled={isPlaying || mode === 'process' || (mode === 'fail' && !useCash)}
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
