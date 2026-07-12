// @mention yardımcıları (mobile) — web src/lib/mention.js ile aynı kontrat.
// Format: @AdSoyad (boşluksuz token) — örn. @FerdiKalkan
import { trNormalize } from '../utils/trSearch'

export const MENTION_REGEX = /@([\p{L}\p{N}_]+)/gu

// "Ferdi Kalkan" → "FerdiKalkan"
export const adToMentionToken = (ad) => {
  if (!ad) return ''
  return String(ad).replace(/\s+/g, '').replace(/[^\p{L}\p{N}_]/gu, '')
}

// Metindeki @mention'ları kullanıcı id'lerine çöz (eşleşmeyen atlanır, tekilleştirilir)
export const parseMentions = (metin, kullanicilar) => {
  if (!metin || !kullanicilar?.length) return []
  const idler = new Set()
  for (const m of metin.matchAll(MENTION_REGEX)) {
    const aranan = trNormalize(m[1])
    const k = kullanicilar.find(u => {
      const token = trNormalize(adToMentionToken(u.ad))
      return token && token === aranan
    })
    if (k) idler.add(k.id)
  }
  return [...idler]
}

// Render için segmentle: [{tip:'text'|'mention', deger, kullanici?}]
export const segmentMetin = (metin, kullanicilar = []) => {
  if (!metin) return []
  const seg = []
  let son = 0
  for (const m of metin.matchAll(MENTION_REGEX)) {
    if (m.index > son) seg.push({ tip: 'text', deger: metin.slice(son, m.index) })
    const aranan = trNormalize(m[1])
    const k = kullanicilar.find(u => trNormalize(adToMentionToken(u.ad)) === aranan)
    seg.push({ tip: 'mention', deger: m[0], kullanici: k || null })
    son = m.index + m[0].length
  }
  if (son < metin.length) seg.push({ tip: 'text', deger: metin.slice(son) })
  return seg
}

// Yazarken aktif @sorgusu: metnin sonunda "@xxx" varsa döndür (yoksa null)
export const aktifMentionSorgusu = (metin) => {
  if (!metin) return null
  const m = metin.match(/@([\p{L}\p{N}_]*)$/u)
  return m ? m[1] : null
}
