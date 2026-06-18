import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { log } from '../lib/logger.js';
import { withRetry } from '../lib/retry.js';
import { url, RETRY } from '../config.js';

const CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];

const pct = (cat) => (cat && cat.score != null ? Math.round(cat.score * 100) : null);
const ms = (audit) => (audit && audit.numericValue != null ? Math.round(audit.numericValue) : null);

async function runOne(target) {
  const target_url = url(target.path);
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  try {
    const result = await lighthouse(
      target_url,
      { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES },
    );
    const lhr = result.lhr;
    const c = lhr.categories;
    const a = lhr.audits;
    return {
      label: target.label,
      url: target_url,
      performance: pct(c.performance),
      seo: pct(c.seo),
      accessibility: pct(c.accessibility),
      bestPractices: pct(c['best-practices']),
      lcpMs: ms(a['largest-contentful-paint']),
      fcpMs: ms(a['first-contentful-paint']),
      tbtMs: ms(a['total-blocking-time']),
      siMs: ms(a['speed-index']),
      cls: a['cumulative-layout-shift']?.numericValue ?? null,
    };
  } finally {
    await chrome.kill();
  }
}

// รัน Lighthouse กับทุก target ที่ตั้ง lighthouse:true — แต่ละหน้ามี retry
export async function runLighthouse(targets) {
  const results = [];
  for (const t of targets.filter((x) => x.lighthouse)) {
    log.step(`lighthouse: ${t.label} (${t.path})`);
    try {
      const res = await withRetry(() => runOne(t), { ...RETRY, label: `lh:${t.label}` });
      log.info(
        `  perf=${res.performance} seo=${res.seo} a11y=${res.accessibility} bp=${res.bestPractices}`
      );
      results.push(res);
    } catch (err) {
      log.error(`  lighthouse ${t.label} ล้มเหลว: ${err.message}`);
      results.push({
        label: t.label,
        url: url(t.path),
        performance: null, seo: null, accessibility: null, bestPractices: null,
        lcpMs: null, fcpMs: null, tbtMs: null, siMs: null, cls: null,
        error: err.message,
      });
    }
  }
  return results;
}
