// Teklif PDF üretimi — format seç → HTML üret → expo-print → expo-sharing
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'
import { supabase } from './supabase'
import { tumGorselleriYukle } from './teklifHtml/imageUtils'
import { standartHtml } from './teklifHtml/standartHtml'
import { karelHtml } from './teklifHtml/karelHtml'
import { trassirHtml } from './teklifHtml/trassirHtml'

export const TEKLIF_FORMATLARI = [
  { id: 'standart', label: 'Standart', aciklama: 'Tek sayfa, ZNA antetli' },
  { id: 'karel',    label: 'Karel',    aciklama: 'Tek sayfa Fiyatlandırma + Karel İş Ortağı rozeti' },
  { id: 'trassir',  label: 'Trassir',  aciklama: '5 sayfa: kapak + anlatı + fiyat + ortaklar + referanslar' },
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

// Promise'ı timeout ile sar — bir adım takılırsa zincir kilitlenmesin
const ileTimeout = (promise, ms, ad) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Zaman aşımı (${ad}) — ${ms / 1000}sn`)), ms)),
])

// PDF üret + paylaş ekranını aç
export const teklifPdfUretVePaylas = async ({ teklif, format }) => {
  try {
    console.log('[teklifPdf] başladı, format:', format)

    console.log('[teklifPdf] HTML üretiliyor...')
    const html = await ileTimeout(formatHtml(format, teklif), 30000, 'HTML üretimi')
    console.log('[teklifPdf] HTML üretildi, uzunluk:', html.length)

    console.log('[teklifPdf] PDF dosyaya yazılıyor...')
    const { uri } = await ileTimeout(
      Print.printToFileAsync({ html, base64: false, width: 595, height: 842 }),
      30000,
      'PDF oluşturma',
    )
    console.log('[teklifPdf] PDF üretildi:', uri)

    // Dosya adını anlamlandır: "<müşteri kodu>-<teklif sıra no>-ZNA.pdf"
    // (müşteri kodu yoksa "<teklif no>-ZNA.pdf"). Format adı (trassir/karel) yazılmaz.
    const teklifNoRaw = String(teklif.teklifNo || `teklif-${teklif.id}`)
    // Teklif sıra no = teklif numarasındaki son rakam grubu (TEK-0547 → 0547, IMP-2026-0064 → 0064)
    const rakamGruplari = teklifNoRaw.match(/\d+/g)
    const sira = rakamGruplari ? rakamGruplari[rakamGruplari.length - 1] : teklifNoRaw
    // Dosya sistemi için güvensiz karakterleri temizle (tire ve nokta korunur)
    const dosyaTemizle = (s) => String(s ?? '').replace(/[\/\\:*?"<>|\s]+/g, '').trim()

    // Müşteri kodunu çek (teklif nesnesinde yoksa musteriId'den)
    let musteriKod = teklif.musteriKod ?? null
    if (!musteriKod && teklif.musteriId) {
      try {
        const { data } = await supabase
          .from('musteriler')
          .select('kod')
          .eq('id', teklif.musteriId)
          .single()
        musteriKod = data?.kod ?? null
      } catch (e) {
        console.warn('[teklifPdf] müşteri kodu alınamadı:', e?.message)
      }
    }

    const kodTemiz = dosyaTemizle(musteriKod)
    const yeniAd = kodTemiz
      ? `${kodTemiz}-${sira}-ZNA.pdf`
      : `${dosyaTemizle(teklifNoRaw)}-ZNA.pdf`
    const yeniUri = `${FileSystem.cacheDirectory}${yeniAd}`

    try {
      await FileSystem.deleteAsync(yeniUri, { idempotent: true })
      await FileSystem.copyAsync({ from: uri, to: yeniUri })
    } catch (e) {
      console.warn('[teklifPdf] kopyalama hata:', e?.message)
    }

    const paylasilacakUri = (await FileSystem.getInfoAsync(yeniUri)).exists ? yeniUri : uri
    console.log('[teklifPdf] paylaşılacak uri:', paylasilacakUri)

    if (Platform.OS === 'web') {
      Alert.alert('PDF', `PDF oluşturuldu: ${paylasilacakUri}`)
      return { ok: true, uri: paylasilacakUri }
    }

    const paylasMevcut = await Sharing.isAvailableAsync()
    if (!paylasMevcut) {
      Alert.alert('Paylaşım', 'Cihazda paylaşım modülü mevcut değil.')
      return { ok: true, uri: paylasilacakUri }
    }

    console.log('[teklifPdf] paylaşım açılıyor...')
    // Sharing.shareAsync iOS'ta share sheet kapanana kadar bekler.
    // Kullanıcı share sheet'i dismiss eder etmez resolve olur.
    await Sharing.shareAsync(paylasilacakUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Teklifi Paylaş',
      UTI: 'com.adobe.pdf',
    })
    console.log('[teklifPdf] paylaşım tamamlandı')

    return { ok: true, uri: paylasilacakUri }
  } catch (err) {
    console.error('[teklifPdf] hata:', err)
    Alert.alert('PDF oluşturulamadı', String(err?.message ?? err))
    return { ok: false, hata: err }
  }
}
