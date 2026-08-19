// User-Agent เฉพาะของ health-check bot (monitoring/run.js ผ่าน Playwright)
// ใช้แยก traffic ของ bot ออกจากผู้ใช้จริงทั้งฝั่ง server (api/stats.js) และ client (useOnlineCount.js)
export const BOT_UA_SIGNATURE = 'RO-Refine-HealthCheck'

export function isBotUA(ua) {
  return typeof ua === 'string' && ua.includes(BOT_UA_SIGNATURE)
}
