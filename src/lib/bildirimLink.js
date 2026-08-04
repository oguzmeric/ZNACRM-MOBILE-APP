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
    // Sohbet mesajı push'u (mig 245): /sohbet/kisi/<gondericiId>
    //                                 /sohbet/grup/<sohbetId>
    // id 2. konumda olduğu için yukarıdaki genel `id` ayrıştırması işe yaramaz.
    case 'sohbet': {
      const alt = parcalar[1]
      const sohbetId = parcalar[2] ? parseInt(parcalar[2], 10) : null
      // 'Sohbet' = sekmedeki LİSTE, 'SohbetDetay' = tek sohbet ekranı
      if (!sohbetId) return ['Sohbet']
      return alt === 'grup'
        ? ['SohbetDetay', { tip: 'grup', sohbetId }]
        : ['SohbetDetay', { tip: 'kisi', kisiId: sohbetId }]
    }
    case 'gorevler':
      return id ? ['GörevDetay', { id }] : ['Görevler']
    case 'servis-talepleri':
      return id ? ['ServisDetay', { id }] : null
    // Bakım atama bildirimi (mig 253): /bakim-isleri/<id>
    // Web'de detay sayfası, mobilde teknisyenin bakımı doldurduğu ekran.
    case 'bakim-isleri':
      return id ? ['BakimYap', { id }] : ['BakimIslerim']
    case 'gorusmeler':
      return id ? ['GorusmeDetay', { id }] : null
    case 'teklifler':
      return id ? ['TeklifDetay', { id }] : null
    case 'destek':
      // Yanıtlayıcı (Oğuz, id 2) gelen talepler ekranına, talep sahibi kendi listesine
      return Number(kullanici?.id) === 2 ? ['AdminDestekTalepleri'] : ['DestekListe']
    case 'musteriler':
      return id ? ['MüşteriDetay', { id }] : ['Müşteriler']
    // Kullanıcı sözleşmesi duyurusu (mig 264/265): bildirimden okunup
    // onaylanabilsin. Onaylamamışsa SozlesmeKapisi zaten çıkar; bu ekran
    // onaylamış kişinin de metni sonradan okuyabilmesi için.
    case 'kullanici-sozlesmesi':
      return ['KullaniciSozlesmesi']
    default:
      return null
  }
}
