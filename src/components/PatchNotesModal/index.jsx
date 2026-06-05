import React, { useEffect, useState } from 'react';
import { CHANGELOG, LATEST_CHANGELOG_VERSION, CHANGE_TYPE_META } from '../../constants/changelog';

const STORAGE_KEY = 'ro_refine_patchnotes';
const SUPPRESS_DAYS = 7;
const SUPPRESS_MS = SUPPRESS_DAYS * 24 * 60 * 60 * 1000;

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y}`;
};

// มี record ใน localStorage ที่ยัง valid ไหม (ยังไม่หมดเวลา + เป็นเวอร์ชันล่าสุด)
// = ผู้ใช้ "รับทราบ" patch เวอร์ชันนี้ไปแล้ว
const hasValidSuppression = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Date.now() < data.until && data.version === LATEST_CHANGELOG_VERSION;
  } catch {
    return false;
  }
};

// Modal ประวัติการอัปเดต — แสดงทุกครั้งที่เปิดเว็บ เว้นแต่กดปิดไว้ภายใน 7 วัน
// (และจะแสดงซ้ำทันทีถ้ามีเวอร์ชันใหม่กว่าที่เคยปิด)
// openTrigger: ค่าจะเพิ่มขึ้นเมื่อต้องการสั่งเปิด modal เองจากภายนอก (ปุ่มในเมนูลอย)
const PatchNotesModal = ({ openTrigger = 0 }) => {
  const [open, setOpen] = useState(false);
  // true = รับทราบ patch เวอร์ชันนี้ไปแล้ว → ปุ่มเป็น "ปิดหน้าต่างนี้" และไม่เขียน localStorage ซ้ำ
  const [acknowledged, setAcknowledged] = useState(false);

  // auto-show ตอนเปิดเว็บ: แสดงเฉพาะเมื่อ "ยังไม่รับทราบ" (ไม่มี record / หมดเวลา / มีเวอร์ชันใหม่)
  useEffect(() => {
    if (!hasValidSuppression()) {
      setAcknowledged(false);
      setOpen(true);
    }
  }, []);

  // สั่งเปิดเองจากปุ่มเมนูลอย (ข้าม openTrigger เริ่มต้น = 0)
  // ถ้ารับทราบไปแล้ว → acknowledged = true → ปุ่ม "ปิดหน้าต่างนี้" และไม่บันทึกซ้ำ
  useEffect(() => {
    if (openTrigger > 0) {
      setAcknowledged(hasValidSuppression());
      setOpen(true);
    }
  }, [openTrigger]);

  const dismiss = () => {
    // บันทึก suppress 7 วัน เฉพาะตอนที่ยังไม่เคยรับทราบ patch เวอร์ชันนี้
    if (!acknowledged) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ until: Date.now() + SUPPRESS_MS, version: LATEST_CHANGELOG_VERSION })
        );
      } catch {
        /* localStorage ใช้ไม่ได้ (เช่น private mode) — ปิดเฉยๆ */
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#181a20] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-slate-700/60 bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-transparent px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-amber-300">มีอะไรใหม่บ้าง</h2>
            <p className="text-xs text-slate-400">
              ประวัติการอัปเดต · เวอร์ชันล่าสุด {LATEST_CHANGELOG_VERSION ? `v${LATEST_CHANGELOG_VERSION}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="ปิด"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — timeline ของแต่ละเวอร์ชัน */}
        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {CHANGELOG.map((release, ri) => (
            <div key={ri} className="relative pl-4">
              <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
              {ri < CHANGELOG.length - 1 && (
                <span className="absolute left-[3px] top-3.5 h-[calc(100%+0.75rem)] w-px bg-slate-700/60" />
              )}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">{formatDate(release.date)}</span>
                {release.version && (
                  <span className="rounded-md border border-slate-600/60 bg-slate-700/30 px-1.5 py-0.5 text-[0.65rem] font-bold text-slate-300">
                    v{release.version}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {release.items.map((it, ii) => {
                  const meta = CHANGE_TYPE_META[it.type] || CHANGE_TYPE_META.improve;
                  return (
                    <li key={ii} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                      <span className={`mt-0.5 h-fit shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span>{it.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700/60 px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-lg border border-amber-400/40 bg-amber-400/10 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-400 hover:text-slate-900"
          >
            {acknowledged ? 'ปิดหน้าต่างนี้' : 'รับทราบแล้ว — ไม่แสดงอีกใน 7 วัน'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatchNotesModal;
