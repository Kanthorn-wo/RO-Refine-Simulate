// ค่าตั้งกลางของระบบ monitoring — เพิ่มหน้าใหม่ได้ที่ TARGETS (array)
// หมายเหตุ: เว็บเป็น SPA หน้าเดียว (simulator) + dashboard + api proxy
//   route จริงมีแค่ /dashboard และ catch-all (= simulator ที่ / และ /en/)
//   จึง monitor เฉพาะ "หน้าที่มีอยู่จริง" ไม่ใช่ /item /monster /skill /map (ไม่มีในเว็บนี้)

export const SITE = process.env.MONITOR_SITE || 'https://ro-refine.com';

// type: 'page' = เปิดด้วย browser จริง (Playwright) + วัด js error / failed request / page size
//       'api'  = ยิง request ตรง ๆ (ไม่เปิด browser) เหมาะกับ endpoint ที่คืน JSON
// lighthouse: true = รัน Lighthouse กับหน้านี้ด้วย (เฉพาะหน้าเนื้อหาจริง)
export const TARGETS = [
  { label: 'home-th',   path: '/',                 type: 'page', lighthouse: true,  expectStatus: 200 },
  { label: 'home-en',   path: '/en/',              type: 'page', lighthouse: true,  expectStatus: 200 },
  { label: 'dashboard', path: '/dashboard',        type: 'page', lighthouse: false, expectStatus: 200 },
  { label: 'api-item',  path: '/api/item?id=1101', type: 'api',  lighthouse: false, expectStatus: 200, expectJson: true },
];

// เกณฑ์เตือน — Lighthouse Performance ของ CI runner ผันผวนสูง ตั้งหลวมไว้ก่อน
// (SEO / A11y / Best-Practices เสถียรกว่ามาก ตั้งเข้มได้)
export const THRESHOLDS = {
  lighthouse: {
    performance: 50,
    seo: 85,
    accessibility: 85,
    bestPractices: 85,
  },
  responseTimeMs: 8000, // เกินนี้ถือว่าช้าผิดปกติ
};

// retry เมื่อ request ล้มเหลว (network ของ CI ไม่เสถียร)
export const RETRY = {
  attempts: 3,
  baseDelayMs: 1500, // exponential backoff: 1.5s, 3s, 6s
};

// timeout ต่อการโหลด 1 หน้า
export const NAV_TIMEOUT_MS = 30000;

export const url = (path) => new URL(path, SITE).toString();
