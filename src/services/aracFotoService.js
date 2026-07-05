// Şirket aracı foto kayıt servisi.
// Storage bucket: arac-fotolari. Path: {arac_id}/{tarih}/{zaman}/{bolge}.jpg
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'

// base64 → ArrayBuffer (base64-arraybuffer paketi bağımlılık olmadan)
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

export const BOLGELER = [
  { id: 'on',     ad: 'Ön',        aciklama: 'Aracın önü' },
  { id: 'arka',   ad: 'Arka',      aciklama: 'Aracın arkası' },
  { id: 'sol',    ad: 'Sol Yan',   aciklama: 'Sol yan görünüm' },
  { id: 'sag',    ad: 'Sağ Yan',   aciklama: 'Sağ yan görünüm' },
  { id: 'kokpit', ad: 'Ön Konsol', aciklama: 'Direksiyon ve konsol' },
  { id: 'ic',     ad: 'Araç İçi',  aciklama: 'Koltuklar / iç mekan' },
]

export const ZAMANLAR = [
  { id: 'sabah', ad: 'Sabah' },
  { id: 'aksam', ad: 'Akşam' },
]

function bugunISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

export async function aktifAraclariGetir() {
  const { data, error } = await supabase
    .from('sirket_araclari')
    .select('id, plaka, marka, model, yil')
    .eq('aktif', true)
    .order('plaka')
  if (error) throw error
  return data ?? []
}

export async function bugunkuKayitlariGetir(aracId) {
  const { data, error } = await supabase
    .from('arac_foto_kayitlari')
    .select('id, zaman, bolge, foto_url, cekim_zamani, teknisyen_id, kullanicilar(ad)')
    .eq('arac_id', aracId)
    .eq('tarih', bugunISO())
  if (error) throw error
  return data ?? []
}

export async function tumAraclarBugunOzet() {
  const { data: araclar } = await supabase
    .from('sirket_araclari').select('id, plaka, marka, model')
    .eq('aktif', true).order('plaka')
  if (!araclar) return []
  const { data: kayitlar } = await supabase
    .from('arac_foto_kayitlari')
    .select('arac_id, zaman, bolge')
    .eq('tarih', bugunISO())
  const kayitMap = new Map()
  ;(kayitlar ?? []).forEach(k => {
    const key = `${k.arac_id}|${k.zaman}`
    if (!kayitMap.has(key)) kayitMap.set(key, new Set())
    kayitMap.get(key).add(k.bolge)
  })
  return araclar.map(a => ({
    ...a,
    sabahSayisi: kayitMap.get(`${a.id}|sabah`)?.size ?? 0,
    aksamSayisi: kayitMap.get(`${a.id}|aksam`)?.size ?? 0,
    toplamBolge: BOLGELER.length,
  }))
}

// Foto yükle → mevcut kayıt varsa üzerine yaz (upsert)
export async function fotoKaydet({ aracId, zaman, bolge, dosyaUri }) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) return { ok: false, hata: 'Oturum yok' }
  const { data: k } = await supabase.from('kullanicilar').select('id').eq('auth_id', uid).maybeSingle()
  if (!k) return { ok: false, hata: 'Kullanıcı bulunamadı' }

  const tarih = bugunISO()
  const zamanAn = Date.now()
  const yol = `${aracId}/${tarih}/${zaman}/${bolge}_${zamanAn}.jpg`

  // Dosyayı ArrayBuffer'a çevir (RN'de fetch(file://) iOS'te boş blob dönüyor)
  let veri
  try {
    const base64 = await FileSystem.readAsStringAsync(dosyaUri, { encoding: 'base64' })
    veri = base64ToArrayBuffer(base64)
    if (!veri || veri.byteLength === 0) throw new Error('Boş dosya')
  } catch (e) {
    return { ok: false, hata: 'Dosya okunamadı: ' + e.message }
  }

  const { error: upErr } = await supabase.storage.from('arac-fotolari').upload(yol, veri, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (upErr) return { ok: false, hata: 'Yükleme hatası: ' + upErr.message }

  const { data: urlD } = supabase.storage.from('arac-fotolari').getPublicUrl(yol)
  // Bucket private — signed URL kullanacağız görüntülerken. Şimdilik yolu saklayalım.
  const fotoUrl = yol

  // Var olan kaydı güncelle veya yeni kayıt aç (unique index: arac+tarih+zaman+bolge)
  const { data: mevcut } = await supabase.from('arac_foto_kayitlari')
    .select('id, foto_url')
    .eq('arac_id', aracId).eq('tarih', tarih).eq('zaman', zaman).eq('bolge', bolge)
    .maybeSingle()

  if (mevcut) {
    // Eski dosyayı sil
    if (mevcut.foto_url && mevcut.foto_url !== fotoUrl) {
      supabase.storage.from('arac-fotolari').remove([mevcut.foto_url]).catch(() => {})
    }
    const { error: uErr } = await supabase.from('arac_foto_kayitlari').update({
      foto_url: fotoUrl,
      cekim_zamani: new Date().toISOString(),
      teknisyen_id: k.id,
    }).eq('id', mevcut.id)
    if (uErr) return { ok: false, hata: 'Kayıt güncellenemedi: ' + uErr.message }
    return { ok: true, foto_url: fotoUrl, yeni: false }
  }

  const { error: iErr } = await supabase.from('arac_foto_kayitlari').insert({
    arac_id: aracId,
    teknisyen_id: k.id,
    zaman, bolge,
    foto_url: fotoUrl,
    tarih,
  })
  if (iErr) return { ok: false, hata: 'Kayıt eklenemedi: ' + iErr.message }
  return { ok: true, foto_url: fotoUrl, yeni: true }
}

// Kayıt sil + dosyayı storage'dan kaldır
export async function fotoKaydiSil(kayit) {
  if (!kayit?.id) return { ok: false, hata: 'Kayıt bulunamadı' }

  // Storage dosyasını sil (hata olsa bile DB kaydını silmeye devam et)
  let storageHata = null
  if (kayit.foto_url) {
    const { error } = await supabase.storage.from('arac-fotolari').remove([kayit.foto_url])
    if (error) storageHata = error.message
  }

  // DB kaydını sil ve gerçekten silinip silinmediğini teyit et (RLS 0 satır dönebilir, hata vermez)
  const { data, error } = await supabase
    .from('arac_foto_kayitlari')
    .delete()
    .eq('id', kayit.id)
    .select('id')
  if (error) return { ok: false, hata: 'DB: ' + error.message }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'RLS engelledi (yetki yok). Dashboard\'da DELETE policy kontrol et.' }
  }
  return { ok: true, storageHata }
}

// Signed URL üret (görüntüleme için)
export async function imzaliUrl(yol, saniye = 3600) {
  if (!yol) return null
  const { data } = await supabase.storage.from('arac-fotolari').createSignedUrl(yol, saniye)
  return data?.signedUrl ?? null
}

export function aracFotoModulVarMi(kullanici) {
  return (kullanici?.moduller ?? []).includes('arac_foto_takip')
}
