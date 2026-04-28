import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { gorusmeEkle } from '../services/gorusmeService'
import { musterileriGetir } from '../services/musteriService'
import { trIcerir } from '../utils/trSearch'

// Web ile aynı listeler
const VARSAYILAN_KONULAR = [
  'CCTV', 'NVR-ANALİZ', 'Network', 'Teklif', 'Demo',
  'Fuar', 'Access Kontrol', 'Mobiltek', 'Donanım', 'Yazılım', 'Diğer',
]

const IRTIBAT_SEKILLERI = [
  'Telefon', 'WhatsApp', 'Mail', 'Yüz Yüze', 'Merkez',
  'Uzak Bağlantı', 'Bridge', 'Online Toplantı', 'Telegram', 'Diğer',
]

const DURUMLAR = [
  { id: 'acik', isim: 'Açık' },
  { id: 'beklemede', isim: 'Beklemede' },
  { id: 'kapali', isim: 'Kapalı' },
]

export default function YeniGorusmeScreen({ navigation, route }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const baslangicMusteri = route?.params?.musteri

  const [firmaAdi, setFirmaAdi] = useState(baslangicMusteri?.firma ?? '')
  const [musteriId, setMusteriId] = useState(baslangicMusteri?.id ?? null)
  const [muhatapAd, setMuhatapAd] = useState('')
  const [konu, setKonu] = useState('CCTV')
  const [manuelKonu, setManuelKonu] = useState('')
  const [manuelKonuAcik, setManuelKonuAcik] = useState(false)
  const [irtibatSekli, setIrtibatSekli] = useState('Telefon')
  const [notlar, setNotlar] = useState('')
  const [durum, setDurum] = useState('acik')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Müşteri autocomplete
  const [musteriler, setMusteriler] = useState([])
  const [oneriGoster, setOneriGoster] = useState(false)

  useEffect(() => {
    musterileriGetir().then((veri) => setMusteriler(veri ?? []))
  }, [])

  const oneriler = useMemo(() => {
    if (!oneriGoster) return []
    const q = firmaAdi.trim()
    if (!q) return musteriler.slice(0, 20)
    return musteriler
      .filter((m) => trIcerir([m.firma, m.musteriAdi], firmaAdi))
      .slice(0, 20)
  }, [musteriler, firmaAdi, oneriGoster])

  const musteriSec = (m) => {
    setFirmaAdi(m.firma ?? '')
    setMusteriId(m.id)
    if (m.musteriAdi && !muhatapAd.trim()) setMuhatapAd(m.musteriAdi)
    setOneriGoster(false)
  }

  const kaydet = async () => {
    if (!firmaAdi.trim()) {
      Alert.alert('Eksik', 'Firma adı gerekli.')
      return
    }
    const sonKonu = manuelKonuAcik ? manuelKonu.trim() : konu
    if (!sonKonu) {
      Alert.alert('Eksik', 'Konu gerekli.')
      return
    }
    setKaydediliyor(true)
    const bugun = new Date()
    const tarihStr = bugun.toISOString().slice(0, 10)
    const saatStr = `${String(bugun.getHours()).padStart(2, '0')}:${String(bugun.getMinutes()).padStart(2, '0')}`

    const sonuc = await gorusmeEkle({
      firmaAdi: firmaAdi.trim(),
      musteriAdi: muhatapAd.trim() || null,
      konu: sonKonu,
      notlar: notlar.trim() || null,
      tip: irtibatSekli,
      durum,
      tarih: tarihStr,
      saat: saatStr,
      hazirlayan: kullanici?.ad ?? null,
    })
    setKaydediliyor(false)
    if (!sonuc) {
      Alert.alert('Kaydedilemedi', 'Görüşme eklenemedi. Tekrar deneyin.')
      return
    }
    navigation.goBack()
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {/* Firma seç */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Firma Adı *</Text>
          <TextInput
            value={firmaAdi}
            onChangeText={(t) => { setFirmaAdi(t); setOneriGoster(true); setMusteriId(null) }}
            onFocus={() => setOneriGoster(true)}
            placeholder="Müşteri seçmek için dokun veya yaz"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          {oneriGoster && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {musteriler.length === 0 ? 'Yükleniyor…' : `${oneriler.length} müşteri`}
                </Text>
                <TouchableOpacity onPress={() => setOneriGoster(false)} activeOpacity={0.7}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Kapat</Text>
                </TouchableOpacity>
              </View>
              {oneriler.length === 0 && musteriler.length > 0 ? (
                <Text style={{ padding: 14, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                  Eşleşen müşteri yok. Yazılı olarak da kaydedebilirsin.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {oneriler.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => musteriSec(m)}
                      activeOpacity={0.7}
                      style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                        {m.firma || 'Firma yok'}
                      </Text>
                      {!!m.musteriAdi && (
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {m.musteriAdi}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Muhatap */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Muhatap (yetkili)</Text>
          <TextInput
            value={muhatapAd}
            onChangeText={setMuhatapAd}
            placeholder="Konuştuğun kişi"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          {/* Konu */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Konu *</Text>
          <View style={styles.chipRow}>
            {VARSAYILAN_KONULAR.map((k) => {
              const aktif = !manuelKonuAcik && konu === k
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => { setKonu(k); setManuelKonuAcik(false) }}
                  activeOpacity={0.85}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: aktif ? colors.primary : colors.surface }]}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{k}</Text>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity
              onPress={() => setManuelKonuAcik((v) => !v)}
              activeOpacity={0.85}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: manuelKonuAcik ? colors.primary : colors.surface }]}
            >
              <Text style={{ color: manuelKonuAcik ? '#fff' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>✏ Manuel</Text>
            </TouchableOpacity>
          </View>
          {manuelKonuAcik && (
            <TextInput
              value={manuelKonu}
              onChangeText={setManuelKonu}
              placeholder="Konu yaz…"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 8 }]}
            />
          )}

          {/* İrtibat */}
          <Text style={[styles.label, { color: colors.textMuted }]}>İrtibat Şekli</Text>
          <View style={styles.chipRow}>
            {IRTIBAT_SEKILLERI.map((i) => {
              const aktif = irtibatSekli === i
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setIrtibatSekli(i)}
                  activeOpacity={0.85}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: aktif ? colors.primary : colors.surface }]}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{i}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Durum */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Durum</Text>
          <View style={styles.chipRow}>
            {DURUMLAR.map((d) => {
              const aktif = durum === d.id
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setDurum(d.id)}
                  activeOpacity={0.85}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: aktif ? colors.primary : colors.surface }]}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>{d.isim}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Notlar */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Notlar / Takip</Text>
          <TextInput
            value={notlar}
            onChangeText={setNotlar}
            placeholder="Görüşme detayları, takip edilecek konular…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 110 }]}
          />

          <TouchableOpacity
            onPress={kaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
            style={[styles.btn, { backgroundColor: colors.primary, opacity: kaydediliyor ? 0.6 : 1 }]}
          >
            {kaydediliyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.btnText}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dropdown: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
