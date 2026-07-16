// Görüşme yorumları (mig 184) — web ile AYNI tablo: gorusme_yorumlari.
// Tek store, tam senkron: mobilde yazılan web'de, web'de yazılan mobilde görünür.
// RLS: staff okur + kendi adına yazar + kendi yorumunu siler; admin hepsi.
// Ekler: [{url,name,type,size}] — public bucket urun-gorselleri/yorum-ekleri
// (web EkListesi ile birebir aynı nesne şekli).

import { supabase } from '../lib/supabase'
import { toCamel } from '../lib/mapper'
import { oturumTokenAl } from '../lib/storageAuth'

const BUCKET = 'urun-gorselleri'
const KLASOR = 'yorum-ekleri'

const yorumBicim = (r) => {
  const c = toCamel(r)
  return {
    id: c.id,
    yazar: c.yazarAd,
    yazarId: c.kullaniciId,
    icerik: c.icerik,
    dosyalar: Array.isArray(c.dosyalar) ? c.dosyalar : [],
    tarih: c.olusturmaTarih ? new Date(c.olusturmaTarih).toLocaleString('tr-TR') : '',
    zaman: c.olusturmaTarih || null,
  }
}

export const gorusmeYorumlariGetir = async (gorusmeId) => {
  const { data, error } = await supabase
    .from('gorusme_yorumlari')
    .select('*')
    .eq('gorusme_id', gorusmeId)
    .order('olusturma_tarih', { ascending: true })
  if (error) { console.warn('[gorusmeYorumlariGetir]', error.message); return [] }
  return (data || []).map(yorumBicim)
}

export const gorusmeYorumEkle = async ({ gorusmeId, kullaniciId, yazarAd, icerik, dosyalar = [] }) => {
  const { data, error } = await supabase
    .from('gorusme_yorumlari')
    .insert({
      gorusme_id: gorusmeId,
      kullanici_id: kullaniciId,
      yazar_ad: yazarAd,
      icerik,
      dosyalar,
    })
    .select()
    .single()
  if (error) { console.error('[gorusmeYorumEkle]', error.message); throw error }
  return yorumBicim(data)
}

export const gorusmeYorumSil = async (id) => {
  const { error } = await supabase.from('gorusme_yorumlari').delete().eq('id', id)
  if (error) { console.error('[gorusmeYorumSil]', error.message); throw error }
}

// Uzantıdan MIME tahmini (picker mimeType vermezse)
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

// Yorum eki yükle — foto VEYA belge (PDF/Excel/Word...). FormData + OTURUM JWT
// (ANON bearer RLS'e takılır). asset: { uri, name?, mimeType?/type?, size? }
// Dönen nesne web ile aynı: { url, name, type, size }
export const yorumEkiYukle = async (asset) => {
  const a = typeof asset === 'string' ? { uri: asset } : asset
  const ad = a.name || `foto_${Date.now()}.${(a.uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()}`
  const mimeType = a.mimeType || a.type || mimeTahmin(ad)
  const safe = ad.replace(/[^\w.\-]/g, '_')
  const yol = `${KLASOR}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${safe}`

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
