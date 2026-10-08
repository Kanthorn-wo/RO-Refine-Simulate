-- ตัวคุมอัตราเรียก Divine Pride API ร่วมกันทั้งระบบ (เว็บจริง api/*, GitHub Action, สคริปต์ในเครื่อง)
-- กติกาของ Divine Pride: สูงสุด 1 request/วินาที, ห้ามขนาน, โดน rate limit ต้องหยุดยิงตามที่ API บอก
-- ทุกผู้เรียกขอ "ช่อง" จาก dp_claim_slot() ก่อนยิง (แถวเดียวถูก lock → คิวต่อเนื่องข้าม instance/โปรเซส)
-- ใช้ผ่าน api/_lib/divinePride.js (service_role เท่านั้น)
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)

create table if not exists public.dp_gate (
  id            smallint primary key check (id = 1),   -- แถวเดียว
  next_at       timestamptz not null default now(),    -- เวลาที่ช่องถัดไปว่าง
  blocked_until timestamptz                            -- โดน rate limit: ห้ามยิงจนถึงเวลานี้
);
alter table public.dp_gate enable row level security;  -- ไม่มี policy => service_role เท่านั้น
insert into public.dp_gate (id, next_at) values (1, now()) on conflict (id) do nothing;

-- ขอช่องยิง: คืน { wait_ms } = ต้องรออีกกี่ ms ก่อนยิง, หรือ { blocked_ms } = ถูกบล็อกอยู่อีกกี่ ms (ห้ามยิง)
create or replace function public.dp_claim_slot(p_interval_ms integer default 1100)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now     timestamptz := clock_timestamp();
  v_blocked timestamptz;
  v_slot    timestamptz;
begin
  select blocked_until into v_blocked from public.dp_gate where id = 1 for update;
  if v_blocked is not null and v_blocked > v_now then
    return jsonb_build_object('blocked_ms', ceil(extract(epoch from (v_blocked - v_now)) * 1000)::int);
  end if;
  update public.dp_gate
     set next_at = greatest(next_at, v_now) + make_interval(secs => p_interval_ms / 1000.0)
   where id = 1
  returning next_at - make_interval(secs => p_interval_ms / 1000.0) into v_slot;
  return jsonb_build_object('wait_ms', greatest(0, ceil(extract(epoch from (v_slot - v_now)) * 1000))::int);
end $$;

-- โดน rate limit: บล็อกทุกผู้เรียกจนครบ p_seconds (อย่างน้อย 30 วินาที, ไม่เกิน 1 ชั่วโมง)
create or replace function public.dp_report_limit(p_seconds integer default 60)
returns void
language sql
set search_path = public
as $$
  update public.dp_gate
     set blocked_until = greatest(coalesce(blocked_until, now()), now() + make_interval(secs => least(greatest(p_seconds, 30), 3600)))
   where id = 1;
$$;

revoke execute on function public.dp_claim_slot(integer)  from public, anon, authenticated;
revoke execute on function public.dp_report_limit(integer) from public, anon, authenticated;
grant  execute on function public.dp_claim_slot(integer)  to service_role;
grant  execute on function public.dp_report_limit(integer) to service_role;
