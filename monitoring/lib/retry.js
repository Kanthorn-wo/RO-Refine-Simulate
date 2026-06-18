import { log } from './logger.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// รัน fn พร้อม retry แบบ exponential backoff — โยน error ตัวสุดท้ายถ้าครบจำนวนครั้ง
export async function withRetry(fn, { attempts = 3, baseDelayMs = 1500, label = 'task' } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      log.warn(`retry: ${label} attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await sleep(baseDelayMs * 2 ** (i - 1));
    }
  }
  throw lastErr;
}
