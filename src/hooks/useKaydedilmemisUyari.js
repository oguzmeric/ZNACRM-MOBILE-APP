// Form ekranlarında GERİ ÇIKIŞ KORUMASI (22.08 denetimi).
// Header geri oku, Android donanım geri tuşu ve iOS kenardan kaydırma
// hepsi `beforeRemove` olayından geçer: form kirliyse çıkış SORULUR.
//
// Kullanım:
//   const kirliRef = useKaydedilmemisUyari(navigation)
//   ... alan değişince:  kirliRef.current = true
//   ... kaydet/sil BAŞARILI olunca goBack/replace'ten ÖNCE: kirliRef.current = false
//
// Neden ref: dinleyici BİR KEZ bağlanır ([navigation]) ve kirliliği ref'ten
// okur. State'e bağlansaydı `setKirli(false); goBack()` ardışık çağrısında
// eski dinleyici hâlâ takılı olur, kaydedip çıkarken de sorardı.
// İlk yükleme (düzenleme modunda setForm) kirli SAYILMAZ — bayrak yalnız
// kullanıcı etkileşiminde kaldırılır; yanlış pozitif uyarı ERP'de güven kaybıdır.
import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'

export function useKaydedilmemisUyari(navigation) {
  const kirliRef = useRef(false)
  useEffect(() => {
    if (!navigation?.addListener) return undefined
    const cikar = navigation.addListener('beforeRemove', (e) => {
      if (!kirliRef.current) return
      e.preventDefault()
      Alert.alert(
        'Kaydedilmemiş değişiklikler var',
        'Formu kaydetmeden çıkıyorsun. Çıkarsan yazdıkların KAYBOLUR.',
        [
          { text: 'Kalıp Kaydedeyim', style: 'cancel' },
          {
            text: 'Yine de çık',
            style: 'destructive',
            onPress: () => { kirliRef.current = false; navigation.dispatch(e.data.action) },
          },
        ],
      )
    })
    return cikar
  }, [navigation])
  return kirliRef
}
