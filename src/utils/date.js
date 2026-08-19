// วันที่ปัจจุบัน (หรือ n วันก่อน) โซนไทย (UTC+7, ไม่มี DST) เป็น 'YYYY-MM-DD'
// ใช้ร่วมกันทั้งฝั่ง client (usageStats.js, dashboard) และ server (api/stats.js) — เดิมคำนวณแยกกัน 3 ที่
export const bkkDaysAgo = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10)
export const bkkToday = () => bkkDaysAgo(0)
