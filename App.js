// react-native-gesture-handler import EN BAŞTA olmalı (RN best practice)
import 'react-native-gesture-handler'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { Component, useCallback, useEffect, useRef } from 'react'
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
import GecikmisGorevKapisi from './src/components/GecikmisGorevKapisi'
import { dikeyKilitle } from './src/lib/ekranYonu'
import { useFonts } from 'expo-font'
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque'
import AcilisEkrani from './src/components/AcilisEkrani'

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
  // Uygulanamamış push hedefi. RootNavigator'da NavigationContainer'ın key'i
  // oturum/rol ile değişiyor (auth → admin/teknisyen): oturum yüklenirken
  // container REMOUNT oluyor ve tam o ana denk gelen navigate yutuluyordu —
  // "bildirime bastım ama mesaja gitmedi" bunun sonucuydu. Hedefi saklıyoruz,
  // oturum oturduktan sonra tekrar uyguluyoruz.
  const bekleyenPush = useRef(null)
  useEffect(() => { kullaniciRef.current = kullanici }, [kullanici])

  const linkeGit = useCallback((data, deneme = 0) => {
    if (data?.tip === 'toplanti' && data?.link) {
      try { Linking.openURL(data.link) } catch {}
      return
    }
    if (!data?.link) return
    if (!navigationRef.isReady() || !kullaniciRef.current?.id) {
      bekleyenPush.current = data
      if (deneme < 10) setTimeout(() => linkeGit(data, deneme + 1), 700)
      return
    }
    const hedef = bildirimLinkHedefi(data.link, kullaniciRef.current)
    if (!hedef) { bekleyenPush.current = null; return }
    try {
      navigationRef.navigate(...hedef)
      // Remount navigate'i yutmuş olabilir — gerçekten gidildi mi doğrula
      setTimeout(() => {
        const suanki = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null
        if (suanki === hedef[0]) { bekleyenPush.current = null; return }
        if (deneme < 6) linkeGit(data, deneme + 1)
        else bekleyenPush.current = null
      }, 600)
    } catch (e) {
      console.warn('[push nav]', e?.message)
      if (deneme < 6) setTimeout(() => linkeGit(data, deneme + 1), 700)
    }
  }, [])

  // Oturum yüklenince (navKey değişip container yeniden kurulunca) bekleyeni uygula
  useEffect(() => {
    if (!kullanici?.id || !bekleyenPush.current) return
    const t = setTimeout(() => { if (bekleyenPush.current) linkeGit(bekleyenPush.current) }, 900)
    return () => clearTimeout(t)
  }, [kullanici?.id, linkeGit])

  useEffect(() => {

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
  }, [linkeGit])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mod === 'gunduz' ? 'dark' : 'light'} />
      <ToplantiHatirlaticiKurulum />
      {/* Gecikmiş GÖREV kapısı — yalnız görevler; servis talepleri etkilenmez */}
      <GecikmisGorevKapisi />
      <RootNavigator />
    </View>
  )
}

export default Sentry.wrap(function App() {
  // Uygulama genel olarak DİKEY kalır; yalnız keşif çizim modalı yatay açılır
  // (o modal kilidi kendi açıp kapatıyor). app.json'da orientation "default"
  // olduğu için kilit burada, çalışma anında kurulur.
  // NOT: eski build'lerde expo-screen-orientation native tarafı yoktur —
  // lib/ekranYonu içindeki try/catch sessizce geçer, çökme olmaz.
  useEffect(() => { dikeyKilitle().catch(() => {}) }, [])

  // Marka fontu (web giriş sayfasındaki 'Bricolage Grotesque').
  // ⚠️ YALNIZ giriş ekranında kullanılır — açılış ekranı SİSTEM FONTUYLA çizilir.
  // Sebebi: font burada yüklenene kadar geçen sürede özel fontlu yazı sistem
  // fontuyla çıkıp sonra ZIPLAR; açılış ekranında bu, düzeltmeye çalıştığımız
  // kopukluğun aynısını yaratırdı.
  // ⚠️ Font yüklenirken de AcilisEkrani gösteriliyor: beyaz/boş kare olmasın.
  // Hata olursa (fontError) uygulamayı KİLİTLEME — sistem fontuyla devam et.
  const [fontYuklendi, fontHata] = useFonts({ BricolageGrotesque_800ExtraBold })
  if (!fontYuklendi && !fontHata) return <AcilisEkrani />

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
