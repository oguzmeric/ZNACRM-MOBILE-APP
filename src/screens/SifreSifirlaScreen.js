import { useState, useEffect } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { kayitKodGonder, kayitKodDogrula } from '../services/emailAuthService'

export default function SifreSifirlaScreen({ navigation }) {
  const { colors } = useTheme()
  const [adim, setAdim] = useState(1)
  const [email, setEmail] = useState('')
  const [kod, setKod] = useState('')
  const [sifre, setSifre] = useState('')
  const [sifre2, setSifre2] = useState('')
  const [loading, setLoading] = useState(false)
  const [geriSayim, setGeriSayim] = useState(0)

  useEffect(() => {
    if (geriSayim <= 0) return
    const t = setTimeout(() => setGeriSayim((g) => g - 1), 1000)
    return () => clearTimeout(t)
  }, [geriSayim])

  const kodGonder = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.')
      return
    }
    setLoading(true)
    try {
      await kayitKodGonder(email, 'sifre_sifirla')
      setAdim(2)
      setGeriSayim(60)
      Alert.alert('Kod gönderildi', `${email} adresine 6 haneli kod gönderildi. Spam klasörünü de kontrol edin.`)
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kod gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const sifreyiGuncelle = async () => {
    if (!/^\d{6}$/.test(kod)) { Alert.alert('Hata', 'Kod 6 haneli olmalı.'); return }
    if (sifre.length < 8) { Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.'); return }
    if (sifre !== sifre2) { Alert.alert('Hata', 'Şifreler eşleşmiyor.'); return }
    setLoading(true)
    try {
      await kayitKodDogrula({ email, kod, yeniSifre: sifre, amac: 'sifre_sifirla' })
      Alert.alert(
        'Şifreniz güncellendi',
        'Yeni şifrenizle giriş yapabilirsiniz.',
        [{ text: 'Giriş ekranına dön', onPress: () => navigation.goBack() }],
      )
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Şifre güncellenemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>Şifreni Sıfırla</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {adim === 1
            ? 'E-posta adresinizi girin, 6 haneli kod gönderelim.'
            : `${email} adresine gönderilen kodu ve yeni şifrenizi girin.`}
        </Text>

        {adim === 1 ? (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="adsoyad@firma.com"
              placeholderTextColor={colors.textFaded}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={kodGonder} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Gönderiliyor…' : 'Kod Gönder →'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong, letterSpacing: 6, textAlign: 'center', fontSize: 20 }]}
              placeholder="000000"
              placeholderTextColor={colors.textFaded}
              keyboardType="number-pad"
              maxLength={6}
              value={kod}
              onChangeText={(t) => setKod(t.replace(/\D/g, '').slice(0, 6))}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="Yeni şifre (en az 8 karakter)"
              placeholderTextColor={colors.textFaded}
              secureTextEntry
              value={sifre}
              onChangeText={setSifre}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
              placeholder="Yeni şifre (tekrar)"
              placeholderTextColor={colors.textFaded}
              secureTextEntry
              value={sifre2}
              onChangeText={setSifre2}
            />
            <TouchableOpacity disabled={geriSayim > 0 || loading} onPress={kodGonder}>
              <Text style={[styles.resend, { color: geriSayim > 0 ? colors.textFaded : colors.primary }]}>
                {geriSayim > 0 ? `Yeni kod (${geriSayim}sn)` : 'Yeni kod gönder'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={sifreyiGuncelle} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'İşleniyor…' : 'Şifreyi Güncelle →'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 18 }}>
          <Text style={[styles.link, { color: colors.textMuted }]}>Şifreni hatırladın mı? Giriş yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  wrap: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  input: { padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 12.5, fontWeight: '600', textAlign: 'right', marginBottom: 8 },
  link: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
})
