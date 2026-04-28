import { Component } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ScrollView } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Sentry from '@sentry/react-native'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import RootNavigator from './src/navigation/RootNavigator'

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

function AppInner() {
  const { colors, mod } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mod === 'gunduz' ? 'dark' : 'light'} />
      <RootNavigator />
    </View>
  )
}

export default Sentry.wrap(function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
});
