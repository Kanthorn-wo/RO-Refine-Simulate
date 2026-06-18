import { getSupabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

// บันทึกผล 1 run ลง Supabase (3 ตาราง) — ถ้าไม่มี client (local) ข้ามอย่างนุ่มนวล
// คืน run_id ที่สร้าง (หรือ null ถ้าไม่ได้บันทึก)
export async function persistRun({ meta, pages, lighthouse }) {
  const sb = getSupabase();
  if (!sb) {
    log.warn('persist: ข้ามการบันทึก (ไม่มี Supabase client)');
    return null;
  }

  // 1) test_runs
  const { data: run, error: runErr } = await sb
    .from('monitor_test_runs')
    .insert({
      started_at: meta.startedAt,
      finished_at: meta.finishedAt,
      status: meta.status,
      git_sha: meta.gitSha,
      trigger: meta.trigger,
      pages_total: meta.pagesTotal,
      pages_passed: meta.pagesPassed,
      pages_failed: meta.pagesFailed,
      notes: meta.notes ?? null,
    })
    .select('id')
    .single();

  if (runErr) {
    log.error(`persist: insert test_runs ล้มเหลว: ${runErr.message}`);
    throw runErr;
  }
  const runId = run.id;
  log.info(`persist: test_run ${runId}`);

  // 2) page_results
  if (pages.length) {
    const rows = pages.map((p) => ({
      run_id: runId,
      url: p.url,
      label: p.label,
      http_status: p.httpStatus,
      ok: p.ok,
      response_time_ms: p.responseTimeMs,
      page_size_bytes: p.pageSizeBytes,
      failed_requests: p.failedRequests,
      js_errors: p.jsErrors,
      js_error_samples: p.jsErrorSamples,
      failed_request_samples: p.failedRequestSamples,
    }));
    const { error } = await sb.from('monitor_page_results').insert(rows);
    if (error) log.error(`persist: page_results ล้มเหลว: ${error.message}`);
    else log.info(`persist: page_results ${rows.length} แถว`);
  }

  // 3) lighthouse_results
  if (lighthouse.length) {
    const rows = lighthouse.map((l) => ({
      run_id: runId,
      url: l.url,
      label: l.label,
      performance: l.performance,
      seo: l.seo,
      accessibility: l.accessibility,
      best_practices: l.bestPractices,
      lcp_ms: l.lcpMs,
      fcp_ms: l.fcpMs,
      tbt_ms: l.tbtMs,
      si_ms: l.siMs,
      cls: l.cls,
    }));
    const { error } = await sb.from('monitor_lighthouse_results').insert(rows);
    if (error) log.error(`persist: lighthouse_results ล้มเหลว: ${error.message}`);
    else log.info(`persist: lighthouse_results ${rows.length} แถว`);
  }

  return runId;
}
