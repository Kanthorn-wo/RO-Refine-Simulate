// อนุมานระดับการตีบวกของอาวุธ/เกราะที่ divine-pride ไม่บอกระดับมาให้
// กฎ (ผู้ใช้กำหนด): ไอเทมที่ requiredLevel "เกิน 200" = ระดับสูงสุด — อาวุธ W5 / เกราะ Lv2
// ลำดับความสำคัญ: ค่าที่ระบุชัดก่อน (weaponLevel จาก API, บรรทัด "Armor Level : N" ใน description) → ไม่มีค่อยใช้กฎนี้ → ไม่เข้ากฎ = เลเวล 1
export const HIGH_TIER_REQUIRED_LEVEL = 200
export const isHighTierRequiredLevel = (requiredLevel) => Number(requiredLevel) > HIGH_TIER_REQUIRED_LEVEL
