import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as MailComposer from 'expo-mail-composer'
import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'
import { servisFormuHtml } from '../templates/servisFormuHtml'
import { malzemePlaniGetir } from './servisMalzemeService'

let logoBase64Cache = null

async function logoBase64Getir() {
  if (logoBase64Cache) return logoBase64Cache
  try {
    const asset = Asset.fromModule(require('../../assets/logo.jpeg'))
    await asset.downloadAsync()
    const uri = asset.localUri ?? asset.uri
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    logoBase64Cache = `data:image/jpeg;base64,${b64}`
    return logoBase64Cache
  } catch (e) {
    console.warn('logo yüklenemedi:', e.message)
    return null
  }
}

// Planda olan ve hareket görmüş malzemeleri filtrele
function malzemeleriFiltrele(liste) {
  return (liste ?? []).filter((m) => {
    const p = Number(m.planliMiktar ?? 0)
    const t = Number(m.teslimAlinanMiktar ?? 0)
    const k = Number(m.kullanilanMiktar ?? 0)
    return p > 0 || t > 0 || k > 0
  })
}

// Önizleme için HTML stringini döndür (WebView'de göstermek üzere)
export async function onizlemeHtmlGetir(talep) {
  const malzemelerRaw = await malzemePlaniGetir(talep.id)
  const liste = malzemeleriFiltrele(malzemelerRaw)
  const logoBase64 = await logoBase64Getir()
  return servisFormuHtml({ talep, malzemeler: liste, logoBase64 })
}

// Native print önizlemesini aç (yazıcıya gönder veya PDF olarak kaydet)
export async function pdfOnizle(talep) {
  const liste = malzemeleriFiltrele(await malzemePlaniGetir(talep.id))
  const logoBase64 = await logoBase64Getir()
  const html = servisFormuHtml({ talep, malzemeler: liste, logoBase64 })
  await Print.printAsync({ html })
}

// PDF dosyası üretir, local URI döner
export async function pdfOlustur(talep) {
  const liste = malzemeleriFiltrele(await malzemePlaniGetir(talep.id))
  const logoBase64 = await logoBase64Getir()
  const html = servisFormuHtml({ talep, malzemeler: liste, logoBase64 })

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  })

  // Anlamlı isim — dosyayı kopyala
  const yeniAd = `ServisFormu_${(talep.talepNo ?? 'TLP-' + talep.id).replace(/[^\w-]/g, '_')}.pdf`
  const hedef = `${FileSystem.cacheDirectory}${yeniAd}`
  try {
    await FileSystem.copyAsync({ from: uri, to: hedef })
    return hedef
  } catch {
    return uri
  }
}

// Sistem paylaşım menüsünü aç (WhatsApp, Drive, Files, Mail vb.)
export async function paylasPdf(uri) {
  const erisim = await Sharing.isAvailableAsync()
  if (!erisim) {
    throw new Error('Cihazda paylaşım özelliği yok.')
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Servis Formunu Paylaş',
    UTI: 'com.adobe.pdf',
  })
}

// Varsayılan e-posta uygulamasında taslak oluştur (ek dahil)
export async function emailGonder(uri, { to = [], subject, body } = {}) {
  const erisim = await MailComposer.isAvailableAsync()
  if (!erisim) {
    // Fallback → paylaşım menüsü
    await paylasPdf(uri)
    return { ok: true, fallback: true }
  }
  const sonuc = await MailComposer.composeAsync({
    recipients: Array.isArray(to) ? to : [to].filter(Boolean),
    subject: subject ?? 'Servis Formu',
    body: body ?? 'Servis formu ektedir.',
    attachments: [uri],
  })
  return { ok: sonuc.status !== 'cancelled', status: sonuc.status }
}
