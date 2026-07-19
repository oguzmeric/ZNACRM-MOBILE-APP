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
// Fotoğraf etiketi (KEŞİF DÜZENLEME dokümanı §2) — web + mig 200 CHECK ile birebir
export const KESIF_FOTO_ETIKETLERI = [
  { id: 'mevcut_durum',     ad: 'Mevcut Durum',     renk: '#64748b' },
  { id: 'ariza_noktasi',    ad: 'Arıza Noktası',    renk: '#dc2626' },
  { id: 'montaj_noktasi',   ad: 'Montaj Noktası',   renk: '#16a34a' },
  { id: 'kablo_guzergahi',  ad: 'Kablo Güzergahı',  renk: '#f59e0b' },
  { id: 'elektrik_noktasi', ad: 'Elektrik Noktası', renk: '#ea580c' },
  { id: 'network_noktasi',  ad: 'Network Noktası',  renk: '#2563eb' },
  { id: 'riskli_alan',      ad: 'Riskli Alan',      renk: '#9333ea' },
]
export const kesifFotoEtiketBilgi = (id) => KESIF_FOTO_ETIKETLERI.find(e => e.id === id) || null

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

export async function kesifFotoYukle(kesifId, dosyaUri, meta = {}) {
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
    baslik: meta.baslik?.trim() || null,
    aciklama: meta.aciklama?.trim() || null,
    montaj_notu: meta.montajNotu?.trim() || null,
    mahal: meta.mahal?.trim() || null,
    kat_bolum: meta.katBolum?.trim() || null,
    etiket: meta.etiket || null,
    kalem_id: meta.kalemId || null,
    olusturan_ad: meta.olusturanAd || null,
    olusturan_id: meta.olusturanId || null,
  }).select().single()
  if (error) {
    await supabase.storage.from(FOTO_BUCKET).remove([yol]).catch(() => {})
    return { ok: false, hata: error.message }
  }
  return { ok: true, foto: toCamel(data) }
}

// Alt bilgi güncelleme (RLS: ekleyen + admin)
export const kesifFotoGuncelle = async (fotoId, alanlar) => {
  const izinli = ['baslik', 'aciklama', 'montajNotu', 'mahal', 'katBolum', 'etiket', 'kalemId']
  const temiz = {}
  for (const k of izinli) if (k in alanlar) temiz[k] = alanlar[k] === '' ? null : alanlar[k]
  temiz.guncellemeTarih = new Date().toISOString()
  const { data, error } = await supabase.from('kesif_fotolari')
    .update(toSnake(temiz)).eq('id', fotoId).select('id')
  if (error) return { ok: false, hata: error.message }
  if (!data?.length) return { ok: false, hata: 'Yetki yok — fotoğrafı yalnız ekleyen veya yönetici düzenleyebilir.' }
  return { ok: true }
}

// Çizimli versiyonu yükle (flatten PNG, Skia snapshot base64) — orijinal korunur
export async function kesifFotoCizimKaydet(foto, pngBase64, cizimVeri, kullanici) {
  const yol = foto.cizimYolu || `${foto.kesifId}/cizim/${foto.id}_${Date.now()}.png`
  const veri = base64ToArrayBuffer(pngBase64)
  if (!veri?.byteLength) return { ok: false, hata: 'Çizim verisi boş.' }
  const { error: upErr } = await supabase.storage.from(FOTO_BUCKET).upload(yol, veri, {
    contentType: 'image/png', upsert: true,
  })
  if (upErr) return { ok: false, hata: 'Yükleme hatası: ' + upErr.message }
  const gecmis = [...(foto.cizimGecmisi || []), {
    ad: kullanici?.ad || '—', tarih: new Date().toISOString(),
    islem: foto.cizimYolu ? 'cizim_guncellendi' : 'cizim_eklendi',
  }]
  const { data, error } = await supabase.from('kesif_fotolari').update({
    cizim_yolu: yol,
    cizim_veri: cizimVeri || null,
    cizim_gecmisi: gecmis,
    guncelleme_tarih: new Date().toISOString(),
  }).eq('id', foto.id).select('id, cizim_yolu, cizim_veri, cizim_gecmisi')
  if (error) return { ok: false, hata: error.message }
  if (!data?.length) return { ok: false, hata: 'Çizim kaydetme yetkin yok.' }
  return { ok: true, foto: toCamel(data[0]) }
}

export const kesifFotoSil = async (foto) => {
  const { data, error } = await supabase.from('kesif_fotolari').delete().eq('id', foto.id).select('id')
  if (error) { console.warn('[kesif] foto sil:', error.message); return false }
  if (!data?.length) return false // RLS: yetki yok
  const yollar = [foto.dosyaYolu || foto.dosya_yolu, foto.cizimYolu || foto.cizim_yolu].filter(Boolean)
  if (yollar.length) await supabase.storage.from(FOTO_BUCKET).remove(yollar).catch(() => {})
  return true
}

// ---------- Krokiler (mig 202) ----------
// Sembol paleti — web kesifService.KROKI_SEMBOLLERI ile AYNI liste
// ikon: Feather adı (mobil palet çipi @expo/vector-icons/Feather ile gösterir)
export const KROKI_SEMBOLLERI = [
  { id: 'kamera',  kod: 'K',  ikon: 'camera',    ad: 'Kamera',          renk: '#2563eb' },
  { id: 'ptz',     kod: 'P',  ikon: 'video',     ad: 'PTZ Kamera',      renk: '#7c3aed' },
  { id: 'nvr',     kod: 'N',  ikon: 'hard-drive', ad: 'NVR / Kayıt',    renk: '#0f766e' },
  { id: 'switch',  kod: 'S',  ikon: 'server',    ad: 'Switch',          renk: '#0891b2' },
  { id: 'guc',     kod: 'G',  ikon: 'zap',       ad: 'Güç Noktası',     renk: '#ea580c' },
  { id: 'network', kod: 'NT', ikon: 'globe',     ad: 'Network Noktası', renk: '#4f46e5' },
  { id: 'bariyer', kod: 'B',  ikon: 'minus',     ad: 'Bariyer',         renk: '#b91c1c' },
  { id: 'turnike', kod: 'T',  ikon: 'rotate-cw', ad: 'Turnike',         renk: '#a16207' },
  { id: 'kapi',    kod: 'KP', ikon: 'log-in',    ad: 'Kapı',            renk: '#64748b' },
]
export const krokiSembolBilgi = (id) => KROKI_SEMBOLLERI.find(s => s.id === id) || KROKI_SEMBOLLERI[0]

export const kesifKrokileriGetir = async (kesifId) => {
  const { data, error } = await supabase
    .from('kesif_krokiler')
    .select('*')
    .eq('kesif_id', kesifId)
    .order('olusturma_tarih', { ascending: true })
  if (error) { console.warn('[kesif] krokiler:', error.message); return [] }
  return arrayToCamel(data ?? [])
}

// Yeni kroki VEYA güncelleme: flatten PNG (Skia base64) aynı yola upsert
export async function kesifKrokiKaydet({ id, kesifId, baslik, veri, pngBase64, mevcutYol, kullanici }) {
  const yol = mevcutYol || `${kesifId}/kroki/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
  const buf = base64ToArrayBuffer(pngBase64)
  if (!buf?.byteLength) return { ok: false, hata: 'Kroki görseli boş.' }
  const { error: upErr } = await supabase.storage.from(FOTO_BUCKET).upload(yol, buf, {
    contentType: 'image/png', upsert: true,
  })
  if (upErr) return { ok: false, hata: 'Yükleme hatası: ' + upErr.message }
  if (id) {
    const { data, error } = await supabase.from('kesif_krokiler').update({
      baslik: baslik || 'Kroki', veri, gorsel_yolu: yol,
      guncelleme_tarih: new Date().toISOString(),
    }).eq('id', id).select()
    if (error) return { ok: false, hata: error.message }
    if (!data?.length) return { ok: false, hata: 'Güncelleme yetkin yok — yalnız çizen kişi veya yönetici.' }
    return { ok: true, kroki: toCamel(data[0]) }
  }
  const { data, error } = await supabase.from('kesif_krokiler').insert({
    kesif_id: kesifId, baslik: baslik || 'Kroki', veri, gorsel_yolu: yol,
    olusturan_ad: kullanici?.ad || null, olusturan_id: kullanici?.id || null,
  }).select().single()
  if (error) {
    await supabase.storage.from(FOTO_BUCKET).remove([yol]).catch(() => {})
    return { ok: false, hata: error.message }
  }
  return { ok: true, kroki: toCamel(data) }
}

export const kesifKrokiSil = async (kroki) => {
  const { data, error } = await supabase.from('kesif_krokiler').delete().eq('id', kroki.id).select('id')
  if (error) { console.warn('[kesif] kroki sil:', error.message); return false }
  if (!data?.length) return false
  if (kroki.gorselYolu) await supabase.storage.from(FOTO_BUCKET).remove([kroki.gorselYolu]).catch(() => {})
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
