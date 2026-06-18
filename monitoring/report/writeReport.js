import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = path.resolve(__dirname, '../../reports');

// เขียนรายงานรายวัน reports/YYYY-MM-DD.json — เขียนทับของวันเดิมถ้ารันซ้ำ
// คืน path ที่เขียน
export async function writeReport({ date, meta, pages, lighthouse }) {
  await mkdir(REPORT_DIR, { recursive: true });

  const report = {
    date,
    site: meta.site,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    trigger: meta.trigger,
    gitSha: meta.gitSha,
    status: meta.status,
    summary: {
      pagesTotal: meta.pagesTotal,
      pagesPassed: meta.pagesPassed,
      pagesFailed: meta.pagesFailed,
      passed: pages.filter((p) => p.ok).map((p) => p.label),
      failed: pages.filter((p) => !p.ok).map((p) => p.label),
    },
    lighthouse: lighthouse.map((l) => ({
      label: l.label,
      performance: l.performance,
      seo: l.seo,
      accessibility: l.accessibility,
      bestPractices: l.bestPractices,
    })),
    pages: pages.map((p) => ({
      label: p.label,
      url: p.url,
      httpStatus: p.httpStatus,
      ok: p.ok,
      responseTimeMs: p.responseTimeMs,
      pageSizeBytes: p.pageSizeBytes,
      failedRequests: p.failedRequests,
      jsErrors: p.jsErrors,
    })),
    issues: meta.issues, // รายการปัญหาที่ตรวจพบ (ใช้ทำ issue automation เฟสถัดไป)
  };

  const file = path.join(REPORT_DIR, `${date}.json`);
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  log.info(`report: เขียน ${path.relative(process.cwd(), file)}`);
  return file;
}
