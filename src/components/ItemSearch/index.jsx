import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../contexts/LangContext';
import { recordItemSearchMiss } from '../../utils/usageStats';

const MAX_RESULTS = 30;
const MISS_MIN_LENGTH = 3;   // สั้นกว่านี้ถือว่ายังพิมพ์ไม่จบ
const MISS_DELAY_MS = 1500;  // รอให้หยุดพิมพ์ก่อนค่อยนับว่า "ไม่เจอ"
const MISS_SESSION_CAP = 20; // กันยิงถี่ใน 1 session
const iconSrc = id => `https://static.divine-pride.net/images/items/item/${id}.png`;

// ค้นไอเทมด้วยชื่อ แล้วแสดงเป็น dropdown รูป + ชื่อ
// รายชื่อ [id, name, armorLevel?] โหลด lazy ตอน focus ครั้งแรก (แยก chunk ไม่หนัก bundle หลัก)
// รวมกับรายการที่จัดการใน dashboard (/api/extra-items): add = เพิ่มเข้าช่องค้นหา, deny = ซ่อน (แม้อยู่ใน index ไฟล์)
// API ใช้ไม่ได้ = ค้นจาก index ไฟล์อย่างเดียว
async function loadItemList() {
  const staticList = (await import('../../constants/refinableItems.json')).default;
  try {
    const res = await fetch('/api/extra-items');
    if (!res.ok) return staticList;
    const { add, deny } = await res.json();
    if (!Array.isArray(add) || !Array.isArray(deny)) return staticList;
    const denied = new Set(deny);
    const merged = new Map();
    for (const item of staticList) if (!denied.has(item[0])) merged.set(item[0], item);
    for (const item of add) merged.set(item[0], item); // รายการจาก dashboard ทับของเดิม (เช่น แก้ชื่อ/เลเวลเกราะ)
    return [...merged.values()].sort((a, b) => a[0] - b[0]);
  } catch {
    return staticList;
  }
}
function searchItems(list, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const starts = [];
  const contains = [];
  for (const item of list) {
    const name = item[1];
    const text = name.toLowerCase();
    if (!tokens.every(tk => text.includes(tk))) continue;
    (text.startsWith(tokens[0]) ? starts : contains).push(item);
    if (starts.length >= MAX_RESULTS) break;
  }
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

export default function ItemSearch({ value, onChange, onSelect, placeholder }) {
  const { t } = useLang();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const reportedMisses = useRef(new Set());

  const results = list && value.trim() ? searchItems(list, value) : [];

  // ค้นแล้วไม่เจอ (หยุดพิมพ์แล้ว) → ส่งคำค้นไปเก็บสถิติ 1 ครั้งต่อคำต่อ session
  const missQuery = list && results.length === 0 ? value.trim().toLowerCase() : '';
  useEffect(() => {
    if (missQuery.length < MISS_MIN_LENGTH) return;
    const timer = setTimeout(() => {
      const reported = reportedMisses.current;
      if (reported.has(missQuery) || reported.size >= MISS_SESSION_CAP) return;
      reported.add(missQuery);
      recordItemSearchMiss(missQuery);
    }, MISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [missQuery]);

  const loadList = () => {
    if (list) return;
    loadItemList().then(setList);
  };

  // ปิด dropdown เมื่อคลิกนอกกล่อง
  useEffect(() => {
    const onDocDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pick = ([id, name, armorLevel]) => {
    onChange(name);
    setOpen(false);
    onSelect(String(id), armorLevel, name);
  };

  const handleKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && results[active]) pick(results[active]);
    }
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onFocus={() => { loadList(); setOpen(true); }}
        onChange={e => { onChange(e.target.value); setActive(0); setOpen(true); loadList(); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-sunken px-4 py-2.5 text-body outline-none transition-colors hover:border-amber-400/70 focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300/40"
      />
      {open && value.trim() && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-sunken shadow-xl shadow-black/40"
        >
          {!list ? (
            <li className="px-3 py-2.5 text-xs text-dim">{t('loading_text')}</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-dim">{t('item_search_no_result')}</li>
          ) : (
            results.map((item, i) => (
              <li
                key={item[0]}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => { e.preventDefault(); pick(item); }}
                className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 ${i === active ? 'bg-line-soft/70' : ''}`}
              >
                <img src={iconSrc(item[0])} alt="" loading="lazy" className="h-8 w-8 shrink-0 object-contain" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-body">{item[1]}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
