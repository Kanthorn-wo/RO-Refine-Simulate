import React from 'react';

const HeroBanner = () => (
  <header>
    <div className="w-full overflow-hidden rounded-2xl shadow-lg shadow-black/40">
      {/* responsive: มือถือโหลดไฟล์เล็ก (srcset ต้องตรงกับ <link rel="preload"> ใน index.html/en) */}
      <img
        src="/og-image.webp"
        srcSet="/hero-480.webp 480w, /hero-768.webp 768w, /hero-1024.webp 1024w, /og-image.webp 1200w"
        sizes="(max-width: 1024px) 100vw, 1024px"
        alt="RO Refine Simulator — จำลองตีบวก Ragnarok Online"
        width="1200"
        height="634"
        fetchPriority="high"
        className="w-full block h-auto"
      />
    </div>
    <h1 className="sr-only">จำลองตีบวก Ragnarok Online | RO Refine Simulator</h1>
  </header>
);

export default HeroBanner;
