// Görev modülü sözlükleri — web src/lib/gorevSabitleri.js'in MOBİL eşi (mig 195-196).
// DB'de SAKLANAN durumlar + HESAPLANAN durumlar (suresi_gecti) ayrımı bilinçli:
// gecikme her an son_tarih'ten türetilir, kolonda tutulursa bayatlar.
// Renkler HEX — mobil temada CSS değişkeni yok, koyu/açık iki temada da okunur tonlar.

// ─── Durumlar ───────────────────────────────────────────────────────────────
export const GOREV_DURUMLARI = [
  { id: 'taslak',           isim: 'Taslak',           renk: '#94a3b8', grup: 'pasif' },
  { id: 'bekliyor',         isim: 'Atandı',           renk: '#3b82f6', grup: 'acik' },
  { id: 'devam',            isim: 'Devam Ediyor',     renk: '#f59e0b', grup: 'acik' },
  { id: 'beklemede',        isim: 'Beklemede',        renk: '#f97316', grup: 'acik' },
  { id: 'bilgi_bekleniyor', isim: 'Bilgi Bekleniyor', renk: '#a855f7', grup: 'acik' },
  { id: 'onay_bekliyor',    isim: 'Onay Bekliyor',    renk: '#06b6d4', grup: 'acik' },
  { id: 'revize',           isim: 'Revize İstendi',   renk: '#ec4899', grup: 'acik' },
  { id: 'tamamlandi',       isim: 'Tamamlandı',       renk: '#22c55e', grup: 'kapali' },
  { id: 'reddedildi',       isim: 'Reddedildi',       renk: '#ef4444', grup: 'kapali' },
  { id: 'iptal',            isim: 'İptal Edildi',     renk: '#94a3b8', grup: 'kapali' },
]

export const DURUM_MAP = Object.fromEntries(GOREV_DURUMLARI.map(d => [d.id, d]))

// Eski mobil veri değerleri → yeni kanonik id (görüntüleme için)
const LEGACY_DURUM = {
  devam_ediyor: 'devam',
  devamediyor: 'devam',
  baslamadi: 'bekliyor',
}

export const durumBilgi = (id) => {
  const kanonik = LEGACY_DURUM[id] || id
  return DURUM_MAP[kanonik] || { id, isim: id || '—', renk: '#94a3b8', grup: 'acik' }
}

export const ACIK_DURUMLAR = GOREV_DURUMLARI.filter(d => d.grup === 'acik').map(d => d.id)
export const KAPALI_DURUMLAR = GOREV_DURUMLARI.filter(d => d.grup === 'kapali').map(d => d.id)

// Durum değişikliğinde sebep zorunlu olanlar
export const SEBEP_ZORUNLU_DURUMLAR = ['beklemede', 'bilgi_bekleniyor', 'iptal']

// ─── Hesaplanan durumlar ────────────────────────────────────────────────────
export const bugunStr = () => new Date().toISOString().slice(0, 10)

// son_tarih kanonik; eski kayıtlar için bitis_tarih(i) fallback
const sonTarihStr = (g) => {
  const t = g?.sonTarih || g?.bitisTarih || g?.bitisTarihi
  return t ? String(t).slice(0, 10) : ''
}

export const gorevGecikti = (g) => {
  const t = sonTarihStr(g)
  return !!t && !KAPALI_DURUMLAR.includes(g?.durum) && t < bugunStr()
}

export const gecikmeGunu = (g) => {
  if (!gorevGecikti(g)) return 0
  const fark = Date.now() - new Date(sonTarihStr(g) + 'T23:59:59').getTime()
  return Math.max(1, Math.ceil(fark / 86400000))
}

// Etkin (görünen) durum: gecikme saklanan durumu ezer
export const etkinDurum = (g) => {
  if (gorevGecikti(g)) {
    return { id: 'suresi_gecti', isim: `${gecikmeGunu(g)} gün gecikti`, renk: '#ef4444', grup: 'acik' }
  }
  return durumBilgi(g?.durum)
}

// ─── Kabul akışı ────────────────────────────────────────────────────────────
export const KABUL_DURUMLARI = [
  { id: 'atandi',       isim: 'Atandı',       renk: '#3b82f6' },
  { id: 'goruldu',      isim: 'Görüldü',      renk: '#06b6d4' },
  { id: 'kabul_edildi', isim: 'Kabul Edildi', renk: '#22c55e' },
  { id: 'reddedildi',   isim: 'Reddedildi',   renk: '#ef4444' },
]
export const KABUL_MAP = Object.fromEntries(KABUL_DURUMLARI.map(d => [d.id, d]))

export const RET_SEBEPLERI = [
  'Görev uzmanlık alanım dışında',
  'Görev tarihi uygun değil',
  'Eksik bilgi bulunuyor',
  'Yanlış kişiye atandı',
  'Başka görev nedeniyle müsait değilim',
  'Yetkim dışında',
  'Diğer',
]

// ─── Onay akışı ─────────────────────────────────────────────────────────────
export const ONAY_DURUM_ISIM = {
  bekliyor: 'Bekliyor',
  onaylandi: 'Onaylandı',
  revize: 'Revize İstendi',
  reddedildi: 'Reddedildi',
}

// ─── Öncelik (5 seviye; mevcut normal/orta/yuksek verisi korunur) ───────────
export const GOREV_ONCELIKLERI = [
  { id: 'dusuk',  isim: 'Düşük',  renk: '#94a3b8', sira: 1, agirlik: 1 },
  { id: 'normal', isim: 'Normal', renk: '#3b82f6', sira: 2, agirlik: 2 },
  { id: 'orta',   isim: 'Orta',   renk: '#3b82f6', sira: 2, agirlik: 2 }, // legacy eşdeğer
  { id: 'yuksek', isim: 'Yüksek', renk: '#f59e0b', sira: 3, agirlik: 3 },
  { id: 'acil',   isim: 'Acil',   renk: '#f97316', sira: 4, agirlik: 5 },
  { id: 'kritik', isim: 'Kritik', renk: '#ef4444', sira: 5, agirlik: 8 },
]
export const ONCELIK_MAP = Object.fromEntries(GOREV_ONCELIKLERI.map(o => [o.id, o]))
export const oncelikBilgi = (id) => ONCELIK_MAP[id] || ONCELIK_MAP.normal
// Formlarda gösterilecek liste (legacy 'orta' gizli — 'normal' ile aynı)
export const ONCELIK_SECENEKLERI = GOREV_ONCELIKLERI.filter(o => o.id !== 'orta')

// ─── İlerleme ───────────────────────────────────────────────────────────────
export const ILERLEME_ADIMLARI = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
