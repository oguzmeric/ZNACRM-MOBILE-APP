import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function LoginScreen() {
  const { girisYap } = useAuth()
  const { colors } = useTheme()
  const [kullaniciAdi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!kullaniciAdi || !sifre) {
      Alert.alert('Eksik bilgi', 'Kullanıcı adı ve şifre gerekli.')
      return
    }
    setLoading(true)
    const ok = await girisYap(kullaniciAdi, sifre)
    setLoading(false)
    if (!ok) Alert.alert('Giriş başarısız', 'Kullanıcı adı veya şifre hatalı.')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Ana sayfa ile aynı gradient glow efektleri */}
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* Üst köşede küçük logo */}
      <View style={styles.topBar}>
        <Image
          source={require('../../assets/logo.jpeg')}
          style={styles.topBarLogo}
          resizeMode="contain"
        />
      </View>

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Hoş Geldin</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Devam etmek için giriş yap</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanıcı Adı</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="kullanici_adi"
              placeholderTextColor={colors.textFaded}
              autoCapitalize="none"
              autoCorrect={false}
              value={kullaniciAdi}
              onChangeText={setKullaniciAdi}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Şifre</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaded}
              secureTextEntry
              value={sifre}
              onChangeText={setSifre}
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: colors.textFaded }]}>ZNA Teknoloji · Saha & Satış Mobil</Text>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },

  // Glow efektleri — Ana sayfa ile aynı
  topGlow: {
    position: 'absolute',
    top: -150,
    left: -120,
    width: 400,
    height: 400,
    borderRadius: 300,
    backgroundColor: '#2563eb',
    opacity: 0.12,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -150,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: 300,
    backgroundColor: '#7c3aed',
    opacity: 0.1,
  },

  // Üst barda küçük logo (ana sayfa ile tutarlı)
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'flex-end',
  },
  topBarLogo: {
    width: 70,
    height: 36,
    opacity: 0.8,
  },

  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },

  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },

  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  footer: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.5,
  },
})
