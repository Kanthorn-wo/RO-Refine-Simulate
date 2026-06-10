import React from 'react';
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

// ไอคอน "Rate Up": เปลวไฟ gradient + ลูกศรชี้ขึ้นสีขาวเด้งเป็นจังหวะ (สื่อว่าอัตราพุ่งขึ้น)
const RateUpIcon = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="rateupFlame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#991b1b" />
        <stop offset="45%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#fde047" />
      </linearGradient>
    </defs>
    {/* เปลวไฟ */}
    <path
      fill="url(#rateupFlame)"
      stroke="rgba(255,255,255,0.55)"
      strokeWidth="1.2"
      d="M24 3c1.6 8.4-1.6 12.9-5.4 16.7C15 23.2 12 27 12 32a12 12 0 0 0 24 0c0-3-1-5.7-2.6-7.9-2 2.4-4.6 3.3-4.6 3.3 2-6.4.8-14.3-4.8-21.4z"
    />
    {/* ลูกศรขึ้น */}
    <g className="rateup-arrow" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 38v-10.5" />
      <path d="M18.8 32.7 24 27.5l5.2 5.2" />
    </g>
  </svg>
);

// แถบ sticky บนสุดตอนเปิด Event Rate Up — พื้นหลังไฟลุก (CSS ใน index.css)
const EventRateBanner = () => {
  const { t } = useLang();
  return (
    <div className="event-fire-bar event-fire-enter fixed inset-x-0 top-0 z-40 w-full overflow-hidden shadow-lg shadow-orange-950/60">
      {/* glow กลางแถบ กระพริบแบบไฟ */}
      <div className="event-fire-glow pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(253,224,71,0.3),transparent_70%)]" />
      {/* ลูกไฟลอยขึ้น */}
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="event-ember"
          style={{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.dur }}
        />
      ))}
      <div className="relative z-[1] mx-auto flex h-14 w-full max-w-4xl items-center justify-center gap-2.5 px-4 sm:h-20 sm:gap-4">
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
    </div>
  );
};

export default EventRateBanner;
