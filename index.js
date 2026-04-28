import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

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
