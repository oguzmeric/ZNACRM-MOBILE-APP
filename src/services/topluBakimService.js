// Toplu Bakım — mobil servis katmanı (teknik personel tarafı).
// Teknik personel: müşteri/lokasyon DEĞİŞTİREMEZ, kalem EKLEYEMEZ/SİLEMEZ,
// yeni iş OLUŞTURAMAZ (spec madde 6) — burada yalnız okuma + saha akışı +
// kalem cevap/sonuç yazma fonksiyonları var.

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'
import { oturumTokenAl } from '../lib/storageAuth'

// Bakım fotoğrafı yükle — gorevFotoService ile aynı desen (public bucket +
// personel JWT + FormData). URL'ler kalemin cevaplar.fotolar dizisinde tutulur.
const FOTO_BUCKET = 'urun-gorselleri'
const FOTO_KLASOR = 'bakim-fotolar'

export const bakimFotoYukle = async (altNo, uri) => {
  try {
    const uzanti = (uri.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
    const mimeType = uzanti === 'png' ? 'image/png' : 'image/jpeg'
    const dosyaAdi = `${FOTO_KLASOR}/${altNo || 'tb'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`
    const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    const token = await oturumTokenAl()

    const formData = new FormData()
    formData.append('file', { uri, name: dosyaAdi.split('/').pop(), type: mimeType })

    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${FOTO_BUCKET}/${dosyaAdi}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      body: formData,
    })
    if (!resp.ok) {
      console.error('[bakim] foto yukleme:', resp.status, await resp.text())
      return null
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${FOTO_BUCKET}/${dosyaAdi}`
  } catch (e) {
    console.error('[bakim] foto yukleme:', e?.message)
    return null
  }
}

// Bana atanan işler: ana görevli VEYA yardımcı ekipte (spec 22).
export const bakimIslerimGetir = async (kullaniciId) => {
  if (!kullaniciId) return []
  const kid = Number(kullaniciId)
  const { data, error } = await supabase
    .from('toplu_bakimlar')
    .select(`
      id, tb_no, musteri_id, lokasyon_adi, lokasyon_adres, bakim_donemi,
      planlanan_tarih, planlanan_saat, durum, oncelik, aciklama,
      teknik_personel_id, ekip_ids,
      musteriler ( firma ),
      toplu_bakim_kalemleri ( id, kalem_tip, durum, ariza_var )
    `)
    .or(`teknik_personel_id.eq.${kid},ekip_ids.cs.{${kid}}`)
    .order('planlanan_tarih', { ascending: true })
  if (error) { console.error('[bakim] islerim:', error.message); return [] }
  return (data || []).map((r) => ({
    ...toCamel(r),
    musteriFirma: r.musteriler?.firma ?? null,
    kalemler: arrayToCamel(r.toplu_bakim_kalemleri || []),
  }))
}

export const bakimGetir = async (id) => {
  const { data, error } = await supabase
    .from('toplu_bakimlar')
    .select('*, musteriler ( firma ), toplu_bakim_kalemleri ( * )')
    .eq('id', id)
    .single()
  if (error) { console.error('[bakim] detay:', error.message); return null }
  return {
    ...toCamel(data),
    musteriFirma: data.musteriler?.firma ?? null,
    kalemler: arrayToCamel(data.toplu_bakim_kalemleri || []).sort((a, b) => a.id - b.id),
  }
}

// Saha akış butonları — zaman damgalarını SİSTEM yazar (spec 6).
export const yolaCiktim = (id) =>
  _guncelle(id, { durum: 'yola_cikildi', yolaCikisTarih: new Date().toISOString() })

export const lokasyonaUlastim = (id) =>
  _guncelle(id, { durum: 'lokasyona_ulasildi', ulasmaTarih: new Date().toISOString() })

export const bakimiBaslat = (id) =>
  _guncelle(id, { durum: 'bakim_basladi', baslamaTarih: new Date().toISOString() })

export const durumGuncelle = (id, durum, ekstra = {}) => _guncelle(id, { durum, ...ekstra })

const _guncelle = async (id, patch) => {
  const { data, error } = await supabase
    .from('toplu_bakimlar')
    .update(toSnake(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[bakim] guncelle:', error.message); return null }
  return toCamel(data)
}

// Kalem cevap/sonuç kaydı. Cevaplar jsonb'de birikir — sekmeler arası geçişte
// kaybolmaz (spec 7). durum: devam_ediyor | tamamlandi | ariza_tespit | yapilamadi
export const kalemKaydet = async (kalemId, patch) => {
  const { data, error } = await supabase
    .from('toplu_bakim_kalemleri')
    .update(toSnake(patch))
    .eq('id', kalemId)
    .select()
    .single()
  if (error) { console.error('[bakim] kalem:', error.message); return null }
  return toCamel(data)
}
