import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { kullaniciEkle } from '../../services/kullaniciService'

const UNVAN_SECENEKLER = [
  'Teknisyen',
  'Saha Teknisyeni',
  'Teknik Müdür',
  'Depo Sorumlusu',
  'Admin',
  'Genel Müdür',
  'Yazılım Geliştirmeci',
  'Satış',
]

export default function AdminYeniPersonelScreen({ navigation }) {
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const [ad, setAd] = useState('')
  const [kullaniciAdi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [unvan, setUnvan] = useState('Teknisyen')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const kaydet = async () => {
    if (!ad.trim()) return Alert.alert('Eksik', 'Ad Soyad zorunlu.')
    if (!kullaniciAdi.trim()) return Alert.alert('Eksik', 'Kullanıcı adı zorunlu.')
    if (sifre.length < 4) return Alert.alert('Eksik', 'Şifre en az 4 karakter olmalı.')

    setKaydediliyor(true)
    const sonuc = await kullaniciEkle({
      ad: ad.trim(),
      kullaniciAdi: kullaniciAdi.trim().toLowerCase(),
      sifre,
      unvan,
      telefon: telefon.trim() || null,
      email: email.trim() || null,
    })
    setKaydediliyor(false)

    if (!sonuc.ok) {
      Alert.alert('Hata', sonuc.hata ?? 'Kullanıcı oluşturulamadı.')
      return
    }

    Alert.alert(
      '✅ Personel Eklendi',
      `${ad} başarıyla oluşturuldu.\n\nKullanıcı adı: ${kullaniciAdi}\nGeçici şifre: ${sifre}\n\nKullanıcıya bu bilgileri iletin, ilk girişten sonra profilden değiştirebilir.`,
      [{ text: 'Tamam', onPress: () => navigation.goBack() }]
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.bilgi, { color: colors.textMuted }]}>
            Yeni saha personeli veya çalışan ekle. İlk girişten sonra şifresini değiştirmesi önerilir.
          </Text>

          <Alan label="Ad Soyad *" deger={ad} setter={setAd} placeholder="Mehmet Yılmaz" colors={colors} />
          <Alan
            label="Kullanıcı Adı *"
            deger={kullaniciAdi}
            setter={setKullaniciAdi}
            placeholder="mehmetyilmaz"
            colors={colors}
            autoCap="none"
          />
          <Alan
            label="Geçici Şifre *"
            deger={sifre}
            setter={setSifre}
            placeholder="En az 4 karakter"
            colors={colors}
            autoCap="none"
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Unvan</Text>
          <View style={styles.chipRow}>
            {UNVAN_SECENEKLER.map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  unvan === u && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setUnvan(u)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.textSecondary },
                    unvan === u && { color: '#fff' },
                  ]}
                >
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Alan
            label="Telefon"
            deger={telefon}
            setter={setTelefon}
            placeholder="05xx xxx xx xx"
            colors={colors}
            keyboard="phone-pad"
          />
          <Alan
            label="E-posta"
            deger={email}
            setter={setEmail}
            placeholder="kisi@zna.com.tr"
            colors={colors}
            keyboard="email-address"
            autoCap="none"
          />

          <TouchableOpacity
            style={[
              styles.kaydetBtn,
              { backgroundColor: colors.primary },
              kaydediliyor && { opacity: 0.5 },
            ]}
            onPress={kaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
          >
            {kaydediliyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="user-plus" size={18} color="#fff" />
                <Text style={styles.kaydetText}>Personeli Oluştur</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  )
}

function Alan({ label, deger, setter, placeholder, colors, autoCap = 'sentences', keyboard = 'default' }) {
  return (
    <>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
        value={deger}
        onChangeText={setter}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaded}
        autoCapitalize={autoCap}
        autoCorrect={false}
        keyboardType={keyboard}
      />
    </>
  )
}

const styles = StyleSheet.create({
  bilgi: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  kaydetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
  },
  kaydetText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
