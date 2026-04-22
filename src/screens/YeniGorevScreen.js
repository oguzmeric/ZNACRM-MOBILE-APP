import { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { kullanicilariGetir } from '../services/kullaniciService'
import { musterileriGetir } from '../services/musteriService'
import { gorevEkle } from '../services/gorevService'

const ONCELIKLER = [
  { id: 'dusuk', label: 'Düşük' },
  { id: 'normal', label: 'Normal' },
  { id: 'yuksek', label: 'Yüksek' },
]

export default function YeniGorevScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const [baslik, setBaslik] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [oncelik, setOncelik] = useState('normal')
  const [bitisTarihi, setBitisTarihi] = useState('') // YYYY-MM-DD

  const [atanan, setAtanan] = useState(null)
  const [kullanicilar, setKullanicilar] = useState([])
  const [kullaniciPickerOpen, setKullaniciPickerOpen] = useState(false)

  const [musteri, setMusteri] = useState(null)
  const [musteriler, setMusteriler] = useState([])
  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')

  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    kullanicilariGetir().then((list) => setKullanicilar(list ?? []))
    musterileriGetir().then((list) => setMusteriler(list ?? []))
  }, [])

  const filtrelenmisMusteriler = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    const q = musteriArama.toLowerCase()
    return musteriler.filter((m) =>
      [m.firma, m.ad, m.soyad, m.telefon, m.kod]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [musteriler, musteriArama])

  const kaydet = async () => {
    if (!baslik.trim()) {
      Alert.alert('Eksik', 'Başlık gerekli.')
      return
    }
    if (!atanan) {
      Alert.alert('Eksik', 'Bir kullanıcıya atayın.')
      return
    }
    if (bitisTarihi && !/^\d{4}-\d{2}-\d{2}$/.test(bitisTarihi)) {
      Alert.alert('Tarih hatalı', 'YYYY-AA-GG formatında yaz (örn 2026-04-25).')
      return
    }

    setKaydediliyor(true)
    const yeni = await gorevEkle({
      baslik: baslik.trim(),
      aciklama: aciklama.trim() || null,
      durum: 'bekliyor',
      oncelik,
      atananId: atanan.id,
      atananAd: atanan.ad,
      olusturanAd: kullanici?.ad ?? '',
      bitisTarihi: bitisTarihi || null,
      musteriId: musteri?.id ?? null,
      firmaAdi: musteri ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim()) : null,
    })
    setKaydediliyor(false)

    if (!yeni) {
      Alert.alert('Hata', 'Görev oluşturulamadı.')
      return
    }
    navigation.goBack()
  }

  const inputStyle = [styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]

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
        <Text style={[styles.label, { color: colors.textMuted }]}>Başlık *</Text>
        <TextInput
          style={inputStyle}
          placeholder="Görev başlığı"
          placeholderTextColor={colors.textFaded}
          value={baslik}
          onChangeText={setBaslik}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Açıklama</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, height: 100, textAlignVertical: 'top' }]}
          placeholder="Detaylar..."
          placeholderTextColor={colors.textFaded}
          multiline
          value={aciklama}
          onChangeText={setAciklama}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Atanacak Kullanıcı *</Text>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: colors.surface }]}
          onPress={() => setKullaniciPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: atanan ? colors.textPrimary : colors.textFaded }}>
            {atanan ? atanan.ad : 'Kullanıcı seç...'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.textMuted }]}>Bağlı Müşteri (opsiyonel)</Text>
        <View style={styles.musteriRow}>
          <TouchableOpacity
            style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
            onPress={() => setMusteriPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: musteri ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
              {musteri
                ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim())
                : 'Müşteri seç...'}
            </Text>
          </TouchableOpacity>
          {!!musteri && (
            <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setMusteri(null)}>
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Öncelik</Text>
        <View style={styles.row}>
          {ONCELIKLER.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.borderStrong }, oncelik === o.id && styles.chipActive]}
              onPress={() => setOncelik(o.id)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, oncelik === o.id && { color: '#fff' }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Bitiş Tarihi (YYYY-AA-GG)</Text>
        <TextInput
          style={inputStyle}
          placeholder="2026-04-30"
          placeholderTextColor={colors.textFaded}
          value={bitisTarihi}
          onChangeText={setBitisTarihi}
          keyboardType="numbers-and-punctuation"
        />

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Görevi Oluştur'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Kullanıcı seçici */}
      <Modal visible={kullaniciPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kullanıcı Seç</Text>
              <TouchableOpacity onPress={() => setKullaniciPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={kullanicilar}
              keyExtractor={(k) => String(k.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setAtanan(item)
                    setKullaniciPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{item.ad}</Text>
                  {!!item.rol && (
                    <Text style={{ color: colors.textFaded, fontSize: 12 }}>{item.rol}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Müşteri seçici (aramalı) */}
      <Modal visible={musteriPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteri Seç</Text>
              <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <TextInput
                style={[styles.modalSearch, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                placeholder="Ara: firma, ad, telefon, kod..."
                placeholderTextColor={colors.textFaded}
                value={musteriArama}
                onChangeText={setMusteriArama}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filtrelenmisMusteriler}
              keyExtractor={(m) => String(m.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 24 }}>
                  Eşleşen müşteri yok.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setMusteri(item)
                    setMusteriPickerOpen(false)
                    setMusteriArama('')
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }} numberOfLines={1}>
                    {item.firma || `${item.ad} ${item.soyad}`}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.ad} {item.soyad}
                    {item.telefon ? ` · ${item.telefon}` : ''}
                    {item.kod ? ` · ${item.kod}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  musteriRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    backgroundColor: '#1e293b',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearText: { color: '#ef4444', fontSize: 22, fontWeight: '700' },

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

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSearch: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
})
