import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  musteriKisiEkle,
  musteriKisiGuncelle,
  musteriKisiGetir,
  musteriKisiSil,
} from '../services/musteriKisiService'
import { useTheme } from '../context/ThemeContext'

export default function KisiFormScreen({ route, navigation }) {
  const { musteriId, kisiId } = route.params ?? {}
  const editMode = !!kisiId
  const headerHeight = useHeaderHeight()
  const { colors } = useTheme()

  const [ad, setAd] = useState('')
  const [soyad, setSoyad] = useState('')
  const [unvan, setUnvan] = useState('')
  const [telefon, setTelefon] = useState('')
  const [emailAdres, setEmailAdres] = useState('')
  const [notlar, setNotlar] = useState('')
  const [anaKisi, setAnaKisi] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(editMode)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: editMode ? 'Kişiyi Düzenle' : 'Yeni İlgili Kişi' })
  }, [navigation, editMode])

  useEffect(() => {
    if (!editMode) return
    ;(async () => {
      const k = await musteriKisiGetir(kisiId)
      if (k) {
        setAd(k.ad ?? '')
        setSoyad(k.soyad ?? '')
        setUnvan(k.unvan ?? '')
        setTelefon(k.telefon ?? '')
        setEmailAdres(k.email ?? '')
        setNotlar(k.notlar ?? '')
        setAnaKisi(!!k.anaKisi)
      }
      setYukleniyor(false)
    })()
  }, [editMode, kisiId])

  const kaydet = async () => {
    if (!ad.trim()) {
      Alert.alert('Eksik', 'Ad zorunlu.')
      return
    }
    setKaydediliyor(true)
    const veri = {
      ad: ad.trim(),
      soyad: soyad.trim() || null,
      unvan: unvan.trim() || null,
      telefon: telefon.trim() || null,
      email: emailAdres.trim() || null,
      notlar: notlar.trim() || null,
      anaKisi,
    }

    let sonuc
    if (editMode) {
      sonuc = await musteriKisiGuncelle(kisiId, veri)
    } else {
      sonuc = await musteriKisiEkle({ ...veri, musteriId })
    }

    setKaydediliyor(false)
    if (!sonuc) {
      Alert.alert('Hata', editMode ? 'Kişi güncellenemedi.' : 'Kişi eklenemedi.')
      return
    }
    navigation.goBack()
  }

  const sil = () => {
    Alert.alert('Kişiyi sil', 'Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await musteriKisiSil(kisiId)
          navigation.goBack()
        },
      },
    ])
  }

  if (yukleniyor) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text style={[styles.label, { color: colors.textMuted }]}>Ad *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={ad} onChangeText={setAd} placeholder="Ahmet" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Soyad</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={soyad} onChangeText={setSoyad} placeholder="Yılmaz" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Ünvan / Departman</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={unvan} onChangeText={setUnvan} placeholder="Satın Alma Müdürü" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Telefon</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={telefon}
          onChangeText={setTelefon}
          keyboardType="phone-pad"
          placeholder="0555 123 45 67"
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>E-posta</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={emailAdres}
          onChangeText={setEmailAdres}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ornek@firma.com"
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Notlar</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={notlar}
          onChangeText={setNotlar}
          multiline
          placeholder="Bu kişiyle ilgili notlar..."
          placeholderTextColor={colors.textFaded}
        />

        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Ana Kişi</Text>
            <Text style={[styles.switchHint, { color: colors.textFaded }]}>Listede üstte gösterilir, varsayılan iletişim</Text>
          </View>
          <Switch
            value={anaKisi}
            onValueChange={setAnaKisi}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : editMode ? 'Değişiklikleri Kaydet' : 'Kişiyi Ekle'}
          </Text>
        </TouchableOpacity>

        {editMode && (
          <TouchableOpacity style={styles.silBtn} onPress={sil}>
            <Text style={styles.silText}>Kişiyi Sil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  switchTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  switchHint: { color: '#64748b', fontSize: 12, marginTop: 2 },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  silBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },
})
