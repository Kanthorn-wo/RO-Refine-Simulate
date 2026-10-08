import { useEffect, useMemo, useState } from 'react'
import Toggle from '../components/Toggle'
import AddItemPanel from './items/AddItemPanel'
import { ItemDetail } from './items/RawDetails'
import { DEFAULT_FILTERS, SOURCE_FILTERS, STATUS_FILTERS, TYPE_FILTERS, buildRows, countFacets, filterRows } from './items/itemRows'
import { btnNeutral, btnOk, btnWarn, inputCls } from './items/consts'
import { EmptyNote, FilterTabs, ItemRow, Panel, Skeleton } from './items/ui'

// แท็บ "ไอเทม": จัดการรายชื่อไอเทมของช่องค้นหาไอเทม (ตาราง extra_items ผ่าน /api/extra-items + รายชื่อหลัก refinableItems.json)
//   - โหมดอนุมัติ (item_auto_approve ผ่าน /api/settings): ผ่านอัตโนมัติ หรือรอกดอนุมัติเอง
//   - คิวรออนุมัติ (pending) จาก Action, เพิ่มเองด้วย Item ID (AddItemPanel), รายการทั้งหมด (กรอง/ค้น/ดูรายละเอียด/ซ่อน)
// ชิ้นส่วนอยู่ใน ./items/ (ui = ป้าย/ปุ่ม/แถว, itemRows = รวมแถว+ตัวกรอง, RawDetails = ข้อมูลดิบ, AddItemPanel = ฟอร์มเพิ่ม)

const LIST_PAGE = 50
const jsonPost = (url, headers, payload) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) })

export default function ItemsView({ session, scrollTo }) {
  const [data, setData] = useState(null) // { items, autoApprove }
  const [indexItems, setIndexItems] = useState([]) // รายชื่อหลัก [[id, label, armorLevel?]]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null) // id ที่กำลังบันทึก / 'mode' = กำลังสลับโหมด / 'add' = กำลังเพิ่ม
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [detail, setDetail] = useState(null) // { id, loading?, data?, error? } — ดูรายละเอียดทีละชิ้น (ยิง API ทีละคำขอตามกติกา rate limit)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [shown, setShown] = useState(LIST_PAGE)

  const token = session?.access_token
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    if (!scrollTo?.id) return
    document.getElementById(scrollTo.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])

  const load = async () => {
    setError('')
    try {
      const res = await fetch('/api/extra-items?all=1', { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `โหลดข้อมูลไม่สำเร็จ (${res.status})`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [authHeaders]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { import('../constants/refinableItems.json').then((m) => setIndexItems(m.default)) }, [])

  // เรียก action ของ /api/extra-items (POST, owner) — คืน JSON หรือ throw ข้อความ error
  const callApi = async (payload) => {
    const res = await jsonPost('/api/extra-items', authHeaders, payload)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `ไม่สำเร็จ (${res.status})`)
    return body
  }

  // รันการเขียน → โหลดรายการใหม่ → แจ้งผล; คืน true เมื่อสำเร็จ
  const run = async (id, fn, successMsg) => {
    setBusyId(id); setError(''); setNotice('')
    try {
      await fn()
      await load()
      if (successMsg) setNotice(successMsg)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusyId(null)
    }
  }
  const save = (payload, successMsg) => run(payload.id, () => callApi(payload), successMsg)

  const toggleAutoApprove = (next) => run('mode', async () => {
    const res = await jsonPost('/api/settings', authHeaders, { key: 'item_auto_approve', value: next })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `บันทึกโหมดไม่สำเร็จ (${res.status})`)
    }
  }, next ? 'เปิดโหมดผ่านอัตโนมัติแล้ว' : 'เปลี่ยนเป็นโหมดรออนุมัติเองแล้ว')

  const setStatus = (item, status) =>
    save({ action: 'setStatus', id: String(item.id), status }, status === 'approved' ? `อนุมัติ “${item.label}” แล้ว` : `ซ่อน “${item.label}” แล้ว`)

  // ไอเทมจากรายชื่อหลักอยู่ในไฟล์ ลบไม่ได้ → "ซ่อน" = บันทึกแถว denied ลงตาราง (ลบแถวนี้ภายหลัง = กลับมาแสดงตามเดิม)
  const hideIndexItem = (item) =>
    save({ action: 'add', id: String(item.id), label: item.label, armorLevel: item.armor_level, itemType: item.item_type, weaponLevel: item.weapon_level, status: 'denied' },
      `ซ่อน “${item.label}” แล้ว`)

  const removeItem = (item) => {
    setConfirmDeleteId(null)
    return save({ action: 'delete', id: String(item.id) }, `ลบ “${item.label}” ออกจากรายการแล้ว`)
  }

  // ดูข้อมูลดิบครบทุก field (action lookup เดิม) ทีละชิ้น
  const toggleDetail = async (item) => {
    if (detail?.id === item.id) { setDetail(null); return }
    setDetail({ id: item.id, loading: true })
    try {
      setDetail({ id: item.id, data: await callApi({ action: 'lookup', id: String(item.id) }) })
    } catch (err) {
      setDetail({ id: item.id, error: err.message })
    }
  }

  const setFilter = (key) => (value) => { setFilters((f) => ({ ...f, [key]: value })); setShown(LIST_PAGE) }

  const items = useMemo(() => data?.items || [], [data])
  const pending = useMemo(() => items.filter((x) => x.status === 'pending'), [items])
  const rows = useMemo(() => buildRows(items, indexItems), [items, indexItems])
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters])
  const counts = useMemo(() => countFacets(rows, filters), [rows, filters])
  const filtersActive = Object.keys(DEFAULT_FILTERS).some((k) => filters[k] !== DEFAULT_FILTERS[k])

  if (loading) return (
    <div className="space-y-6"><Skeleton h="h-24" /><Skeleton h="h-40" /><Skeleton h="h-56" /><Skeleton h="h-72" /></div>
  )
  if (!data) return (
    <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 p-5 text-sm text-rose-300">
      <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="mt-1 text-rose-400/80">{error}</p>
      <button onClick={() => { setLoading(true); load() }} className={`${btnNeutral} mt-3`}>ลองใหม่</button>
    </div>
  )

  const autoApprove = !!data.autoApprove
  const detailButton = (item) => (
    <button className={btnNeutral} disabled={detail?.loading && detail.id !== item.id} onClick={() => toggleDetail(item)}>
      {detail?.id === item.id ? 'ซ่อนรายละเอียด' : 'รายละเอียด'}
    </button>
  )
  const detailBox = (item) => detail?.id === item.id && <ItemDetail state={detail} />

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${error ? 'border-rose-900/50 bg-rose-950/40 text-rose-300' : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'}`}>
          {error || notice}
        </div>
      )}

      {/* ── โหมดอนุมัติ ── */}
      <Panel id="items-mode" title="โหมดอนุมัติไอเทมใหม่" hint="ไอเทมที่ระบบ (GitHub Action) หาเจอเอง จะถูกใส่เข้าช่องค้นหาตามโหมดนี้">
        <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${autoApprove ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-200">ผ่านอัตโนมัติ</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${autoApprove ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>
                {autoApprove ? 'อัตโนมัติ' : 'รออนุมัติเอง'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {autoApprove
                ? 'ไอเทมที่หาเจอขึ้นในช่องค้นหาทันที (ลบ/ซ่อนทีหลังได้ในรายการด้านล่าง) — ยกเว้นที่เลเวลไม่แน่ใจ จะเข้าคิวรออนุมัติเสมอ'
                : 'ไอเทมที่หาเจอจะเข้าคิว “รออนุมัติ” ด้านล่าง จนกว่าจะกดอนุมัติ'}
            </p>
          </div>
          <Toggle checked={autoApprove} onChange={toggleAutoApprove} disabled={busyId === 'mode'} activeColor="bg-emerald-500" ariaLabel="ผ่านอัตโนมัติ" />
        </div>
      </Panel>

      {/* ── คิวรออนุมัติ ── */}
      <Panel id="items-pending" title={`รออนุมัติ (${pending.length})`} hint="ไอเทมที่ระบบหาเจอ รอให้คุณตัดสินใจ">
        {pending.length === 0 ? <EmptyNote>ไม่มีรายการรออนุมัติ</EmptyNote> : (
          <ul className="space-y-2">
            {pending.map((item) => (
              <ItemRow key={item.id} item={item} variant="card" actions={<>
                {detailButton(item)}
                <button className={btnOk} disabled={busyId === item.id} onClick={() => setStatus(item, 'approved')}>อนุมัติ</button>
                <button className={btnWarn} disabled={busyId === item.id} onClick={() => setStatus(item, 'denied')}>ปฏิเสธ</button>
              </>}>
                {detailBox(item)}
              </ItemRow>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── เพิ่มเอง ── */}
      <AddItemPanel callApi={callApi} onSave={save} onError={setError} saving={busyId === 'add'} />

      {/* ── รายการทั้งหมด ── */}
      <Panel id="items-all" title={`รายการทั้งหมด (${rows.length})`} hint="รายชื่อหลัก (ไฟล์) + ไอเทมเสริมจาก dashboard — “ซ่อนอยู่” = ไม่แสดงในช่องค้นหา; รายชื่อหลักลบไม่ได้ ใช้ “ซ่อน” (ลบแถวที่ซ่อนไว้ = กลับมาแสดง)">
        <div className="mb-4 space-y-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filters.query}
              onChange={(e) => setFilter('query')(e.target.value)}
              placeholder="ค้นชื่อหรือ ID"
              className={`${inputCls} min-w-0 flex-1 px-3 py-1.5 text-xs sm:max-w-xs`}
            />
            {filtersActive && (
              <button className={btnNeutral} onClick={() => { setFilters(DEFAULT_FILTERS); setShown(LIST_PAGE) }}>ล้างตัวกรอง</button>
            )}
            <span className="ml-auto text-[11px] text-slate-500">แสดง {Math.min(shown, filtered.length).toLocaleString('th-TH')} จาก {filtered.length.toLocaleString('th-TH')} รายการ</span>
          </div>
          <FilterTabs label="สถานะ" options={STATUS_FILTERS} value={filters.status} onChange={setFilter('status')} counts={counts.status} />
          <FilterTabs label="ประเภท" options={TYPE_FILTERS} value={filters.type} onChange={setFilter('type')} counts={counts.type} />
          <FilterTabs label="ที่มา" options={SOURCE_FILTERS} value={filters.source} onChange={setFilter('source')} counts={counts.source} />
        </div>

        {filtered.length === 0 ? <EmptyNote>ไม่มีรายการ</EmptyNote> : (
          <ul className="divide-y divide-white/5">
            {filtered.slice(0, shown).map((item) => (
              <ItemRow key={item.id} item={item} showStatus actions={<>
                {detailButton(item)}
                {item.source === 'index' ? (
                  <button className={btnWarn} disabled={busyId === item.id} onClick={() => hideIndexItem(item)}>ซ่อน</button>
                ) : (<>
                  {item.status !== 'approved' && <button className={btnOk} disabled={busyId === item.id} onClick={() => setStatus(item, 'approved')}>อนุมัติ</button>}
                  {item.status !== 'denied' && <button className={btnWarn} disabled={busyId === item.id} onClick={() => setStatus(item, 'denied')}>ซ่อน</button>}
                  {confirmDeleteId === item.id ? (<>
                    <button className={btnWarn} disabled={busyId === item.id} onClick={() => removeItem(item)}>ยืนยันลบ</button>
                    <button className={btnNeutral} onClick={() => setConfirmDeleteId(null)}>ยกเลิก</button>
                  </>) : (
                    <button className={btnNeutral} disabled={busyId === item.id} onClick={() => setConfirmDeleteId(item.id)}>ลบ</button>
                  )}
                </>)}
              </>}>
                {detailBox(item)}
              </ItemRow>
            ))}
          </ul>
        )}
        {filtered.length > shown && (
          <button className={`${btnNeutral} mt-3`} onClick={() => setShown((n) => n + LIST_PAGE)}>แสดงเพิ่ม ({filtered.length - shown} รายการ)</button>
        )}
      </Panel>
    </div>
  )
}
