import React from 'react';

const REPORT_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSegZdTgvGgHiekYN-JiMeVtwvSvCbfvzLagkJa8ZSzQZpWFzw/viewform';

// ปุ่มแจ้งปัญหา ลอยตามจอมุมขวาล่าง เปิด Google Form ในแท็บใหม่
const ReportButton = () => (
  <a
    href={REPORT_FORM_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="แจ้งปัญหา / Report"
    className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center gap-1.5 rounded-full border border-amber-400/40 bg-[#181a20]/90 text-sm font-semibold text-amber-300 shadow-lg shadow-black/40 backdrop-blur transition-colors hover:bg-amber-400 hover:text-slate-900 active:scale-95 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 sm:h-4 sm:w-4">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
    <span className="hidden sm:inline">แจ้งปัญหา</span>
  </a>
);

export default ReportButton;
