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
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { stokKalemEkle, hareketEkle } from '../services/stokKalemiService'
import EtiketTarayici from '../components/EtiketTarayici'

export default function YeniCihazScreen({ route, navigation }) {
  const { onaySeriNo } = route.params ?? {}
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()

  const [seriNo, setSeriNo] = useState(onaySeriNo ?? '')
  const [barkod, setBarkod] = useState('')
  const [marka, setMarka] = useState('')
  const [model, setModel] = useState('')
  const [stokKodu, setStokKodu] = useState('')
  const [notlar, setNotlar] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [tarayiciOpen, setTarayiciOpen] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: 'Yeni Cihaz Kaydı' })
  }, [navigation])

  const onTaramaTamam = (atamalar) => {
    if (atamalar.seriNo) setSeriNo(atamalar.seriNo)
    if (atamalar.barkod) setBarkod(atamalar.barkod)
    if (atamalar.model) setModel(atamalar.model)
    if (atamalar.stokKodu) setStokKodu(atamalar.stokKodu)
  }

  const kaydet = async () => {
    if (!seriNo.trim() && !barkod.trim()) {
      Alert.alert('Eksik', 'Seri no veya barkod en az biri gerekli.')
      return
    }
    if (!model.trim() && !stokKodu.trim()) {
      Alert.alert('Eksik', 'Model veya stok kodu en az biri gerekli.')
      return
    }

    setKaydediliyor(true)

    // Stok kodu otomatik üret (boşsa): MOB-{S/N son 6 hane} veya MOB-{rastgele}
    let kullanilacakStokKodu = stokKodu.trim()
    if (!kullanilacakStokKodu) {
      const sonHane = (seriNo.trim() || barkod.trim()).slice(-6).toUpperCase()
      kullanilacakStokKodu = sonHane
        ? `MOB-${sonHane}`
        : `MOB-${Date.now().toString().slice(-6)}`
    }

    const yeni = await stokKalemEkle({
      stokKodu: kullanilacakStokKodu,
      seriNo: seriNo.trim() || null,
      barkod: barkod.trim() || null,
      marka: marka.trim() || null,
      model: model.trim() || null,
      notlar: notlar.trim() || null,
      durum: 'depoda',
    })

    if (yeni) {
      await hareketEkle({
        kalemId: yeni.id,
        hareket: 'depoya_donus',
        kaynakAciklama: 'İlk kayıt',
        hedefAciklama: 'Depo',
        kullaniciId: kullanici?.id,
        kullaniciAd: kullanici?.ad,
        notMetni: 'İlk kayıt — sisteme eklendi',
      })
    }

    setKaydediliyor(false)

    if (!yeni) {
      Alert.alert('Hata', 'Kaydedilemedi. Bu seri no zaten kayıtlı olabilir.')
      return
    }
    navigation.replace('CihazDetay', { id: yeni.id })
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
        <Text style={[styles.bilgi, { backgroundColor: colors.surface, color: colors.primary }]}>
          Etiketteki tüm barkodları tek seferde okutmak için aşağıdaki butona bas.
          Bulunan kodları sen seçip ilgili alana ata.
        </Text>

        <TouchableOpacity
          style={styles.taraEtiketBtn}
          onPress={() => setTarayiciOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.taraEtiketText}>📷 Etiketteki Tüm Barkodları Tara</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.textMuted }]}>Seri No (S/N)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={seriNo}
          onChangeText={setSeriNo}
          placeholder="Üretici S/N"
          placeholderTextColor={colors.textFaded}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Barkod</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={barkod}
          onChangeText={setBarkod}
          placeholder="Ek barkod (opsiyonel)"
          placeholderTextColor={colors.textFaded}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Marka</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={marka}
              onChangeText={setMarka}
              placeholder="Hyrbone, Hikvision..."
              placeholderTextColor={colors.textFaded}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Model</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={model}
              onChangeText={setModel}
              placeholder="DS-2CD2143..."
              placeholderTextColor={colors.textFaded}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Stok Kodu (opsiyonel)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={stokKodu}
          onChangeText={setStokKodu}
          placeholder="Web kataloğundaki kod (boşsa otomatik üretilir)"
          placeholderTextColor={colors.textFaded}
          autoCapitalize="characters"
        />
        <Text style={[styles.hint, { color: colors.textFaded }]}>
          Boş bırakırsan: MOB-{`{S/N son 6 hane}`} şeklinde otomatik üretilir.
          Web'deki bir kataloğa bağlamak istiyorsan onun stok kodunu yaz.
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Notlar</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={notlar}
          onChangeText={setNotlar}
          multiline
          placeholder="Garanti süresi, alış faturası, vb."
          placeholderTextColor={colors.textFaded}
        />

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Cihazı Depoya Kaydet'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <EtiketTarayici
        visible={tarayiciOpen}
        onClose={() => setTarayiciOpen(false)}
        onTamam={onTaramaTamam}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  bilgi: {
    color: '#3b82f6',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  taraEtiketBtn: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  taraEtiketText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  hint: { color: '#64748b', fontSize: 11, marginTop: 4, fontStyle: 'italic', lineHeight: 16 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  row2: { flexDirection: 'row', gap: 8 },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
