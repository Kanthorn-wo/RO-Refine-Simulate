import { useEffect, useMemo, useState } from 'react'
import Toggle from '../components/Toggle'
import ItemIcon from './ItemIcon'

// แท็บ "ไอเทม": จัดการรายชื่อไอเทมเสริมของช่องค้นหาไอเทม (ตาราง extra_items ผ่าน /api/extra-items)
//   - ตั้งค่าโหมดอนุมัติ (item_auto_approve ผ่าน /api/settings): ผ่านอัตโนมัติ หรือรอกดอนุมัติเอง
//   - คิวรออนุมัติ (pending) จาก Action, เพิ่มเองด้วย Item ID (prefill ชื่อ/เลเวลเกราะ), รายการทั้งหมด

const STATUS_META = {
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-emerald-500/15 text-emerald-400' },
  pending:  { label: 'รออนุมัติ',  cls: 'bg-amber-500/15 text-amber-400' },
  denied:   { label: 'ซ่อนอยู่',   cls: 'bg-rose-500/15 text-rose-400' },
}
const SOURCE_LABEL = { manual: 'เพิ่มเอง', auto: 'ระบบหาเจอ' }
const STATUS_FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'approved', label: 'อนุมัติแล้ว' },
  { id: 'pending', label: 'รออนุมัติ' },
  { id: 'denied', label: 'ซ่อนอยู่' },
]
const LIST_PAGE = 50

function Skeleton({ h = 'h-40' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${h}`} />
}

function Panel({ id, title, hint, action, children }) {
  return (
    <div id={id} className="scroll-mt-20 rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-white/5 text-slate-400' }
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
}

const LevelBadge = ({ level }) => (
  <span className="shrink-0 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">เกราะ Lv{level}</span>
)

// ค่าของ field จาก divine-pride: description มีรหัสสี ^RRGGBB และขึ้นบรรทัดใหม่ → ตัดรหัสสี/คงบรรทัด, object/array → JSON
const FIELD_VALUE_LIMIT = 2000
function FieldValue({ name, value }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-600">—</span>
  if (typeof value === 'object') {
    const json = JSON.stringify(value, null, 1)
    const cut = json.length > FIELD_VALUE_LIMIT
    return (
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/30 p-2 text-[11px] text-slate-300">
        {cut ? `${json.slice(0, FIELD_VALUE_LIMIT)}\n… (ตัด ${json.length - FIELD_VALUE_LIMIT} ตัวอักษร)` : json}
      </pre>
    )
  }
  if (name === 'description' || name === 'unidDescription') {
    return <span className="whitespace-pre-wrap break-words">{String(value).replace(/\^[0-9A-Fa-f]{6}/g, '').replace(/\r/g, '')}</span>
  }
  return <span className="break-all">{String(value)}</span>
}

// ข้อมูลดิบทั้งหมดของไอเทมจาก divine-pride (เลือกดูตามเซิร์ฟ) — ไว้ตรวจก่อนตัดสินใจเพิ่ม/ซ่อน
function RawDetails({ raw }) {
  const sources = ['thROG', 'iRO'].filter((k) => raw && raw[k])
  const [source, setSource] = useState(sources[0] || 'thROG')
  if (!sources.length) return null
  const data = raw[source] || raw[sources[0]]
  const entries = Object.entries(data)
  return (
    <details className="rounded-lg border border-white/5 bg-black/20">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-300">
        ดูข้อมูลทั้งหมดจาก Divine Pride ({entries.length} field)
      </summary>
      <div className="border-t border-white/5 p-3">
        <div className="mb-2 flex gap-1">
          {sources.map((k) => (
            <button key={k} onClick={() => setSource(k)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${source === k ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
              {k === 'thROG' ? 'เซิร์ฟไทย (thROG)' : 'iRO'}
            </button>
          ))}
        </div>
        <dl className="max-h-96 divide-y divide-white/5 overflow-y-auto text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[9rem_1fr] gap-3 py-1.5">
              <dt className="break-all font-mono text-slate-500">{key}</dt>
              <dd className="min-w-0 text-slate-300"><FieldValue name={key} value={value} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}

const btnBase = 'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const btnOk = `${btnBase} border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`
const btnWarn = `${btnBase} border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20`
const btnNeutral = `${btnBase} border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]`

export default function ItemsView({ session, scrollTo }) {
  const [data, setData] = useState(null) // { items, autoApprove }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)       // id ที่กำลังบันทึก / 'mode' = กำลังสลับโหมด
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(LIST_PAGE)
  // ฟอร์มเพิ่มเอง
  const [addId, setAddId] = useState('')
  const [lookup, setLookup] = useState(null)       // ผล lookup ที่ผู้ใช้แก้ได้ { id, label, armorLevel, ... }
  const [looking, setLooking] = useState(false)

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

  // เรียก action ของ /api/extra-items (POST, owner) — คืน JSON หรือ throw ข้อความ error
  const callApi = async (payload) => {
    const res = await fetch('/api/extra-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `ไม่สำเร็จ (${res.status})`)
    return body
  }

  const run = async (id, fn, successMsg) => {
    setBusyId(id); setError(''); setNotice('')
    try {
      await fn()
      await load()
      if (successMsg) setNotice(successMsg)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const toggleAutoApprove = (next) => run('mode', async () => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ key: 'item_auto_approve', value: next }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `บันทึกโหมดไม่สำเร็จ (${res.status})`)
    }
  }, next ? 'เปิดโหมดผ่านอัตโนมัติแล้ว' : 'เปลี่ยนเป็นโหมดรออนุมัติเองแล้ว')

  const setStatus = (item, status) =>
    run(item.id, () => callApi({ action: 'setStatus', id: String(item.id), status }),
      status === 'approved' ? `อนุมัติ “${item.label}” แล้ว` : `ซ่อน “${item.label}” แล้ว`)

  const removeItem = (item) => {
    setConfirmDeleteId(null)
    return run(item.id, () => callApi({ action: 'delete', id: String(item.id) }), `ลบ “${item.label}” ออกจากรายการแล้ว`)
  }

  const doLookup = async () => {
    const id = addId.trim()
    setNotice(''); setError(''); setLookup(null)
    if (!/^\d{1,8}$/.test(id)) { setError('Item ID ต้องเป็นตัวเลข 1–8 หลัก'); return }
    setLooking(true)
    try {
      setLookup(await callApi({ action: 'lookup', id }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLooking(false)
    }
  }

  const saveLookup = (status) => run('add', async () => {
    await callApi({ action: 'add', id: String(lookup.id), label: lookup.label, armorLevel: lookup.armorLevel, status })
    setLookup(null); setAddId('')
  }, status === 'approved' ? 'เพิ่มเข้าช่องค้นหาแล้ว' : 'ซ่อนไอเทมนี้จากช่องค้นหาแล้ว')

  const items = useMemo(() => data?.items || [], [data])
  const pending = useMemo(() => items.filter((x) => x.status === 'pending'), [items])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((x) => (statusFilter === 'all' || x.status === statusFilter)
      && (!q || x.label.toLowerCase().includes(q) || String(x.id).includes(q)))
  }, [items, statusFilter, query])
  const counts = useMemo(() => items.reduce((acc, x) => ({ ...acc, [x.status]: (acc[x.status] || 0) + 1 }), {}), [items])

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
                ? 'ไอเทมที่หาเจอขึ้นในช่องค้นหาทันที (ลบ/ซ่อนทีหลังได้ในรายการด้านล่าง)'
                : 'ไอเทมที่หาเจอจะเข้าคิว “รออนุมัติ” ด้านล่าง จนกว่าจะกดอนุมัติ'}
            </p>
          </div>
          <Toggle checked={autoApprove} onChange={toggleAutoApprove} disabled={busyId === 'mode'} activeColor="bg-emerald-500" ariaLabel="ผ่านอัตโนมัติ" />
        </div>
      </Panel>

      {/* ── คิวรออนุมัติ ── */}
      <Panel id="items-pending" title={`รออนุมัติ (${pending.length})`} hint="ไอเทมที่ระบบหาเจอ รอให้คุณตัดสินใจ">
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">ไม่มีรายการรออนุมัติ</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <ItemIcon id={item.id} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-200">{item.label}</span>
                    {item.armor_level === 2 && <LevelBadge level={2} />}
                  </div>
                  <p className="text-[11px] text-slate-500">#{item.id} · {SOURCE_LABEL[item.source] || item.source}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className={btnOk} disabled={busyId === item.id} onClick={() => setStatus(item, 'approved')}>อนุมัติ</button>
                  <button className={btnWarn} disabled={busyId === item.id} onClick={() => setStatus(item, 'denied')}>ปฏิเสธ</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── เพิ่มเอง ── */}
      <Panel id="items-add" title="เพิ่ม/ซ่อนไอเทมเอง" hint="กรอก Item ID แล้วระบบดึงชื่อและเลเวลเกราะมาให้ตรวจก่อนบันทึก (“ซ่อน” ใช้กับไอเทมที่อยู่ในรายชื่อหลักอยู่แล้ว)">
        <div className="flex flex-wrap gap-2">
          <input
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doLookup() }}
            inputMode="numeric"
            placeholder="Item ID เช่น 460166"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/60"
          />
          <button className={btnNeutral} onClick={doLookup} disabled={looking || !addId.trim()}>{looking ? 'กำลังค้น…' : 'ค้นข้อมูล'}</button>
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
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-400/60"
                />
                <p className="mt-1 text-[11px] text-slate-500">#{lookup.id} · {lookup.type || 'ไม่ทราบประเภท'}{lookup.subType ? ` / ${lookup.subType}` : ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 ${lookup.refinableGuess ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {lookup.refinableGuess ? 'คำอธิบายพูดถึง refine (น่าจะตีบวกได้)' : 'ไม่พบสัญญาณว่าตีบวกได้ — ตรวจเองก่อน'}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${lookup.availableOnThai ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                {lookup.availableOnThai ? 'มีบนเซิร์ฟไทย' : 'API ไม่ยืนยันว่ามีบนเซิร์ฟไทย'}
              </span>
              {lookup.existingStatus && <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">มีในรายการแล้ว: {STATUS_META[lookup.existingStatus]?.label}</span>}
            </div>
            <RawDetails key={lookup.id} raw={lookup.raw} />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              เลเวลเกราะ
              <select
                value={lookup.armorLevel}
                onChange={(e) => setLookup({ ...lookup, armorLevel: Number(e.target.value) })}
                className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-200 [color-scheme:dark]"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
              <span className="text-slate-600">(จากบรรทัด Armor Level ในคำอธิบาย; ไม่มี = 1)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className={btnOk} disabled={busyId === 'add' || !lookup.label.trim()} onClick={() => saveLookup('approved')}>เพิ่มเข้าช่องค้นหา</button>
              <button className={btnWarn} disabled={busyId === 'add' || !lookup.label.trim()} onClick={() => saveLookup('denied')}>ซ่อนจากช่องค้นหา</button>
              <button className={btnNeutral} onClick={() => setLookup(null)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </Panel>

      {/* ── รายการทั้งหมด ── */}
      <Panel id="items-all" title={`รายการทั้งหมด (${items.length})`} hint="ไอเทมเสริมที่จัดการจาก dashboard — “ซ่อนอยู่” = ไม่แสดงในช่องค้นหาแม้อยู่ในรายชื่อหลัก">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f.id} onClick={() => { setStatusFilter(f.id); setShown(LIST_PAGE) }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === f.id ? 'bg-indigo-500/25 text-indigo-200' : 'text-slate-400 hover:text-slate-200'}`}>
                {f.label}{f.id !== 'all' && counts[f.id] ? ` ${counts[f.id]}` : ''}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(LIST_PAGE) }}
            placeholder="ค้นชื่อหรือ ID"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/60 sm:max-w-xs"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">ไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.slice(0, shown).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <ItemIcon id={item.id} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm text-slate-200">{item.label}</span>
                    {item.armor_level === 2 && <LevelBadge level={2} />}
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="text-[11px] text-slate-500">#{item.id} · {SOURCE_LABEL[item.source] || item.source}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.status !== 'approved' && <button className={btnOk} disabled={busyId === item.id} onClick={() => setStatus(item, 'approved')}>อนุมัติ</button>}
                  {item.status !== 'denied' && <button className={btnWarn} disabled={busyId === item.id} onClick={() => setStatus(item, 'denied')}>ซ่อน</button>}
                  {confirmDeleteId === item.id ? (
                    <>
                      <button className={btnWarn} disabled={busyId === item.id} onClick={() => removeItem(item)}>ยืนยันลบ</button>
                      <button className={btnNeutral} onClick={() => setConfirmDeleteId(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <button className={btnNeutral} disabled={busyId === item.id} onClick={() => setConfirmDeleteId(item.id)}>ลบ</button>
                  )}
                </div>
              </li>
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
