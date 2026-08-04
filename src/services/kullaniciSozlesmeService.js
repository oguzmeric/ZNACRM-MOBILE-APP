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

/**
 * Markdown → basit HTML. WebView'de gösterilir.
 * Neden WebView: mobilde markdown kütüphanesi kurulu değil; yeni paket
 * eklemek yerine zaten var olan react-native-webview kullanılıyor
 * (bkz. [[reference_native_modul_ota_tuzagi]] — gereksiz paket eklememe).
 */
export const markdownToHtml = (md = '') => {
  const kacir = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const satirlar = kacir(md).split(/\r?\n/)
  const parcalar = []
  let listeAcik = false

  const listeKapat = () => { if (listeAcik) { parcalar.push('</ul>'); listeAcik = false } }

  for (const ham of satirlar) {
    const s = ham.trimEnd()
    if (!s.trim()) { listeKapat(); continue }

    if (/^---+$/.test(s.trim())) { listeKapat(); parcalar.push('<hr>'); continue }

    const baslik = s.match(/^(#{1,4})\s+(.*)$/)
    if (baslik) {
      listeKapat()
      const seviye = baslik[1].length
      parcalar.push(`<h${seviye}>${satirIci(baslik[2])}</h${seviye}>`)
      continue
    }

    const madde = s.match(/^\s*[-*]\s+(.*)$/)
    if (madde) {
      if (!listeAcik) { parcalar.push('<ul>'); listeAcik = true }
      parcalar.push(`<li>${satirIci(madde[1])}</li>`)
      continue
    }

    listeKapat()
    parcalar.push(`<p>${satirIci(s)}</p>`)
  }
  listeKapat()
  return parcalar.join('\n')
}

// **kalın** ve `kod`
const satirIci = (s) => s
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
