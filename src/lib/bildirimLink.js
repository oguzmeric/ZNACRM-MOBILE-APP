// Bildirim linki (web yolu, örn. /gorevler/123) → mobil ekran eşlemesi.
// Hem uygulama içi bildirim listesi (BildirimlerScreen) hem push'a dokunma
// (App.js) aynı çözümleyiciyi kullanır — yeni modül eklerken yalnız burayı
// güncelle. Karşılığı olmayan link null döner (uygulama olduğu yerde kalır).
export function bildirimLinkHedefi(link, kullanici) {
  if (!link) return null
  const parcalar = String(link).split('?')[0].split('/').filter(Boolean)
  const kok = parcalar[0]
  const id = parcalar[1] ? parseInt(parcalar[1], 10) : null

  switch (kok) {
    case 'gorevler':
      return id ? ['GörevDetay', { id }] : ['Görevler']
    case 'servis-talepleri':
      return id ? ['ServisDetay', { id }] : null
    case 'gorusmeler':
      return id ? ['GorusmeDetay', { id }] : null
    case 'teklifler':
      return id ? ['TeklifDetay', { id }] : null
    case 'destek':
      // Yanıtlayıcı (Oğuz, id 2) gelen talepler ekranına, talep sahibi kendi listesine
      return Number(kullanici?.id) === 2 ? ['AdminDestekTalepleri'] : ['DestekListe']
    case 'musteriler':
      return id ? ['MüşteriDetay', { id }] : ['Müşteriler']
    default:
      return null
  }
}
