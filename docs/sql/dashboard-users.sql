-- ผู้ใช้ dashboard + สิทธิ์รายส่วน (checkbox) — จัดการผ่าน dashboard แท็บ "ผู้ใช้" (เฉพาะ owner)
--   role 'owner'  = ทำได้ทุกอย่างรวมจัดการผู้ใช้
--   role 'member' = ได้เฉพาะสิทธิ์ใน perms รูปแบบ 'section:action' เช่น 'items-all:view', 'items-all:delete', 'usage-settings:edit'
--   (section id / action ที่ใช้ได้ดูที่ api/_lib/auth.js PAGE_SECTIONS — ค่าที่ไม่รู้จักถูกกรองทิ้งตอนอ่าน)
-- อีเมลใน env DASHBOARD_ALLOWED_EMAILS ยังเป็น owner เสมอ (bootstrap กันล็อกตัวเอง — ไม่ต้องมีแถวในตารางนี้)
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)

create table if not exists public.dashboard_users (
  email      text primary key check (email = lower(email)),  -- เก็บตัวพิมพ์เล็กเสมอ (api/_lib/auth.js ค้นด้วย email ตรงตัว)
  role       text not null default 'member',
  perms      text[] not null default '{}',
  expires_at timestamptz,                                    -- null = ไม่หมดอายุ; เลยเวลานี้ = ไม่มีสิทธิ์ (api/_lib/auth.js getAccess) — owner จาก env ไม่เกี่ยว
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_users drop constraint if exists dashboard_users_role_check;
alter table public.dashboard_users add constraint dashboard_users_role_check check (role in ('owner', 'member'));

-- คอลัมน์วันหมดอายุสำหรับตารางที่สร้างไว้ก่อนหน้า (idempotent)
alter table public.dashboard_users add column if not exists expires_at timestamptz;

-- ประวัติการเปลี่ยนสิทธิ์ผู้ใช้ (ใครเพิ่ม/แก้/ลบ/ส่งลิงก์รีเซ็ต ใคร เมื่อไหร่) — เขียนโดย api/users.js, ดูที่แท็บ "ผู้ใช้" (ไม่เก็บรหัสผ่าน)
create table if not exists public.dashboard_audit_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor      text not null,                 -- อีเมลคนที่ทำ
  action     text not null,                 -- upsert | delete | send_reset
  target     text not null,                 -- อีเมลที่ถูกทำ
  detail     jsonb not null default '{}'::jsonb
);
create index if not exists dashboard_audit_log_created_idx on public.dashboard_audit_log (created_at desc);
alter table public.dashboard_audit_log enable row level security;

-- ล็อกตาราง: ไม่สร้าง policy => anon/authenticated เข้าไม่ถึง; เฉพาะ service_role (server) ที่ bypass RLS
alter table public.dashboard_users enable row level security;
