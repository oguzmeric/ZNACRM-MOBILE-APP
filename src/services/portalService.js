// Müşteri portalı (mobil) veri katmanı — web'deki portal sayfalarıyla aynı
// kaynaklar. Portal kullanıcısı = kullanicilar.tip === 'musteri'.
//
// ⚠️ RLS notları (mig 293/296/298→318/311/319):
//   • servis_talepleri: müşteri yalnız KENDİ firmasının kayıtlarını görür
//     (musteri_id = current_musteri_id()); UPDATE politikası YOK — not ve
//     dosya ekleme SECURITY DEFINER RPC'lerle yapılır (311 + 319).
//   • portal_cihazlarim / portal_katalog GÖRÜNÜMLERİ: satır/kolon filtresi
//     görünümün içinde — cihaz şifresi/IP/MAC ve fiyat kolonları GELMEZ.
//   • Ham stok tablolarına müşteri erişemez (is_staff kapısı).
import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'
import { oturumTokenAl } from '../lib/storageAuth'

// Müşteriye gösterilen cihaz durum etiketleri (web portalCihazService ile aynı)
export const CIHAZ_DURUMLARI = {
  sahada:         { etiket: 'Kullanımda',         renk: '#22c55e' },
  teknisyende:    { etiket: 'Teknisyende',        renk: '#f59e0b' },
  arizali_depoda: { etiket: 'Arızalı — serviste', renk: '#ef4444' },
  arizada:        { etiket: 'Arızalı — serviste', renk: '#ef4444' },
  depoda:         { etiket: 'Depoda',             renk: '#94a3b8' },
}

// Portalda seçilebilen talep türleri (web PORTAL_TURLERI ile aynı küme:
// bakım/kurulum/teklif portal dışı — teklif için ayrı "Teklif İste" akışı var)
export const PORTAL_TUR_IDLERI = ['ariza', 'talep', 'kesif', 'egitim']

export const portalCihazlariGetir = async () => {
  const { data, error } = await supabase
    .from('portal_cihazlarim')
    .select('id, seri_no, marka, model, durum, kanal_no, takilma_tarihi, garanti_bitis_tarihi, alt_lokasyon, lokasyon_ad, urun_adi')
    .order('lokasyon_ad', { nullsFirst: false })
    .order('takilma_tarihi', { ascending: false })
    .order('id')
  if (error) throw new Error(error.message)
  return arrayToCamel(data ?? [])
}

// Ürün kataloğu (portal_katalog görünümü, mig 296 — fiyat kolonu yok)
export const katalogUrunleriniGetir = async () => {
  const hepsi = []
  const SAYFA = 1000
  // PostgREST varsayılan limiti 1000 — katalog bundan büyükse sayfalayarak çek
  for (let off = 0; off < 20000; off += SAYFA) {
    const { data, error } = await supabase
      .from('portal_katalog')
      .select('id, stok_kodu, stok_adi, marka, model, grup_kodu, kategori_id, birim, aciklama, gorsel_url')
      .order('stok_adi')
      .order('id')
      .range(off, off + SAYFA - 1)
    if (error) throw new Error(error.message)
    hepsi.push(...(data ?? []))
    if (!data || data.length < SAYFA) break
  }
  return arrayToCamel(hepsi)
}

// Kategori ağacı — stok_kategoriler SELECT'i müşteri tipine mig 296 ile açık
export const kategorileriGetir = async () => {
  const { data, error } = await supabase
    .from('stok_kategoriler')
    .select('id, ad, ust_id, sira')
    .eq('aktif', true)
    .order('sira')
    .order('ad')
  if (error) { console.warn('[portal kategoriler]', error.message); return [] }
  return arrayToCamel(data ?? [])
}

// Teklif isteği — personel "Teklifler > Müşteri Talepleri" kuyruğuna düşer.
// talep_no DB trigger'ından (mig 269); musteri_id kimlik bağı (mig 301).
export const teklifTalebiGonder = async (talep) => {
  const { data, error } = await supabase
    .from('musteri_teklif_talepleri')
    .insert(toSnake(talep))
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toCamel(data)
}

// Müşterinin kendi firması (RLS kendi kaydını verir) — temsilci bilgisi dahil
export const benimMusteriKaydim = async (musteriId) => {
  if (!musteriId) return null
  const { data, error } = await supabase
    .from('musteriler')
    .select('id, firma, ad, soyad, telefon, email, temsilci_kullanici_id')
    .eq('id', musteriId)
    .maybeSingle()
  if (error) { console.warn('[benimMusteriKaydim]', error.message); return null }
  return data ? toCamel(data) : null
}

// Talep detayı — DAR kolon seti (⚠️ select('*') yasak: personel_imza/musteri_imza
// base64 kolonları ~200 kB/satır; müşteri detayında hiçbiri gösterilmiyor)
const DETAY_KOLONLARI = [
  'id', 'talep_no', 'ana_tur', 'alt_kategori', 'konu', 'aciklama', 'durum',
  'aciliyet', 'lokasyon', 'cihaz_turu', 'ilgili_kisi', 'telefon', 'email',
  'uygun_zaman', 'planli_tarih', 'atanan_kullanici_ad', 'olusturma_tarihi',
  'notlar', 'dosyalar', 'durum_gecmisi', 'musteri_onay',
  'degerlendirme_puan', 'degerlendirme_yorum',
].join(',')

export const talepDetayGetir = async (id) => {
  const { data, error } = await supabase
    .from('servis_talepleri')
    .select(DETAY_KOLONLARI)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toCamel(data) : null
}

// Çözüm onayı / ret — mig 319 RPC (müşteride UPDATE politikası yok)
export const talepOnayVer = async (talepId, onay) => {
  const { error } = await supabase.rpc('servis_talep_musteri_onay', {
    p_talep_id: talepId, p_onay: onay,
  })
  if (error) throw new Error(error.message || 'Onay kaydedilemedi.')
}

// Hizmet değerlendirmesi (1-5 yıldız + yorum) — mig 319 RPC
export const talepDegerlendir = async (talepId, puan, yorum) => {
  const { error } = await supabase.rpc('servis_talep_degerlendir', {
    p_talep_id: talepId, p_puan: puan, p_yorum: yorum || null,
  })
  if (error) throw new Error(error.message || 'Değerlendirme kaydedilemedi.')
}

// Not ekleme — mig 311 RPC'si (müşteri UPDATE politikası olmadığı için tek yol).
// HATA FIRLATIR: çağıran yakalayıp metni kutuda bırakmalı.
export const talepNotEkle = async (talepId, metin) => {
  const { data, error } = await supabase.rpc('servis_talep_not_ekle', {
    p_talep_id: talepId,
    p_metin: metin,
    p_tip: 'musteri',      // sunucu müşteride zaten 'musteri'ye sabitler
  })
  if (error) throw new Error(error.message || 'Not eklenemedi.')
  return data
}

// Dosya metasını talep kaydına işle — mig 319 RPC'si (aynı RLS kökü)
export const talepDosyaEkle = async (talepId, meta) => {
  const { data, error } = await supabase.rpc('servis_talep_dosya_ekle', {
    p_talep_id: talepId,
    p_ad: meta.ad,
    p_tip: meta.tip ?? null,
    p_boyut: meta.boyut ?? null,
    p_yol: meta.yol ?? null,
    p_url: meta.url ?? null,
  })
  if (error) throw new Error(error.message || 'Dosya kaydı eklenemedi.')
  return data
}

// Talep ekini Storage'a yükle: bucket servis-talep-dosyalari, yol {talepId}/…
// ⚠️ Storage müşteri INSERT politikası yolun ilk klasörünün KENDİ talebinin
// id'si olmasını şart koşar — bu yüzden önce talep INSERT edilir, sonra dosya
// yüklenir, meta mig 319 RPC'siyle kayda işlenir (UPDATE yolu müşteriye kapalı).
export const talepEkiYukle = async (talepId, uri) => {
  const uzanti = (uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
  const mimeType =
    uzanti === 'png' ? 'image/png' :
    uzanti === 'mp4' ? 'video/mp4' :
    uzanti === 'mov' ? 'video/quicktime' :
    'image/jpeg'
  const dosyaAdi = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${uzanti}`
  const yol = `${talepId}/${dosyaAdi}`

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const token = await oturumTokenAl()   // müşteri JWT'si — RLS bunun üstünden çalışır

  const formData = new FormData()
  formData.append('file', { uri, name: dosyaAdi, type: mimeType })

  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/servis-talep-dosyalari/${yol}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!resp.ok) {
    const metin = await resp.text()
    throw new Error(`Yükleme ${resp.status}: ${metin.slice(0, 200)}`)
  }
  return { yol, ad: dosyaAdi, tip: mimeType }
}

// Ek görüntüleme — bucket private: kısa ömürlü imzalı link üret
export const talepEkLinkiAl = async (yol) => {
  const { data, error } = await supabase.storage
    .from('servis-talep-dosyalari')
    .createSignedUrl(yol, 120)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
