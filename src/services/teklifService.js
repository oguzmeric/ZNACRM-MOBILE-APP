import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const ONAY_DURUMLARI = [
  { id: 'takipte', isim: 'Takipte', renk: '#3b82f6', ikon: '⏳' },
  { id: 'revizyon', isim: 'Revize', renk: '#f59e0b', ikon: '📝' },
  { id: 'kabul', isim: 'Kabul', renk: '#10b981', ikon: '✅' },
  { id: 'vazgecildi', isim: 'Red', renk: '#ef4444', ikon: '❌' },
]

export const onayDurumuBul = (id) => ONAY_DURUMLARI.find((d) => d.id === id)

export const teklifleriGetir = async () => {
  const data = await tumSayfalariCek('teklifler', (q) =>
    q.order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

export const benimTekliflerim = async (hazirlayanAd) => {
  const data = await tumSayfalariCek('teklifler', (q) =>
    q.eq('hazirlayan', hazirlayanAd).order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

export const teklifGetir = async (id) => {
  const { data } = await supabase.from('teklifler').select('*').eq('id', id).single()
  return toCamel(data)
}

export const sonrakiTeklifNo = async () => {
  const yil = new Date().getFullYear()
  const { count } = await supabase
    .from('teklifler')
    .select('*', { count: 'exact', head: true })
  const sira = String((count ?? 0) + 1).padStart(4, '0')
  return `TEK-${yil}-${sira}`
}

export const teklifEkle = async (teklif) => {
  const { id, olusturmaTarih, ...rest } = teklif
  const { data, error } = await supabase
    .from('teklifler')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('teklifEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const teklifGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('teklifler')
    .update(toSnake(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('teklifGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const teklifDurumGuncelle = (id, onayDurumu) =>
  teklifGuncelle(id, { onayDurumu })

export const teklifSil = async (id) => {
  await supabase.from('teklifler').delete().eq('id', id)
}

// === YARDIMCI: Satır toplamı hesapla ===
// satir: { miktar, birimFiyat, iskonto (%), kdv (%) }
// dönüş: { araToplam, iskontoTutari, kdvTutari, netTutar }
export const satirHesapla = (satir) => {
  const miktar = Number(satir?.miktar ?? 0)
  const birimFiyat = Number(satir?.birimFiyat ?? 0)
  const iskontoOran = Number(satir?.iskonto ?? 0) / 100
  const kdvOran = Number(satir?.kdv ?? 0) / 100

  const araToplam = miktar * birimFiyat
  const iskontoTutari = araToplam * iskontoOran
  const netIskontolu = araToplam - iskontoTutari
  const kdvTutari = netIskontolu * kdvOran
  const netTutar = netIskontolu + kdvTutari

  return { araToplam, iskontoTutari, netIskontolu, kdvTutari, netTutar }
}

// Teklifin tüm toplamları (genel iskonto dahil)
export const teklifToplamHesapla = (satirlar = [], genelIskonto = 0) => {
  let araToplam = 0
  let kdvToplam = 0
  let satirIskontoToplam = 0
  satirlar.forEach((s) => {
    const h = satirHesapla(s)
    araToplam += h.araToplam
    satirIskontoToplam += h.iskontoTutari
    kdvToplam += h.kdvTutari
  })
  const netIskontolu = araToplam - satirIskontoToplam
  const genelIskontoTutari = (netIskontolu * Number(genelIskonto || 0)) / 100
  const kdvHaric = netIskontolu - genelIskontoTutari
  // KDV, genel iskonto sonrası kdv oranlarından orantılı çıkarılır
  const kdvOrani = netIskontolu ? kdvToplam / netIskontolu : 0
  const nihaiKdv = kdvHaric * kdvOrani
  const genelToplam = kdvHaric + nihaiKdv
  return {
    araToplam,
    satirIskontoToplam,
    genelIskontoTutari,
    kdvHaric,
    kdvToplam: nihaiKdv,
    genelToplam,
  }
}
