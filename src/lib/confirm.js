// Yıkıcı/önemli aksiyonlar için tutarlı onay helper'ı.
// React Native Alert wrapper'ı — her yerde aynı buton metinleri ve sırası.
//
// Kullanım:
//   import { confirmSil, confirmAksiyon } from '../lib/confirm'
//
//   const onayli = await confirmSil('Bu görevi silmek istediğine emin misin?')
//   if (onayli) await sil()
//
//   const ok = await confirmAksiyon({
//     baslik: 'Servisi kapat',
//     mesaj: 'Kapattıktan sonra düzenlenemez.',
//     onayText: 'Kapat',
//   })

import { Alert } from 'react-native'

/**
 * Generic onay dialog'u. Promise döner.
 * @param {object} cfg
 * @param {string} cfg.baslik   - Alert başlığı
 * @param {string} cfg.mesaj    - Açıklama
 * @param {string} [cfg.onayText='Onayla'] - Onay butonu metni
 * @param {string} [cfg.iptalText='Vazgeç'] - İptal butonu metni
 * @param {boolean} [cfg.yikici=false] - true ise onay butonu kırmızı (destructive)
 * @returns {Promise<boolean>} - kullanıcı onayladıysa true
 */
export function confirmAksiyon({
  baslik,
  mesaj,
  onayText = 'Onayla',
  iptalText = 'Vazgeç',
  yikici = false,
}) {
  return new Promise((resolve) => {
    Alert.alert(
      baslik ?? 'Onayla',
      mesaj ?? '',
      [
        { text: iptalText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: onayText,
          style: yikici ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

/**
 * Silme onayı için kısayol. Her yerde aynı metin/davranış.
 * @param {string} [mesaj] - Özel mesaj (verilmezse generic)
 * @param {string} [baslik='Sil']
 */
export function confirmSil(mesaj, baslik = 'Sil') {
  return confirmAksiyon({
    baslik,
    mesaj: mesaj ?? 'Bu kaydı silmek istediğine emin misin? Geri alınamaz.',
    onayText: 'Sil',
    yikici: true,
  })
}
