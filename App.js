// react-native-gesture-handler import EN BAŞTA olmalı (RN best practice)
import 'react-native-gesture-handler'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { Component, useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ScrollView, AppState, Linking } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Sentry from '@sentry/react-native'
import * as Notifications from 'expo-notifications'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import RootNavigator, { navigationRef } from './src/navigation/RootNavigator'
import { toplantiHatirlaticilariniYenile } from './src/lib/toplantiHatirlatici'
import { bildirimLinkHedefi } from './src/lib/bildirimLink'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  // dev / production ayrımı: Sentry dashboard'da filtrelenebilir
  environment: __DEV__ ? 'development' : 'production',
})

class ErrorBoundary extends Component {
  state = { error: null, info: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info)
    try {
      Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } })
    } catch (_) {}
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0a0f1e', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Uygulama başlatılamadı
          </Text>
          <Text selectable style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text selectable style={{ color: '#9ca3af', fontSize: 11, marginBottom: 16 }}>
            {String(this.state.error?.stack || '')}
          </Text>
          {this.state.info?.componentStack ? (
            <Text selectable style={{ color: '#9ca3af', fontSize: 11 }}>
              {this.state.info.componentStack}
            </Text>
          ) : null}
        </ScrollView>
      )
    }
    return this.props.children
  }
}

function ToplantiHatirlaticiKurulum() {
  const { kullanici } = useAuth()

  // Kullanıcı değişince + app foreground'a alınınca toplantı hatırlaticılarını yenile
  useEffect(() => {
    if (!kullanici?.id) return
    toplantiHatirlaticilariniYenile(kullanici.id)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') toplantiHatirlaticilariniYenile(kullanici.id)
    })
    return () => sub.remove()
  }, [kullanici?.id])

  return null
}

function AppInner() {
  const { colors, mod } = useTheme()
  const { kullanici } = useAuth()
  const responseListener = useRef(null)
  const receivedListener = useRef(null)
  const kullaniciRef = useRef(null)
  useEffect(() => { kullaniciRef.current = kullanici }, [kullanici])

  useEffect(() => {
    // Push'a dokununca ilgili ekrana git (bildirimLinkHedefi eşler).
    // Navigasyon/oturum henüz hazır değilse kısa aralıklarla yeniden dene
    // (uygulama push'tan soğuk açıldığında gerekir).
    const linkeGit = (data, deneme = 0) => {
      if (data?.tip === 'toplanti' && data?.link) {
        try { Linking.openURL(data.link) } catch {}
        return
      }
      if (!data?.link) return
      if (!navigationRef.isReady() || !kullaniciRef.current?.id) {
        if (deneme < 10) setTimeout(() => linkeGit(data, deneme + 1), 700)
        return
      }
      const hedef = bildirimLinkHedefi(data.link, kullaniciRef.current)
      if (hedef) {
        try { navigationRef.navigate(...hedef) } catch (e) { console.warn('[push nav]', e?.message) }
      }
    }

    // Foreground'da bildirim geldiğinde — sadece logla, handler shouldShowAlert ile zaten gösterir
    receivedListener.current = Notifications.addNotificationReceivedListener(() => {})

    // Kullanıcı bildirime dokunduğunda (uygulama açık/arka planda)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      linkeGit(resp?.notification?.request?.content?.data)
    })

    // Uygulama push'a dokunularak KAPALIYKEN açıldıysa — son yanıtı yakala
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => { if (resp) linkeGit(resp?.notification?.request?.content?.data) })
      .catch(() => {})

    return () => {
      try { Notifications.removeNotificationSubscription(receivedListener.current) } catch {}
      try { Notifications.removeNotificationSubscription(responseListener.current) } catch {}
    }
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mod === 'gunduz' ? 'dark' : 'light'} />
      <ToplantiHatirlaticiKurulum />
      <RootNavigator />
    </View>
  )
}

export default Sentry.wrap(function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppInner />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
});
