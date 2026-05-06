// Teklif PDF üretimi — format seç → HTML üret → expo-print → expo-sharing
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'
import { tumGorselleriYukle } from './teklifHtml/imageUtils'
import { standartHtml } from './teklifHtml/standartHtml'
import { karelHtml } from './teklifHtml/karelHtml'
import { trassirHtml } from './teklifHtml/trassirHtml'

export const TEKLIF_FORMATLARI = [
  { id: 'standart', label: 'Standart', aciklama: 'Tek sayfa, ZNA antetli' },
  { id: 'karel',    label: 'Karel İş Ortağı', aciklama: 'Tek sayfa, Karel rozetli' },
  { id: 'trassir',  label: 'Trassir Sunum',   aciklama: '5 sayfa: kapak + anlatı + fiyat + ortaklar' },
]

const formatHtml = async (format, teklif) => {
  const gorseller = await tumGorselleriYukle()
  switch (format) {
    case 'trassir': return trassirHtml({ teklif, gorseller })
    case 'karel':   return karelHtml({ teklif, gorseller })
    case 'standart':
    default:        return standartHtml({ teklif, gorseller })
  }
}

// PDF üret + paylaş ekranını aç
export const teklifPdfUretVePaylas = async ({ teklif, format }) => {
  try {
    const html = await formatHtml(format, teklif)
    const { uri } = await Print.printToFileAsync({ html, base64: false })

    // Dosya adını anlamlandır: teklif numarası + format
    const teklifNo = (teklif.teklifNo || `teklif-${teklif.id}`).replaceAll('/', '-')
    const yeniAd = `${teklifNo}-${format}.pdf`
    const yeniUri = `${FileSystem.cacheDirectory}${yeniAd}`

    try {
      await FileSystem.deleteAsync(yeniUri, { idempotent: true })
      await FileSystem.copyAsync({ from: uri, to: yeniUri })
    } catch (e) {
      console.warn('[teklifPdf] kopyalama hata:', e?.message)
    }

    const paylasilacakUri = (await FileSystem.getInfoAsync(yeniUri)).exists ? yeniUri : uri

    if (Platform.OS === 'web') {
      // Web fallback (Expo web preview)
      Alert.alert('PDF', `PDF oluşturuldu: ${paylasilacakUri}`)
      return { ok: true, uri: paylasilacakUri }
    }

    const paylasMevcut = await Sharing.isAvailableAsync()
    if (paylasMevcut) {
      await Sharing.shareAsync(paylasilacakUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Teklifi Paylaş',
        UTI: 'com.adobe.pdf',
      })
    } else {
      Alert.alert('Paylaşım', 'Cihazda paylaşım modülü mevcut değil.')
    }

    return { ok: true, uri: paylasilacakUri }
  } catch (err) {
    console.error('[teklifPdf] hata:', err)
    Alert.alert('PDF oluşturulamadı', String(err?.message ?? err))
    return { ok: false, hata: err }
  }
}
