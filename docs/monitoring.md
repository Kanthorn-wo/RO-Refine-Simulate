# Website Monitoring — ro-refine.com

ระบบตรวจสอบคุณภาพเว็บอัตโนมัติทุกคืน เก็บสถิติย้อนหลังลง Supabase และสร้าง report รายวันใน repo
(แยกขาดจากโค้ดเว็บใน `src/` — ไม่กระทบ bundle ที่ deploy ขึ้น Vercel)

## โครงสร้างโปรเจกต์

```
monitoring/
  config.js              # SITE, TARGETS (หน้าที่ตรวจ), THRESHOLDS, RETRY — เพิ่มหน้าใหม่ที่ TARGETS
  run.js                 # entrypoint: page check -> lighthouse -> persist -> report
  lib/
    logger.js            # log มี timestamp + level
    retry.js             # withRetry() exponential backoff
    supabase.js          # client จาก service_role (ไม่มี env = ข้าม persist)
  checks/
    pageCheck.js         # Playwright: status, response time, page size, js error, failed request
    lighthouse.js        # Lighthouse: performance / seo / accessibility / best-practices
  store/
    persist.js           # เขียนผลลง Supabase 3 ตาราง
  report/
    writeReport.js       # เขียน reports/YYYY-MM-DD.json
  sql/
    schema.sql           # SQL สร้างตาราง + view (รันใน Supabase ครั้งเดียว)
reports/
  YYYY-MM-DD.json        # report รายวัน (commit เข้า repo)
.github/workflows/
  monitoring.yml         # cron วันละครั้ง + random delay + commit report
```

## หน้าที่ตรวจ (TARGETS)

เว็บเป็น SPA หน้าเดียว (simulator) จึง monitor เฉพาะ **หน้าที่มีอยู่จริง**:

| label | path | ตรวจ |
|---|---|---|
| home-th | `/` | หน้าหลักไทย + Lighthouse |
| home-en | `/en/` | หน้าหลักอังกฤษ + Lighthouse |
| dashboard | `/dashboard` | หน้า login dashboard (โหลดได้ 200) |
| api-item | `/api/item?id=1101` | API proxy คืน JSON 200 |

> หมายเหตุ: `/item` `/monster` `/skill` `/map` **ไม่มีในเว็บนี้** (ทุก path ที่ไม่ใช่ `/dashboard`
> จะ fallback เป็น simulator และคืน 200 หมด การตรวจจึงไร้ความหมาย) — ถ้าเว็บเพิ่มหน้าจริงในอนาคต
> ค่อยเพิ่มเข้า `TARGETS` ใน `monitoring/config.js`

## สิ่งที่เก็บ

- **page check**: http status, response time (ms), page size (bytes), failed requests (รวม asset 404), js errors + ตัวอย่าง
- **lighthouse**: performance, seo, accessibility, best-practices + metric (LCP/FCP/TBT/SI/CLS)
- **report รายวัน**: เวลาทดสอบ, คะแนน Lighthouse, หน้าที่ผ่าน/ล้มเหลว, รายการ issue

## ติดตั้ง Supabase (ครั้งเดียว)

1. เปิด Supabase project เดิม → **SQL Editor**
2. วางเนื้อหา `monitoring/sql/schema.sql` แล้ว Run
   - สร้าง 4 ตาราง (`monitor_test_runs`, `monitor_page_results`, `monitor_lighthouse_results`, `monitor_broken_links`)
   - เปิด RLS ทุกตาราง (อ่าน/เขียนได้เฉพาะ service_role) + สร้าง view `monitor_daily_uptime`, `monitor_lighthouse_trend`

## ตั้งค่า Secrets (GitHub repo → Settings → Secrets and variables → Actions)

| Secret | ค่า | หาได้จาก |
|---|---|---|
| `SUPABASE_URL` | URL ของ project | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Supabase → Project Settings → API → `service_role` (secret) |

> ใช้ **service_role** ไม่ใช่ anon — เพราะ RLS เปิดอยู่ การเขียนจาก CI ต้อง bypass RLS
> service_role key มีสิทธิ์เต็ม **ห้าม commit / ห้ามใส่ฝั่ง client** เก็บใน GitHub Secret เท่านั้น

`GITHUB_TOKEN` มีให้อัตโนมัติ (ใช้ push report) — ไม่ต้องตั้งเอง

## Deploy / เปิดใช้งาน

1. รัน `monitoring/sql/schema.sql` ใน Supabase
2. ตั้ง 2 secrets ข้างบน
3. merge ไฟล์เข้า master — workflow `Website Monitoring` จะรันเองทุกคืน
4. สั่งรันทดสอบทันทีได้ที่ **Actions → Website Monitoring → Run workflow** (workflow_dispatch)

## รัน local (smoke test)

```bash
npm install                      # ติดตั้ง lighthouse + chrome-launcher
npx playwright install chromium  # ติดตั้ง browser
npm run monitor                  # รันโดยไม่มี Supabase env -> ข้าม persist แต่เขียน report ได้
```

ตั้ง env เพื่อทดสอบเขียน DB จริง:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run monitor
```

## กลยุทธ์ commit

report รายวันมี response time / Lighthouse score ที่ขยับทุกวันอยู่แล้ว → `reports/YYYY-MM-DD.json`
จะต่างทุกวันโดยธรรมชาติ → workflow commit ทุกวันด้วย **ข้อมูลจริง** (ไม่ใช่ heartbeat ปลอม)
ถ้าวันไหนไม่มี diff เลย workflow จะข้ามการ commit เอง

## ขยายระบบในอนาคต

- **เพิ่มหน้าตรวจ**: เพิ่ม object ใน `TARGETS` (`monitoring/config.js`) — รองรับ type `page` / `api`
- **Issue automation**: `run.js` รวบรวม `issues[]` ไว้ใน report แล้ว — เพิ่ม step ใน workflow
  เรียก `gh issue create` พร้อม dedupe (เช็ค open issue label เดิมก่อน) + auto-close เมื่อหาย
- **Broken link**: ตาราง `monitor_broken_links` + index เตรียมไว้แล้ว — เพิ่ม crawler ใน `checks/`
- **Dashboard**: query view `monitor_daily_uptime` / `monitor_lighthouse_trend` ผ่าน serverless
  (ด้วย service_role เหมือน `api/ga.js`) แล้ว render ด้วย recharts ที่มีอยู่
  - uptime 30 วัน, avg response time, SEO/Performance trend, broken link history
- **ปรับ threshold**: แก้ `THRESHOLDS` ใน `config.js` (Lighthouse Performance ของ CI ผันผวน — ตั้งหลวมไว้)
```
