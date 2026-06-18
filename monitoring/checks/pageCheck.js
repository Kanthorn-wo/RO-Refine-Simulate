import { chromium, request as pwRequest } from 'playwright';
import { log } from '../lib/logger.js';
import { withRetry } from '../lib/retry.js';
import { url, NAV_TIMEOUT_MS, RETRY, THRESHOLDS } from '../config.js';

const MAX_SAMPLES = 10; // จำกัดจำนวนตัวอย่าง error/failed request ที่เก็บ กัน payload บวม

// ตรวจหน้าแบบ browser จริง: status, response time, page size, js error, failed request
async function checkPage(browser, target) {
  const target_url = url(target.path);
  const context = await browser.newContext({ ignoreHTTPSErrors: false });
  const page = await context.newPage();

  const jsErrors = [];
  const failedRequests = [];
  let bytes = 0;
  let mainStatus = null;

  page.on('pageerror', (err) => {
    if (jsErrors.length < MAX_SAMPLES) jsErrors.push(String(err.message || err));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && jsErrors.length < MAX_SAMPLES) {
      jsErrors.push(`console.error: ${msg.text()}`.slice(0, 300));
    }
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText || 'unknown';
    // ERR_ABORTED = request ถูกยกเลิกฝั่ง client (เช่น analytics beacon ตอนปิดหน้า)
    // ไม่ใช่ asset เสียจริง — ข้ามไม่ให้ตัวเลข failed_requests เพี้ยน
    if (reason.includes('ERR_ABORTED')) return;
    if (failedRequests.length < MAX_SAMPLES) {
      failedRequests.push({ url: req.url(), reason });
    }
  });
  page.on('response', async (res) => {
    // นับ failed request จาก status >= 400 (เช่น asset 404)
    const status = res.status();
    if (status >= 400 && failedRequests.length < MAX_SAMPLES) {
      failedRequests.push({ url: res.url(), reason: `HTTP ${status}` });
    }
    // ประมาณ page size จาก content-length ของทุก response
    const len = Number(res.headers()['content-length'] || 0);
    if (len > 0) bytes += len;
  });

  const started = Date.now();
  let response;
  try {
    response = await page.goto(target_url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    mainStatus = response ? response.status() : null;
    // รอ network เงียบสั้น ๆ ให้ js error / asset โหลดครบ (ไม่บังคับสำเร็จ)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  } finally {
    var responseTime = Date.now() - started;
    await context.close();
  }

  const okStatus = mainStatus === (target.expectStatus ?? 200);
  const slow = responseTime > THRESHOLDS.responseTimeMs;
  const ok = okStatus && jsErrors.length === 0;

  return {
    label: target.label,
    url: target_url,
    type: 'page',
    httpStatus: mainStatus,
    ok,
    responseTimeMs: responseTime,
    slow,
    pageSizeBytes: bytes,
    failedRequests: failedRequests.length,
    jsErrors: jsErrors.length,
    jsErrorSamples: jsErrors,
    failedRequestSamples: failedRequests,
  };
}

// ตรวจ endpoint แบบ API: status + (ออปชัน) parse JSON ได้
async function checkApi(target) {
  const target_url = url(target.path);
  const ctx = await pwRequest.newContext();
  try {
    const started = Date.now();
    const res = await ctx.get(target_url, { timeout: NAV_TIMEOUT_MS });
    const responseTime = Date.now() - started;
    const status = res.status();
    const body = await res.body();
    let jsonOk = true;
    if (target.expectJson) {
      try {
        JSON.parse(body.toString('utf-8'));
      } catch {
        jsonOk = false;
      }
    }
    const okStatus = status === (target.expectStatus ?? 200);
    return {
      label: target.label,
      url: target_url,
      type: 'api',
      httpStatus: status,
      ok: okStatus && jsonOk,
      responseTimeMs: responseTime,
      slow: responseTime > THRESHOLDS.responseTimeMs,
      pageSizeBytes: body.length,
      failedRequests: okStatus ? 0 : 1,
      jsErrors: target.expectJson && !jsonOk ? 1 : 0,
      jsErrorSamples: target.expectJson && !jsonOk ? ['response is not valid JSON'] : [],
      failedRequestSamples: okStatus ? [] : [{ url: target_url, reason: `HTTP ${status}` }],
    };
  } finally {
    await ctx.dispose();
  }
}

// รันตรวจทุก target (เปิด browser ครั้งเดียว ใช้ซ้ำ) — แต่ละ target มี retry ของตัวเอง
export async function runPageChecks(targets) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const t of targets) {
      log.step(`page check: ${t.label} (${t.path})`);
      try {
        const res = await withRetry(
          () => (t.type === 'api' ? checkApi(t) : checkPage(browser, t)),
          { ...RETRY, label: `page:${t.label}` }
        );
        if (res.ok) log.info(`  ok ${res.httpStatus} ${res.responseTimeMs}ms ${res.pageSizeBytes}B`);
        else log.warn(`  FAIL ${res.httpStatus} jsErr=${res.jsErrors} failedReq=${res.failedRequests}`);
        results.push(res);
      } catch (err) {
        // หมด retry แล้วยังพัง → บันทึกเป็น result ที่ ok=false ไม่ให้ทั้ง run ล้ม
        log.error(`  ${t.label} ล้มเหลวถาวร: ${err.message}`);
        results.push({
          label: t.label,
          url: url(t.path),
          type: t.type,
          httpStatus: null,
          ok: false,
          responseTimeMs: null,
          slow: false,
          pageSizeBytes: 0,
          failedRequests: 1,
          jsErrors: 0,
          jsErrorSamples: [],
          failedRequestSamples: [{ url: url(t.path), reason: err.message }],
        });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
