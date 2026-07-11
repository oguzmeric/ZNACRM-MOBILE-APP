// Keşif Modülü servisi (mobile) — saha keşif kayıtları.
// Web karşılığı: crm-app/src/services/kesifService.js (mig 139).
// kesif_no (KSF-YYYY-NNNN) DB trigger üretir, client göndermez.
// Foto upload: aracFotoService base64→ArrayBuffer kalıbı (iOS fetch(file://) sorunu için).

import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

const FOTO_BUCKET = 'kesif-foto'

export const KESIF_KATEGORILERI = [
  { id: 'kamera',       ad: 'Kamera',       ikon: '📷' },
  { id: 'kayit_cihazi', ad: 'Kayıt Cihazı', ikon: '💾' },
  { id: 'kablo',        ad: 'Kablo',        ikon: '🔌' },
  { id: 'network',      ad: 'Network',      ikon: '🌐' },
  { id: 'malzeme',      ad: 'Malzeme',      ikon: '🧰' },
  { id: 'iscilik',      ad: 'İşçilik',      ikon: '👷' },
  { id: 'diger',        ad: 'Diğer',        ikon: '📦' },
]

export const KESIF_DURUMLARI = [
  { id: 'acik',       ad: 'Açık',       renk: '#60a5fa' },
  { id: 'tamamlandi', ad: 'Tamamlandı', renk: '#22c55e' },
  { id: 'iptal',      ad: 'İptal',      renk: '#ef4444' },
]

export const KESIF_ONCELIKLERI = [
  { id: 'dusuk',  ad: 'Düşük',  renk: '#94a3b8' },
  { id: 'normal', ad: 'Normal', renk: '#60a5fa' },
  { id: 'yuksek', ad: 'Yüksek', renk: '#f59e0b' },
  { id: 'acil',   ad: 'Acil',   renk: '#ef4444' },
]

// Keşif türleri (spec §4) — çoklu seçim
export const KESIF_TURLERI = [
  { id: 'cctv',              ad: 'CCTV Kamera' },
  { id: 'video_analitik',    ad: 'Video Analitik' },
  { id: 'alev_duman',        ad: 'Alev/Duman Algılama' },
  { id: 'plaka_tanima',      ad: 'Plaka Tanıma' },
  { id: 'kartli_gecis',      ad: 'Kartlı Geçiş' },
  { id: 'pdks',              ad: 'PDKS' },
  { id: 'turnike',           ad: 'Turnike' },
  { id: 'bariyer',           ad: 'Bariyer' },
  { id: 'network',           ad: 'Network' },
  { id: 'kablosuz_ag',       ad: 'Kablosuz Ağ' },
  { id: 'fiber_optik',       ad: 'Fiber Optik' },
  { id: 'yapisal_kablolama', ad: 'Yapısal Kablolama' },
  { id: 'telefon_santrali',  ad: 'Telefon Santrali' },
  { id: 'interkom',          ad: 'İnterkom' },
  { id: 'hirsiz_alarm',      ad: 'Hırsız Alarm' },
  { id: 'yangin_algilama',   ad: 'Yangın Algılama' },
  { id: 'seslendirme',       ad: 'Seslendirme/Anons' },
  { id: 'sistem_odasi',      ad: 'Sistem Odası' },
  { id: 'veri_merkezi',      ad: 'Veri Merkezi' },
  { id: 'zayif_akim',        ad: 'Zayıf Akım' },
  { id: 'bakim_yenileme',    ad: 'Bakım/Yenileme' },
  { id: 'diger',             ad: 'Diğer' },
]

// ---------- Keşifler ----------
export const kesifleriGetir = async () => {
  const { data, error } = await supabase
    .from('kesifler')
    .select('*')
    .order('olusturma_tarih', { ascending: false })
    .limit(200)
  if (error) { console.warn('[kesif] liste hatası:', error.message); return [] }
  return arrayToCamel(data ?? [])
}

export const kesifGetir = async (id) => {
  const { data, error } = await supabase.from('kesifler').select('*').eq('id', id).single()
  if (error) { console.warn('[kesif] getir hatası:', error.message); return null }
  return toCamel(data)
}

export const kesifEkle = async (kesif) => {
  const { id, kesifNo, olusturmaTarih, guncellemeTarih, ...rest } = kesif
  const { data, error } = await supabase.from('kesifler').insert(toSnake(rest)).select().single()
  if (error) { console.error('[kesif] ekle hatası:', error.message); return null }
  return toCamel(data)
}

export const kesifGuncelle = async (id, alanlar) => {
  const { id: _id, kesifNo, olusturmaTarih, guncellemeTarih, ...rest } = alanlar
  const { data, error } = await supabase.from('kesifler').update(toSnake(rest)).eq('id', id).select().single()
  if (error) { console.error('[kesif] güncelle hatası:', error.message); return null }
  return toCamel(data)
}

// ---------- Kalemler ----------
export const kesifKalemleriGetir = async (kesifId) => {
  const { data, error } = await supabase
    .from('kesif_kalemleri')
    .select('*')
    .eq('kesif_id', kesifId)
    .order('siralama', { ascending: true })
    .order('id', { ascending: true })
  if (error) { console.warn('[kesif] kalem hatası:', error.message); return [] }
  return arrayToCamel(data ?? [])
}

export const kesifKalemEkle = async (kalem) => {
  const { id, olusturmaTarih, ...rest } = kalem
  const { data, error } = await supabase.from('kesif_kalemleri').insert(toSnake(rest)).select().single()
  if (error) { console.error('[kesif] kalem ekle hatası:', error.message); return null }
  return toCamel(data)
}

export const kesifKalemSil = async (id) => {
  const { error } = await supabase.from('kesif_kalemleri').delete().eq('id', id)
  if (error) { console.warn('[kesif] kalem sil hatası:', error.message); return false }
  return true
}

// ---------- Fotoğraflar ----------
export const kesifFotolariGetir = async (kesifId) => {
  const { data, error } = await supabase
    .from('kesif_fotolari')
    .select('*')
    .eq('kesif_id', kesifId)
    .order('olusturma_tarih', { ascending: false })
  if (error) { console.warn('[kesif] foto hatası:', error.message); return [] }
  return arrayToCamel(data ?? [])
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

export async function kesifFotoYukle(kesifId, dosyaUri, { olusturanAd = '' } = {}) {
  const yol = `${kesifId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  let veri
  try {
    const base64 = await FileSystem.readAsStringAsync(dosyaUri, { encoding: 'base64' })
    veri = base64ToArrayBuffer(base64)
    if (!veri || veri.byteLength === 0) throw new Error('Boş dosya')
  } catch (e) {
    return { ok: false, hata: 'Dosya okunamadı: ' + e.message }
  }
  const { error: upErr } = await supabase.storage.from(FOTO_BUCKET).upload(yol, veri, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (upErr) return { ok: false, hata: 'Yükleme hatası: ' + upErr.message }
  const { data, error } = await supabase.from('kesif_fotolari').insert({
    kesif_id: kesifId,
    dosya_yolu: yol,
    olusturan_ad: olusturanAd || null,
  }).select().single()
  if (error) {
    await supabase.storage.from(FOTO_BUCKET).remove([yol]).catch(() => {})
    return { ok: false, hata: error.message }
  }
  return { ok: true, foto: toCamel(data) }
}

export const kesifFotoSil = async (foto) => {
  const { error } = await supabase.from('kesif_fotolari').delete().eq('id', foto.id)
  if (error) { console.warn('[kesif] foto sil:', error.message); return false }
  const yol = foto.dosyaYolu || foto.dosya_yolu
  if (yol) await supabase.storage.from(FOTO_BUCKET).remove([yol]).catch(() => {})
  return true
}

// Private bucket — okuma signed URL ile
export async function kesifFotoUrl(yol, saniye = 3600) {
  const { data } = await supabase.storage.from(FOTO_BUCKET).createSignedUrl(yol, saniye)
  return data?.signedUrl ?? null
}

export async function kesifFotoUrlleri(yollar, saniye = 3600) {
  if (!yollar?.length) return {}
  const { data, error } = await supabase.storage.from(FOTO_BUCKET).createSignedUrls(yollar, saniye)
  if (error) { console.warn('[kesif] signed urls:', error.message); return {} }
  const m = {}
  ;(data ?? []).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl })
  return m
}
