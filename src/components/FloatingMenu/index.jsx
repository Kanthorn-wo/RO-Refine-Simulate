import React, { useState } from 'react';

const REPORT_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSegZdTgvGgHiekYN-JiMeVtwvSvCbfvzLagkJa8ZSzQZpWFzw/viewform';

// ปุ่ม FAB ลอยมุมขวาล่าง คลี่ออกเป็นเมนู (speed dial) — เพิ่ม action ใหม่ได้ที่ array ด้านล่าง
const FloatingMenu = ({ onOpenPatchNotes }) => {
  const [open, setOpen] = useState(false);

  // แต่ละ action: ใส่ className สีแบบเต็ม (ไม่ทำ dynamic เพราะ Tailwind purge)
  const actions = [
    {
      key: 'patch',
      label: 'อัปเดตใหม่',
      btnClass: 'border-amber-400/40 bg-[#181a20]/95 text-amber-300 hover:bg-amber-400 hover:text-slate-900',
      onClick: () => {
        onOpenPatchNotes();
        setOpen(false);
      },
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="m3 11 18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      ),
    },
    {
      key: 'report',
      label: 'แจ้งปัญหา',
      btnClass: 'border-sky-400/40 bg-[#181a20]/95 text-sky-300 hover:bg-sky-400 hover:text-slate-900',
      href: REPORT_FORM_URL,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* backdrop ปิดเมนูเมื่อคลิกที่อื่น */}
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
        {/* action items — คลี่ขึ้นด้านบน */}
        {actions.map((a, i) => {
          const Tag = a.href ? 'a' : 'button';
          return (
            <div
              key={a.key}
              className={`flex items-center gap-2 transition-all duration-200 ${
                open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-90 opacity-0'
              }`}
              style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
            >
              <span className="rounded-lg border border-slate-700/60 bg-[#181a20]/95 px-2.5 py-1 text-xs font-medium text-slate-200 shadow-lg shadow-black/40 backdrop-blur">
                {a.label}
              </span>
              <Tag
                {...(a.href
                  ? { href: a.href, target: '_blank', rel: 'noopener noreferrer' }
                  : { type: 'button', onClick: a.onClick })}
                aria-label={a.label}
                className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg shadow-black/40 backdrop-blur transition-colors active:scale-95 ${a.btnClass}`}
              >
                {a.icon}
              </Tag>
            </div>
          );
        })}

        {/* ปุ่มหลัก — กดเพื่อคลี่/พับ */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
          aria-expanded={open}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400 text-slate-900 shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-6 w-6 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default FloatingMenu;
