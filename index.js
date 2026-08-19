import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

// Production'da console susturulur (19.08 performans denetimi): src/ altında
// 267 console çağrısı var ve RN'de release build'de bile console.* köprüden
// geçer — özellikle her sorguda log atan servis katmanı JS thread'ini yavaşlatır.
// console.error BİLEREK açık: Sentry ve global hata yakalayıcı ondan besleniyor.
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
}

// Production'da yakalanamayan JS hatalarını ekrana göster
if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  const prev = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      Alert.alert(
        isFatal ? 'Fatal Hata' : 'Hata',
        String(error?.message || error) + '\n\n' + String(error?.stack || '').slice(0, 1500)
      );
    } catch (_) {}
    if (prev) prev(error, isFatal);
  });
}

import App from './App';

registerRootComponent(App);
