// ยิง GA4 event แบบปลอดภัย — ไม่พังถ้า gtag ยังไม่โหลดหรือโดน adblock บล็อก
// ห้ามส่งข้อมูลส่วนตัวใน params (ส่งได้เฉพาะค่า config เกม เช่น ระดับ/ชนิดหิน)
export const trackEvent = (name, params = {}) => {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch {
    /* ignore — analytics ห้ามทำแอปพัง */
  }
};
