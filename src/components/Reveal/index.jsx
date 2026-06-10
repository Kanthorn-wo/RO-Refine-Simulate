import React, { useEffect, useRef, useState } from 'react';

// Scroll reveal: ลูกค่อย ๆ ลอยขึ้น + จางเข้ามาเมื่อ scroll มาถึง (เล่นครั้งเดียวต่อ section)
// - ใช้ IntersectionObserver, ปิด animation อัตโนมัติถ้า user ตั้ง prefers-reduced-motion
// - ตอน shown แล้วจะถอด class transform ออกหมด (กัน transform ค้างไปสร้าง containing block
//   ให้ position:fixed ของลูกหลานเพี้ยน)
const Reveal = ({ children, className = '' }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? '' : 'translate-y-8 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
};

export default Reveal;
