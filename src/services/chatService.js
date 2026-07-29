import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'

// Personel sohbeti — WEB İLE AYNI VERİ, aynı RPC'ler (mig 240-244).
// Webde yazılan mesaj burada, burada yazılan webde görünür: tek tablo,
// senkron diye ayrı bir katman YOK.
//
// Sözleşme (web `src/services/chatService.js` ile birebir):
//   • sohbetler / sohbet_katilimcilar / mesajlar.sohbet_id
//   • dosya: `sohbet-dosyalari` bucket, yol `<sohbet_id>/<dosya>` (base64 DEĞİL)
//   • "Sohbeti sil" = gizlendi_tarih damgası (yalnız bana gizler)

export const SOHBET_BUCKET = 'sohbet-dosyalari'
export const DOSYA_LIMIT = 25 * 1024 * 1024

// ── Okuma ──────────────────────────────────────────────────────────────────
// Filtreyi RLS koyuyor: katılımcı olduğum sohbetler + gizleme damgamdan
// sonrakiler. Grup mesajında alici_id null olduğu için istemci filtresi yok.
export const mesajlariGetir = async (limit = 800) => {
  const { data, error } = await supabase
    .from('mesajlar')
    .select('*')
    .order('tarih', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) { console.error('mesajlariGetir hata:', error.message); return [] }
  return arrayToCamel(data).reverse()
}

// Tek sohbetin mesajları. Ters sırada döner (en yeni ilk) — inverted
// FlatList doğrudan bu sırayı istiyor, ayrıca ilk açılışta son mesajlar gelir.
export const sohbetMesajlariGetir = async ({ tip, sohbetId, kisiId, benId }, limit = 200) => {
  let q = supabase.from('mesajlar').select('*')
  if (tip === 'grup') {
    if (!sohbetId) return []
    q = q.eq('sohbet_id', sohbetId)
  } else {
    q = q.or(
      `and(gonderici_id.eq.${benId},alici_id.eq.${kisiId}),` +
      `and(gonderici_id.eq.${kisiId},alici_id.eq.${benId})`
    )
  }
  const { data, error } = await q
    .order('tarih', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) { console.error('sohbetMesajlariGetir hata:', error.message); return [] }
  return arrayToCamel(data)
}

export const sohbetleriGetir = async () => {
  const { data, error } = await supabase.rpc('sohbetlerim')
  if (error) { console.error('sohbetleriGetir hata:', error.message); return [] }
  return arrayToCamel(data)
}

// Ana ekrandaki rozet: birebir okunmamışlar + gruplarda okuma damgamdan
// sonra başkasından gelenler. Grup sayısı az olduğu için döngü yeterli.
export const okunmamisMesajSayisi = async (benId) => {
  if (!benId) return 0
  const [birebirSonuc, sohbetler] = await Promise.all([
    supabase.from('mesajlar').select('id', { count: 'exact', head: true })
      .eq('alici_id', benId).eq('okundu', false),
    sohbetleriGetir(),
  ])
  let toplam = birebirSonuc.count || 0
  for (const g of (sohbetler || []).filter(s => s.tip === 'grup')) {
    let q = supabase.from('mesajlar').select('id', { count: 'exact', head: true })
      .eq('sohbet_id', g.id).neq('gonderici_id', benId)
    if (g.sonOkumaTarih) q = q.gt('tarih', g.sonOkumaTarih)
    const { count } = await q
    toplam += count || 0
  }
  return toplam
}

// ── Sohbet açma / grup ─────────────────────────────────────────────────────
export const birebirSohbetAc = async (digerId) => {
  const { data, error } = await supabase.rpc('birebir_sohbet_ac', { p_diger_id: Number(digerId) })
  if (error) { console.error('birebirSohbetAc hata:', error.message); return { __error: error.message } }
  return { sohbetId: data }
}

export const grupSohbetAc = async (ad, katilimciIdler) => {
  const { data, error } = await supabase.rpc('grup_sohbet_ac', {
    p_ad: ad,
    p_katilimci_idler: (katilimciIdler || []).map(Number),
  })
  if (error) { console.error('grupSohbetAc hata:', error.message); return { __error: error.message } }
  return { sohbetId: data }
}

export const grubaKisiEkle = async (sohbetId, kullaniciId) => {
  const { error } = await supabase.rpc('sohbete_katilimci_ekle', {
    p_sohbet_id: Number(sohbetId), p_kullanici_id: Number(kullaniciId),
  })
  if (error) { console.error('grubaKisiEkle hata:', error.message); return { __error: error.message } }
  return { ok: true }
}

export const gruptanAyril = async (sohbetId) => {
  const { error } = await supabase.rpc('sohbetten_ayril', { p_sohbet_id: Number(sohbetId) })
  if (error) { console.error('gruptanAyril hata:', error.message); return { __error: error.message } }
  return { ok: true }
}

// ── Mesaj ──────────────────────────────────────────────────────────────────
export const mesajGonder = async (gondericiId, aliciId, icerik, sohbetId) => {
  const { data, error } = await supabase
    .from('mesajlar')
    .insert({
      gonderici_id: gondericiId,
      alici_id: aliciId ?? null,      // grupta tek alıcı yok
      sohbet_id: sohbetId ?? null,
      icerik,
    })
    .select()
    .single()
  if (error) { console.error('mesajGonder hata:', error.message); return { __error: error.message } }
  return toCamel(data)
}

export const mesajSil = async (id) => {
  const { error } = await supabase.from('mesajlar').delete().eq('id', id)
  if (error) { console.error('mesajSil hata:', error.message); return { __error: error.message } }
  return { ok: true }
}

export const sohbetiGizle = async (sohbetId) => {
  const { error } = await supabase.rpc('sohbeti_gizle', { p_sohbet_id: Number(sohbetId) })
  if (error) { console.error('sohbetiGizle hata:', error.message); return { __error: error.message } }
  return { ok: true }
}

export const sohbetOkunduIsaretle = async (sohbetId) => {
  const { error } = await supabase.rpc('sohbet_okundu_isaretle', { p_sohbet_id: Number(sohbetId) })
  if (error) console.error('sohbetOkunduIsaretle hata:', error.message)
}

export const konusmayiOkunduYap = async (kullaniciId, kisiId) => {
  const { error } = await supabase
    .from('mesajlar')
    .update({ okundu: true })
    .eq('alici_id', kullaniciId)
    .eq('gonderici_id', kisiId)
    .eq('okundu', false)
  if (error) console.error('konusmayiOkunduYap hata:', error.message)
}

// ── Dosya (private bucket → SDK upload; web ile aynı yol deseni) ────────────
function base64ToArrayBuffer(base64) {
  // Hermes'te atob global; yoksa Buffer'a düş (globalThis üzerinden — düz
  // `Buffer` referansı RN'de tanımsız olabiliyor)
  const cozucu = typeof globalThis.atob === 'function'
    ? globalThis.atob
    : (typeof globalThis.Buffer !== 'undefined'
        ? (s) => globalThis.Buffer.from(s, 'base64').toString('binary')
        : null)
  if (!cozucu) throw new Error('base64 çözücü bulunamadı')
  const binaryString = cozucu(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

function mimeTahmin(ad, verilen) {
  if (verilen) return verilen
  const ext = (ad.split('.').pop() || '').toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', mp4: 'video/mp4', mov: 'video/quicktime',
  }
  return map[ext] || 'application/octet-stream'
}

// asset: DocumentPicker veya ImagePicker sonucu ({ uri, name/fileName, mimeType/type, size })
export const sohbetDosyaYukle = async (sohbetId, asset) => {
  if (!sohbetId) return { __error: 'Sohbet bulunamadı' }
  const ad = asset.name || asset.fileName || (asset.uri || '').split('/').pop() || `dosya_${Date.now()}`
  const guvenli = ad.replace(/[^\w.\-]/g, '_').slice(-80)
  const contentType = mimeTahmin(ad, asset.mimeType || asset.type)
  const yol = `${sohbetId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${guvenli}`

  let boyut = asset.size ?? asset.fileSize ?? null
  if (boyut == null) {
    try { const bilgi = await FileSystem.getInfoAsync(asset.uri); if (bilgi.exists) boyut = bilgi.size ?? null } catch {}
  }
  if (boyut && boyut > DOSYA_LIMIT) return { __error: 'Dosya 25 MB\'dan büyük olamaz' }

  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = base64ToArrayBuffer(base64)
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return { __error: 'Boş dosya' }

    const { error } = await supabase.storage
      .from(SOHBET_BUCKET)
      .upload(yol, arrayBuffer, { contentType, upsert: false })
    if (error) return { __error: error.message }

    return { yol, ad, contentType, boyut: boyut ?? arrayBuffer.byteLength }
  } catch (e) {
    return { __error: e.message }
  }
}

export const sohbetDosyaUrl = async (yol, saniye = 3600) => {
  const { data, error } = await supabase.storage.from(SOHBET_BUCKET).createSignedUrl(yol, saniye)
  if (error) { console.error('sohbetDosyaUrl hata:', error.message); return { __error: error.message } }
  return { url: data.signedUrl }
}

export const sohbetDosyaSil = async (yol) => {
  if (!yol) return { ok: true }
  const { error } = await supabase.storage.from(SOHBET_BUCKET).remove([yol])
  if (error) { console.error('sohbetDosyaSil hata:', error.message); return { __error: error.message } }
  return { ok: true }
}

// ── Ortak yardımcılar (iki ekran da kullanıyor) ────────────────────────────
export const dosyaMesajiCoz = (icerik) => {
  try {
    const j = JSON.parse(icerik)
    return j?.tip === 'dosya' ? j : null
  } catch { return null }
}

export const onizlemeMetni = (icerik = '') => {
  const d = dosyaMesajiCoz(icerik)
  if (d) return `📎 ${d.dosyaAdi || 'Dosya'}`
  return icerik
}
