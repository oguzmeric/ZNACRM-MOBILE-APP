// Servis formu PDF arşivi: Supabase Storage + DB tablo entegrasyonu.

import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '../lib/supabase'

const BUCKET = 'servis-formlari'

// PDF'i storage'a yükle ve arşiv tablosuna kayıt at.
// Best-effort: hata durumunda null döndürür, ana akışı bozmaz.
export async function arsiveYukle({ servisId, lokalPdfUri, olusturanId }) {
  try {
    if (!servisId || !lokalPdfUri) return null

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const dosyaYolu = `servis_${servisId}/${ts}.pdf`

    const base64 = await FileSystem.readAsStringAsync(lokalPdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const arrayBuffer = decodeBase64ToArrayBuffer(base64)

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(dosyaYolu, arrayBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      console.warn('[arsiveYukle] upload fail:', uploadErr.message)
      return null
    }

    let boyut = null
    try {
      const info = await FileSystem.getInfoAsync(lokalPdfUri)
      if (info.exists) boyut = info.size ?? null
    } catch {}

    const { data, error } = await supabase
      .from('servis_formu_arsivi')
      .insert({
        servis_id: servisId,
        dosya_yolu: dosyaYolu,
        olusturan_id: olusturanId ?? null,
        boyut_byte: boyut,
      })
      .select('id, dosya_yolu')
      .single()

    if (error) {
      console.warn('[arsiveYukle] insert fail:', error.message)
      return null
    }
    return { id: data.id, dosyaYolu: data.dosya_yolu }
  } catch (e) {
    console.warn('[arsiveYukle] catch:', e?.message)
    return null
  }
}

// Bir servisin arşivlenmiş tüm formlarını listele (yeni → eski).
export async function arsivListele(servisId) {
  if (!servisId) return []
  const { data, error } = await supabase
    .from('servis_formu_arsivi')
    .select(`
      id,
      dosya_yolu,
      boyut_byte,
      olusturma_tarih,
      olusturan_id,
      kullanicilar:olusturan_id (ad, soyad)
    `)
    .eq('servis_id', servisId)
    .order('olusturma_tarih', { ascending: false })

  if (error) {
    console.warn('[arsivListele] fail:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    dosyaYolu: r.dosya_yolu,
    boyut: r.boyut_byte,
    olusturmaTarih: r.olusturma_tarih,
    olusturanAd: r.kullanicilar
      ? `${r.kullanicilar.ad ?? ''} ${r.kullanicilar.soyad ?? ''}`.trim()
      : '',
  }))
}

// Signed URL al (1 saat geçerli) — indirme/paylaşma için.
export async function arsivSignedUrl(dosyaYolu) {
  if (!dosyaYolu) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(dosyaYolu, 3600)
  if (error) {
    console.warn('[arsivSignedUrl] fail:', error.message)
    return null
  }
  return data.signedUrl
}

// base64 → ArrayBuffer helper (RN'de Buffer yok, atob fallback)
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
