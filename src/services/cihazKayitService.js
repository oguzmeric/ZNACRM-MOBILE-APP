// Mobile — cihaz kurulum tarihçesi (snapshot) service.
// stok_kalemleri "canlı" durumu tutar; cihaz_kayitlari kurulum başına snapshot.
// cihazTak → snapshot INSERT (aktif)
// modal.save → snapshot UPDATE (IP/MAC/şifre vs. teknik bilgi doldurulunca)
// cihazSok → aktif snapshot 'sokuldu' işaretle

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

const KOLONLAR = `
  id, stok_kalemi_id, servis_talep_id, musteri_id,
  ip_adresi, mac_adresi, kullanici_adi, sifre, port,
  nvr_bilgisi, kanal_no, alt_lokasyon,
  lokasyon_notu, model_notu, kurulum_notu,
  kuran_kullanici_id, kurulum_tarihi,
  durum, sokum_tarihi, sokum_servis_talep_id, sokum_kullanici_id, sokum_notu,
  olusturma_tarihi, guncelleme_tarihi
`

// Yeni kurulum snapshot'ı — cihazTak sonrası çağrılır.
// payload: { stokKalemiId, musteriId, kuranKullaniciId, servisTalepId?, kurulumNotu? }
// Bilgiler boş olabilir; modal SAVE ile doldurulur.
export const cihazKayitBaslat = async (payload) => {
  const { data, error } = await supabase
    .from('cihaz_kayitlari')
    .insert(toSnake({ ...payload, durum: 'aktif' }))
    .select(KOLONLAR)
    .single()
  if (error) { console.warn('cihazKayitBaslat:', error.message); return null }
  return toCamel(data)
}

// Aktif snapshot'ı bul — modal update için
export const aktifKayitGetir = async (stokKalemiId) => {
  const { data, error } = await supabase
    .from('cihaz_kayitlari')
    .select(KOLONLAR)
    .eq('stok_kalemi_id', stokKalemiId)
    .eq('durum', 'aktif')
    .maybeSingle()
  if (error) { console.warn('aktifKayitGetir:', error.message); return null }
  return data ? toCamel(data) : null
}

// Snapshot upsert — modal SAVE zamanında çağrılır.
// Aktif kayıt varsa günceller, yoksa yeni oluşturur.
// payload: { stokKalemiId, musteriId, kuranKullaniciId, servisTalepId?, ...tech }
export const cihazKayitUpsert = async (payload) => {
  const mevcut = await aktifKayitGetir(payload.stokKalemiId)
  if (mevcut) {
    // Sadece teknik alanları güncelle — meta alanlar sabit kalır
    const teknik = {
      ipAdresi: payload.ipAdresi ?? null,
      macAdresi: payload.macAdresi ?? null,
      kullaniciAdi: payload.kullaniciAdi ?? null,
      sifre: payload.sifre ?? null,
      port: payload.port ?? null,
      nvrBilgisi: payload.nvrBilgisi ?? null,
      kanalNo: payload.kanalNo ?? null,
      altLokasyon: payload.altLokasyon ?? null,
      lokasyonNotu: payload.lokasyonNotu ?? null,
      modelNotu: payload.modelNotu ?? null,
      kurulumNotu: payload.kurulumNotu ?? mevcut.kurulumNotu,
    }
    const { data, error } = await supabase
      .from('cihaz_kayitlari')
      .update(toSnake(teknik))
      .eq('id', mevcut.id)
      .select(KOLONLAR)
      .single()
    if (error) { console.warn('cihazKayitUpsert.update:', error.message); return null }
    return toCamel(data)
  }
  return cihazKayitBaslat({ ...payload, durum: 'aktif' })
}

// Aktif kaydı 'sokuldu' işaretle (cihazSok içinde çağrılır)
// payload: { sokumKullaniciId, sokumServisTalepId?, sokumNotu?, arizali? }
export const aktifKaydiSok = async (stokKalemiId, payload) => {
  const mevcut = await aktifKayitGetir(stokKalemiId)
  if (!mevcut) return null

  const durum = payload?.arizali ? 'ariza' : 'sokuldu'
  const { data, error } = await supabase
    .from('cihaz_kayitlari')
    .update(toSnake({
      durum,
      sokumTarihi: new Date().toISOString(),
      sokumServisTalepId: payload?.sokumServisTalepId ?? null,
      sokumKullaniciId: payload.sokumKullaniciId,
      sokumNotu: payload?.sokumNotu ?? null,
    }))
    .eq('id', mevcut.id)
    .select(KOLONLAR)
    .single()
  if (error) { console.warn('aktifKaydiSok:', error.message); return null }
  return toCamel(data)
}

// Bir servis talebi için EKSİK cihaz bilgisi olan S/N takipli ürünler.
// Bir kalem "kullanıldı" durumundaysa VE seri numarası varsa VE IP/alt-lokasyon
// dolu değilse eksik sayılır. stok_kalemleri üzerinden doğrudan kontrol edilir
// (cihaz_kayitlari snapshot INSERT başarısız olsa bile bu güvenilir çalışır).
export const eksikCihazKayitlariGetir = async (servisTalepId) => {
  // 1) Bu servise kullanıldı olarak yazılmış kalemleri al
  const { data: kullanimlar, error: e1 } = await supabase
    .from('servis_kalem_kullanimi')
    .select('kalem_id')
    .eq('servis_talep_id', servisTalepId)
    .eq('durum', 'kullanildi')
    .not('kalem_id', 'is', null)
  if (e1) { console.warn('eksikCihazKayitlariGetir.kullanim:', e1.message); return [] }

  const kalemIds = [...new Set((kullanimlar || []).map((k) => k.kalem_id))]
  if (kalemIds.length === 0) return []

  // 2) Kalemleri fetch et; seri numarası olan + IP veya alt-lokasyonu boş olanlar aday
  const { data: kalemler, error: e2 } = await supabase
    .from('stok_kalemleri')
    .select('id, seri_no, ip_adresi, alt_lokasyon, stok_kodu, musteri_id')
    .in('id', kalemIds)
    .not('seri_no', 'is', null)
    .eq('silindi', false)
  if (e2) { console.warn('eksikCihazKayitlariGetir.kalem:', e2.message); return [] }

  let eksikler = (kalemler || []).filter((k) => !k.ip_adresi || !k.alt_lokasyon)
  if (eksikler.length === 0) return []

  // 2.5) Bilgi musteri_cihazlari'nda girilmiş olabilir (webdeki "Cihaz" modalı
  //      + mobil müşteri cihaz ekranı oraya yazar) — orada dolu olan S/N'i
  //      eksik sayma. SN unique index'i upper(trim) olduğundan eşleşme JS'te
  //      normalize edilerek yapılır.
  //      (Webden düşülen kalemde musteri_id boş kalır — servisin müşterisi de
  //      sete eklenir ki kontrol atlanmasın.)
  const musteriIdSet = new Set(eksikler.map((k) => k.musteri_id).filter(Boolean))
  const { data: st } = await supabase
    .from('servis_talepleri').select('musteri_id').eq('id', servisTalepId).maybeSingle()
  if (st?.musteri_id) musteriIdSet.add(st.musteri_id)
  const musteriIds = [...musteriIdSet]
  if (musteriIds.length > 0) {
    const { data: mcler } = await supabase
      .from('musteri_cihazlari')
      .select('seri_no, ip_adresi, lokasyon')
      .in('musteri_id', musteriIds)
    const norm = (s) => String(s || '').trim().toUpperCase()
    const doluSn = new Set((mcler || [])
      .filter((c) => c.ip_adresi && c.lokasyon)
      .map((c) => norm(c.seri_no)))
    eksikler = eksikler.filter((k) => !doluSn.has(norm(k.seri_no)))
    if (eksikler.length === 0) return []
  }

  // 3) Ürün adları — stok_kalemleri→stok_urunler FK'sı yok, embed çalışmaz;
  //    bağ stok_kodu metniyle kurulur (stok_urunler'da ad kolonu stok_adi)
  const kodlar = [...new Set(eksikler.map((k) => k.stok_kodu).filter(Boolean))]
  let adlar = new Map()
  if (kodlar.length > 0) {
    const { data: urunler } = await supabase
      .from('stok_urunler')
      .select('stok_kodu, stok_adi')
      .in('stok_kodu', kodlar)
    adlar = new Map((urunler || []).map((u) => [u.stok_kodu, u.stok_adi]))
  }
  return arrayToCamel(eksikler).map((k) => ({
    ...k,
    urunAdi: adlar.get(k.stokKodu) || null,
  }))
}

// Bir S/N'in tarihçesi (hepsi)
export const tarihceGetir = async (stokKalemiId) => {
  const { data, error } = await supabase
    .from('cihaz_kayitlari')
    .select(`${KOLONLAR}, musteriler:musteri_id (id, firma, ad, soyad)`)
    .eq('stok_kalemi_id', stokKalemiId)
    .order('kurulum_tarihi', { ascending: false })
  if (error) { console.warn('tarihceGetir:', error.message); return [] }
  return arrayToCamel(data || [])
}
