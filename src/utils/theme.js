// จัดการธีม dark/light — เก็บใน localStorage, สลับด้วย class `light` บน <html>
// ค่า default = dark (ไม่มี class) ให้ตรงกับ inline bootstrap ใน index.html
const STORAGE_KEY = 'ro_refine_theme';

export const getTheme = () =>
  document.documentElement.classList.contains('light') ? 'light' : 'dark';

export const applyTheme = (theme) => {
  document.documentElement.classList.toggle('light', theme === 'light');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage อาจถูกปิด (private mode) — ข้าม */
  }
};

export const toggleTheme = () => {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
};
