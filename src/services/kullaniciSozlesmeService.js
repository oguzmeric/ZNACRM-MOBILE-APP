// Kullanıcı Sözleşmesi — metin + zorunlu onay (mig 264/265).
// Web'deki crm-app/src/services/kullaniciSozlesmeService.js ile aynı sözleşme;
// METİN ORTAK KAYNAKTAN (DB) gelir, iki projede iki kopya yoktur.

import { supabase } from '../lib/supabase'

export const aktifSozlesmeGetir = async () => {
  const { data, error } = await supabase
    .from('sozlesme_metinleri')
    .select('id, versiyon, baslik, icerik, yururluk_tarihi')
    .eq('aktif', true)
    .maybeSingle()
  if (error) { console.warn('[sozlesme] metin:', error.message); return null }
  return data
}

/**
 * Onay gerekli mi? → { gerekli, versiyon, baslik, onay_tarihi }
 * Personel dışı kullanıcılar için gerekli=false (kapsam kapısı sunucuda).
 * ⚠️ Hata durumunda gerekli=false: bağlantı sorunu yüzünden teknisyen
 * sahada uygulamadan kilitlenmesin.
 */
export const sozlesmeDurumum = async () => {
  const { data, error } = await supabase.rpc('sozlesme_durumum')
  if (error) {
    console.warn('[sozlesme] durum:', error.message)
    return { gerekli: false, hata: error.message }
  }
  return data || { gerekli: false }
}

export const sozlesmeOnayla = async (versiyon, cihaz) => {
  const { data, error } = await supabase.rpc('sozlesme_onayla', {
    p_versiyon: versiyon,
    p_kaynak: 'mobil',
    p_cihaz: cihaz || null,
  })
  if (error) { console.error('[sozlesme] onay:', error.message); return { ok: false, hata: error.message } }
  return data
}

// Metin biçimlendirme saf modülde: src/lib/markdownBloklar.js
// (bağımlılıksız → sözleşme metniyle testten geçirilebiliyor)
