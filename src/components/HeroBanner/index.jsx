import React from 'react';

const HeroBanner = () => (
  <header>
    <div className="w-full overflow-hidden rounded-2xl shadow-lg shadow-black/40">
      <img
        src="/og-image.png"
        alt="RO Refine Simulator — จำลองตีบวก Ragnarok Online"
        className="w-full block"
      />
    </div>
    <h1 className="sr-only">จำลองตีบวก Ragnarok Online | RO Refine Simulator</h1>
  </header>
);

export default HeroBanner;
