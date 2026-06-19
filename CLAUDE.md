# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

จำลองระบบตีบวก (refine) ของ Ragnarok Online เป็นหน้าเดียวด้วย React 19 + Vite (plugin `@vitejs/plugin-react-swc`) ไม่มี TypeScript การ deploy ใช้ **Vercel** (auto build จาก push master) มี **Vitest** เป็น test runner สำหรับ unit test ของ pure logic

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — build production bundle ไปที่ `dist/`
- `npm run preview` — preview build
- `npm run lint` — ESLint ตามคอนฟิกใน `eslint.config.js` (flat config, rule `no-unused-vars` ignore ตัวที่ขึ้นต้นด้วยตัวพิมพ์ใหญ่หรือ `_`)
- `npm test` — รัน Vitest ครั้งเดียว (unit test ของ pure logic: `simulate.js`, `stones.js`, `refineRates.js` — ไฟล์ `*.test.js` วางข้างโมดูล), `npm run test:watch` — watch mode. Manual QA checklist อยู่ที่ `docs/QA-checklist.md`

คำเตือนเกี่ยวกับ script auto-commit ใน `package.json`:
- `deploy`, `quick-commit`, `auto-deploy`, `watch-and-deploy`, `start-auto`, `watch-changes` ทุกตัว **commit + push อัตโนมัติ** ห้ามรันให้ผู้ใช้โดยไม่ขออนุญาตก่อน

## Architecture

### Entry และ shell
- `index.html` → `src/main.jsx` mount `<App />` (ไม่ใช้ `StrictMode` ห่อ children เพิ่ม)
- `src/App.jsx` ห่อทุกอย่างด้วย `<LangProvider>` แล้ว render `<Container />`, `<FloatingMenu />`, `<PatchNotesModal />`, `<CookieConsent />` — state `cookieVisible` ส่งเป็น `suppressed` ให้ `FloatingMenu` (ซ่อน FAB ตอน cookie bar โชว์ กันทับกัน)
  - **Cookie consent** (`src/components/CookieConsent/index.jsx`): bar ล่างจอ (`fixed bottom z-50`) bilingual (ใช้ `useLang` text inline ไม่ผ่าน TRANSLATIONS) — accept/reject + นโยบายคุกกี้ (expandable) เก็บผลใน localStorage `ro_refine_cookie_consent` (`accepted`/`rejected`) ผูกกับ **Google Consent Mode v2**: `index.html`/`en/index.html` ตั้ง `analytics_storage: 'denied'` เป็น default แล้ว grant เมื่อผู้ใช้ยอมรับ (inline script เช็ค localStorage ตอนโหลด + component เรียก `gtag('consent','update')` ตอนกด) — GA ไม่เก็บ analytics cookie จนกว่าจะยอมรับ

### ระบบ 2 ภาษา (i18n)
- `src/i18n/translations.js` — `TRANSLATIONS` object มีทั้ง `th` และ `en` key สำหรับทุก string ใน UI
- `src/contexts/LangContext.jsx` — `LangProvider`, `useLang()` → `{ lang, setLang, t(key, params?) }` โดย `t()` รองรับ placeholder `{key}` เช่น `t('hd_before_warn', { n: 7 })`
  - **ภาษาถูกกำหนดจาก URL เป็นหลัก**: path ขึ้นต้น `/en` → อังกฤษ, อื่น ๆ → ค่าใน localStorage (`ro_refine_lang`) default ไทย — **ไม่มี** auto-detect จาก `navigator.language`
  - มี `useEffect` sync `document.title`, `<html lang>`, meta description / og / twitter / canonical / og:url ตามภาษา + `history.replaceState` ให้ URL ตรงภาษา (`/` ↔ `/en/`)
  - **Multi-page build**: `en/index.html` เป็น entry ที่สอง (rollup input ใน `vite.config.js`) meta อังกฤษทั้งชุด + hreflang ทั้งสองหน้า → Google เลือกหน้าให้ตรงภาษาผู้ค้นเอง (sitemap มี `/en/` ด้วย)
  - ทุก component ที่แสดง text ใช้ `useLang()` แทนการ hardcode ภาษาไทย
- ปุ่มสลับภาษา (🇹🇭 TH / 🇬🇧 EN) ซ้อนมุมขวาบนของ HeroBanner (absolute + backdrop-blur ใน Layout)

### Pure helpers / data ที่แยกออกจาก `index.jsx` แล้ว
ตรรกะ stateful ทั้งหมดยังอยู่ใน `Container` (`index.jsx`) แต่ค่าคงที่/ฟังก์ชัน pure ถูกแยกเป็นโมดูลย่อย (import กลับเข้า index.jsx):
- `src/constants/refineRates.js` — `RATE_TABLES` (4 ชุด noevent/event × normal/cash), `getRateTable`, `getRate` (ตารางอัตราที่ใช้จริง — **ไม่ใช่** ค่าใน `refineConfig.js` ที่ import มาแต่ไม่ใช้). **Enriched ใช้เรทชุดเดียวกับ HD** (ตาราง cash) ตาม iROWiki — `getRate` อ่านตาราง cash เมื่อ `useCash || useEnriched` (ไม่มี `ENRICHED_RATE_BONUS` แล้ว ต่างกันแค่ "ผลตอนล้ม")
- `src/utils/stones.js` — `STONE_META`, `getStoneMinLevel`, `getEffectiveStone`, `getPlannedStone`, `toggleHasMeaning` (logic เลือก/validate ชนิดหิน auto)
- `src/constants/ores.js` — `ITEM_TYPE_LABELS`, `ORE_BY_TYPE`, `SPECIAL_ORE`, `ORE_COLORS`, `ORE_IMAGES`, `getOreName`, `getStoneOre`, `STONE_REFERENCE`
- `src/constants/frames.js` — `frameCount`, `getFrameSrc`, `getAllFrameSrcs` + เฟรม precompute (`WAITING_FRAMES`/`PROCESSING_FRAMES`/`SUCCESS_FRAMES`/`FAIL_FRAMES`/`ALL_FRAMES`) คำนวณครั้งเดียวตอน module load
- `src/components/Toggle/index.jsx` — `Toggle` switch reusable
- `src/components/Reveal/index.jsx` — scroll reveal wrapper (IntersectionObserver, เล่นครั้งเดียว, เคารพ `prefers-reduced-motion`) ห่อ section หลักใน Layout (ตาราง rate, แถวการ์ด+ตีบวก, Simulator, สถิติ, log, สรุปไอเทม) — **ตอน shown จะถอด class transform ออก** กัน transform ค้างสร้าง containing block ให้ `position:fixed` ของลูกหลานเพี้ยน อย่าห่อ element ที่มี fixed ข้างใน (modal อยู่นอก Reveal แล้ว)
- `src/utils/analytics.js` — `trackEvent(name, params)` ยิง GA4 event ผ่าน `window.gtag` (guard adblock/ยังไม่โหลด) — event: `refine_attempt` (เฉพาะกดตีเอง ไม่นับ auto กัน event ท่วม), `auto_start`, `sim_open`, `sim_run` — **ห้ามใส่ข้อมูลส่วนตัวใน params**
- `src/utils/simulate.js` — engine จำลอง Monte Carlo (pure): `simulateRound` mirror กติกา fail จาก `handleRefine` ทุกสาขา (**แก้ handleRefine ต้องแก้ที่นี่ด้วย**), `summarize` (mean/sd/median/p90/min/max), `buildHistogram`, `MAX_ATTEMPTS_PER_ROUND` (เพดาน 50000/รอบ กัน loop ไม่จบ) — model: ไอเทมแตก = เริ่มไอเทมใหม่ที่ startLevel นับต่อในรอบเดิม

### `src/components/Layout/index.jsx` (ไฟล์หลัก)
รวม state, sprite animation, sound effect และ UI ของตาราง/ปุ่ม/log ทั้งหมดไว้ใน `Container` เดียว (pure helpers แยกไปโมดูลด้านบนแล้ว) จุดสำคัญที่ต้องเข้าใจก่อนแก้:

#### ตารางอัตราสำเร็จ
- ตารางที่ใช้จริงคือ `RATE_TABLES` ใน `src/constants/refineRates.js` แยกตามประเภทไอเท็ม (`armor1`, `armor2`, `weapon1`–`weapon5`) **ไม่ใช่** ค่าใน `src/constants/refineConfig.js` (import เข้ามาแต่ไม่ได้ใช้ในการคำนวณจริง) ถ้าจะแก้สูตรอัตราต้องแก้ที่ `RATE_TABLES`
- **UI ตาราง:** default ย่อแสดง +1~+10 (state `showFullRateTable` + ปุ่มขยาย/ย่อใต้ตาราง — กันตารางดันหน้าต่างตีบวกตกใต้ fold), หัวคอลัมน์จอเล็กใช้ชื่อย่อจาก `ITEM_TYPE_SHORT` (ores.js), คอลัมน์ของ `itemType` ที่เลือกถูก highlight ทั้ง th/td

#### กติกาผลล้มเหลว (อยู่ใน `handleRefine`)
- **`weapon5` และ `armor2`** เป็นเคสพิเศษ แยกเป็น 2 ช่วง:
  - Low range (+0~+9): หินธรรมดาล้ม = −3 ระดับ, Enriched ล้ม = −1 ระดับ — clamp ที่ 0 ไม่หาย, HD ไม่มีในช่วงนี้
  - High range (+10+): ทุกหินล้มเหลว = ไอเทมหาย (รวม HD ทุกตัว) — **ชื่อแร่ HD แยก 2 ตอน** (กติกาเหมือนกัน ต่างแค่ชื่อ/รูป): level 10–14 = HD Etherdeocon / HD Ethernium, level ≥ 15 = HD Etel Bradium / HD Etel Carnium (`SPECIAL_ORE` มี 3 ชุด `low`/`high`/`top`, boundary ใน `getOreName`/`getStoneOre`: `< 10` / `< 15`)
- **ประเภทอื่น (armor1, weapon1–4):** HD ล้ม = −1 ระดับ, หินธรรมดา/Enriched ล้ม = ไอเทมหายทันที
- BSB ป้องกันผลล้มเหลว (ทั้ง item หายและลดระดับ) ถ้าเปิด toggle และอยู่ในช่วง +7→+14 (`stack.length >= 7 && stack.length <= 14`)

#### BSB (Black Smith Blessing)
- ใช้ได้ที่ `stack.length` 7–14 (ตีจาก +7→+8 ถึง +14→+15) เช็คผ่าน `bsbInRange`
- จำนวน BSB ต่อระดับมาจาก `BSB_REQUIRED_NORMAL` / `BSB_REQUIRED_EVENT` ใน `src/constants/refineConfig.js` เลือกตาม `isEventRate`
- **BSB ถูกหักทุกครั้งที่ตีในช่วงที่ active — ตีติดก็เสีย** (กติกาเกมจริง) ทั้งใน `handleRefine` และ `simulate.js` — การ "ป้องกัน" คือผลตอนล้มเท่านั้น แต่การ "หัก" เกิดทุก attempt
- เมื่อมี BSB: log บอกว่าป้องกัน "ลดระดับ" (HD) หรือ "ไอเทมหาย" (หินธรรมดา/Enriched) แล้วแต่ชนิดหิน + chip BSB ใน log โชว์ ×N ที่ใช้ทุก entry ที่มีการหัก

#### ระบบ Auto ตีบวก
Auto มี state หลักดังนี้ — แก้ไขอะไรใน auto ต้องอ่านทั้งกลุ่มนี้:

| state | ความหมาย |
|---|---|
| `autoRefine` | เปิด/ปิดโหมด auto (toggle) |
| `autoStart` | ระดับเริ่มต้น auto — **แยกจาก global start level** |
| `autoTarget` | เป้าหมายระดับที่ auto จะตีถึง (> autoStart เสมอ) |
| `autoRunning` | กำลังตี auto อยู่จริง |
| `autoStoneRules` | แผนชนิดหิน+BSB แต่ละช่วง `[{ id, from, stone, stopOnLoss, bsb }]` |
| `autoUseBSB` | master เปิด/ปิด BSB อัตโนมัติ (เปิดแล้วจึงโชว์ toggle BSB ต่อช่วง) |

BSB section ซ่อนทั้งหมดเมื่อ `autoTarget < 8` เพราะ BSB ใช้ได้ตั้งแต่ +7→+8 auto ต้องตีถึงอย่างน้อย +8 จึงจะมีประโยชน์

**Stone rules semantics ที่สำคัญมาก:** `from` ในแต่ละ rule คือ **destination level** ไม่ใช่ source — auto loop เรียก `getPlannedStone(autoStoneRules, stack.length + 1)` ดังนั้น rule ที่ `from: 6` จะมีผลตอน item อยู่ที่ +5 กำลังตีไป +6 — **แต่ใน UI แสดงเป็น "เลเวลก่อนตี" (`from − 1`)** เพื่อให้ช่วงต่อกันพอดี (ปลายช่วงก่อน = ต้นช่วงถัดไป เช่น +0→+10, +10→+12) ไม่มี "+X~+X" กำกวม (option `value` ยังเป็น destination, label เป็น `value − 1`)

**กำแพงจุดเปลี่ยนแร่ (`stoneWallsFor(itemType)`):** แร่เปลี่ยน low→high ที่ destination +11 ทุก item type — **weapon5/armor2 มีกำแพงที่สองที่ +16** (HD เปลี่ยนชื่อ HD Etherdeocon/HD Ethernium → HD Etel) คืนค่า `[11, 16]` สำหรับ special, `[11]` สำหรับที่เหลือ; `isWallFrom(from, itemType)` รับ itemType ด้วย → ช่วงห้ามคร่อม +10/+11 ทุก mutation ของ rules ผ่าน `normalizeStoneRules(rules, start, target, itemType, nextIdRef)` (module-level) ซึ่ง: บังคับ rule แรก = `start+1`, ใส่ขอบที่กำแพง 11 เมื่อ span คร่อม, ตัด rule นอกช่วง, แก้หินที่ใช้ไม่ได้ในห้องเป็น `bestStoneForRoom`. helper คู่กัน: `stoneValidInRoom` (enriched: `from ≤ 10`; hd: `from > getStoneMinLevel('hd')`; ตรงกับ disabled ของ stone slots ใน refine UI), `bestStoneForRoom` (Enriched > HD(เฉพาะ item ปกติ) > ปกติ), `isWallFrom`

**แบ่งช่วง:** ปุ่ม "แบ่ง" (`splitStoneRule`) แบ่งช่วง ~กึ่งกลางในห้องเดิม (คัดลอก stone+bsb) — ไม่มีปุ่ม "+ เพิ่มช่วง"/`addStoneRule` แล้ว. ปุ่มลบ (`removeStoneRule`) รวมกับช่วงก่อนหน้า — **ช่วงแรก (i=0) และช่วงกำแพง (`from===11`) ล็อก ลบ/ย้ายไม่ได้**. dropdown `from` ถูก cap ที่ `next.from − 1` (อยู่ในห้อง ไม่ข้ามกำแพง)

**ปุ่มเลือกหินต่อช่วง:** กรองด้วย `stoneValidInRoom` (ซ่อนหินที่ใช้ไม่ได้, flex-1 ขยายเต็ม) แต่ละปุ่มโชว์ **รูปแร่ + ชื่อแร่จริง** ของห้องนั้นจาก `getStoneOre(itemType, from − 1, stone)` (ชื่อ truncate `...`)

**`stopOnLoss` ใน stone rules:** toggle "หยุด Auto ถ้าเสี่ยงหาย" แสดงเมื่อ `toggleHasMeaning(stone, itemType, from, toLevel, isEventRate, autoUseBSB, rule.bsb, bsbTable)` เป็น true — ตรวจ 3 เงื่อนไข: (1) stone+ช่วงนั้น item หายได้, (2) rate < 100%, (3) BSB ของช่วงนั้น (`rule.bsb`) ไม่คุ้มกันครบทุกระดับ

**`bsb` ต่อช่วง:** แต่ละ rule มี `bsb: boolean` — toggle "ใส่ BSB ช่วงนี้" แสดงเฉพาะช่วงที่แตะ +7→+14 (`autoUseBSB && from ≤ 15 && toLevel ≥ 8`) อยากคุมละเอียด (เปิด/ปิด/เปิดใหม่) ให้กด "แบ่ง" แล้ว toggle ต่อช่วง — ไม่มี `autoBSBStart`/`autoBSBEnd` แล้ว

**Auto loop (useEffect):** ทำงานเมื่อ `autoRunning && !isPlaying && mode !== 'process'` โดยลำดับ:
1. เช็ค stop condition (ถึง target, item หาย)
2. ปรับชนิดหินตามแผน (`getPlannedStone` → `getEffectiveStone`) — ถ้าต้องเปลี่ยน `useCash`/`useEnriched` จะ return รอ re-render ก่อน
3. ปรับ BSB toggle ตาม `applicableRule.bsb` (ภายใต้กฎ +7→+14) — ถ้าต้องเปลี่ยนก็ return รอ re-render เช่นกัน
4. เช็ค `applicableRule.stopOnLoss` — ถ้าหินถัดไปเสี่ยง item หาย, BSB ไม่คุ้มกัน **และ rate < 100%**: หยุด
5. `setTimeout(handleRefine, 450)` เพื่อตีรอบถัดไป

**เมื่อ `autoRefine = true`:** global "เริ่มที่ระดับตีบวก" จะ dim + disabled, stone slots ใน UI ตีบวก dim + pointer-events-none (มี badge "ควบคุมโดย Auto" มุมซ้ายบน), BSB toggle manual disabled ถ้า `autoUseBSB = true`, ปุ่ม manual refine disabled

**Handler ที่เกี่ยวข้อง:**
- `handleAutoStartChange(level)` — เปลี่ยน autoStart และ sync stack ทันที
- `handleStartAuto()` — reset stack ไปที่ autoStart แล้วเริ่ม autoRunning
- `handleStopAuto()` — หยุด autoRunning และ reset BSB ที่ auto เปิดไว้
- `handleBackToWait()` — กด "กลับไป" หลัง fail: ถ้า autoRefine เปิดอยู่จะ reset stack ไปที่ autoStart แทน 0
- `handleClearSession()` — ล้าง log, oreUsed, bsbUsedTotal

#### UI ตีบวก (overlay บน animation frame)
ทุก UI ซ้อนเป็น overlay (`absolute z-[3]`) อยู่ใน div เดียวกับ animation frame (`maxWidth 350`, `aspectRatio 262/301`, `fontFamily Tahoma`):
- **Stone slots (เลือกหินในตัว UI):** การเลือกชนิดหิน + BSB ย้ายมาคลิกที่ slots hexagon ใน UI ตีบวกแล้ว (แทน panel ชนิดหินข้างนอกที่ถูกลบ) — 3 ช่อง `normal`/`enriched`/`hd` + ช่อง BSB แต่ละช่องโชว์รูปแร่ของช่วงปัจจุบันผ่าน `getStoneOre(itemType, level, stone)` (helper ใหม่ คืนแร่ตัวแทนของชนิดหินโดยไม่ fallback) ช่อง active = ขอบ+glow สีตามชนิด, ช่องใช้ไม่ได้ = dim `opacity 0.3` + disabled (`enriched` ที่ ≥+10, `hd` ก่อน `hdMinLevel`, BSB นอกช่วง 7–14) คลิก = `setUseCash`/`setUseEnriched`/`setUseBSB` (logic เดิม ไม่เปลี่ยน) — `getDisplayOres`/`nextOre` เดิมถูกลบแล้ว
- **ปุ่ม "?" ดูตารางหิน** ลอยมุมซ้ายบนของ frame (คงทางเข้า `showStoneModal` หลังลบ panel)
- **ไม่มี result badge** (สำเร็จ/ล้มเหลว/ไอเทมหาย) ใน frame แล้ว — ลบออกเพราะทับรูป item icon (ดูผลจากสีเลข +N และ Stack log แทน)
- **bannerRate** (banner "สำเร็จ X%") = `currentRate` (rate รอบถัดไป ตัวเดียวกับปุ่ม "Rate:" — sync กันเสมอ) — เมื่อ `mode === 'fail' && isItemLost` banner เปลี่ยนเป็นข้อความ "ไอเทมแตกสลาย" (สีดำ) แทน %
- **Item icon ใน slot:** ถ้ายังไม่ค้นหา item ID จะโชว์รูป default `/images/default_weapon.png` (weapon*) หรือ `/images/default_armor.png` (armor*) ขนาด/ตำแหน่งเดียวกับ icon จาก API
- **ปุ่ม refine/auto:** โปร่งใส (`background transparent`, `color #000`) ซ่อนระหว่าง animation (`!isPlaying && mode !== 'process'`); ตำแหน่งจาก `isTibok`/`isTwoBtn`/`isTwoBtnAuto` — `isTwoBtnAuto` (auto ตีแตกแล้วหยุด) บังคับ `bottom 4% / left 50% / width 83%`
- **Stop Auto badge** สีแดง gradient + จุด pulse มุมขวาบน แสดงตลอดตอน `autoRunning` (ไม่ผูกกับ `isPlaying` จึงไม่กระพริบ) แยกจากปุ่ม "เริ่ม Auto" ที่อยู่ใน group ปุ่มหลัก

#### SEO / Analytics (`index.html` + `public/`)
`index.html` มี meta SEO ไทย (title/description/keywords), Open Graph, Twitter Card, JSON-LD, canonical, Google Search Console verification และ GA4 gtag (`G-52LVZ4FK1T`) — URL ทั้งหมดชี้ `https://ro-refine.com` (custom domain บน Vercel ที่ root path ไม่ต้องตั้ง `base`) มี `public/robots.txt` + `public/sitemap.xml` (Vite copy ไป dist root อัตโนมัติ) + `public/og-image.png` (มีแล้ว) favicon ใช้ `public/favicon.png` ขนาด 256×256

#### PWA + Security headers
- **PWA**: `public/manifest.webmanifest` (ติดตั้งลงจอได้, icons `icon-192.png`/`icon-512.png` gen จาก favicon ด้วย `sips`), `public/sw.js` (service worker: navigation network-first กัน build ค้าง, `/assets/`+`/images/` cache-first, ข้าม cross-origin/`/api/`) — register ใน `main.jsx` เฉพาะ `import.meta.env.PROD`; ลิงก์ manifest + apple meta ใน `index.html`/`en/index.html`
- **Security headers** อยู่ใน `vercel.json` (`headers` block, apply ทุก path): CSP (allowlist GA googletagmanager/google-analytics, Supabase host, รูปไอเทม `static.divine-pride.net`, `'unsafe-inline'` สำหรับ inline gtag + React/recharts inline style), HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy — **แก้ host/บริการใหม่ต้องอัปเดต CSP ด้วย ไม่งั้นโดนบล็อก** (ทดสอบ CSP ได้เฉพาะบน Vercel จริง ไม่ขึ้นใน vite dev/preview)

#### Sprite animation
ใช้ระบบ frame-by-frame ผ่าน `<img>` หลายตัวซ้อนแล้วโชว์เฉพาะ index ที่ active โหมดมี 4 สถานะ (`wait`, `process`, `success`, `fail`) แต่ละสถานะมี `useEffect` คุม interval ของตัวเอง รูปวางที่ `public/images/{waiting|processing|success|fail}/*.webp` (แปลงจาก `.bmp` เดิมเป็น WebP เพื่อลดขนาดโหลด ~12MB → ~1.2MB) ตั้งชื่อตามแพตเทิร์นใน `getFrameSrc` (สังเกตว่า `processing` ใช้ prefix สองแบบสลับที่ index 9: `bg_refininga_process_` ก่อนหน้านั้น, `bg_refining_process_` ตั้งแต่ index 9) ห้ามแก้ชื่อไฟล์/นามสกุลโดยไม่อัปเดต `getFrameSrc` ให้ตรงกัน

#### เสียง
import จาก `assets/sounds/*` (ใช้ alias `assets` ที่ตั้งใน `vite.config.js` ชี้ไป `src/assets`) เล่นเป็น `new Audio(...)` ต่อกันด้วย `onended`

### โมดูลย่อย
- `src/components/EventRateBanner/index.jsx` — แถบ "Event Rate Up" (**`fixed top-0 right-0 z-40` — ห้ามใช้ sticky**) + กรอบไฟขอบซ้าย-ขวาของเพจ (`event-fire-edge`, absolute z-[-1] เลื่อนตามหน้า)
  - **Slide in/out ไม่ดัน content**: props `active` (bool) คุม `shown` state ผ่าน `requestAnimationFrame` — `active=true` → `translate-y-0` (สไลด์ลง), `active=false` → `-translate-y-full` (สไลด์ขึ้นกลับ) — **ไม่มี spacer แล้ว** (เคย `h-8 sm:h-10` ดัน content = layout shift, ถูกลบแล้ว) — parent (`Container`) คง mount ผ่าน `showEventBar` state + `setTimeout 520ms` ก่อน unmount เพื่อให้ slide-up animation จบก่อน
  - **ย่อ/ขยายแบบ morph**: `collapsed` prop → pill `w-[178px]` มุมขวาบน / เต็มจอ 56px mobile / 80px desktop
  - **ปุ่ม**: ✕ ปิด Event (`onClose`) + ⌄ ย่อ (`onToggle`) — ทั้ง big mode และ pill mode
  - **เปลวไฟใน bar**: 2 layer `div` จริงซ้อนกัน (`event-flame-1` ชั้นใน เหลือง/ขาวร้อน, `event-flame-2` ชั้นนอก ส้ม) แทน `::before`/`::after` pseudo — div จริงโดน `overflow-hidden` clip ไม่ทะลุ + `isolation: isolate` บน `.event-fire-bar` กัน `mix-blend-mode: screen` blend ทะลุไปทั้งเพจ — **ห้ามใส่ `filter: blur()` บน child ของ bar** (ทำให้หลุด overflow-hidden → bleed) — `flame-flicker-a/b` ใช้ opacity อย่างเดียว (ไม่มี transform — transform บน pseudo กระทบ scrollHeight = layout jitter 100px+)
  - **กรอบไฟขอบเพจ** (`event-fire-edge`): `absolute inset-0 z-[-1]` gradient ซ้าย-ขวา 40px ไม่มีบน/ล่าง — ไม่มีลูกไฟ (ember) แล้ว (เคยทำให้เห็นส้มล่างสุดเพจ ถูกลบแล้ว)
- `src/components/HeroBanner/index.jsx` — hero banner ด้านบนสุด แสดง `/og-image.png` เต็มความกว้าง + `<h1 sr-only>` สำหรับ SEO (แทน DateTimeDisplay + DailyInfoPanel เดิมที่ถูกลบแล้ว)
- `src/components/Toggle/index.jsx` — Toggle switch reusable
- `src/components/FloatingMenu/index.jsx` — ปุ่ม FAB ลอย fixed มุมขวาล่าง (`z-40`, backdrop `z-30`, ต่ำกว่า stone modal `z-50`/patch modal `z-60`) คลี่เป็น speed dial เห็น actions (array เพิ่มเมนูใหม่ได้ง่าย): "อัปเดตใหม่" → เรียก `onOpenPatchNotes`, "แจ้งปัญหา" → เปิด Google Form, theme toggle (อาทิตย์/จันทร์)
  - **Scroll-hide**: `scrollHidden` state — เลื่อนลงพ้น 160px → FAB ซ่อน (`opacity-0 pointer-events-none translate-y-6`) กัน FAB บัง content, เลื่อนขึ้น → โผล่กลับ — ใช้ `requestAnimationFrame` throttle + threshold 8px กัน jitter — `hidden = suppressed || scrollHidden`
  - **Lazy render**: `{open && actions.map(...)}` — action items render เฉพาะตอนกดเปิด **ไม่มี HTML ค้างใน DOM** กัน FAB บังปุ่ม content ขณะปิด — entrance animation `.fab-action` (keyframe `fab-in` เด้ง stagger)
- `src/components/SimulatorPanel/index.jsx` — โหมดจำลองหาค่าเฉลี่ย (Beta) แถบม่วง slide เปิด/ปิด อยู่เหนือสถิติ Session ใน Layout: config (ช่วงระดับ/หิน/BSB/จำนวนรอบ 10–1000) → รัน `simulateRound` เป็น chunk ละ 50 ผ่าน `setTimeout` (มี progress) → แสดงสรุปต่อรอบ 6 metric (ตี/ติด/ล้ม/แตก/หิน/BSB จาก `METRIC_CARDS` module-level) เป็นการ์ดเดียวต่อ metric: เฉลี่ยตัวใหญ่ + Min/Max แถวเล็กในการ์ด, chip แร่เฉลี่ยแยกชนิด, กราฟ + ตารางรายรอบ — รับ props `itemType`, `isEventRate`, `bsbTable` จาก Container
- `src/components/SimulatorPanel/DistChart.jsx` — กราฟการกระจาย (**recharts** — dependency เดียวที่เพิ่มเพื่อกราฟ) histogram + เส้น CDF (โอกาสสะสม) + ReferenceLine Mean/P50/P90 — **lazy load ผ่าน `React.lazy`** จึงแยก chunk (~113KB gzip) ไม่บวม main bundle; ใน panel มีปุ่มสลับ metric ของกราฟ (`CHART_METRIC_KEYS`: ตี/หิน/BSB/แตก — ซ่อนปุ่มที่ค่า max=0) + ประโยคสรุป P50/P90 ใต้กราฟ (`sim_budget_note`)
- `src/components/PatchNotesModal/index.jsx` — modal ประวัติการอัปเดต (`z-60`) อ่านข้อมูลจาก `src/constants/changelog.js` (`CHANGELOG`, `LATEST_CHANGELOG_VERSION`, `CHANGE_TYPE_META`) auto-show ตอนเปิดเว็บถ้าไม่ได้ปิดไว้ภายใน 7 วัน (เก็บ `ro_refine_patchnotes` ใน localStorage เป็น `{until, version}`; แสดงซ้ำถ้ามีเวอร์ชันใหม่กว่าที่เคยปิด) + prop `openTrigger` (counter) สำหรับสั่งเปิดเองจาก FloatingMenu

### Dashboard analytics (หน้า `/dashboard` — admin ส่วนตัว ไม่มีลิงก์เข้าจาก UI)
หน้า dashboard แสดงสถิติ GA4 สำหรับเจ้าของเว็บ แยกขาดจาก simulator (ไม่กระทบ bundle/หน้าหลัก):
- **Routing**: `src/main.jsx` ห่อด้วย `<BrowserRouter>` (react-router-dom) — route `/dashboard` lazy-load `Dashboard` (แยก chunk), route `*` = `<App />` (simulator เดิม ทั้ง `/` และ `/en/`). Vercel rewrite `/dashboard` → `/index.html` ใน `vite.config`/`vercel.json`
- **Auth**: Supabase (`@supabase/supabase-js`) ผ่าน `src/lib/supabase.js` (อ่าน `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `isSupabaseConfigured` guard ถ้า env ว่าง) — `src/dashboard/Dashboard.jsx` เป็น auth gate (`Login.jsx` ↔ `DashboardView.jsx`), ใครสมัครก็เข้าได้ (email+password)
- **ข้อมูล GA**: `api/ga.js` = Vercel Serverless Function เรียก GA4 Data API ด้วย service account (`@google-analytics/data`) — verify Supabase access token ก่อนทุก request (401 ถ้าไม่มี/ไม่ถูก) คืน totals + deltas (เทียบ 30 วันก่อนหน้า) + timeseries (90 วัน — client ตัด 7/30/90) + hourly (วันนี้รายชั่วโมง 0–23) + topPages + devices + countries + cities + channels (sessionDefaultChannelGroup) + audience (newVsReturning: new/returning users, returningAvgVisits) + events (FEATURE_EVENTS = custom event ของเว็บ)
- **Dev**: `vite.config.js` มี `devApiPlugin` (`apply: 'serve'`) shim `/api/ga` ให้รันใต้ `npm run dev` ได้ (โหลด GA_*/SUPABASE_* จาก `.env.local` เข้า `process.env`) — production ใช้ Vercel function จริง
- **UI**: `DashboardView.jsx` ใช้ recharts (KPI cards + sparkline + delta badge, กราฟแนวโน้ม area gradient + ปุ่มสลับช่วง วันนี้/7/30/90 วัน, donut อุปกรณ์, donut ผู้ใช้ใหม่ vs กลับมาซ้ำ, bar events, leaderboard หน้า/ประเทศ/เมือง/ช่องทาง, skeleton loading)
- **ENV ที่ต้องตั้งบน Vercel**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, `GA_PRIVATE_KEY`, **`DASHBOARD_ALLOWED_EMAILS`** (อีเมลเจ้าของคั่นด้วย `,` — `api/ga.js` คืนข้อมูลเฉพาะอีเมลนี้; ไม่ตั้ง = 403 ทุกคน **fail closed**), **`DIVINE_PRIDE_API_KEY`** (ใช้ใน `api/item.js`) (ค่าจริงอยู่ใน `.env.local` — gitignored; service account JSON เก็บใน `.secrets/` — gitignored)
- **`api/item.js`** = Serverless proxy ค้นไอเทมจาก divine-pride (ซ่อน API key ไว้ฝั่ง server แทน hardcode ใน client + ผ่าน same-origin เลี่ยง CSP) — validate `id` เป็นตัวเลข 1–8 หลัก, cache `s-maxage` 1 วัน; client เรียก `/api/item?id=` (devApiPlugin shim ทั้ง `/api/ga` + `/api/item` ใน dev)
- **Auth dashboard**: `api/ga.js` verify Supabase token **แล้วเช็ค email ใน `DASHBOARD_ALLOWED_EMAILS`** (signup เปิดอยู่ ใครสมัครก็ได้ แต่เห็นข้อมูลเฉพาะเจ้าของ) — แนะนำปิด open signup ใน Supabase console ด้วย
- **Patch notes**: dashboard เป็น admin/analytics ภายใน **ห้ามใส่ใน CHANGELOG** (ผู้เล่นไม่เห็น)

### ระบบธีม dark/light
แนวทาง A = semantic tokens ผ่าน CSS variables (ไม่ใช้ `dark:` variant)
- **`src/index.css`**: `@theme inline` map token → utility
  - neutral: `bg-app/bg-card/bg-sunken/text-body/text-dim/text-faint/border-line/border-line-soft`
  - accent (แบรนด์ม่วง): `accent/accent-2/accent-3/accent-fg/accent-surface`
  - **semantic accent text** (สลับอ่อน dark ↔ เข้ม light เพื่อ contrast): `text-warn/text-success/text-danger/text-info/text-brand2` — ใช้แทน `text-amber/emerald/rose/sky/indigo-200|300` ทั้งหมด
  - ค่าจริงอยู่ `:root` (dark default) และ `html.light` (light) สลับ runtime
  - **brand gradient นีออน** (เขียว→ฟ้า→ม่วง) = `--brand-gradient` + utility `.bg-brand` (เส้น/progress) และ `.brand-border` (ขอบ gradient 1px ล้อมกล่อง ผ่าน padding-box/border-box ใช้กับแผง SimulatorPanel) — **ห้ามใช้ gradient เป็นพื้นปุ่มที่มีข้อความ** (ตัวอักษรจม)
- **`src/utils/theme.js`**: `getTheme/applyTheme/toggleTheme` เก็บ localStorage `ro_refine_theme` (สลับ class `light` บน `<html>`)
- **No-FOUC bootstrap**: inline script ใน `index.html` + `en/index.html` ใส่ class `light` ก่อน paint (default = dark)
- **Toggle**: action ใน `FloatingMenu` (ไอคอนอาทิตย์/จันทร์)
- **สถานะ**: app ฝั่งผู้เล่นแปลงเป็น token ครบแล้ว + QC ด้วย screenshot จริงทั้ง 2 ธีม (Phase 1–3,5) เหลือ **Dashboard (`src/dashboard/*`) ยัง dark-only** (Phase 4). คงสีตายตัวโดยตั้งใจ: `text-slate-900` (ตัวดำบนปุ่มสว่าง), accent `-100` บน badge พื้น hex/inline ตายตัว (กรอบเกม, chip log), หน้าต่างตีบวก (sprite เกม) ใช้ inline `color:#000`. **toggle live บน production แต่ยังไม่ประกาศใน patch notes (internal)**

### Path alias
ใน Vite ตั้ง alias `assets` → `src/assets` (ใช้ในการ import รูป/เสียง) ส่วน frame ของ sprite ใช้ public path `/images/...` ตรง ๆ ไม่ผ่าน alias

### CI / deploy
Deploy หลักใช้ **Vercel** (auto build จาก push master, root path) — เว็บจริง `https://ro-refine.com` (custom domain; โดเมนเก่า `ro-refine-simulate-i9a9.vercel.app` redirect 301 มาที่นี่) gh-pages/GitHub Pages ถูกตัดทิ้ง (เลี่ยง duplicate content) workflow ที่ active มีเพียง `monitoring.yml` (cron ทุกคืน: Playwright + Lighthouse + Supabase persist + commit report รายวัน)

## เรื่องที่ควรระวังเวลาแก้

- การคำนวณอัตราสำเร็จและกติกาแพ้/ชนะกระจุกอยู่ใน `handleRefine` เดียว แก้ตรงไหนต้องไล่ flow ของ `useCash`, `useEnriched`, `useBSB`, `itemType`, `stack.length` ให้ครบทุกสาขา
- `useEffect` ของแต่ละโหมด animation depend เฉพาะ `mode` (และบางตัวก็ `isFail`/`isSuccessLoop`) ถ้าเพิ่ม state ที่ต้อง reset ตอนเปลี่ยนโหมดให้ระวัง interval ตกค้าง
- auto loop `useEffect` มี dependency array ยาว — ถ้าเพิ่ม state ที่ auto loop ต้องอ่านต้องใส่ใน deps ด้วย (มี `// eslint-disable-next-line react-hooks/exhaustive-deps` เพราะ handleRefine เป็น closure)
- `autoStoneRules[0].from` ล็อคไว้ (= `autoStart+1`) และช่วงกำแพง (`from===11`) ก็ล็อก — ทุก mutation ของ rules ต้องผ่าน `normalizeStoneRules` ซึ่งบังคับ invariant พวกนี้ (effect `[autoStart, autoTarget, itemType, ...]` + handler `updateRuleFrom`/`splitStoneRule`/`removeStoneRule`)
- เมื่อ `autoRefine` เปิดและ `autoStart` เปลี่ยน → stack จะ sync ทันทีผ่าน `handleAutoStartChange` ซึ่งทำงานเป็น event handler ไม่ใช่ useEffect (ทำให้ไม่มี stale closure)
- `getPlannedStone` รับ `stack.length + 1` เสมอ (destination level) — อย่าส่ง `stack.length` เพราะจะ offset ผิด
- Log/stats (`log`, `oreUsed`, `bsbUsedTotal`) สะสมข้าม session จนกว่าจะกด "ล้าง Session" (`handleClearSession`) — ตั้งใจให้เป็น global session counter
- Empty states: Stack log ว่างมี hint (`log_empty_hint`), สรุปการใช้ไอเทมกรองแถว `qty = 0` ออก (รวม BSB) และโชว์ `usage_empty_hint` เมื่อไม่มีแถวเลย
- Layout กว้าง `max-w-5xl` + `pb-16 sm:pb-4` (กัน FloatingMenu บังเนื้อหาท้ายหน้าบน mobile) — แถบ Event ใช้ `max-w-5xl` ด้านในให้ตรงกัน
- `toggleHasMeaning(..., autoUseBSB, ruleBsb, bsbTable)` (ใน `stones.js`) — ตรวจ 3 เงื่อนไข: stone หายได้ + rate < 100% + BSB ของช่วงนั้น (`ruleBsb`) ไม่คุ้มครบช่วง (รับ `rule.bsb` ไม่ใช่ start/end แล้ว) ถ้าจะแก้เงื่อนไข toggle ต้องแก้ที่ฟังก์ชันนี้

#### Log item structure
แต่ละ entry ใน `log` state มี field:

```
{ msg, itemType, useCash, useEnriched, useBSB, bsbConsumed, isSuccess, oreName }
```

- `msg` — ข้อความเต็ม format `"+X → +Y : ผล — rollDetail"` แยกด้วย ` — `
- `oreName` — ชื่อแร่ที่ใช้จริง (จาก `getOreName`) หรือ `null` ถ้าไม่มี
- `bsbConsumed` — จำนวน BSB ที่ถูกใช้จริง (> 0 เฉพาะตอนล้มแล้ว BSB ปกป้อง)

**Log UI rendering** — ไม่มี `renderColoredLog` / `LOG_KEYWORD_COLORS` แล้ว (ลบออก) ใช้ inline JSX แทน:
- เลขลำดับ `#N` นำหน้าทุก entry
- แสดงรูปแร่จาก `ORE_IMAGES[item.oreName]` + ชื่อ (fallback เป็น stone badge ถ้าไม่มีรูป)
- BSB แสดงด้วยรูป `/images/blacksmith_blessing.png`
- result badge แยกตาม `item.resultType`: `'success'` → สำเร็จ, `'bsb_protect'` → ป้องกัน ×N, `'item_lost'` → ไอเทมหาย, `'level_drop'` → ลด −N (จาก `item.dropAmount`), อื่น → ล้มเหลว
- log entry เพิ่ม field: `resultType`, `dropAmount`, `rollData: {successPct, failPct, rollPct, isSuccess}`, `fromLevel`, `toLevel` — ใช้ render badge และ roll detail โดยไม่ต้อง parse string msg

## Version

เลข version อยู่ที่ `src/version.js` ไฟล์เดียว export เป็น `APP_VERSION` string แสดงใน footer ของ Layout

**กติกาการ bump version (สำคัญ — เปลี่ยนใหม่ 2026-06-10):**
- **ห้าม bump version ทุกครั้งที่แก้โค้ด/commit** — แก้กี่รอบก็ได้โดยไม่แตะ `version.js`
- **bump version ครั้งเดียวเฉพาะตอนผู้ใช้สั่ง "push"** — 1 push = 1 version ใหม่ ไม่ว่าใน push นั้นจะสะสมการแก้ไว้กี่เรื่อง
- ขนาดการ bump ใช้ Semantic Versioning ตามการเปลี่ยนแปลง **รวมทั้งหมด** ของรอบนั้น:
  - `PATCH` (+0.0.1) — มีแต่ bugfix / แก้ UI เล็กน้อย
  - `MINOR` (+0.1.0) — มีฟีเจอร์ใหม่อย่างน้อย 1 อย่าง
  - `MAJOR` (+1.0.0) — เปลี่ยน architecture, redesign ใหญ่

version ปัจจุบัน: **1.11.7** (CHANGELOG ล่าสุดอยู่ที่ 1.11.7 — **Enriched ใช้เรทชุดเดียวกับ HD** (ตาราง cash) ตาม iROWiki: `getRate` อ่านตาราง cash เมื่อ `useCash || useEnriched` ลบ `ENRICHED_RATE_BONUS` (เดิมคิด normal+10 ทำให้เรท Enriched ต่ำกว่าจริง); แก้ `event.normal` ของ W1–4/A1 = เท่า `noevent.normal` (หินธรรมดาไม่รับบูสต์ event — มี `*` เฉพาะคอลัมน์ W5/A2); ตรวจ exhaustive ครบ 840/840 combination (event×ชนิด×ระดับ×หิน) ตรง iROWiki ทั้ง 4 ตาราง. ก่อนหน้า 1.11.6 — แก้ค่า `RATE_TABLES` ให้ตรง iROWiki: W5/A2 ทุกตาราง (เดิมใช้ค่า event ผิดมาทั้งคู่), W3 event +10+, W2 event +7→8, W1/2/3 noevent.normal +15; เพิ่ม `docs/refine-bible.md` เป็นเอกสารอ้างอิงระบบตีบวก. ก่อนหน้า: 1.11.5 = security (dashboard email allowlist + ซ่อน divine-pride key ผ่าน api/item proxy), 1.11.4 = ธีม Phase 2–3,5, 1.11.3 = cursor pointer, 1.11.2 = ธีม dark/light เฟส 1; push `d67a45a` (2026-06-17) event fire bar redesign + FAB scroll-hide ไม่มี CHANGELOG เพราะ internal/polish)

## Patch Notes (changelog)

ข้อมูล changelog อยู่ที่ `src/constants/changelog.js` (`CHANGELOG` array เรียงใหม่→เก่า, `LATEST_CHANGELOG_VERSION`, `CHANGE_TYPE_META`) แสดงผ่าน `src/components/PatchNotesModal/index.jsx` (เปิดผ่าน FloatingMenu เมนู "อัปเดตใหม่" หรือ auto-show)

**เพิ่ม entry ใน `CHANGELOG` เฉพาะตอนผู้ใช้สั่ง push (พร้อมกับ bump version)** — **1 push = 1 entry เดียว** รวบทุกการแก้ที่สะสมไว้ในรอบนั้นเป็น `items` หลายรายการใน entry เดียวกัน แยกชนิดด้วย badge `type` = `'feature'` (ใหม่) / `'fix'` (แก้บั๊ก) / `'improve'` (ปรับปรุง) — **ห้ามสร้าง entry แยกหลาย version ถี่ ๆ สำหรับการแก้ทีละเรื่อง** รูปแบบ: `{ version, date: 'YYYY-MM-DD', items: [{ type, text, textEn }] }` ใส่บนสุด (ใหม่สุด) — `LATEST_CHANGELOG_VERSION` derive จาก `CHANGELOG[0].version` อยู่แล้ว

**ห้ามใส่ข้อมูลเหล่านี้ใน patch notes** (แสดงต่อสาธารณะ):
- **Secret / credential** — API key, token, GA ID (`G-...`), Google Form ID, endpoint ภายใน
- **โครงสร้างพื้นฐาน / ops** — ย้ายโดเมน, deploy, hosting provider, ขนาดไฟล์ (favicon/bundle)
- **SEO / analytics** — sitemap, GA4, Search Console, meta tag
- **รายละเอียดช่องโหว่ security** — ถ้าจำเป็นให้เขียนกว้าง ๆ ว่า "ปรับปรุงความปลอดภัย" เท่านั้น (ห้ามบอกวิธี exploit หรือจุดที่เป็นช่องโหว่)
- **เทคโนโลยี / refactor ภายใน** — ชื่อ library, ชื่อไฟล์/ฟังก์ชัน, การปรับโครงสร้างโค้ดที่ผู้ใช้ไม่เห็นผล
- **หน้า Dashboard / admin ภายใน (`/dashboard`)** — **อะไรก็ตามที่แก้/เพิ่มในหน้า dashboard (analytics สำหรับเจ้าของเว็บ) ห้ามลง patch notes ทุกกรณี** ไม่ว่าจะเป็นฟีเจอร์ใหม่/กราฟ/UI — ผู้เล่นเข้าไม่ถึง ไม่เกี่ยวกับเกม (กฎถาวร ผู้ใช้สั่งไว้ 2026-06-16)

เขียนเฉพาะสิ่งที่ **ผู้เล่นมองเห็น/ได้ประโยชน์** เป็นภาษาผู้ใช้ (เลี่ยงศัพท์เทคนิคในโค้ด เช่น itemType, mapping, frame index) — กฎเดียวกันนี้ย่อไว้เป็น comment บนหัวไฟล์ `changelog.js` ด้วย

**กฎคัดกรอง patch notes (เข้มงวด — ผู้ใช้รำคาญ entry ถี่/ซ้ำมาก):**

1. **1 วัน = ไม่เกิน 1 entry** — ถ้าวันเดียวกันมี push หลายรอบ ให้**รวม items เข้า entry เดิมของวันนั้น**แล้วเปลี่ยน `version` ของ entry เป็นเวอร์ชันล่าสุด **ห้ามสร้าง entry ใหม่ของวันเดิมเด็ดขาด**
2. **วิเคราะห์ก่อนใส่ทุก item**: ถามว่า "ผู้เล่นเปิดเว็บมาแล้วเห็น/ได้ประโยชน์อะไรจากข้อนี้" — ถ้าตอบไม่ได้ชัด ๆ = ไม่ใส่
3. **ห้ามใส่เรื่องเหล่านี้**: แก้คำ/สำนวน/ข้อความ, แก้บั๊กเล็กที่ไม่มี impact (เช่น label ผิด, ระยะห่างเพี้ยน), feature จิ๋ว (ปรับ UI เล็กน้อย, เพิ่ม badge/หน่วยคำ), การแก้/ปรับของฟีเจอร์ที่เพิ่งประกาศไปในวันเดียวกัน (ถือเป็นส่วนหนึ่งของฟีเจอร์นั้น — แก้ text เดิมแทนถ้าจำเป็น)
4. **เรื่องแนวเดียวกันรวมเป็นข้อเดียว** — เช่น ทุกอย่างเกี่ยวกับโหมดจำลองในรอบนั้น = 1 item ไม่แตกเป็น กราฟ 1 ข้อ การ์ด 1 ข้อ คำอธิบาย 1 ข้อ
5. patch notes สั้นคนอ่านมากกว่ายาว — entry ละ 2–4 items กำลังดี

## Workflow: commit ระหว่างทาง vs push

**commit ระหว่างทาง (ยังไม่ push):**
1. **ไม่ bump version, ไม่เพิ่ม CHANGELOG** — แค่แก้โค้ด + commit ปกติ
2. เทียบว่ามีอะไรเปลี่ยนที่ส่งผลต่อ architecture, state, helpers, หรือ behavior — ถ้ามี แก้ CLAUDE.md ให้ตรงแล้ว commit รวมกัน

**เมื่อผู้ใช้สั่ง "push" ให้ถามผู้ใช้ก่อน (ก่อนทำอะไรทั้งนั้น):**

**ขั้นที่ 0 — รวบรวมก่อน:** `git log <last-pushed>..HEAD` + ดูการแก้ค้าง แล้วสรุปให้ผู้ใช้เห็นก่อนว่ามีอะไรบ้าง

**ขั้นที่ 1 — ถามเรื่อง version:**
> "จะ bump version ไหม? (แนะนำ PATCH/MINOR/MAJOR ตามขนาดการแก้) หรือ ไม่ bump"

**ขั้นที่ 2 — ถามเรื่อง patch notes:**
> แสดงรายการสิ่งที่แก้ไปทั้งหมดและระบุว่าอันไหน**ไม่ควรลง** (ตาม กฎ patch notes ที่มีอยู่) แล้วถามว่า:
> 1. **ไม่ลง patch notes เลย** (internal/polish ทั้งหมด)
> 2. **แสดงเฉพาะที่เลือก** (ผู้ใช้ระบุเอง)
> 3. **แสดงทั้งหมดที่ผ่านกฎ** (Claude กรองให้ตามกฎที่ตั้งไว้)

รอคำตอบผู้ใช้ก่อน — ห้ามทำขั้นต่อไปโดยไม่ได้รับคำตอบ

**ขั้นที่ 3 — ลงมือ (หลังได้คำตอบทั้ง 2 ข้อแล้ว):**
1. bump version ใน `src/version.js` (หรือข้ามถ้าผู้ใช้เลือกไม่ bump)
2. เพิ่ม/ไม่เพิ่ม CHANGELOG entry ตามที่ตกลง
3. อัปเดตบรรทัด "version ปัจจุบัน" ใน CLAUDE.md (เสมอ)
4. commit (รวม version + changelog) แล้ว push
