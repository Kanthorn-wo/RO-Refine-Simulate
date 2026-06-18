// Entrypoint ของระบบ monitoring — orchestrate: page check → lighthouse → persist → report
// รัน: node monitoring/run.js   (ดู env ที่ต้องตั้งใน docs/monitoring.md)
import { SITE, TARGETS, THRESHOLDS } from './config.js';
import { runPageChecks } from './checks/pageCheck.js';
import { runLighthouse } from './checks/lighthouse.js';
import { persistRun } from './store/persist.js';
import { writeReport } from './report/writeReport.js';
import { log } from './lib/logger.js';

// รวบรวม "ปัญหา" จากผล เพื่อกำหนด status + เป็น input ของ issue automation (เฟสถัดไป)
function collectIssues(pages, lighthouse) {
  const issues = [];
  for (const p of pages) {
    if (!p.ok) {
      issues.push({
        type: p.httpStatus && p.httpStatus >= 400 ? 'http_error' : 'page_error',
        label: p.label,
        detail: `${p.label}: status=${p.httpStatus} jsErrors=${p.jsErrors} failedRequests=${p.failedRequests}`,
      });
    } else if (p.slow) {
      issues.push({ type: 'slow', label: p.label, detail: `${p.label}: ${p.responseTimeMs}ms` });
    }
  }
  const t = THRESHOLDS.lighthouse;
  for (const l of lighthouse) {
    const checks = [
      ['performance', l.performance, t.performance],
      ['seo', l.seo, t.seo],
      ['accessibility', l.accessibility, t.accessibility],
      ['best_practices', l.bestPractices, t.bestPractices],
    ];
    for (const [name, score, min] of checks) {
      if (score != null && score < min) {
        issues.push({
          type: 'lighthouse_low',
          label: l.label,
          detail: `${l.label}: ${name}=${score} (< ${min})`,
        });
      }
    }
  }
  return issues;
}

async function main() {
  const startedAt = new Date().toISOString();
  const date = startedAt.slice(0, 10); // YYYY-MM-DD (UTC)
  const trigger = process.env.GITHUB_EVENT_NAME || 'manual';
  const gitSha = (process.env.GITHUB_SHA || '').slice(0, 7) || null;

  log.step(`monitoring เริ่ม — site=${SITE} date=${date} trigger=${trigger}`);

  const pages = await runPageChecks(TARGETS);
  const lighthouse = await runLighthouse(TARGETS);

  const issues = collectIssues(pages, lighthouse);
  const pagesPassed = pages.filter((p) => p.ok).length;
  const pagesFailed = pages.length - pagesPassed;
  const hardFail = pages.some((p) => !p.ok);
  const status = hardFail ? 'failed' : issues.length ? 'partial' : 'passed';

  const meta = {
    site: SITE,
    startedAt,
    finishedAt: new Date().toISOString(),
    trigger,
    gitSha,
    status,
    pagesTotal: pages.length,
    pagesPassed,
    pagesFailed,
    issues,
    notes: issues.length ? `${issues.length} issue(s)` : null,
  };

  // persist ไม่ให้ล้มทั้ง run ถ้า DB มีปัญหา (report ยังต้องเขียน)
  try {
    await persistRun({ meta, pages, lighthouse });
  } catch (err) {
    log.error(`persist ล้มเหลว (ข้ามไปเขียน report ต่อ): ${err.message}`);
  }

  await writeReport({ date, meta, pages, lighthouse });

  log.step(`สรุป: status=${status} passed=${pagesPassed}/${pages.length} issues=${issues.length}`);
  for (const i of issues) log.warn(`  issue [${i.type}] ${i.detail}`);

  // exit 0 เสมอเพื่อให้ workflow commit report ได้ (status อยู่ในไฟล์/DB แล้ว)
  // ถ้าต้องการให้ workflow แดงเมื่อหน้าเว็บล่ม ให้ตั้ง MONITOR_FAIL_ON_ERROR=1
  if (process.env.MONITOR_FAIL_ON_ERROR === '1' && hardFail) process.exit(1);
}

main().catch((err) => {
  log.error(`monitoring ล้มเหลวระดับร้ายแรง: ${err.stack || err.message}`);
  process.exit(1);
});
