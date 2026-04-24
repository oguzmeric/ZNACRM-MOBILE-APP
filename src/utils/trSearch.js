// Türkçe farkındalıklı arama normalizasyonu
// Büyük/küçük harf ve aksanlı karakterler tamamen fark etmez
// Hermes engine'de toLocaleLowerCase('tr-TR') güvenilmez olduğu için
// explicit mapping yapıyoruz — hangi platformda olursa olsun tutarlı.

const HARF_MAP = {
  // Türkçe büyük → ascii küçük
  'İ': 'i', 'I': 'i',
  'Ş': 's', 'Ğ': 'g', 'Ü': 'u', 'Ö': 'o', 'Ç': 'c',
  // Türkçe küçük → ascii
  'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c',
  // Diğer aksanlılar (yaygınları)
  'â': 'a', 'Â': 'a',
  'î': 'i', 'Î': 'i',
  'û': 'u', 'Û': 'u',
  'é': 'e', 'É': 'e',
  'è': 'e', 'È': 'e',
}

export function trNormalize(s) {
  if (s == null) return ''
  const str = String(s)
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (HARF_MAP[ch] !== undefined) {
      result += HARF_MAP[ch]
    } else {
      result += ch.toLowerCase()
    }
  }
  return result.trim()
}

// Çoklu alan içinde arama — herhangi birinde eşleşirse true
export function trIcerir(alanlar, q) {
  if (!q) return true
  const aranan = trNormalize(q)
  if (!aranan) return true
  return alanlar
    .filter(Boolean)
    .some((alan) => trNormalize(alan).includes(aranan))
}
