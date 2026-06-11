export const ITEM_TYPE_LABELS = {
  armor1: 'Armor Lv.1',
  armor2: 'Armor Lv.2',
  weapon1: 'Weapon Lv.1',
  weapon2: 'Weapon Lv.2',
  weapon3: 'Weapon Lv.3',
  weapon4: 'Weapon Lv.4',
  weapon5: 'Weapon Lv.5',
};

// ชื่อย่อสำหรับหัวตารางบนจอเล็ก (ชื่อเต็มโดน truncate จนอ่านไม่ออก)
export const ITEM_TYPE_SHORT = {
  armor1: 'A1',
  armor2: 'A2',
  weapon1: 'W1',
  weapon2: 'W2',
  weapon3: 'W3',
  weapon4: 'W4',
  weapon5: 'W5',
};

// แร่ที่ใช้ตีบวกตามประเภทไอเท็ม (ประเภททั่วไป): low = +1-10, high = +11-20
// แยกตามชนิดหิน: normal = หินปกติ (ล้มหาย), cash = HD (ล้มลดระดับ), enriched = Enriched (Cash ล้มหาย+โอกาสสูง, ใช้ +1-10 เท่านั้น)
export const ORE_BY_TYPE = {
  armor1:  { normal: { low: 'Elunium',      high: 'Carnium' }, cash: { low: 'HD Elunium',  high: 'HD Carnium' }, enriched: { low: 'Enriched Elunium' } },
  weapon1: { normal: { low: 'Phracon',      high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon2: { normal: { low: 'Emveretarcon', high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon3: { normal: { low: 'Oridecon',     high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
  weapon4: { normal: { low: 'Oridecon',     high: 'Bradium' }, cash: { low: 'HD Oridecon', high: 'HD Bradium' }, enriched: { low: 'Enriched Oridecon' } },
};

// แร่พิเศษของ Weapon Lv.5 / Armor Lv.2 — แยก 2 ช่วง × 3 ชนิดหิน
// low (+0~9): normal(-3), enriched(-1), hd=ไม่มี
// high (+10+): normal(-3), enriched=ไม่มี, hd=แตก
export const SPECIAL_ORE = {
  weapon5: {
    low:  { normal: 'Etherdeocon',    enriched: 'Enriched Etherdeocon', hd: null },
    high: { normal: 'Etel Bradium',   enriched: null,                   hd: 'HD Etel Bradium' },
  },
  armor2: {
    low:  { normal: 'Ethernium',      enriched: 'Enriched Ethernium',   hd: null },
    high: { normal: 'Etel Carnium',   enriched: null,                   hd: 'HD Etel Carnium' },
  },
};

// สีจุดนำหน้าแร่แต่ละชนิด (ใช้ในชิป/สรุป)
export const ORE_COLORS = {
  Elunium: 'bg-sky-400',
  Carnium: 'bg-cyan-300',
  Phracon: 'bg-slate-300',
  Emveretarcon: 'bg-zinc-300',
  Oridecon: 'bg-orange-400',
  Bradium: 'bg-rose-400',
  'HD Oridecon': 'bg-orange-300',
  'HD Bradium': 'bg-rose-300',
  'HD Elunium': 'bg-sky-300',
  'HD Carnium': 'bg-cyan-200',
  'Enriched Oridecon': 'bg-amber-200',
  'Enriched Elunium': 'bg-indigo-200',
  Etherdeocon: 'bg-amber-400',
  'Enriched Etherdeocon': 'bg-amber-300',
  Ethernium: 'bg-teal-300',
  'Enriched Ethernium': 'bg-teal-200',
  'Etel Bradium': 'bg-red-400',
  'HD Etel Bradium': 'bg-red-300',
  'Etel Carnium': 'bg-emerald-300',
  'HD Etel Carnium': 'bg-green-300',
};

// รูปไอคอนแร่ (ถ้าไม่มีรูปจะ fallback เป็นจุดสีจาก ORE_COLORS)
export const ORE_IMAGES = {
  Phracon: '/images/ores/phracon.png',
  Emveretarcon: '/images/ores/emveretarcon.png',
  Oridecon: '/images/ores/oridecon.png',
  Bradium: '/images/ores/bradium.png',
  Elunium: '/images/ores/elunium.png',
  Carnium: '/images/ores/carnium.png',
  'HD Oridecon': '/images/ores/hd-oridecon.png',
  'HD Bradium': '/images/ores/hd-bradium.png',
  'HD Elunium': '/images/ores/hd-elunium.png',
  'HD Carnium': '/images/ores/hd-carnium.png',
  'Enriched Oridecon': '/images/ores/enriched-oridecon.png',
  'Enriched Elunium': '/images/ores/enriched-elunium.png',
  Etherdeocon: '/images/ores/etherdeocon.png',
  'Enriched Etherdeocon': '/images/ores/enriched-etherdeocon.png',
  Ethernium: '/images/ores/ethernium.png',
  'Enriched Ethernium': '/images/ores/enriched-ethernium.png',
  'Etel Bradium': '/images/ores/etel-bradium.png',
  'HD Etel Bradium': '/images/ores/hd-etel-bradium.png',
  'Etel Carnium': '/images/ores/etel-carnium.png',
  'HD Etel Carnium': '/images/ores/hd-etel-carnium.png',
};

// แร่ที่ใช้ตามประเภทไอเท็ม + ระดับปัจจุบัน (level = stack.length = ระดับก่อนตี) + ชนิดหิน
// boundary: level < 10 = low range (+0→+1 ถึง +9→+10), level >= 10 = high range (+10→+11 เป็นต้นไป)
export const getOreName = (itemType, level, useCash, useEnriched) => {
  const special = SPECIAL_ORE[itemType];
  if (special) {
    const set = level < 10 ? special.low : special.high;
    if (useEnriched && set.enriched) return set.enriched;
    if (useCash && set.hd) return set.hd;
    return set.normal; // fallback: normal ถ้าหินที่เลือกไม่มีในช่วงนี้
  }
  const m = ORE_BY_TYPE[itemType];
  if (!m) return null;
  // Enriched ใช้เฉพาะ level < 10 — หลังจากนั้น fallback เป็นหินปกติ high
  if (useEnriched && m.enriched && level < 10) return m.enriched.low;
  const set = useCash ? m.cash : m.normal;
  return level < 10 ? set.low : set.high; // FIX: เดิม <= 10 ทำให้ +10→+11 ใช้หินผิด
};

// แร่ตัวแทนของชนิดหิน ('normal'|'enriched'|'hd') ที่ระดับนั้น — ไม่ fallback (ใช้โชว์รูปในช่องเลือกหิน)
export const getStoneOre = (itemType, level, stone) => {
  const special = SPECIAL_ORE[itemType];
  if (special) {
    const set = level < 10 ? special.low : special.high;
    if (stone === 'normal') return set.normal;
    if (stone === 'enriched') return special.low.enriched;
    if (stone === 'hd') return special.high.hd;
  }
  const m = ORE_BY_TYPE[itemType];
  if (!m) return null;
  if (stone === 'normal') return level < 10 ? m.normal.low : m.normal.high;
  if (stone === 'enriched') return m.enriched?.low;
  if (stone === 'hd') return level < 10 ? m.cash.low : m.cash.high;
  return null;
};

// ตารางอ้างอิงหินตีบวกทั้งหมด — ไม่ซ้ำซ้อน, แยกกลุ่มด้วย section header
// note: '+โอกาส' = Enriched เพิ่มอัตราสำเร็จ
export const STONE_REFERENCE = [
  { section: 'Weapon Lv.1 ~ 4' },
  { ore: 'Phracon',              for: 'Weapon Lv.1',   range: '+1~+10',  fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/phracon.png' },
  { ore: 'Emveretarcon',         for: 'Weapon Lv.2',   range: '+1~+10',  fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/emveretarcon.png' },
  { ore: 'Oridecon',             for: 'Weapon Lv.3~4', range: '+1~+10',  fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/oridecon.png' },
  { ore: 'Enriched Oridecon',    for: 'Weapon Lv.1~4', range: '+1~+10',  fail: 'ไอเทมหาย',  note: '+โอกาส', img: '/images/ores/enriched-oridecon.png' },
  { ore: 'HD Oridecon',          for: 'Weapon Lv.1~4', range: '+7~+10',  fail: 'ลดระดับ −1', note: '',        img: '/images/ores/hd-oridecon.png' },
  { ore: 'Bradium',              for: 'Weapon Lv.1~4', range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/bradium.png' },
  { ore: 'HD Bradium',           for: 'Weapon Lv.1~4', range: '+11~+20', fail: 'ลดระดับ −1', note: '',        img: '/images/ores/hd-bradium.png' },
  { section: 'Weapon Lv.5' },
  { ore: 'Etherdeocon',          for: 'Weapon Lv.5',   range: '+1~+10',  fail: 'ลดระดับ −3', note: '',        img: '/images/ores/etherdeocon.png' },
  { ore: 'Enriched Etherdeocon', for: 'Weapon Lv.5',   range: '+1~+10',  fail: 'ลดระดับ −1', note: '+โอกาส', img: '/images/ores/enriched-etherdeocon.png' },
  { ore: 'Etel Bradium',         for: 'Weapon Lv.5',   range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/etel-bradium.png' },
  { ore: 'HD Etel Bradium',      for: 'Weapon Lv.5',   range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/hd-etel-bradium.png' },
  { section: 'Armor Lv.1' },
  { ore: 'Elunium',              for: 'Armor Lv.1',    range: '+1~+10',  fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/elunium.png' },
  { ore: 'Enriched Elunium',     for: 'Armor Lv.1',    range: '+1~+10',  fail: 'ไอเทมหาย',  note: '+โอกาส', img: '/images/ores/enriched-elunium.png' },
  { ore: 'HD Elunium',           for: 'Armor Lv.1',    range: '+7~+10',  fail: 'ลดระดับ −1', note: '',        img: '/images/ores/hd-elunium.png' },
  { ore: 'Carnium',              for: 'Armor Lv.1',    range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/carnium.png' },
  { ore: 'HD Carnium',           for: 'Armor Lv.1',    range: '+11~+20', fail: 'ลดระดับ −1', note: '',        img: '/images/ores/hd-carnium.png' },
  { section: 'Armor Lv.2' },
  { ore: 'Ethernium',            for: 'Armor Lv.2',    range: '+1~+10',  fail: 'ลดระดับ −3', note: '',        img: '/images/ores/ethernium.png' },
  { ore: 'Enriched Ethernium',   for: 'Armor Lv.2',    range: '+1~+10',  fail: 'ลดระดับ −1', note: '+โอกาส', img: '/images/ores/enriched-ethernium.png' },
  { ore: 'Etel Carnium',         for: 'Armor Lv.2',    range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/etel-carnium.png' },
  { ore: 'HD Etel Carnium',      for: 'Armor Lv.2',    range: '+11~+20', fail: 'ไอเทมหาย',  note: '',        img: '/images/ores/hd-etel-carnium.png' },
];
