# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

จำลองระบบตีบวก (refine) ของ Ragnarok Online เป็นหน้าเดียวด้วย React 19 + Vite (plugin `@vitejs/plugin-react-swc`) ไม่มี TypeScript deploy ด้วย **Vercel** (auto build จาก push master, เว็บจริง `https://ro-refine.com`) มี **Vitest** สำหรับ unit test ของ pure logic

**เอกสารรายละเอียด (อ่านก่อนแก้ส่วนที่เกี่ยวข้อง):**
- `docs/architecture.md` — รายละเอียดเต็มทุกระบบ: entry/shell, i18n, Layout/auto/UI ตีบวก, sprite/เสียง, โมดูลย่อย (EventRateBanner, FloatingMenu, SimulatorPanel, PatchNotesModal), SEO/PWA/CSP, dashboard + usage stats, ธีม, log structure, ประวัติ version — **แก้อะไรที่กระทบ architecture/state/behavior ต้องอัปเดตไฟล์นี้ด้วย**
- `docs/refine-bible.md` — เอกสารอ้างอิงกติกา/อัตราตีบวก (iROWiki)
- `docs/QA-checklist.md` — manual QA checklist

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint` — ESLint (flat config, `no-unused-vars` ignore ตัวขึ้นต้นตัวพิมพ์ใหญ่หรือ `_`)
- `npm test` — Vitest ครั้งเดียว (pure logic: `simulate.js`, `stones.js`, `refineRates.js` — ไฟล์ `*.test.js` วางข้างโมดูล), `npm run test:watch` — watch mode

คำเตือน script auto-commit ใน `package.json`: `deploy`, `quick-commit`, `auto-deploy`, `watch-and-deploy`, `start-auto`, `watch-changes` ทุกตัว **commit + push อัตโนมัติ** ห้ามรันโดยไม่ขออนุญาตผู้ใช้ก่อน

## แผนที่โค้ด (ย่อ)

- `src/main.jsx` → `<BrowserRouter>`: route `/dashboard` (lazy, admin) / route `*` = `<App />` (simulator ทั้ง `/` และ `/en/`)
- `src/App.jsx` — `<LangProvider>` ห่อ `<Container />` + `<FloatingMenu />` + `<PatchNotesModal />` + `<CookieConsent />`
- `src/components/Layout/index.jsx` — **ไฟล์หลัก** รวม state ทั้งหมดใน `Container` เดียว: `handleRefine`, auto loop, sprite animation, เสียง, ตาราง/ปุ่ม/log
- Pure helpers แยกโมดูล: `src/constants/refineRates.js` (`RATE_TABLES`, `getRate`), `src/utils/stones.js`, `src/constants/ores.js`, `src/constants/frames.js`, `src/utils/simulate.js` (Monte Carlo engine), `src/utils/analytics.js`
- i18n: `src/i18n/translations.js` + `src/contexts/LangContext.jsx` — ทุก text ผ่าน `useLang()`/`t(key)` ห้าม hardcode ภาษา; ภาษากำหนดจาก URL (`/en` = อังกฤษ)
- Dashboard (admin): `src/dashboard/*` + serverless `api/*.js` — ดูรายละเอียด/ENV ใน `docs/architecture.md`
- Vite alias `assets` → `src/assets` (รูป/เสียง); sprite frame ใช้ public path `/images/...` ตรง ๆ

## กติกา refine ที่ห้ามจำผิด

- ตารางอัตราที่ใช้จริง = `RATE_TABLES` ใน `refineRates.js` — **ไม่ใช่** `refineConfig.js` (import มาแต่ไม่ใช้คำนวณ). Enriched ใช้เรทชุดเดียวกับ HD (ตาราง cash): `getRate` อ่าน cash เมื่อ `useCash || useEnriched` — ต่างกันแค่ "ผลตอนล้ม"
- **ผลตอนล้ม** (ใน `handleRefine`):
  - `weapon5`/`armor2` +0~+9: ธรรมดาล้ม −3, Enriched ล้ม −1 (clamp 0 ไม่หาย, ไม่มี HD ช่วงนี้) / +10+: ทุกหินล้ม = ไอเทมหาย (รวม HD) — ชื่อแร่ HD เปลี่ยนที่ +15 (`SPECIAL_ORE` 3 ชุด `low`/`high`/`top`, boundary `< 10` / `< 15`)
  - ประเภทอื่น (armor1, weapon1–4): HD ล้ม −1, ธรรมดา/Enriched ล้ม = หายทันที
- **BSB**: ใช้ได้ช่วง `stack.length` 7–14, จำนวนต่อระดับจาก `BSB_REQUIRED_NORMAL`/`BSB_REQUIRED_EVENT` (refineConfig.js) — **ถูกหักทุก attempt ที่ active ตีติดก็เสีย** การป้องกันคือผลตอนล้มเท่านั้น
- **`simulate.js` mirror กติกา fail จาก `handleRefine` ทุกสาขา — แก้ `handleRefine` ต้องแก้ `simulate.js` ด้วย** (และ test ข้างโมดูล)
- Auto stone rules: `from` = **destination level** (UI แสดง `from − 1`) — `getPlannedStone` รับ `stack.length + 1` เสมอ; ทุก mutation ของ rules ผ่าน `normalizeStoneRules` (rule แรก = `autoStart+1` ล็อก, กำแพงแร่ที่ `from===11` ล็อก, weapon5/armor2 มีกำแพงสองที่ +16)

## เรื่องที่ควรระวังเวลาแก้

- กติกาแพ้/ชนะกระจุกใน `handleRefine` เดียว — แก้ต้องไล่ flow `useCash`/`useEnriched`/`useBSB`/`itemType`/`stack.length` ครบทุกสาขา
- `useEffect` ของแต่ละโหมด animation depend เฉพาะ `mode` — เพิ่ม state ที่ต้อง reset ตอนเปลี่ยนโหมดให้ระวัง interval ตกค้าง
- auto loop `useEffect` dependency array ยาว — เพิ่ม state ที่ loop ต้องอ่านต้องใส่ deps ด้วย (มี eslint-disable เพราะ handleRefine เป็น closure)
- `handleAutoStartChange` sync stack ทันทีแบบ event handler (ไม่ใช่ useEffect — กัน stale closure)
- Log/stats (`log`, `oreUsed`, `bsbUsedTotal`) สะสมข้าม session จนกด "ล้าง Session" — ตั้งใจ
- `toggleHasMeaning(...)` ใน `stones.js` — เงื่อนไข toggle "หยุด Auto ถ้าเสี่ยงหาย" (3 ข้อ: หายได้ + rate < 100% + BSB ไม่คุ้มครบช่วง) แก้เงื่อนไขต้องแก้ที่ฟังก์ชันนี้
- แก้ host/เรียกบริการใหม่ต้องอัปเดต CSP ใน `vercel.json` ด้วย ไม่งั้นโดนบล็อก (ทดสอบได้เฉพาะบน Vercel จริง)
- ห้ามแก้ชื่อไฟล์ sprite frame โดยไม่อัปเดต `getFrameSrc` (`frames.js`) ให้ตรง
- Layout กว้าง `max-w-5xl` + `pb-16 sm:pb-4` (กัน FloatingMenu บังท้ายหน้า mobile)
- อย่าห่อ element ที่มี `position:fixed` ข้างในด้วย `Reveal` (transform สร้าง containing block)
- ธีม dark/light ใช้ semantic token (`bg-app/text-body/text-warn/...` ใน `index.css`) — อย่าใช้ `dark:` variant หรือสี tailwind ตรง ๆ ในส่วนผู้เล่น; dashboard ยัง dark-only โดยตั้งใจ

## Version

เลข version อยู่ที่ `src/version.js` ไฟล์เดียว (`APP_VERSION`) แสดงใน footer

**กติกาการ bump version (สำคัญ):**
- **ห้าม bump ทุกครั้งที่แก้โค้ด/commit** — แก้กี่รอบก็ได้โดยไม่แตะ `version.js`
- **bump ครั้งเดียวเฉพาะตอนผู้ใช้สั่ง "push"** — 1 push = 1 version ใหม่
- ขนาด bump ตาม SemVer ของการเปลี่ยนแปลง **รวมทั้งหมด** ของรอบนั้น: `PATCH` = bugfix/UI เล็กน้อย, `MINOR` = มีฟีเจอร์ใหม่, `MAJOR` = เปลี่ยน architecture/redesign ใหญ่

version ปัจจุบัน: **1.11.9** (ประวัติ version ก่อนหน้าอยู่ใน `docs/architecture.md`)

## Patch Notes (changelog)

ข้อมูลอยู่ที่ `src/constants/changelog.js` (`CHANGELOG` array ใหม่→เก่า) แสดงผ่าน `PatchNotesModal`

**เพิ่ม entry เฉพาะตอนผู้ใช้สั่ง push (พร้อม bump version)** — **1 push = 1 entry เดียว** รวบทุกการแก้เป็น `items` หลายรายการใน entry เดียว (`type` = `'feature'`/`'fix'`/`'improve'`) รูปแบบ `{ version, date: 'YYYY-MM-DD', items: [{ type, text, textEn }] }` ใส่บนสุด — ห้ามสร้าง entry แยกหลาย version ถี่ ๆ

**ห้ามใส่ใน patch notes** (แสดงต่อสาธารณะ):
- Secret/credential — API key, token, GA ID, Google Form ID, endpoint ภายใน
- โครงสร้างพื้นฐาน/ops — โดเมน, deploy, hosting, ขนาดไฟล์
- SEO/analytics — sitemap, GA4, Search Console, meta tag
- รายละเอียดช่องโหว่ security — เขียนกว้าง ๆ ว่า "ปรับปรุงความปลอดภัย" เท่านั้น
- เทคโนโลยี/refactor ภายใน — ชื่อ library/ไฟล์/ฟังก์ชัน
- **หน้า Dashboard/admin (`/dashboard`) — ห้ามลง patch notes ทุกกรณี** (กฎถาวร ผู้ใช้สั่งไว้ 2026-06-16)

เขียนเฉพาะสิ่งที่ **ผู้เล่นมองเห็น/ได้ประโยชน์** เป็นภาษาผู้ใช้ (เลี่ยงศัพท์เทคนิค)

**กฎคัดกรอง (เข้มงวด — ผู้ใช้รำคาญ entry ถี่/ซ้ำ):**
1. **1 วัน = ไม่เกิน 1 entry** — push หลายรอบวันเดียวกันให้รวม items เข้า entry เดิมแล้วเปลี่ยน `version` เป็นล่าสุด **ห้ามสร้าง entry ใหม่ของวันเดิม**
2. ทุก item ถามก่อน: "ผู้เล่นเปิดเว็บมาเห็น/ได้ประโยชน์อะไร" — ตอบไม่ได้ชัด = ไม่ใส่
3. ห้ามใส่: แก้คำ/สำนวน, บั๊กเล็กไม่มี impact, feature จิ๋ว, การแก้ของฟีเจอร์ที่เพิ่งประกาศวันเดียวกัน (แก้ text เดิมแทน)
4. เรื่องแนวเดียวกันรวมเป็นข้อเดียว
5. entry ละ 2–4 items กำลังดี

## Workflow: commit ระหว่างทาง vs push

**commit ระหว่างทาง (ยังไม่ push):**
1. **ไม่ bump version, ไม่เพิ่ม CHANGELOG** — แค่แก้โค้ด + commit ปกติ
2. ถ้ามีอะไรเปลี่ยนที่กระทบ architecture, state, helpers, behavior — อัปเดต `docs/architecture.md` (และ CLAUDE.md ถ้ากระทบกฎ/แผนที่ย่อ) แล้ว commit รวมกัน

**เมื่อผู้ใช้สั่ง "push" ให้ถามผู้ใช้ก่อน (ก่อนทำอะไรทั้งนั้น):**

**ขั้นที่ 0 — รวบรวม:** `git log <last-pushed>..HEAD` + การแก้ค้าง สรุปให้ผู้ใช้เห็นก่อน

**ขั้นที่ 1 — ถามเรื่อง version:**
> "จะ bump version ไหม? (แนะนำ PATCH/MINOR/MAJOR ตามขนาดการแก้) หรือ ไม่ bump"

**ขั้นที่ 2 — ถามเรื่อง patch notes:**
> แสดงรายการที่แก้ทั้งหมด ระบุอันไหน**ไม่ควรลง** (ตามกฎ) แล้วถาม:
> 1. **ไม่ลง patch notes เลย** 2. **แสดงเฉพาะที่เลือก** 3. **แสดงทั้งหมดที่ผ่านกฎ**

รอคำตอบผู้ใช้ก่อน — ห้ามทำขั้นต่อไปโดยไม่ได้รับคำตอบ

**ขั้นที่ 3 — ลงมือ (หลังได้คำตอบครบ):**
1. bump version ใน `src/version.js` (หรือข้ามถ้าเลือกไม่ bump)
2. เพิ่ม/ไม่เพิ่ม CHANGELOG ตามตกลง
3. อัปเดตบรรทัด "version ปัจจุบัน" ใน CLAUDE.md (เสมอ)
4. commit (รวม version + changelog) แล้ว push
