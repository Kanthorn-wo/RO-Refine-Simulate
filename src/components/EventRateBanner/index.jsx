import React, { useState, useEffect } from 'react';
import { useLang } from '../../contexts/LangContext';

// ลูกไฟลอยขึ้น — กระจายตำแหน่ง/จังหวะให้ดูสุ่ม
const EMBERS = [
  { left: '6%', delay: '0s', dur: '2.4s', size: 5 },
  { left: '18%', delay: '0.9s', dur: '3s', size: 4 },
  { left: '32%', delay: '0.4s', dur: '2.2s', size: 6 },
  { left: '47%', delay: '1.5s', dur: '2.9s', size: 4 },
  { left: '61%', delay: '0.2s', dur: '2.5s', size: 5 },
  { left: '74%', delay: '1.1s', dur: '3.2s', size: 5 },
  { left: '88%', delay: '0.6s', dur: '2.6s', size: 4 },
];

// ไอคอน "Rate Up": เปลวไฟ gradient ปลายขาวร้อน (ไหวเบา ๆ) + ลูกศรขึ้นเด้ง
const RateUpIcon = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="rateupFlame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#7f1d1d" />
        <stop offset="38%" stopColor="#ea580c" />
        <stop offset="74%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#fff7cc" />
      </linearGradient>
    </defs>
    <g className="event-flame-icon">
      <path
        fill="url(#rateupFlame)"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1"
        d="M24 3c1.6 8.4-1.6 12.9-5.4 16.7C15 23.2 12 27 12 32a12 12 0 0 0 24 0c0-3-1-5.7-2.6-7.9-2 2.4-4.6 3.3-4.6 3.3 2-6.4.8-14.3-4.8-21.4z"
      />
    </g>
    <g className="rateup-arrow" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 37v-8.5" />
      <path d="M19.8 32.7 24 28.5l4.2 4.2" />
    </g>
  </svg>
);

const Chevron = ({ up, className }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {up ? <path d="M3 10l5-5 5 5" /> : <path d="M3 6l5 5 5-5" />}
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

// แถบ Event Rate Up — fixed บนสุด morph ระหว่างแถบเต็มจอ ↔ pill มุมขวาบน
// + กรอบไฟล้อมขอบเพจ (absolute เลื่อนตามหน้า อยู่หลัง content)
// onClose = ปิด Event (setIsEventRate(false)), onToggle = ย่อ/ขยายแถบ
const EventRateBanner = ({ active, collapsed, onToggle, onClose }) => {
  const { t } = useLang();
  // slide เข้า/ออก: active=true → flip เป็น translate-y-0 (สไลด์ลง), active=false → -translate-y-full (สไลด์ขึ้นกลับ)
  // (parent คง mount ไว้ระหว่างสไลด์ออกก่อน unmount จริง)
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (active) {
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
  }, [active]);
  return (
    <>
    {/* กรอบไฟขอบซ้าย-ขวา — absolute เลื่อนตามหน้า อยู่หลัง content (z-[-1]) ไม่บังกล่อง/ไม่รับคลิก
        (ไม่มีลูกไฟลอยจากล่างแล้ว — เอาออกตามที่ต้องการแค่ขอบข้าง) */}
    <div className="event-fire-edge" aria-hidden="true" />

    <div
      role={collapsed ? 'button' : undefined}
      tabIndex={collapsed ? 0 : undefined}
      aria-label={collapsed ? t('event_expand') : undefined}
      title={collapsed ? t('event_expand') : undefined}
      onClick={collapsed ? onToggle : undefined}
      onKeyDown={collapsed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      className={`event-fire-bar fixed top-0 right-0 z-40 overflow-hidden shadow-lg shadow-orange-950/60 transition-all duration-500 ease-in-out ${
        shown ? 'translate-y-0' : '-translate-y-full'
      } ${
        collapsed
          ? 'event-pill-mode mt-2 mr-3 h-9 w-[178px] cursor-pointer rounded-full ring-1 ring-amber-200/50 hover:scale-105'
          : 'mt-0 mr-0 h-14 w-full rounded-none sm:h-20'
      }`}
    >
      {/* เปลวไฟ 2 ชั้น (div จริงซ้อนกัน) — แทน ::before/::after เดิม กัน bleed/jitter */}
      <div className="event-flame-1" aria-hidden="true" />
      <div className="event-flame-2" aria-hidden="true" />

      {/* glow + ลูกไฟ — จางหายตอนย่อ */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
        <div className="event-fire-glow absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(253,224,71,0.3),transparent_70%)]" />
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="event-ember"
            style={{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.dur }}
          />
        ))}
      </div>

      {/* ชั้นเนื้อหาเต็ม */}
      <div className={`absolute inset-0 z-[1] transition-opacity duration-300 ${collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center gap-2.5 px-4 sm:gap-4">
          <RateUpIcon className="h-9 w-9 drop-shadow-[0_0_8px_rgba(253,224,71,0.85)] sm:h-13 sm:w-13" />
          <div className="text-center">
            <div className="text-base font-extrabold uppercase tracking-[0.2em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:text-2xl">
              Event Rate Up
            </div>
            <div className="text-[0.62rem] font-semibold text-amber-100/90 sm:text-xs">
              {t('event_banner_sub')}
            </div>
          </div>
          <RateUpIcon className="h-9 w-9 drop-shadow-[0_0_8px_rgba(253,224,71,0.85)] sm:h-13 sm:w-13" />
        </div>
        {/* ปุ่มย่อ + ปิด (มุมขวา) */}
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 sm:right-4">
          <button
            type="button"
            onClick={onToggle}
            aria-label={t('event_collapse')}
            title={t('event_collapse')}
            className="rounded-full border border-white/40 bg-black/25 p-1.5 text-white transition-colors hover:bg-black/50"
          >
            <Chevron up className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('event_close')}
            title={t('event_close')}
            className="rounded-full border border-white/40 bg-black/25 p-1.5 text-white transition-colors hover:bg-rose-500/70"
          >
            <CloseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {/* ชั้นเนื้อหา pill */}
      <div className={`absolute inset-0 z-[1] flex items-center justify-center gap-1.5 px-2 transition-opacity duration-300 ${collapsed ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <RateUpIcon className="h-5 w-5 shrink-0 drop-shadow-[0_0_5px_rgba(253,224,71,0.85)]" />
        <span className="text-xs font-extrabold uppercase tracking-wider text-white drop-shadow">Rate Up</span>
        {/* ปิด Event (เล็กในพิลล์) — กันไม่ให้คลิกทะลุไปขยาย */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={t('event_close')}
          title={t('event_close')}
          className="ml-0.5 shrink-0 rounded-full bg-black/30 p-0.5 text-white transition-colors hover:bg-rose-500/80"
        >
          <CloseIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
    </>
  );
};

export default EventRateBanner;
