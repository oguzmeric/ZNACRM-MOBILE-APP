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

// talep.dosyalar içindeki görselleri base64 data-URI'ye çevir.
// expo-print uzak (http) görselleri beklemeden render ettiği için
// PDF'te boş çıkarlar — bu yüzden logo gibi base64'e gömüyoruz.
async function gorselleriBase64Getir(dosyalar) {
  const gorseller = (dosyalar ?? []).filter((d) => {
    if (d?.tip === 'image') return true
    return /\.(jpe?g|png|webp)(\?|$)/i.test(d?.url ?? '')
  })
  const sonuc = []
  for (let i = 0; i < gorseller.length; i++) {
    const d = gorseller[i]
    try {
      const uzanti = (d.url.match(/\.(\w+)(?:\?|$)/)?.[1] || 'jpg').toLowerCase()
      const mime = uzanti === 'png' ? 'image/png' : uzanti === 'webp' ? 'image/webp' : 'image/jpeg'
      const hedef = `${FileSystem.cacheDirectory}form-foto-${i}-${Date.now()}.${uzanti}`
      const { uri } = await FileSystem.downloadAsync(d.url, hedef)
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      sonuc.push({
        dataUri: `data:${mime};base64,${b64}`,
        ad: d.ad ?? null,
        ekleyen: d.ekleyen ?? null,
        eklenme: d.eklenme ?? null,
      })
    } catch (e) {
      console.warn('form fotoğrafı yüklenemedi:', e?.message)
    }
  }
  return sonuc
}

// Form HTML'ini üretmek için ortak hazırlık — malzeme + logo + fotoğraflar
async function formHtmlOlustur(talep) {
  const liste = malzemeleriFiltrele(await malzemePlaniGetir(talep.id))
  const logoBase64 = await logoBase64Getir()
  const fotograflar = await gorselleriBase64Getir(talep.dosyalar)
  return servisFormuHtml({ talep, malzemeler: liste, logoBase64, fotograflar })
}

// Sadece GERÇEKTEN teslim alınmış / kullanılmış malzemeleri forma dahil et.
// Pure "planlı ama hiç teslim alınmadı" satırlar formdan çıkar — kullanıcı
// teslim almadan kapattıysa, plan kaydı serbest plan olarak DB'de kalır
// ama servis formunda görünmez (S/N yok = kabul yok).
function malzemeleriFiltrele(liste) {
  return (liste ?? []).filter((m) => {
    const t = Number(m.teslimAlinanMiktar ?? 0)
    const k = Number(m.kullanilanMiktar ?? 0)
    return t > 0 || k > 0
  })
}

// Önizleme için HTML stringini döndür (WebView'de göstermek üzere)
export async function onizlemeHtmlGetir(talep) {
  return formHtmlOlustur(talep)
}

// A4: 595 × 842 pt (≈ 210 × 297 mm). Default Letter (612x792) yanlış kenarlık verir.
const A4_BOYUT = { width: 595, height: 842 }

// Native print önizlemesini aç (yazıcıya gönder veya PDF olarak kaydet)
export async function pdfOnizle(talep) {
  const html = await formHtmlOlustur(talep)
  await Print.printAsync({ html, ...A4_BOYUT })
}

// PDF dosyası üretir, local URI döner
export async function pdfOlustur(talep) {
  const html = await formHtmlOlustur(talep)

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    ...A4_BOYUT,
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
