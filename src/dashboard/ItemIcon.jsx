import { useState } from 'react'

// ไอคอนไอเทม: รูปจาก divine-pride ตาม item id, ไม่มี id/โหลดไม่ขึ้น → รูป default ตามประเภท (อาวุธ/เกราะ)
const defaultIcon = (t) => (typeof t === 'string' && t.startsWith('weapon') ? '/images/default_weapon.png' : '/images/default_armor.png')
const dpIcon = (id) => `https://static.divine-pride.net/images/items/item/${id}.png`

export default function ItemIcon({ id, type, size = 28 }) {
  const [err, setErr] = useState(false)
  const src = id && !err ? dpIcon(id) : defaultIcon(type)
  return (
    <img src={src} alt="" width={size} height={size} onError={() => setErr(true)}
      className="shrink-0 rounded bg-black/20 object-contain"
      style={{ width: size, height: size, imageRendering: 'pixelated' }} />
  )
}
