// Kullanıcının kişisel notları + opsiyonel müşteri bağlantısı + çizim ekleri.
// Mobile için. Web tarafında da paralel bir notService var.

import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'

export const KATEGORILER = [
  { id: 'kesif',     isim: 'Keşif',         renk: '#0ea5e9', ikon: 'map' },
  { id: 'toplanti',  isim: 'Toplantı Notu', renk: '#a855f7', ikon: 'users' },
  { id: 'fikir',     isim: 'Fikir',         renk: '#f59e0b', ikon: 'zap' },
  { id: 'diger',     isim: 'Diğer',         renk: '#64748b', ikon: 'file-text' },
]

const BUCKET = 'not-cizimleri'

// DB → JS mapper (snake_case → camelCase)
function map(row) {
  if (!row) return null
  return {
    id: row.id,
    kullaniciId: row.kullanici_id,
    baslik: row.baslik || '',
    icerik: row.icerik || '',
    kategori: row.kategori || 'diger',
    musteriId: row.musteri_id,
    cizimler: row.cizimler || [],
    olusturmaTarih: row.olusturma_tarih,
    guncellemeTarih: row.guncelleme_tarih,
    musteri: row.musteriler ?? null,
  }
}

export async function notlarimiGetir(kullaniciId) {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('notlarim')
    .select('*, musteriler:musteri_id (id, firma, ad, soyad)')
    .eq('kullanici_id', kullaniciId)
    .order('olusturma_tarih', { ascending: false })
  if (error) {
    console.warn('[notlarimiGetir]', error.message)
    return []
  }
  return (data ?? []).map(map)
}

export async function notuGetir(id) {
  const { data, error } = await supabase
    .from('notlarim')
    .select('*, musteriler:musteri_id (id, firma, ad, soyad)')
    .eq('id', id)
    .single()
  if (error) {
    console.warn('[notuGetir]', error.message)
    return null
  }
  return map(data)
}

export async function notEkle(kullaniciId, payload) {
  const { data, error } = await supabase
    .from('notlarim')
    .insert({
      kullanici_id: kullaniciId,
      baslik: payload.baslik || null,
      icerik: payload.icerik || null,
      kategori: payload.kategori || 'diger',
      musteri_id: payload.musteriId || null,
      cizimler: payload.cizimler || [],
    })
    .select()
    .single()
  if (error) {
    console.warn('[notEkle]', error.message)
    return null
  }
  return map(data)
}

export async function notGuncelle(id, payload) {
  const { data, error } = await supabase
    .from('notlarim')
    .update({
      baslik: payload.baslik ?? null,
      icerik: payload.icerik ?? null,
      kategori: payload.kategori || 'diger',
      musteri_id: payload.musteriId || null,
      cizimler: payload.cizimler ?? [],
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.warn('[notGuncelle]', error.message)
    return null
  }
  return map(data)
}

export async function notSil(id) {
  // Önce çizimleri storage'dan sil
  const not = await notuGetir(id)
  if (Array.isArray(not?.cizimler)) {
    const paths = not.cizimler.map((c) => c.path).filter(Boolean)
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
    }
  }
  const { error } = await supabase.from('notlarim').delete().eq('id', id)
  if (error) throw error
}

// PNG dosyasını Storage'a yükle, path döndür
export async function cizimYukle(lokalUri, kullaniciId, notId) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const path = `kullanici_${kullaniciId}/not_${notId ?? 'taslak'}/${ts}.png`

    const base64 = await FileSystem.readAsStringAsync(lokalUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const arrayBuffer = decodeBase64ToArrayBuffer(base64)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/png', upsert: false })

    if (error) {
      console.warn('[cizimYukle]', error.message)
      return null
    }
    return { path, eklenmeTarih: new Date().toISOString() }
  } catch (e) {
    console.warn('[cizimYukle catch]', e?.message)
    return null
  }
}

// Bir çizim için signed URL (1 saat)
export async function cizimSignedUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}

export async function cizimSil(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
}

// base64 → ArrayBuffer
function decodeBase64ToArrayBuffer(base64) {
  const binaryString =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary')
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
  return bytes.buffer
}
