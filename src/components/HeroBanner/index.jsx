import React from 'react';

const HeroBanner = () => (
  <header>
    <div className="w-full overflow-hidden rounded-2xl shadow-lg shadow-black/40">
      <img
        src="/og-image.webp"
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
