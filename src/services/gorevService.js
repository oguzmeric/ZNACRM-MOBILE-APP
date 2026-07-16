import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const gorevleriGetir = async () => {
  const data = await tumSayfalariCek('gorevler', (q) =>
    q.order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

export const banaAtananGorevler = async (kullaniciId) => {
  // Birincil atanan VEYA ekip üyesi olan görevler
  const data = await tumSayfalariCek('gorevler', (q) =>
    q.or(`atanan_id.eq.${kullaniciId},ekip.cs.{${kullaniciId}}`)
     .order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

// Bana atanan, aktif (tamamlanmamış/iptal edilmemiş) görev sayısı
export const banaAtananAktifGorevSayisi = async (kullaniciId) => {
  // Birincil atanan VEYA ekip üyesi
  const { count } = await supabase
    .from('gorevler')
    .select('*', { count: 'exact', head: true })
    .or(`atanan_id.eq.${kullaniciId},ekip.cs.{${kullaniciId}}`)
    .not('durum', 'in', '(tamamlandi,iptal)')
  return count ?? 0
}

export const atadigimGorevler = async (kullaniciAd) => {
  const data = await tumSayfalariCek('gorevler', (q) =>
    q.eq('olusturan_ad', kullaniciAd).order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

export const gorevGetir = async (id) => {
  const { data } = await supabase.from('gorevler').select('*').eq('id', id).single()
  return toCamel(data)
}

export const gorevEkle = async (gorev) => {
  const { id, olusturmaTarih, yorumlar, ...rest } = gorev
  const { data, error } = await supabase
    .from('gorevler')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('gorevEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const gorevGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('gorevler')
    .update(toSnake(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('gorevGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const gorevDurumGuncelle = (id, durum) =>
  gorevGuncelle(id, { durum, ...(durum === 'tamamlandi' ? { tamamlanmaTarihi: new Date().toISOString() } : {}) })

// Göreve not ekle — notlar jsonb array, her not: { metin, kullanici, tarih, fotoUrls? }
export const gorevNotEkle = async (id, metin, kullaniciAd, fotoUrls = []) => {
  const mevcut = await gorevGetir(id)
  if (!mevcut) return null
  const yeniNotlar = [
    ...(mevcut.notlar ?? []),
    {
      metin,
      kullanici: kullaniciAd ?? '',
      tarih: new Date().toISOString(),
      ...(fotoUrls.length > 0 ? { fotoUrls } : {}),
    },
  ]
  return gorevGuncelle(id, { notlar: yeniNotlar })
}

export const gorevSil = async (id) => {
  await supabase.from('gorevler').delete().eq('id', id)
}

// Web yorumları (gorev_yorumlari tablosu, mig 174). Web'de yazılan yorumlar
// bu tabloya gider; mobil de bunları OKUYUP notlarla birleşik gösterir ki
// web↔mobil yorumlar iki tarafta da görünsün. (Mobil yazma yine gorevler.notlar'a
// — fotoğraf + "tamamlamak için not şart" kuralı orada.)
export const gorevWebYorumlariGetir = async (gorevId) => {
  const { data, error } = await supabase
    .from('gorev_yorumlari')
    .select('*')
    .eq('gorev_id', gorevId)
    .order('olusturma_tarih', { ascending: true })
  if (error) { console.warn('gorevWebYorumlariGetir:', error.message); return [] }
  return arrayToCamel(data)
}

// Bir notu tamamen sil
export const gorevNotSil = async (id, notIndex) => {
  const mevcut = await gorevGetir(id)
  if (!mevcut) return null
  const notlar = (mevcut.notlar ?? []).filter((_, i) => i !== notIndex)
  return gorevGuncelle(id, { notlar })
}

// Bir notun metnini güncelle
export const gorevNotGuncelle = async (id, notIndex, yeniMetin) => {
  const mevcut = await gorevGetir(id)
  if (!mevcut) return null
  const notlar = [...(mevcut.notlar ?? [])]
  if (!notlar[notIndex]) return null
  notlar[notIndex] = {
    ...notlar[notIndex],
    metin: yeniMetin,
    duzenlendiTarih: new Date().toISOString(),
  }
  return gorevGuncelle(id, { notlar })
}

// Bir not'tan tek bir foto URL'sini çıkar (notIndex notlar array'indeki pozisyon)
export const gorevNotFotoCikar = async (id, notIndex, fotoUrl) => {
  const mevcut = await gorevGetir(id)
  if (!mevcut) return null
  const notlar = [...(mevcut.notlar ?? [])]
  if (!notlar[notIndex]) return null
  const guncelNot = {
    ...notlar[notIndex],
    fotoUrls: (notlar[notIndex].fotoUrls ?? []).filter((u) => u !== fotoUrl),
  }
  if (guncelNot.fotoUrls.length === 0) delete guncelNot.fotoUrls
  notlar[notIndex] = guncelNot
  return gorevGuncelle(id, { notlar })
}
