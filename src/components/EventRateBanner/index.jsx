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

const Flame = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2c.6 3.2-.6 4.9-2.1 6.4C8.3 10 7 11.6 7 14a5 5 0 0 0 10 0c0-1.2-.4-2.3-1-3.2-.9 1-2 1.4-2 1.4.8-2.6.3-5.5-2-8.2z" />
  </svg>
);

// แถบ sticky บนสุดตอนเปิด Event Rate Up — พื้นหลังไฟลุก (CSS ใน index.css)
const EventRateBanner = () => {
  const { t } = useLang();
  return (
    <div className="event-fire-bar event-fire-enter sticky top-0 z-40 w-full overflow-hidden shadow-lg shadow-orange-950/60">
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
        <Flame className="h-6 w-6 animate-pulse text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] sm:h-9 sm:w-9" />
        <div className="text-center">
          <div className="text-base font-extrabold uppercase tracking-[0.2em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:text-2xl">
            Event Rate Up
          </div>
          <div className="text-[0.62rem] font-semibold text-amber-100/90 sm:text-xs">
            {t('event_banner_sub')}
          </div>
        </div>
        <Flame className="h-6 w-6 animate-pulse text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] sm:h-9 sm:w-9" />
      </div>
    </div>
  );
};

export default EventRateBanner;
