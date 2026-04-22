export const tarihFormat = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const gun = String(d.getDate()).padStart(2, '0')
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const yil = d.getFullYear()
  return `${gun}.${ay}.${yil}`
}

export const tarihSaatFormat = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const gun = String(d.getDate()).padStart(2, '0')
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const yil = d.getFullYear()
  const ss = String(d.getHours()).padStart(2, '0')
  const dd = String(d.getMinutes()).padStart(2, '0')
  return `${gun}.${ay}.${yil} ${ss}:${dd}`
}

export const renkDurum = (durum) => {
  switch (durum) {
    case 'tamamlandi': return '#22c55e'
    case 'devam_ediyor':
    case 'devamediyor':
    case 'baslamadi': return '#3b82f6'
    case 'bekliyor': return '#f59e0b'
    case 'iptal': return '#ef4444'
    default: return '#94a3b8'
  }
}

export const renkOncelik = (oncelik) => {
  switch (oncelik) {
    case 'yuksek': return '#ef4444'
    case 'normal': return '#3b82f6'
    case 'dusuk': return '#94a3b8'
    default: return '#94a3b8'
  }
}

export const etiketDurum = (d) => ({
  bekliyor: 'Bekliyor',
  devam_ediyor: 'Devam Ediyor',
  devamediyor: 'Devam Ediyor',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
}[d] ?? d ?? '—')

export const etiketOncelik = (o) => ({
  yuksek: 'Yüksek',
  normal: 'Normal',
  dusuk: 'Düşük',
}[o] ?? o ?? '—')
