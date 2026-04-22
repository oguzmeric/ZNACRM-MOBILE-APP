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
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { hesabiSil } from '../services/kullaniciService'

const ONAY_METNI = 'HESABI SIL'

export default function HesabiSilScreen({ navigation }) {
  const { colors } = useTheme()
  const { kullanici, cikisYap } = useAuth()
  const [onayMetni, setOnayMetni] = useState('')
  const [siliniyor, setSiliniyor] = useState(false)

  const onayGecerli = onayMetni.trim().toLocaleUpperCase('tr-TR') === ONAY_METNI

  const sil = async () => {
    if (!onayGecerli) return
    Alert.alert(
      'Son Uyarı',
      'Hesabınız kalıcı olarak silinecek. Kişisel bilgileriniz (fotoğraf, profil) temizlenir ve bir daha bu hesapla giriş yapamazsınız.\n\nDevam etmek istiyor musunuz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            setSiliniyor(true)
            const sonuc = await hesabiSil(kullanici?.id)
            setSiliniyor(false)
            if (!sonuc.ok) {
              Alert.alert('Hata', sonuc.hata ?? 'Silme başarısız oldu.')
              return
            }
            Alert.alert(
              'Hesap Silindi',
              'Hesabınız başarıyla silindi. Oturum kapatılıyor.',
              [{ text: 'Tamam', onPress: cikisYap }]
            )
          },
        },
      ]
    )
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.iconWrap, { backgroundColor: colors.danger + '22' }]}>
          <Feather name="alert-triangle" size={36} color={colors.danger} />
        </View>

        <Text style={[styles.baslik, { color: colors.textPrimary }]}>Hesabını Sil</Text>
        <Text style={[styles.aciklama, { color: colors.textSecondary }]}>
          Bu işlem geri alınamaz. Aşağıdaki bilgileri okuyup onay metnini yazdıktan sonra devam edebilirsin.
        </Text>

        <View style={[styles.kutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Bilgi ikon="user-x" renk={colors.danger}
            metin="Profil bilgilerin (ad, foto) temizlenir" colors={colors} />
          <Bilgi ikon="lock" renk={colors.danger}
            metin="Şifren sıfırlanır, bu hesapla tekrar giriş yapılamaz" colors={colors} />
          <Bilgi ikon="archive" renk={colors.warning}
            metin="Servis/görev geçmişin iş sürekliliği için saklanır (anonimleştirilir)" colors={colors} />
          <Bilgi ikon="mail" renk={colors.info}
            metin="destek@zna.com.tr adresinden tam silme talep edebilirsin" colors={colors} son />
        </View>

        <Text style={[styles.etiket, { color: colors.textMuted }]}>
          Onaylamak için aşağıya <Text style={{ fontWeight: '800', color: colors.danger }}>{ONAY_METNI}</Text> yaz:
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderColor: onayGecerli ? colors.success : colors.border,
            },
          ]}
          value={onayMetni}
          onChangeText={setOnayMetni}
          placeholder={ONAY_METNI}
          placeholderTextColor={colors.textFaded}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[
            styles.silBtn,
            { backgroundColor: colors.danger },
            (!onayGecerli || siliniyor) && { opacity: 0.4 },
          ]}
          onPress={sil}
          disabled={!onayGecerli || siliniyor}
          activeOpacity={0.85}
        >
          {siliniyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="trash-2" size={18} color="#fff" />
              <Text style={styles.silBtnText}>Hesabımı Kalıcı Olarak Sil</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vazgecBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.vazgecText, { color: colors.textMuted }]}>Vazgeç</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  )
}

function Bilgi({ ikon, renk, metin, son, colors }) {
  return (
    <View style={[styles.bilgiRow, !son && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.bilgiIkon, { backgroundColor: renk + '22' }]}>
        <Feather name={ikon} size={14} color={renk} />
      </View>
      <Text style={[styles.bilgiText, { color: colors.textSecondary }]}>{metin}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60, alignItems: 'center' },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  baslik: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  aciklama: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  kutu: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  bilgiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  bilgiIkon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bilgiText: { flex: 1, fontSize: 12, lineHeight: 17 },

  etiket: { fontSize: 13, alignSelf: 'flex-start', marginBottom: 8 },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 2,
    marginBottom: 20,
    letterSpacing: 1,
    fontWeight: '700',
  },

  silBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  silBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  vazgecBtn: { marginTop: 16, padding: 12 },
  vazgecText: { fontSize: 14, fontWeight: '600' },
})
