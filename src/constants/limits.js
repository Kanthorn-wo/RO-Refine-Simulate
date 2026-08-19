// จำนวนสูงสุดต่อ batch เดียว — ต้องตรงกันทั้ง client (usageStats.js สะสมแล้ว flush) และ server
// (api/stats.js cap delta ต่อ request, api/refine.js cap จำนวนแถวต่อ batch) เดิมกำหนดแยกกัน 3 ที่
export const POST_BATCH_CAP = 200
