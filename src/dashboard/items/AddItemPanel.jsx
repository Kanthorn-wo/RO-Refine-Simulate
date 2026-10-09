import { useState } from 'react'
import ItemIcon from '../ItemIcon'
import { RawDetails } from './RawDetails'
import { STATUS_META, btnNeutral, btnOk, btnWarn, inputCls, selectCls } from './consts'
import { Panel, Spinner, UncertainBadge } from './ui'

// เพิ่ม/ซ่อนไอเทมด้วย Item ID: ค้นข้อมูลจาก divine-pride (action lookup) → ตรวจ/แก้ชื่อ+เลเวล → บันทึก
// lookupItem(id) → ผล lookup (null = parent เมินเพราะมีคำขอค้างอยู่, throw = error); lookupBusy = มีคำขอ lookup ค้างอยู่ (จากปุ่มไหนก็ตาม)
// onSave(payload, successMsg) บันทึกผ่าน parent (โหลดรายการใหม่ + แจ้งผล); onError(msg)
// readOnly = มีสิทธิ์ดู section นี้แต่ไม่มีสิทธิ์แก้ไข → ซ่อนช่องกรอก/ปุ่มบันทึก (API บังคับซ้ำอีกชั้น)
export default function AddItemPanel({ lookupItem, lookupBusy, onSave, onError, saving, readOnly }) {
  const [addId, setAddId] = useState('')
  const [lookup, setLookup] = useState(null) // ผล lookup ที่แก้ได้ { id, label, armorLevel, weaponLevel, type, ... }
  const [looking, setLooking] = useState(false)

  const doLookup = async () => {
    if (lookupBusy) return // กัน Enter/กดซ้ำระหว่างมีคำขอค้างอยู่
    const id = addId.trim()
    setLookup(null)
    if (!/^\d{1,8}$/.test(id)) { onError('Item ID ต้องเป็นตัวเลข 1–8 หลัก'); return }
    setLooking(true)
    try {
      setLookup(await lookupItem(id))
    } catch (err) {
      onError(err.message)
    } finally {
      setLooking(false)
    }
  }

  const save = async (status) => {
    const ok = await onSave(
      { action: 'add', id: String(lookup.id), label: lookup.label, armorLevel: lookup.armorLevel, itemType: lookup.type, weaponLevel: lookup.type === 'Weapon' ? (lookup.weaponLevel || 1) : null, status },
      status === 'approved' ? 'เพิ่มเข้าช่องค้นหาแล้ว' : 'ซ่อนไอเทมนี้จากช่องค้นหาแล้ว',
    )
    if (ok) { setLookup(null); setAddId('') }
  }

  const isWeapon = lookup?.type === 'Weapon'
  const levelField = isWeapon ? 'weaponLevel' : 'armorLevel'
  const levelOptions = isWeapon ? [1, 2, 3, 4, 5] : [1, 2]

  return (
    <Panel id="items-add" title="เพิ่ม/ซ่อนไอเทมเอง" hint="กรอก Item ID แล้วระบบดึงชื่อ ประเภท และเลเวลมาให้ตรวจก่อนบันทึก (“ซ่อน” ใช้กับไอเทมที่อยู่ในรายชื่อหลักอยู่แล้ว)">
      {readOnly && <p className="mb-3 text-[11px] text-slate-500">คุณมีสิทธิ์ดูส่วนนี้อย่างเดียว (ไม่มีสิทธิ์แก้ไข)</p>}
      <div className="flex flex-wrap gap-2">
        <input
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doLookup() }}
          inputMode="numeric"
          placeholder="Item ID เช่น 460166"
          disabled={readOnly}
          className={`${inputCls} min-w-0 flex-1 px-3 py-2 text-sm disabled:opacity-40`}
        />
        <button className={`${btnNeutral} inline-flex min-w-[5.5rem] items-center justify-center`} onClick={doLookup} disabled={readOnly || lookupBusy || !addId.trim()}
          aria-busy={looking} aria-label={looking ? 'กำลังค้น' : undefined}>{looking ? <Spinner /> : 'ค้นข้อมูล'}</button>
      </div>

      {lookup && (
        <div className="mt-4 space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <ItemIcon id={lookup.id} size={40} />
            <div className="min-w-0 flex-1">
              <input
                value={lookup.label}
                onChange={(e) => setLookup({ ...lookup, label: e.target.value })}
                maxLength={120}
                aria-label="ชื่อที่แสดงในช่องค้นหา"
                className={`${inputCls} w-full px-3 py-1.5 text-sm`}
              />
              <p className="mt-1 text-[11px] text-slate-500">#{lookup.id} · {lookup.type || 'ไม่ทราบประเภท'}{lookup.subType ? ` / ${lookup.subType}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 ${lookup.refinable ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {lookup.refinable ? 'คำอธิบายพูดถึง refine (น่าจะตีบวกได้)' : 'ไม่พบสัญญาณว่าตีบวกได้ — ตรวจเองก่อน'}
            </span>
            {lookup.levelUncertain && <UncertainBadge />}
            <span className={`rounded-full px-2 py-0.5 ${lookup.availableOnThai ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
              {lookup.availableOnThai ? 'มีบนเซิร์ฟไทย' : 'API ไม่ยืนยันว่ามีบนเซิร์ฟไทย'}
            </span>
            {lookup.existingStatus && <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">มีในรายการแล้ว: {STATUS_META[lookup.existingStatus]?.label}</span>}
          </div>
          <RawDetails key={lookup.id} raw={lookup.raw} />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            {isWeapon ? 'เลเวลอาวุธ' : 'เลเวลเกราะ'}
            <select
              value={lookup[levelField] || 1}
              onChange={(e) => setLookup({ ...lookup, [levelField]: Number(e.target.value) })}
              className={selectCls}
            >
              {levelOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-slate-600">{isWeapon ? '(จาก weaponLevel ของ API)' : '(จากบรรทัด Armor Level ในคำอธิบาย / requiredLevel เกิน 200 = 2; ไม่มี = 1)'}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={btnOk} disabled={readOnly || saving || !lookup.label.trim()} onClick={() => save('approved')}>เพิ่มเข้าช่องค้นหา</button>
            <button className={btnWarn} disabled={readOnly || saving || !lookup.label.trim()} onClick={() => save('denied')}>ซ่อนจากช่องค้นหา</button>
            <button className={btnNeutral} onClick={() => setLookup(null)}>ยกเลิก</button>
          </div>
        </div>
      )}
    </Panel>
  )
}
