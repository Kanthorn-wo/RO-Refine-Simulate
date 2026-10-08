import { useState } from 'react'
import { UncertainBadge } from './ui'

// ข้อมูลดิบจาก divine-pride ของไอเทม (thROG + iRO) ครบทุก field — ไว้ตรวจก่อนตัดสินใจเพิ่ม/ซ่อน

const FIELD_VALUE_LIMIT = 2000

// description มีรหัสสี ^RRGGBB และขึ้นบรรทัดใหม่ → ตัดรหัสสี/คงบรรทัด, object/array → JSON (ยาวเกินตัด)
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

export function RawDetails({ raw }) {
  const sources = ['thROG', 'iRO'].filter((k) => raw && raw[k])
  const [source, setSource] = useState(sources[0] || 'thROG')
  if (!sources.length) return null
  const entries = Object.entries(raw[source] || raw[sources[0]])
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

// กล่องรายละเอียดท้ายแถว: state = { loading? , error? , data? } จาก action lookup
export function ItemDetail({ state }) {
  return (
    <div className="basis-full space-y-2">
      {state.loading && <p className="text-xs text-slate-500">กำลังดึงข้อมูลจาก Divine Pride (ทีละคำขอ อาจรอสักครู่)…</p>}
      {state.error && <p className="text-xs text-rose-400">{state.error}</p>}
      {state.data && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{state.data.type || '-'} / {state.data.subType || '-'}</span>
            <span>requiredLevel {state.data.requiredLevel ?? '-'}</span>
            {state.data.levelUncertain && <UncertainBadge />}
          </div>
          <RawDetails raw={state.data.raw} />
        </>
      )}
    </div>
  )
}
