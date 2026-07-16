// Genel ek yükleyici — foto VEYA belge (PDF/Excel/Word...). Görev ekleri,
// görev not ekleri ve benzeri her yerde kullanılır. FormData + OTURUM JWT
// (ANON bearer RLS'e takılır — bkz. storageAuth). Public bucket.
// Dönen nesne web EkListesi ile aynı: { url, name, type, size }

import { oturumTokenAl } from '../lib/storageAuth'

const BUCKET = 'urun-gorselleri'

const mimeTahmin = (ad) => {
  const ext = (String(ad).split('.').pop() || '').toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic',
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

// asset: { uri, name?, mimeType?/type?, size? } veya düz uri string
export const ekYukle = async (klasor, asset) => {
  const a = typeof asset === 'string' ? { uri: asset } : asset
  const ad = a.name || `foto_${Date.now()}.${(a.uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()}`
  const mimeType = a.mimeType || a.type || mimeTahmin(ad)
  const safe = ad.replace(/[^\w.\-]/g, '_')
  const yol = `${klasor}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${safe}`

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const token = await oturumTokenAl()

  const formData = new FormData()
  formData.append('file', { uri: a.uri, name: safe, type: mimeType })

  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${yol}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
    body: formData,
  })
  if (!resp.ok) {
    const metin = await resp.text()
    throw new Error(`Yükleme ${resp.status}: ${metin.slice(0, 100)}`)
  }
  return {
    url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${yol}`,
    name: ad,
    type: mimeType,
    size: a.size ?? null,
  }
}
