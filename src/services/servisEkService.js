import { supabase } from '../lib/supabase'

const BUCKET = 'urun-gorselleri'
const KLASOR = 'servis-ekler'

// Local URI'yi Supabase Storage'a yükle, public URL dön.
export const servisEkiYukle = async (talepNoVeyaId, uri) => {
  try {
    const uzanti = (uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
    const mimeType =
      uzanti === 'png' ? 'image/png' :
      uzanti === 'pdf' ? 'application/pdf' :
      'image/jpeg'
    const dosyaAdi = `${KLASOR}/${talepNoVeyaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`

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
      console.error('Servis ek yükleme hatası:', resp.status, metin)
      return { ok: false, hata: `Upload ${resp.status}: ${metin}` }
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${dosyaAdi}`
    return { ok: true, url: publicUrl, uzanti }
  } catch (e) {
    console.error('servisEkiYukle hata:', e)
    return { ok: false, hata: e?.message ?? 'Bilinmeyen hata' }
  }
}
