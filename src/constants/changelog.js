// ประวัติการอัปเดต (patch notes) — เรียงจากใหม่ไปเก่า
// type ของแต่ละรายการ: 'feature' (ใหม่) | 'fix' (แก้บั๊ก) | 'improve' (ปรับปรุง)
// กติกา: 1 วัน = ไม่เกิน 1 entry — push ซ้ำวันเดิมให้รวม items เข้า entry เดิมแล้วอัปเดต version เป็นตัวล่าสุด
// คัดเฉพาะเรื่องที่ผู้เล่นได้ประโยชน์ชัด ๆ — แก้คำ/บั๊กเล็กไม่มี impact/feature จิ๋ว/แก้ของที่เพิ่งออกวันเดียวกัน = ไม่ใส่
// เรื่องแนวเดียวกันรวมเป็นข้อเดียว (bump version เฉพาะตอน push)
//
// ⚠️ patch notes แสดงต่อสาธารณะ — ก่อนเพิ่มรายการ ห้ามใส่สิ่งเหล่านี้:
//   - secret / credential: API key, token, GA ID, Google Form ID, endpoint/API provider ภายใน
//   - โครงสร้างพื้นฐาน/ops: ย้ายโดเมน, deploy, ขนาดไฟล์ favicon, ผู้ให้บริการ hosting
//   - SEO / analytics: sitemap, GA4, Search Console, meta tag
//   - รายละเอียดช่องโหว่ security (ถ้าจำเป็นให้เขียนกว้าง ๆ ว่า "ปรับปรุงความปลอดภัย")
//   - เทคโนโลยี/refactor ภายใน: ชื่อ library, ชื่อไฟล์/ฟังก์ชัน, การปรับโครงสร้างโค้ด
// เขียนเฉพาะสิ่งที่ "ผู้เล่นมองเห็น/ได้ประโยชน์" เป็นภาษาผู้ใช้
// textEn = English version (optional — fallback to text if missing)

export const CHANGELOG = [
  {
    version: '1.10.0',
    date: '2026-06-16',
    items: [
      { type: 'feature', text: 'ติดตั้งเว็บเป็นแอปลงหน้าจอมือถือ/คอมได้ (PWA) เปิดเร็วขึ้นและใช้งานพื้นฐานได้แม้เน็ตไม่ดี', textEn: 'Install the site as an app on your phone/desktop (PWA) — faster launch and basic offline use' },
      { type: 'feature', text: 'เพิ่มแถบจัดการคุกกี้ด้านล่างจอ — เลือกยอมรับหรือปฏิเสธคุกกี้วิเคราะห์ได้เอง พร้อมนโยบายคุกกี้ให้อ่าน (เว็บจะไม่เก็บข้อมูลการใช้งานจนกว่าจะกดยอมรับ)', textEn: 'Added a cookie consent bar at the bottom — accept or reject analytics cookies yourself, with a cookie policy to read (the site collects no usage data until you accept)' },
      { type: 'improve', text: 'ปรับปรุงความปลอดภัยของเว็บไซต์', textEn: 'Improved website security' },
    ],
  },
  {
    version: '1.8.3',
    date: '2026-06-11',
    items: [
      { type: 'fix', text: 'แก้หิน HD ของ Weapon Lv.5 / Armor Lv.2 ให้ตรงตามเกม — +11~+15 ใช้ HD Etherdeocon / HD Ethernium และ +16~+20 ใช้ HD Etel Bradium / HD Etel Carnium (แสดงรูปและชื่อถูกต้องทั้งช่องเลือกหิน, log, ตารางหิน และโหมดจำลอง)', textEn: 'Fixed Weapon Lv.5 / Armor Lv.2 HD stones to match the game — +11~+15 uses HD Etherdeocon / HD Ethernium, +16~+20 uses HD Etel Bradium / HD Etel Carnium (correct icon and name in stone slots, log, stone table and simulator)' },
      { type: 'fix', text: 'แก้ Stack log เลื่อนขึ้นไปอ่านย้อนหลังแล้วเด้งกลับลงล่างเอง — ตอนนี้เลื่อนค้างไว้ได้ จะเลื่อนลงให้เฉพาะตอนมีรายการใหม่', textEn: 'Fixed Stack log snapping back to the bottom while scrolling up — it now stays put and only scrolls down when a new entry arrives' },
      { type: 'improve', text: 'ตารางอัตราสำเร็จย่อแสดง +1~+10 เป็นค่าเริ่มต้น (กดดูเต็มได้) พร้อมไฮไลต์คอลัมน์ไอเทมที่เลือก และใช้ชื่อย่อ A1/W1 บนมือถือให้อ่านง่าย', textEn: 'Rate table now shows +1~+10 by default (expandable), highlights your selected item column, and uses short names (A1/W1) on mobile' },
      { type: 'improve', text: 'จัดหน้าจอมือถือใหม่หลายจุด (โหมดจำลอง, สกุลเงิน) และเพิ่มข้อความแนะนำเมื่อยังไม่มีประวัติการตี', textEn: 'Mobile layout polish (simulator, currency) and helpful hints when there is no refine history yet' },
      { type: 'improve', text: 'เลื่อนหน้าแล้วแต่ละส่วนของเว็บค่อย ๆ ลอยขึ้นมาอย่างนุ่มนวล และย้ายปุ่มเปลี่ยนภาษาไปมุมขวาบนของแบนเนอร์', textEn: 'Sections gently float in as you scroll, and the language switch moved to the top-right of the banner' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-10',
    items: [
      { type: 'feature', text: 'เพิ่มโหมดจำลองหาค่าเฉลี่ย (Beta) — เลือกช่วงระดับ ชนิดหิน BSB และจำนวนรอบ แล้วดูค่าเฉลี่ย/ต่ำสุด/สูงสุดของ ตี/ติด/ล้ม/ไอเทมหาย/หิน/BSB พร้อมกราฟแบบชี้ดูค่าได้ เส้นโอกาสสะสม และคำแนะนำว่าควรเตรียมของเท่าไหร่ (กดเปิดที่แถบม่วงเหนือสถิติ Session)', textEn: 'New Average Simulator (Beta) — pick a level range, stone, BSB and rounds, then see avg/min/max of attempts/successes/fails/items lost/stones/BSB with an interactive chart, cumulative-chance line and advice on how much to stock up (open via the purple bar above Session Stats)' },
      { type: 'feature', text: 'เปิดโหมด Event Rate Up แล้วมีแถบไฟลุกลอยบนสุดของจอบอกสถานะตลอดเวลา — ย่อเป็นปุ่มเล็กมุมขวาบนได้', textEn: 'Turning on Event Rate Up now shows a fiery banner pinned to the top of the screen — collapsible into a small pill at the top right' },
      { type: 'improve', text: 'ปรับดีไซน์ปุ่มและสวิตช์ทั่วเว็บ (เปลี่ยนภาษา, เลือกไอเทม, Event, สกุลเงิน, ล้าง Session) ให้เห็นชัดขึ้นว่ากดได้', textEn: 'Redesigned buttons and switches across the site (language, item mode, Event, currency, Clear Session) so they clearly look clickable' },
      { type: 'feature', text: 'เพิ่มหน้าเว็บภาษาอังกฤษที่ ro-refine.com/en/ — สลับภาษาแล้วลิงก์จะเปลี่ยนตามให้อัตโนมัติ', textEn: 'English version now available at ro-refine.com/en/ — switching language updates the link automatically' },
      { type: 'fix', text: 'แก้การนับ BSB ให้ตรงตามเกม — BSB ถูกใช้ทุกครั้งที่ตี (ตีติดก็เสีย) มีผลทั้งโหมดปกติและโหมดจำลอง', textEn: 'Fixed BSB counting to match the game — BSB is consumed on every attempt (success included), in both normal and simulator modes' },
      { type: 'fix', text: 'แก้เปอร์เซ็นต์สำเร็จบนแถบด้านบนไม่ตรงกับ Rate ที่ปุ่มตีบวก', textEn: 'Fixed success % on the top banner not matching the Rate on the refine button' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-09',
    items: [
      { type: 'feature', text: 'รองรับ 2 ภาษา (ไทย/อังกฤษ) — กดปุ่มธงเพื่อสลับภาษาได้ทันที', textEn: 'Bilingual support (Thai/English) — press the flag button to switch instantly' },
      { type: 'improve', text: 'ปรับปรุงให้หน้าเว็บโหลดเร็วขึ้น — รูปภาพและภาพเคลื่อนไหวเบาลงมาก', textEn: 'Faster page load — images and animations are now much lighter' },
      { type: 'improve', text: 'ปรับปรุง Accessibility — สวิตช์และ dropdown เลือกประเภทไอเท็มรองรับ screen reader ได้ดีขึ้น', textEn: 'Improved accessibility — toggles and item-type dropdown now have proper labels for screen readers' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-05',
    items: [
      { type: 'feature', text: 'ระบบ Auto: ปุ่มเลือกหินแต่ละช่วงแสดงรูปแร่ + ชื่อแร่จริง และซ่อนหินที่ใช้ไม่ได้ในช่วงนั้น', textEn: 'Auto: Stone buttons show ore icon + name, and hide stones unavailable for that range' },
      { type: 'feature', text: 'ระบบ Auto: แบ่งช่วงตีบวกย่อยได้ด้วยปุ่ม "แบ่ง" และระบบกั้นจุดเปลี่ยนแร่ +10 ให้อัตโนมัติ', textEn: 'Auto: Split a range into two with the "Split" button; ore-change wall at +10 is auto-enforced' },
      { type: 'feature', text: 'ระบบ Auto: ตั้งค่า BSB เปิด/ปิดได้ทีละช่วง (เริ่ม/เลิก/ใส่ใหม่ได้ ภายใต้กฎ +7→+14)', textEn: 'Auto: Toggle BSB per range independently (start/stop/resume within +7→+14)' },
      { type: 'improve', text: 'ระบบ Auto: แสดงช่วงแบบเลเวลก่อนตี (เช่น +0 ถึง +3) ให้ช่วงต่อกันพอดี อ่านง่ายขึ้น', textEn: 'Auto: Ranges now display as pre-refine level (e.g. +0 to +3) for cleaner readability' },
      { type: 'improve', text: 'ระบบ Auto: ป้ายสวิตช์ BSB แต่ละช่วงแสดงช่วงระดับจริงที่จะใส่ BSB (เช่น +7→+10)', textEn: 'Auto: BSB toggle now shows the actual level range where BSB applies (e.g. +7→+10)' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-05',
    items: [
      { type: 'feature', text: 'เพิ่มหน้าต่างประวัติการอัปเดต (Patch Notes) ดูสิ่งที่แก้ไขแต่ละเวอร์ชันได้', textEn: 'Added Patch Notes window — view what changed in each version' },
      { type: 'fix', text: 'แก้ตำแหน่งปุ่มและภาพตอนเลือกระดับตีบวกเริ่มต้น ให้แสดงไอเทมที่ตีบวกแล้วถูกต้อง (ทั้งโหมดปกติและโหมด Auto)', textEn: 'Fixed button and item display when selecting a starting refine level (both normal and Auto modes)' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-05',
    items: [
      { type: 'improve', text: 'ปรับปรุงให้เว็บโหลดเร็วขึ้น', textEn: 'Improved page load speed' },
      { type: 'fix', text: 'แก้การค้นหาโล่ (Shield) ที่แสดงระดับเกราะผิด ตอนนี้แสดงเป็นเกราะเลเวล 2 ถูกต้อง', textEn: 'Fixed Shield search showing wrong armor level; now correctly identified as Armor Lv.2' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-04',
    items: [
      { type: 'feature', text: 'เพิ่มแบนเนอร์หัวเว็บ', textEn: 'Added hero banner at top of page' },
      { type: 'feature', text: 'เพิ่มปุ่ม "แจ้งปัญหา" ลอยมุมขวาล่าง', textEn: 'Added floating "Report Issue" button at bottom-right' },
      { type: 'improve', text: 'เพิ่มข้อความ "ไอเทมแตกสลาย" ตอนตีบวกล้มเหลวแล้วไอเทมหาย', textEn: 'Added "Item Destroyed" message when refine fails and item is lost' },
      { type: 'fix', text: 'แก้ตำแหน่งส่วนท้าย (footer) ให้อยู่ด้านล่างสุดถูกต้อง', textEn: 'Fixed footer position to stay at the bottom' },
    ],
  },
  {
    version: null,
    date: '2026-06-03',
    items: [
      { type: 'feature', text: 'ย้ายการเลือกชนิดหินมาคลิกที่ช่องหินในหน้าตีบวกได้โดยตรง (รวมช่อง BSB)', textEn: 'Moved stone selection to clickable slots inside the refine window (including BSB slot)' },
      { type: 'feature', text: 'แสดงรูปไอเทมเริ่มต้นเมื่อยังไม่ได้ค้นหา Item ID', textEn: 'Show default item icon when no Item ID has been searched' },
      { type: 'fix', text: 'เอาป้ายผลลัพธ์ที่บังรูปไอเทมออก', textEn: 'Removed result badge that was covering the item icon' },
      { type: 'fix', text: 'แก้ตำแหน่งปุ่มตอน Auto หยุดหลังไอเทมแตก', textEn: 'Fixed button position when Auto stops after item is destroyed' },
    ],
  },
  {
    version: null,
    date: '2026-06-02',
    items: [
      { type: 'feature', text: 'ออกแบบการ์ดตีบวกใหม่ให้เหมือน Ragnarok + แบนเนอร์ "สำเร็จ X%" + แสดงรูปไอเทมในช่องช่างตีเหล็ก', textEn: 'Redesigned refine card to match Ragnarok style + "Success X%" banner + item icon in smithing slot' },
      { type: 'feature', text: 'เพิ่มปุ่ม "ล้าง Session" สำหรับรีเซ็ตสถิติและ log', textEn: 'Added "Clear Session" button to reset stats and log' },
      { type: 'improve', text: 'ปรับหน้าตา log การตีบวกให้อ่านง่ายขึ้น', textEn: 'Improved refine log layout for better readability' },
      { type: 'fix', text: 'ซ่อนปุ่มระหว่างเล่นแอนิเมชันตีบวก', textEn: 'Hide buttons during refine animation' },
      { type: 'fix', text: 'แก้ log ที่แสดงจำนวนระดับที่ลดผิด (เช่นแสดง −3 ทั้งที่จริงลดแค่ −1)', textEn: 'Fixed log showing wrong level drop count (e.g. showing −3 when actual drop was −1)' },
      { type: 'fix', text: 'แก้แผนหินของ Auto ไม่ให้ตั้งช่วงย้อนกลับ และซ่อนตัวเลือก BSB เมื่อเป้าหมายต่ำกว่า +8', textEn: 'Fixed Auto stone plan preventing backward ranges; hides BSB option when target is below +8' },
      { type: 'fix', text: 'แก้ขนาดและตำแหน่งรูปไอเทมในช่องช่างตีเหล็ก', textEn: 'Fixed item icon size and position in the smithing slot' },
    ],
  },
  {
    version: null,
    date: '2026-06-01',
    items: [
      { type: 'feature', text: 'เพิ่มระบบ Auto ตีบวก — วางแผนชนิดหินแต่ละช่วง, หยุดเมื่อเสี่ยงไอเทมหาย, ใส่ BSB อัตโนมัติ', textEn: 'Added Auto Refine — plan stone type per range, stop on item-loss risk, auto-insert BSB' },
      { type: 'feature', text: 'เพิ่มหิน 3 ชนิด (ปกติ / Enriched / HD) พร้อมตารางอ้างอิงหิน', textEn: 'Added 3 stone types (Normal / Enriched / HD) with a stone reference table' },
      { type: 'fix', text: 'แก้สูตรอาวุธเลเวล 5 / เกราะเลเวล 2 — ตีล้มที่ +10 ขึ้นไปไอเทมหาย และใช้แร่ช่วง +10→+11 ถูกต้อง', textEn: 'Fixed Weapon Lv.5 / Armor Lv.2 rules — fail at +10+ destroys item, ore at +10→+11 now correct' },
      { type: 'fix', text: 'ปิดการเลือกหิน HD ในระดับที่ยังใช้ไม่ได้', textEn: 'Disabled HD stone selection at levels where it is not yet available' },
      { type: 'fix', text: 'แก้ Auto ที่เริ่มใหม่ไม่ได้หลังกด "กลับไป" และ BSB ที่ค้างหลัง Auto จบ', textEn: 'Fixed Auto not restarting after pressing "Back", and BSB state stuck after Auto ends' },
    ],
  },
  {
    version: null,
    date: '2026-05-29',
    items: [
      { type: 'feature', text: 'เพิ่มระบบนับแร่ที่ใช้ และค้นหาไอเทมด้วย Item ID (ตรวจชนิด/เลเวลอัตโนมัติ)', textEn: 'Added ore usage counter and item search by Item ID (type/level auto-detected)' },
      { type: 'feature', text: 'เพิ่มช่องกรอกราคา (Zenny / บาท) พร้อมสรุปค่าใช้จ่ายรวม', textEn: 'Added price input (Zenny / Baht) with total cost summary' },
      { type: 'fix', text: 'แก้ตารางอัตราสำเร็จเป็น 4 แบบ (มี/ไม่มี Event × หินปกติ/Cash) ให้ตรงตารางจริง รวมถึงช่องอาวุธเลเวล 4', textEn: 'Fixed success rate table to 4 modes (Event/No Event × Normal/Cash) with correct values, including Weapon Lv.4' },
      { type: 'improve', text: 'ออกแบบหน้าตาเว็บใหม่ทั้งหมด', textEn: 'Redesigned the entire website layout' },
    ],
  },
  {
    version: null,
    date: '2026-05-28',
    items: [
      { type: 'fix', text: 'แก้ตารางอัตราสำเร็จให้ตรงกับตารางอัตราทางการ (อาวุธ 1-5, เกราะ 1-2 ทุกระดับ)', textEn: 'Fixed success rate table to match official rates (Weapon 1-5, Armor 1-2, all levels)' },
      { type: 'feature', text: 'เพิ่มปุ่มสลับโหมด Event Rate และแยกชนิดหินออกจากการเลือกอัตรา', textEn: 'Added Event Rate toggle and separated stone type from rate selection' },
      { type: 'improve', text: 'ขยายช่วงที่ใช้ BSB ได้เป็นถึง +14 → +15', textEn: 'Extended BSB usable range up to +14 → +15' },
    ],
  },
];

// เวอร์ชันล่าสุด (ใช้เทียบกับ localStorage ว่ามี patch ใหม่ควรแสดงซ้ำไหม)
export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version;

// ป้ายกำกับ + สีตามชนิดการเปลี่ยนแปลง
export const CHANGE_TYPE_META = {
  feature: { label: 'ใหม่', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  fix: { label: 'แก้บั๊ก', className: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  improve: { label: 'ปรับปรุง', className: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
};
