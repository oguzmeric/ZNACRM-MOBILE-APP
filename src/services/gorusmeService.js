import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

// Görüşme dosyaları — web ile BİREBİR aynı sözleşme:
//  • bucket: 'gorusme-dosyalari' (PRIVATE, RLS is_staff)
//  • kolon:  gorusmeler.dosyalar (jsonb dizi)
//  • path:   `${gorusmeId}/${Date.now()}_${safeName}`  (web ile aynı, prefix YOK)
//  • nesne:  { path, name, type, size, uploadedAt, uploaderAd }
const GORUSME_BUCKET = 'gorusme-dosyalari'

// base64 → ArrayBuffer (RN'de Buffer/atob; private bucket'a SDK upload için)
function base64ToArrayBuffer(base64) {
  const binaryString =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary')
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}

// Uzantıdan MIME tahmini (picker mimeType vermezse)
function mimeTahmin(ad, verilen) {
  if (verilen) return verilen
  const ext = (ad.split('.').pop() || '').toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

// Tek dosyayı storage'a yükle → web ile aynı meta nesnesini döndür (uploaderAd hariç)
async function birGorusmeDosyasiYukle(gorusmeId, asset) {
  const ad = asset.name || asset.fileName || (asset.uri || '').split('/').pop() || `dosya_${Date.now()}`
  const safeName = ad.replace(/[^\w.\-]/g, '_')
  const path = `${gorusmeId}/${Date.now()}_${safeName}`
  const contentType = mimeTahmin(ad, asset.type || asset.mimeType)

  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
  const arrayBuffer = base64ToArrayBuffer(base64)
  if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error(`${ad}: boş dosya`)

  const { error } = await supabase.storage
    .from(GORUSME_BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false })
  if (error) throw new Error(`${ad}: ${error.message}`)

  let size = asset.size ?? asset.fileSize ?? null
  if (size == null) {
    try { const info = await FileSystem.getInfoAsync(asset.uri); if (info.exists) size = info.size ?? null } catch {}
  }
  return { path, name: ad, type: contentType, size, uploadedAt: new Date().toISOString() }
}

// Görüşmeye dosya(lar) ekle. assets: [{ uri, name?, type?/mimeType?, size?/fileSize? }]
// Storage'a yükler, sonra gorusmeler.dosyalar kolonunu oku-append-yaz (edit modda da güvenli).
// Dönüş: { basarili: meta[], hatalar: string[] }
export const gorusmeDosyalariEkle = async (gorusmeId, assets, uploaderAd = null) => {
  if (!gorusmeId || !assets?.length) return { basarili: [], hatalar: [] }
  const basarili = []
  const hatalar = []
  for (const a of assets) {
    try {
      const meta = await birGorusmeDosyasiYukle(gorusmeId, a)
      meta.uploaderAd = uploaderAd ?? null
      basarili.push(meta)
    } catch (e) {
      console.warn('[gorusmeDosyalariEkle]', e?.message)
      hatalar.push(e?.message || 'Yükleme hatası')
    }
  }
  if (basarili.length) {
    const { data: mevcut } = await supabase
      .from('gorusmeler').select('dosyalar').eq('id', gorusmeId).single()
    const yeniDizi = [...(mevcut?.dosyalar ?? []), ...basarili]
    const { error } = await supabase
      .from('gorusmeler').update({ dosyalar: yeniDizi }).eq('id', gorusmeId)
    if (error) { console.warn('[gorusmeDosyalariEkle] kolon yaz:', error.message); hatalar.push(`Kayıt: ${error.message}`) }
  }
  return { basarili, hatalar }
}

// Görüntüleme/indirme için signed URL (private bucket) — web createSignedUrl ile aynı
export const gorusmeDosyaLinkiAl = async (path, saniye = 3600) => {
  if (!path) return null
  const { data, error } = await supabase.storage.from(GORUSME_BUCKET).createSignedUrl(path, saniye)
  if (error) { console.warn('[gorusmeDosyaLinkiAl]', error.message); return null }
  return data?.signedUrl ?? null
}

// Sayfalı görüşme listesi (mobile için infinite scroll)
// benimAd verildiğinde: hazirlayan === benimAd VEYA gorusen içinde benimAd var
export const gorusmeleriGetir = async ({ baslangic = 0, limit = 30, hazirlayan = null, benimAd = null, q = null } = {}) => {
  let query = supabase
    .from('gorusmeler')
    .select('*')
    .order('olusturma_tarih', { ascending: false })

  if (benimAd) {
    // OR: kullanıcı ya hazırlayan ya da görüşen içinde olsun
    query = query.or(`hazirlayan.eq.${benimAd},gorusen.ilike.%${benimAd}%`)
  } else if (hazirlayan) {
    query = query.eq('hazirlayan', hazirlayan)
  }
  if (q && q.trim()) {
    const aranan = `%${q.trim()}%`
    query = query.or(`firma_adi.ilike.${aranan},musteri_adi.ilike.${aranan},konu.ilike.${aranan},notlar.ilike.${aranan}`)
  }

  const { data, error } = await query.range(baslangic, baslangic + limit - 1)
  if (error) {
    console.warn('[gorusme] liste hatası:', error.message)
    return []
  }
  return arrayToCamel(data ?? [])
}

export const gorusmeGetir = async (id) => {
  const { data, error } = await supabase.from('gorusmeler').select('*').eq('id', id).single()
  if (error) {
    console.warn('[gorusme] tek getir hatası:', error.message)
    return null
  }
  return toCamel(data)
}

export const gorusmeEkle = async (gorusme) => {
  const { id, olusturmaTarih, ...rest } = gorusme
  const { data, error } = await supabase
    .from('gorusmeler')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('[gorusme] ekle hatası:', error.message)
    return null
  }
  return toCamel(data)
}

export const gorusmeGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('gorusmeler')
    .update(toSnake(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[gorusme] guncelle hatası:', error.message)
    return null
  }
  return toCamel(data)
}
