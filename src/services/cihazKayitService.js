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

// Bir servis talebi için EKSİK cihaz kayıtları (IP veya alt-lokasyon boş, aktif)
// Servis kapatmadan önce kontrolde kullanılır.
export const eksikCihazKayitlariGetir = async (servisTalepId) => {
  const { data, error } = await supabase
    .from('cihaz_kayitlari')
    .select(`id, stok_kalemi_id, ip_adresi, alt_lokasyon, stok_kalemleri:stok_kalemi_id (id, seri_no, urun_id, stok_urunler:urun_id (id, ad, model))`)
    .eq('servis_talep_id', servisTalepId)
    .eq('durum', 'aktif')
    .or('ip_adresi.is.null,alt_lokasyon.is.null')
  if (error) { console.warn('eksikCihazKayitlariGetir:', error.message); return [] }
  return arrayToCamel(data || [])
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
