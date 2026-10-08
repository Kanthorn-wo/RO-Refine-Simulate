// ค่าคงที่ของแท็บ "ไอเทม": ป้ายสถานะ/ที่มา + class ปุ่ม/ช่องกรอก (แยกจาก ui.jsx เพื่อให้ไฟล์ component export เฉพาะ component)

export const STATUS_META = {
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-emerald-500/15 text-emerald-400' },
  pending:  { label: 'รออนุมัติ',  cls: 'bg-amber-500/15 text-amber-400' },
  denied:   { label: 'ซ่อนอยู่',   cls: 'bg-rose-500/15 text-rose-400' },
}
export const SOURCE_LABEL = { manual: 'เพิ่มเอง', auto: 'ระบบหาเจอ', index: 'รายชื่อหลัก' }

const btnBase = 'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
export const btnOk = `${btnBase} border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`
export const btnWarn = `${btnBase} border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`
export const btnNeutral = `${btnBase} border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]`
export const inputCls = 'rounded-lg border border-white/10 bg-white/[0.03] text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/60'
export const selectCls = 'rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-200 [color-scheme:dark]'
