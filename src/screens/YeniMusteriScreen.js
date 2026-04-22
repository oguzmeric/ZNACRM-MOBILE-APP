import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  musteriEkle,
  musteriGuncelle,
  musteriGetir,
  sonrakiMusteriKodu,
} from '../services/musteriService'
import { musteriKisiEkle } from '../services/musteriKisiService'
import { useTheme } from '../context/ThemeContext'

const DURUMLAR = [
  { id: 'lead', label: 'Lead' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'pasif', label: 'Pasif' },
]

export default function YeniMusteriScreen({ route, navigation }) {
  const editId = route?.params?.id ?? null
  const editMode = !!editId
  const headerHeight = useHeaderHeight()
  const { colors } = useTheme()

  const [ad, setAd] = useState('')
  const [soyad, setSoyad] = useState('')
  const [firma, setFirma] = useState('')
  const [unvan, setUnvan] = useState('')
  const [telefon, setTelefon] = useState('')
  const [emailAdres, setEmailAdres] = useState('')
  const [sehir, setSehir] = useState('')
  const [vergiNo, setVergiNo] = useState('')
  const [notlar, setNotlar] = useState('')
  const [durum, setDurum] = useState('lead')
  const [kod, setKod] = useState('')
  const [yukleniyor, setYukleniyor] = useState(editMode)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Başlığı moda göre ayarla
  useEffect(() => {
    navigation.setOptions({ title: editMode ? 'Müşteriyi Düzenle' : 'Yeni Müşteri' })
  }, [navigation, editMode])

  // Edit ise mevcut veriyi yükle, değilse otomatik kod üret
  useEffect(() => {
    if (editMode) {
      ;(async () => {
        const m = await musteriGetir(editId)
        if (m) {
          setAd(m.ad ?? '')
          setSoyad(m.soyad ?? '')
          setFirma(m.firma ?? '')
          setUnvan(m.unvan ?? '')
          setTelefon(m.telefon ?? '')
          setEmailAdres(m.email ?? '')
          setSehir(m.sehir ?? '')
          setVergiNo(m.vergiNo ?? '')
          setNotlar(m.notlar ?? '')
          setDurum(m.durum ?? 'lead')
          setKod(m.kod ?? '')
        }
        setYukleniyor(false)
      })()
    } else {
      sonrakiMusteriKodu().then(setKod)
    }
  }, [editMode, editId])

  const kaydet = async () => {
    if (!ad.trim() || !soyad.trim() || !firma.trim() || !telefon.trim()) {
      Alert.alert('Eksik', 'Ad, soyad, firma ve telefon zorunlu.')
      return
    }
    setKaydediliyor(true)

    const veri = {
      ad: ad.trim(),
      soyad: soyad.trim(),
      firma: firma.trim(),
      unvan: unvan.trim() || null,
      telefon: telefon.trim(),
      email: emailAdres.trim() || null,
      sehir: sehir.trim() || null,
      vergiNo: vergiNo.trim() || null,
      notlar: notlar.trim() || null,
      durum,
    }

    let sonuc
    if (editMode) {
      sonuc = await musteriGuncelle(editId, veri)
    } else {
      sonuc = await musteriEkle({ ...veri, kod })
      // Yeni müşteri için: formdaki ad/soyad/unvan/telefon/email
      // bilgisini otomatik olarak ana kişi olarak da ekle
      if (sonuc?.id) {
        await musteriKisiEkle({
          musteriId: sonuc.id,
          ad: veri.ad,
          soyad: veri.soyad,
          unvan: veri.unvan,
          telefon: veri.telefon,
          email: veri.email,
          anaKisi: true,
        })
      }
    }

    setKaydediliyor(false)

    if (!sonuc) {
      Alert.alert('Hata', editMode ? 'Müşteri güncellenemedi.' : 'Müşteri eklenemedi. Müşteri kodu çakışmış olabilir.')
      return
    }
    navigation.goBack()
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
        <Text style={[styles.kodBadge, { backgroundColor: colors.surface, color: colors.primary }]}>
          {editMode ? `Kod: ${kod || '—'}` : `Otomatik kod: ${kod || '...'}`}
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Ad *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={ad} onChangeText={setAd} placeholder="Ahmet" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Soyad *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={soyad} onChangeText={setSoyad} placeholder="Yılmaz" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Firma *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={firma} onChangeText={setFirma} placeholder="Şirket Adı" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Ünvan</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={unvan} onChangeText={setUnvan} placeholder="Genel Müdür" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Telefon *</Text>
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

        <Text style={[styles.label, { color: colors.textMuted }]}>Şehir</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]} value={sehir} onChangeText={setSehir} placeholder="İstanbul" placeholderTextColor={colors.textFaded} />

        <Text style={[styles.label, { color: colors.textMuted }]}>Vergi No</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={vergiNo}
          onChangeText={setVergiNo}
          keyboardType="number-pad"
          placeholder="1234567890"
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Durum</Text>
        <View style={styles.row}>
          {DURUMLAR.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.borderStrong }, durum === d.id && styles.chipActive]}
              onPress={() => setDurum(d.id)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, durum === d.id && { color: '#fff' }]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Notlar</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={notlar}
          onChangeText={setNotlar}
          multiline
          placeholder="Ek bilgiler..."
          placeholderTextColor={colors.textFaded}
        />

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor
              ? 'Kaydediliyor...'
              : editMode ? 'Değişiklikleri Kaydet' : 'Müşteriyi Kaydet'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  kodBadge: {
    color: '#3b82f6',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#cbd5e1', fontWeight: '600' },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
