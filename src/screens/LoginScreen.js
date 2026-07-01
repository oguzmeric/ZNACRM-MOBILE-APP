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
  ScrollView,
} from 'react-native'
import Constants from 'expo-constants'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const APP_VERSION = Constants.expoConfig?.version || '1.0.0'

export default function LoginScreen({ navigation }) {
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
    try {
      const ok = await girisYap(kullaniciAdi, sifre)
      if (!ok) Alert.alert('Giriş başarısız', 'Kullanıcı adı veya şifre hatalı.')
    } catch (err) {
      if (err?.kod === 'ONAY_BEKLIYOR') {
        Alert.alert('Hesabınız onay sürecinde', err.message)
      } else if (err?.kod === 'REDDEDILDI') {
        Alert.alert('Başvuru reddedildi', err.message)
      } else {
        Alert.alert('Giriş yapılamadı', err?.message || 'Bir hata oluştu.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand hero — büyük logo + başlık + subtitle + chip'ler */}
          <View style={styles.brandHero}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Image
                  source={require('../../assets/logo.jpeg')}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.brandTitle}>ZNA Teknoloji</Text>
            <Text style={styles.brandSubtitle}>Saha ve satış mobil uygulaması</Text>

            <View style={styles.chipRow}>
              {['Saha', 'Satış', 'Servis'].map(c => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Login card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Hoş Geldin</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Devam etmek için giriş yap</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanıcı Adı veya E-posta</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.borderStrong }]}
                placeholder="kullanici_adi veya e-posta"
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

            <TouchableOpacity onPress={() => navigation.navigate('SifreSifirla')} style={{ marginTop: 14 }}>
              <Text style={{ color: '#60a5fa', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                Şifremi unuttum?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Kayıt')} style={{ marginTop: 14 }}>
              <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                Hesabın yok mu? <Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 14 }}>Kayıt ol</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footer, { color: colors.textFaded }]}>
            ZNA Teknoloji · v{APP_VERSION}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },

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

  inner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  brandHero: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logoRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 68, height: 68 },
  brandTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
  },
  chipText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.20)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },

  inputGroup: { marginBottom: 14 },
  label: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    padding: 13,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },

  button: {
    backgroundColor: '#2563eb',
    padding: 14,
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
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  footer: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.5,
  },
})
