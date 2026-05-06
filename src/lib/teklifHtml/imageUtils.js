// Teklif PDF'inde kullanılan görselleri base64 data URI'ye çevirir.
// expo-print HTML'i içinde <img src="data:image/..."> şeklinde gömülür → offline çalışır.

import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'

const VARLIK_TANIMLARI = {
  znaLogo:      { modul: require('../../../assets/teklif/zna-logo.jpg'),       mime: 'image/jpeg' },
  znaCover:     { modul: require('../../../assets/teklif/zna-cover.png'),     mime: 'image/png' },
  karelOrtak:   { modul: require('../../../assets/teklif/karel-is-ortagi.png'), mime: 'image/png' },
  isOrtaklari:  { modul: require('../../../assets/teklif/is-ortaklari.png'),  mime: 'image/png' },
  referanslar:  { modul: require('../../../assets/teklif/referanslar.png'),   mime: 'image/png' },
}

// İlk yüklemede yavaş, sonrası cache'li
const cache = {}

export const teklifGorseliGetir = async (anahtar) => {
  if (cache[anahtar]) return cache[anahtar]
  const tanim = VARLIK_TANIMLARI[anahtar]
  if (!tanim) throw new Error(`Bilinmeyen görsel: ${anahtar}`)
  const asset = Asset.fromModule(tanim.modul)
  await asset.downloadAsync()
  const uri = asset.localUri || asset.uri
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const dataUri = `data:${tanim.mime};base64,${base64}`
  cache[anahtar] = dataUri
  return dataUri
}

export const tumGorselleriYukle = async () => {
  const anahtarlar = Object.keys(VARLIK_TANIMLARI)
  const sonuc = {}
  await Promise.all(
    anahtarlar.map(async (a) => { sonuc[a] = await teklifGorseliGetir(a) }),
  )
  return sonuc
}
