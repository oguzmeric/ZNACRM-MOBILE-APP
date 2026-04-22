import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import {
  tumDestekTalepleriGetir,
  destekTalepCevapla,
  destekTalepKapat,
  durumEtiket,
} from '../../services/destekService'
import { tarihSaatFormat } from '../../utils/format'

const SEKMELER = [
  { id: 'acik', label: 'Açık' },
  { id: 'cevaplandi', label: 'Cevaplandı' },
  { id: 'kapandi', label: 'Kapandı' },
  { id: 'tumu', label: 'Tümü' },
]

export default function AdminDestekTalepleriScreen() {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const [aktifSekme, setAktifSekme] = useState('acik')
  const [hepsi, setHepsi] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detayTalep, setDetayTalep] = useState(null)
  const [cevapMetni, setCevapMetni] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    const l = await tumDestekTalepleriGetir()
    setHepsi(l ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const filtrelenmis = aktifSekme === 'tumu' ? hepsi : hepsi.filter((t) => t.durum === aktifSekme)

  const cevapla = async () => {
    if (!cevapMetni.trim()) {
      Alert.alert('Eksik', 'Cevap metni boş olamaz.')
      return
    }
    setKaydediliyor(true)
    const sonuc = await destekTalepCevapla(detayTalep.id, cevapMetni.trim(), kullanici?.ad)
    setKaydediliyor(false)
    if (!sonuc) {
      Alert.alert('Hata', 'Cevap kaydedilemedi.')
      return
    }
    setDetayTalep(null)
    setCevapMetni('')
    yukle()
  }

  const kapat = async () => {
    const ok = await destekTalepKapat(detayTalep.id)
    if (ok) {
      setDetayTalep(null)
      yukle()
    } else {
      Alert.alert('Hata', 'Kapatılamadı.')
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {SEKMELER.map((s) => {
          const sayi = s.id === 'tumu' ? hepsi.length : hepsi.filter((t) => t.durum === s.id).length
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.tab,
                { backgroundColor: colors.surface },
                aktifSekme === s.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAktifSekme(s.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === s.id && { color: '#fff' }]}>
                {s.label} · {sayi}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={filtrelenmis}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 40 }}>
            Bu kategoride talep yok.
          </Text>
        }
        renderItem={({ item }) => {
          const d = durumEtiket(item.durum)
          const ozet = (item.mesaj ?? '').split('\n')[0].slice(0, 100)
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                setDetayTalep(item)
                setCevapMetni(item.cevap ?? '')
              }}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.kisi, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.kullaniciAd ?? 'Bilinmiyor'}
                </Text>
                <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                  <Text style={[styles.chipText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
                </View>
              </View>
              <Text style={[styles.mesaj, { color: colors.textSecondary }]} numberOfLines={2}>
                {ozet}
              </Text>
              <Text style={[styles.tarih, { color: colors.textFaded }]}>
                {tarihSaatFormat(item.olusturmaTarih)}
              </Text>
            </TouchableOpacity>
          )
        }}
      />

      {/* Detay + cevap modal */}
      <Modal visible={!!detayTalep} animationType="slide" transparent onRequestClose={() => setDetayTalep(null)}>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.bgDark }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Talep Detayı</Text>
              <TouchableOpacity onPress={() => setDetayTalep(null)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {!!detayTalep && (
              <View style={{ padding: 16 }}>
                <Text style={[styles.detayLabel, { color: colors.textMuted }]}>Gönderen</Text>
                <Text style={[styles.detayDeger, { color: colors.textPrimary }]}>
                  {detayTalep.kullaniciAd ?? '—'}
                </Text>

                <Text style={[styles.detayLabel, { color: colors.textMuted, marginTop: 12 }]}>Mesaj</Text>
                <Text style={[styles.detayDeger, { color: colors.textPrimary, lineHeight: 20 }]}>
                  {detayTalep.mesaj}
                </Text>

                {!!detayTalep.fotoUrl && (
                  <Image
                    source={{ uri: detayTalep.fotoUrl }}
                    style={styles.foto}
                    resizeMode="cover"
                  />
                )}

                <Text style={[styles.detayLabel, { color: colors.textMuted, marginTop: 16 }]}>Cevap</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={cevapMetni}
                  onChangeText={setCevapMetni}
                  placeholder="Kullanıcıya cevabınızı yazın..."
                  placeholderTextColor={colors.textFaded}
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }, kaydediliyor && { opacity: 0.6 }]}
                    onPress={cevapla}
                    disabled={kaydediliyor}
                  >
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.btnText}>
                      {detayTalep.cevap ? 'Cevabı Güncelle' : 'Cevapla'}
                    </Text>
                  </TouchableOpacity>
                  {detayTalep.durum !== 'kapandi' && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.success }]}
                      onPress={kapat}
                    >
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={styles.btnText}>Kapat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  tabText: { fontWeight: '600', fontSize: 11 },

  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  kisi: { fontSize: 14, fontWeight: '700', flex: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '700' },
  mesaj: { fontSize: 12, lineHeight: 17 },
  tarih: { fontSize: 11, marginTop: 6 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  detayLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  detayDeger: { fontSize: 14 },
  foto: { width: '100%', height: 180, borderRadius: 10, marginTop: 10 },
  input: {
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
