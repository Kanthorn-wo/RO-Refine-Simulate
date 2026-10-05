import React from 'react';
import { useLang } from '../../contexts/LangContext';

const HeroBanner = ({ onStart }) => {
  const { t } = useLang();
  return (
    <header>
      <div className="relative w-full overflow-hidden rounded-2xl shadow-lg shadow-black/40">
        {/* responsive: มือถือโหลดไฟล์เล็ก (srcset ต้องตรงกับ <link rel="preload"> ใน index.html/en) */}
        <img
          src="/og-image.webp"
          srcSet="/hero-480.webp 480w, /hero-768.webp 768w, /hero-1024.webp 1024w, /og-image.webp 1200w"
          sizes="(max-width: 1024px) 100vw, 1024px"
          alt={t('hero_alt')}
          width="1200"
          height="634"
          fetchPriority="high"
          className="w-full block h-auto"
        />
        {/* ปุ่มเชิญชวน: pulse ring + ลูกศรเด้ง (ปิดเมื่อ prefers-reduced-motion) → กดแล้วเลื่อนลงไปกล่องตีบวก */}
        <button
          type="button"
          onClick={onStart}
          className="hero-cta absolute bottom-16 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border-2 border-amber-200/80 bg-amber-400 px-5 py-2 text-sm font-extrabold text-slate-900 shadow-lg shadow-black/60 transition-transform hover:scale-105 active:scale-95 sm:bottom-24 sm:px-7 sm:py-2.5 sm:text-base"
        >
          {t('hero_cta')}
          <span className="hero-cta-arrow ml-1.5 inline-block" aria-hidden="true">▼</span>
        </button>
      </div>
      <h1 className="sr-only">{t('hero_h1')}</h1>
    </header>
  );
};

export default HeroBanner;
