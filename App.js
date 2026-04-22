import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import RootNavigator from './src/navigation/RootNavigator'

function AppInner() {
  const { colors, mod } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mod === 'gunduz' ? 'dark' : 'light'} />
      <RootNavigator />
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
