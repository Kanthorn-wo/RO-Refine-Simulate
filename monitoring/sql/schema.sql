-- ============================================================================
-- Website Monitoring schema สำหรับ ro-refine.com
-- รันใน Supabase SQL Editor ครั้งเดียว (idempotent — รันซ้ำได้)
-- ออกแบบให้เก็บย้อนหลังหลายปี + รองรับ dashboard ในอนาคต
-- เขียนจาก GitHub Actions ด้วย service_role key (bypass RLS)
-- ============================================================================

-- 1) test_runs — 1 แถวต่อการรัน monitor 1 ครั้ง
create table if not exists public.monitor_test_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('passed', 'partial', 'failed')),
  git_sha      text,
  trigger      text,                 -- 'schedule' | 'workflow_dispatch' | 'manual'
  pages_total  int  not null default 0,
  pages_passed int  not null default 0,
  pages_failed int  not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

-- 2) page_results — 1 แถวต่อหน้า ต่อ run
create table if not exists public.monitor_page_results (
  id                     uuid primary key default gen_random_uuid(),
  run_id                 uuid not null references public.monitor_test_runs(id) on delete cascade,
  url                    text not null,
  label                  text,
  http_status            int,
  ok                     boolean not null,
  response_time_ms       int,
  page_size_bytes        bigint,
  failed_requests        int default 0,
  js_errors              int default 0,
  js_error_samples       jsonb,       -- ตัวอย่าง js error (จำกัดจำนวน)
  failed_request_samples jsonb,       -- ตัวอย่าง request ที่ล้ม/asset 404
  checked_at             timestamptz not null default now()
);

-- 3) lighthouse_results — 1 แถวต่อหน้า ต่อ run (เฉพาะหน้าที่รัน Lighthouse)
create table if not exists public.monitor_lighthouse_results (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references public.monitor_test_runs(id) on delete cascade,
  url            text not null,
  label          text,
  performance    int,
  seo            int,
  accessibility  int,
  best_practices int,
  lcp_ms         int,
  fcp_ms         int,
  tbt_ms         int,
  si_ms          int,
  cls            numeric,
  checked_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4) (ออปชัน/เฟสถัดไป) broken_links — เตรียม schema ไว้รองรับ ยังไม่ populate
--    เว็บนี้เป็น SPA หน้าเดียว ลิงก์ภายในน้อย จึงยังไม่ทำ crawler ในเฟสแรก
-- ----------------------------------------------------------------------------
create table if not exists public.monitor_broken_links (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid references public.monitor_test_runs(id) on delete cascade,
  source_url   text not null,        -- หน้าที่พบลิงก์เสีย
  target_url   text not null,        -- ลิงก์ปลายทางที่เสีย
  http_status  int,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  resolved_at  timestamptz           -- เซ็ตเมื่อกลับมาใช้ได้
);

-- ----------------------------------------------------------------------------
-- Indexes — เร่ง query แบบ time-series / ต่อหน้า (สำหรับ dashboard)
-- ----------------------------------------------------------------------------
create index if not exists idx_runs_started      on public.monitor_test_runs (started_at desc);
create index if not exists idx_page_run          on public.monitor_page_results (run_id);
create index if not exists idx_page_label_time   on public.monitor_page_results (label, checked_at desc);
create index if not exists idx_lh_run            on public.monitor_lighthouse_results (run_id);
create index if not exists idx_lh_label_time     on public.monitor_lighthouse_results (label, checked_at desc);
create index if not exists idx_broken_unresolved on public.monitor_broken_links (resolved_at) where resolved_at is null;

-- ----------------------------------------------------------------------------
-- RLS — เปิดไว้ทุกตาราง และไม่สร้าง policy public
--   => อ่าน/เขียนได้เฉพาะ service_role (CI) เท่านั้น (ปลอดภัยสุด)
--   ถ้าจะทำ dashboard อ่านข้อมูล ให้เรียกผ่าน serverless function ด้วย service_role
--   (เหมือน api/ga.js เดิม) หรือเพิ่ม policy ให้ authenticated อ่าน read-only ภายหลัง
-- ----------------------------------------------------------------------------
alter table public.monitor_test_runs        enable row level security;
alter table public.monitor_page_results      enable row level security;
alter table public.monitor_lighthouse_results enable row level security;
alter table public.monitor_broken_links      enable row level security;

-- ----------------------------------------------------------------------------
-- VIEW ตัวอย่างสำหรับ dashboard (uptime / response time / trend) — สร้างไว้ใช้ได้เลย
-- ----------------------------------------------------------------------------

-- uptime 30 วันล่าสุด (รายวัน) — % ของ page check ที่ ok
create or replace view public.monitor_daily_uptime as
select
  date_trunc('day', pr.checked_at)::date as day,
  count(*)                               as checks,
  count(*) filter (where pr.ok)          as ok_checks,
  round(100.0 * count(*) filter (where pr.ok) / nullif(count(*), 0), 2) as uptime_pct,
  round(avg(pr.response_time_ms))        as avg_response_ms
from public.monitor_page_results pr
where pr.checked_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- trend Lighthouse รายวันต่อหน้า (ค่าเฉลี่ยของวัน)
create or replace view public.monitor_lighthouse_trend as
select
  date_trunc('day', checked_at)::date as day,
  label,
  round(avg(performance))    as performance,
  round(avg(seo))            as seo,
  round(avg(accessibility))  as accessibility,
  round(avg(best_practices)) as best_practices
from public.monitor_lighthouse_results
group by 1, 2
order by 1 desc, 2;
