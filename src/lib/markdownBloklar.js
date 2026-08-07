// Markdown → YERLİ render blokları (saf fonksiyon, bağımlılıksız → test edilebilir).
//
// ⚠️ NEDEN HTML/WEBVIEW DEĞİL (07.08): sözleşme metni WebView'de gösteriliyor
// ve "metnin sonuna inildi" bilgisi WebView'in JS köprüsünden (postMessage)
// geliyordu. O köprü sessizce çalışmazsa onay kutusu HİÇ etkinleşmez ve
// personel uygulamaya giremez — aynı gün imza tuvalinde yaşanan kırılmanın
// (bkz. reference_imza_tuvali_skia) daha ağır hâli: 21 kişilik saha ekibinin
// tamamı kilitlenirdi. Artık metin yerli <Text> ile çizilir, sona gelme
// ScrollView'in kendi ölçümünden okunur; köprü yok, kırılma noktası yok.
//
// Dönüş: [{ tip, seviye?, parcalar? }]
//   tip: 'baslik' | 'paragraf' | 'madde' | 'ayrac'
//   parcalar: [{ metin, kalin?, kod? }]

export const markdownToBloklar = (md = '') => {
  const bloklar = []

  for (const ham of String(md).split(/\r?\n/)) {
    const s = ham.trimEnd()
    if (!s.trim()) continue

    if (/^---+$/.test(s.trim())) { bloklar.push({ tip: 'ayrac' }); continue }

    const baslik = s.match(/^(#{1,4})\s+(.*)$/)
    if (baslik) {
      bloklar.push({ tip: 'baslik', seviye: baslik[1].length, parcalar: satirIciParcala(baslik[2]) })
      continue
    }

    const madde = s.match(/^\s*[-*]\s+(.*)$/)
    if (madde) {
      bloklar.push({ tip: 'madde', parcalar: satirIciParcala(madde[1]) })
      continue
    }

    bloklar.push({ tip: 'paragraf', parcalar: satirIciParcala(s) })
  }

  return bloklar
}

// **kalın** ve `kod` → biçim parçaları
export const satirIciParcala = (s = '') => {
  const parcalar = []
  const re = /\*\*(.+?)\*\*|`(.+?)`/g
  let son = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > son) parcalar.push({ metin: s.slice(son, m.index) })
    if (m[1] !== undefined) parcalar.push({ metin: m[1], kalin: true })
    else parcalar.push({ metin: m[2], kod: true })
    son = m.index + m[0].length
  }
  if (son < s.length) parcalar.push({ metin: s.slice(son) })
  return parcalar.length ? parcalar : [{ metin: s }]
}
