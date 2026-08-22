// Kök ekranlarda (Ana Sayfa / Yönetim / Müşteri Ana) Android donanım geri tuşu
// uygulamayı TEK basışta kapatıyordu (22.08 denetimi). Kurumsal uygulama
// beklentisi: "Çıkmak için tekrar basın" — 2 sn içinde ikinci basış çıkar.
// Yalnız ekran ODAKTAYKEN kayıtlı (useFocusEffect); üstte başka ekran varken
// (canGoBack) normal geriye karışmaz. iOS'ta donanım geri yok → etkisiz.
import { useCallback, useRef } from 'react'
import { BackHandler, Platform, ToastAndroid } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

export function useCiftGeriCikis(navigation) {
  const sonBasis = useRef(0)
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return undefined
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.canGoBack?.()) return false          // kök değil → varsayılan geri
      const simdi = Date.now()
      if (simdi - sonBasis.current < 2000) return false     // ikinci basış → çık
      sonBasis.current = simdi
      ToastAndroid.show('Çıkmak için tekrar basın', ToastAndroid.SHORT)
      return true
    })
    return () => sub.remove()
  }, [navigation]))
}
