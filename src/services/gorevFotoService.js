import { supabase } from '../lib/supabase'

const BUCKET = 'urun-gorselleri'
const KLASOR = 'gorev-fotolar'

// Local URI'yi Supabase Storage'a yükle, public URL dön.
export const gorevFotosuYukle = async (gorevId, uri) => {
  try {
    const uzanti = (uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
    const mimeType = uzanti === 'png' ? 'image/png' : 'image/jpeg'
    const dosyaAdi = `${KLASOR}/${gorevId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`

    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

    const formData = new FormData()
    formData.append('file', {
      uri,
      name: dosyaAdi.split('/').pop(),
      type: mimeType,
    })

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${dosyaAdi}`
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'x-upsert': 'true',
      },
      body: formData,
    })

    if (!resp.ok) {
      const metin = await resp.text()
      console.error('Görev foto yükleme hatası:', resp.status, metin)
      return { ok: false, hata: `Upload ${resp.status}: ${metin}` }
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${dosyaAdi}`
    return { ok: true, url: publicUrl }
  } catch (e) {
    console.error('gorevFotosuYukle hata:', e)
    return { ok: false, hata: e?.message ?? 'Bilinmeyen hata' }
  }
}

// Public URL'den dosya yolunu çıkar, storage'dan sil
export const gorevFotosuSil = async (publicUrl) => {
  try {
    const marker = `/public/${BUCKET}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return { ok: false, hata: 'URL parse edilemedi' }
    const yol = publicUrl.substring(idx + marker.length)
    const { error } = await supabase.storage.from(BUCKET).remove([yol])
    if (error) {
      console.warn('Storage sil hata (görmezden gelinebilir):', error.message)
    }
    return { ok: true }
  } catch (e) {
    console.error('gorevFotosuSil hata:', e)
    return { ok: false, hata: e?.message ?? 'Bilinmeyen hata' }
  }
}
