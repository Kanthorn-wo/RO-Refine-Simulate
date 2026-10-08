import { useState } from 'react'

// ไอคอนไอเทม: รูปจาก divine-pride ตาม item id, ไม่มี id/โหลดไม่ขึ้น → รูป default ตามประเภท (อาวุธ/เกราะ)
// ระหว่างรูปยังโหลดไม่เสร็จแสดงช่อง loading (สี่เหลี่ยม pulse) ขนาดเท่ารูป
const defaultIcon = (t) => (typeof t === 'string' && t.startsWith('weapon') ? '/images/default_weapon.png' : '/images/default_armor.png')
const dpIcon = (id) => `https://static.divine-pride.net/images/items/item/${id}.png`

function Icon({ id, type, size }) {
  const [err, setErr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const src = id && !err ? dpIcon(id) : defaultIcon(type)
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded bg-black/20" style={{ width: size, height: size }}>
      {!loaded && <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-white/10" />}
      <img src={src} alt="" width={size} height={size}
        onLoad={() => setLoaded(true)} onError={() => { if (err) setLoaded(true); else setErr(true) }}
        className={`h-full w-full object-contain transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ imageRendering: 'pixelated' }} />
    </span>
  )
}

// key ตาม id/ประเภท: เปลี่ยนไอเทมแล้ว state โหลด/error รีเซ็ตใหม่
export default function ItemIcon({ id, type, size = 28 }) {
  return <Icon key={`${id || ''}:${type || ''}`} id={id} type={type} size={size} />
}
