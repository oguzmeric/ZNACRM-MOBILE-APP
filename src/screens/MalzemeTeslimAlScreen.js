import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import QuickScanner from '../components/QuickScanner'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { servisTalepGetir } from '../services/servisService'
import {
  malzemePlaniGetir,
  malzemePlanGuncelle,
  kullanilanKalemleriGetir,
  kalemKullanimEkle,
  bulkTeslimAl,
} from '../services/servisMalzemeService'
import {
  kalemAra,
  stokKalemGuncelle,
  hareketEkle,
} from '../services/stokKalemiService'

export default function MalzemeTeslimAlScreen({ route, navigation }) {
  const { servisTalepId } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const [talep, setTalep] = useState(null)
  const [plan, setPlan] = useState([])
  const [kullanimKayitlari, setKullanimKayitlari] = useState([])
  const [loading, setLoading] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [sonEklenen, setSonEklenen] = useState(null)
  // Bulk miktar giriş modal'ı
  const [bulkModalPlan, setBulkModalPlan] = useState(null)
  const [bulkMiktar, setBulkMiktar] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: 'Malzeme Teslim Al' })
  }, [navigation])

  const yukle = useCallback(async () => {
    const [t, p, k] = await Promise.all([
      servisTalepGetir(servisTalepId),
      malzemePlaniGetir(servisTalepId),
      kullanilanKalemleriGetir(servisTalepId),
    ])
    setTalep(t)
    setPlan(p ?? [])
    setKullanimKayitlari(k ?? [])
    setLoading(false)
  }, [servisTalepId])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Teslim alınmış kalemler (S/N listesi, henüz kullanılmamış)
  const teslimAlinanlar = kullanimKayitlari.filter((k) => k.durum === 'teslim_alindi')

  const onScan = async (kod) => {
    if (!kod?.trim()) return
    setScannerOpen(false)

    // S/N veya barkodla cihazı bul
    const kalem = await kalemAra(kod)
    if (!kalem) {
      Alert.alert('Bulunamadı', `Seri no / barkod: ${kod}\n\nBu cihaz sistemde kayıtlı değil.`)
      return
    }

    // Zaten teslim alınmış mı?
    const varMi = kullanimKayitlari.find((k) => k.kalemId === kalem.id)
    if (varMi) {
      Alert.alert('Zaten kayıtlı', 'Bu cihaz bu servis için zaten teslim alınmış.')
      return
    }

    // Cihaz depoda mı?
    if (kalem.durum !== 'depoda' && kalem.durum !== 'arizali_depoda') {
      Alert.alert(
        'Uyarı',
        `Cihaz depoda değil. Mevcut durum: ${kalem.durum}\n\nYine de teslim alalım mı?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Teslim Al', onPress: () => teslimAl(kalem) },
        ]
      )
      return
    }

    teslimAl(kalem)
  }

  const teslimAl = async (kalem) => {
    // Hangi plan satırına denk geliyor? (stok_kodu eşleşmesi)
    const ilgiliPlan = plan.find((p) => p.stokKodu === kalem.stokKodu)

    // 1) stok_kalemleri → teknisyene zimmet
    await stokKalemGuncelle(kalem.id, {
      durum: 'teknisyende',
      teknisyenId: kullanici?.id,
      musteriId: null,
      musteriLokasyonId: null,
    })

    // 2) Hareket kaydı
    await hareketEkle({
      kalemId: kalem.id,
      hareket: 'teknisyene_zimmet',
      kaynakAciklama: 'Depo',
      hedefAciklama: `${kullanici?.ad} (Servis ${talep?.talepNo ?? talep?.id})`,
      servisTalepId,
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
    })

    // 3) Servis kalem kullanımı → teslim_alindi
    const kayit = await kalemKullanimEkle({
      servisTalepId,
      kalemId: kalem.id,
      planId: ilgiliPlan?.id ?? null,
      durum: 'teslim_alindi',
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
    })

    // 4) Plan satırının teslim alınan miktarını güncelle
    if (ilgiliPlan) {
      await malzemePlanGuncelle(ilgiliPlan.id, {
        teslimAlinanMiktar: (ilgiliPlan.teslimAlinanMiktar ?? 0) + 1,
      })
    }

    setSonEklenen(kalem)
    yukle()
  }

  const bitir = () => {
    Alert.alert(
      'Teslim almayı bitir',
      `${teslimAlinanlar.length} cihaz teslim aldın. Servise dönelim mi?`,
      [
        { text: 'Devam Et', style: 'cancel' },
        { text: 'Bitir', onPress: () => navigation.goBack() },
      ]
    )
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={[styles.headerBox, { borderBottomColor: colors.border }]}>
        <Text style={styles.servisNo}>{talep?.talepNo ?? '—'}</Text>
        <Text style={[styles.firma, { color: colors.textPrimary }]}>{talep?.firmaAdi ?? '—'}</Text>
      </View>

      {/* Plan özeti */}
      <View style={[styles.planOzet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.planBaslik}>📦 Planlanmış Malzeme</Text>
        {plan.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Bu servis için planlanmış malzeme yok.</Text>
        ) : (
          plan.map((p) => {
            const teslim = p.teslimAlinanMiktar ?? 0
            const tamamTeslim = teslim >= p.planliMiktar
            const isBulk = p.tip === 'bulk'
            const SatirComp = isBulk ? TouchableOpacity : View
            return (
              <SatirComp
                key={p.id}
                style={styles.planSatir}
                onPress={isBulk ? () => {
                  setBulkModalPlan(p)
                  setBulkMiktar(String(p.planliMiktar - teslim))
                } : undefined}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planAd, { color: colors.textPrimary }]} numberOfLines={1}>
                    {p.stokAdi || p.stokKodu}
                    {isBulk && <Text style={styles.bulkTag}> · SARF</Text>}
                  </Text>
                  <Text style={styles.planDetay}>
                    {isBulk ? '🔹 Miktar gir' : `🔸 S/N okut`} · {p.stokKodu}
                  </Text>
                </View>
                <View
                  style={[
                    styles.planProgress,
                    tamamTeslim && { backgroundColor: 'rgba(34, 197, 94, 0.18)', borderColor: '#22c55e' },
                  ]}
                >
                  <Text
                    style={[
                      styles.planProgressText,
                      tamamTeslim && { color: '#22c55e' },
                    ]}
                  >
                    {teslim} / {p.planliMiktar} {p.birim}
                  </Text>
                </View>
              </SatirComp>
            )
          })
        )}
      </View>

      {/* Teslim alınanlar listesi */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          Teslim Alınan ({teslimAlinanlar.length})
        </Text>
        {teslimAlinanlar.length > 0 && (
          <TouchableOpacity onPress={bitir} style={styles.bitirBtn}>
            <Feather name="check" size={14} color="#22c55e" />
            <Text style={styles.bitirText}>Bitir</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={teslimAlinanlar}
        keyExtractor={(k) => String(k.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={42} color="#334155" />
            <Text style={[styles.emptyText, { color: colors.textFaded }]}>
              Henüz cihaz okutmadın.{'\n'}Aşağıdaki butonla S/N okutmaya başla.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const k = item.stokKalemleri // nested
          return (
            <View style={[styles.teslimCard, { backgroundColor: colors.surface }]}>
              <Feather name="check-circle" size={20} color="#22c55e" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.teslimAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {k?.marka ? `${k.marka} ` : ''}{k?.model ?? k?.stokKodu}
                </Text>
                <Text style={[styles.teslimSeri, { color: colors.textMuted }]}>S/N: {k?.seriNo ?? '—'}</Text>
              </View>
            </View>
          )
        }}
      />

      {/* Büyük tarama butonu */}
      <TouchableOpacity
        style={styles.taraFab}
        onPress={() => setScannerOpen(true)}
        activeOpacity={0.85}
      >
        <Feather name="camera" size={20} color="#fff" />
        <Text style={styles.taraFabText}>S/N Okut</Text>
      </TouchableOpacity>

      <QuickScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onScan}
        title="Cihaz S/N Okut"
      />

      {/* Bulk miktar gir modal */}
      <Modal visible={!!bulkModalPlan} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Miktar Teslim Al</Text>
              <TouchableOpacity onPress={() => setBulkModalPlan(null)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={[styles.modalUrunAd, { color: colors.textPrimary }]}>{bulkModalPlan?.stokAdi}</Text>
              <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                Planlı: {bulkModalPlan?.planliMiktar} {bulkModalPlan?.birim} ·
                Teslim: {bulkModalPlan?.teslimAlinanMiktar ?? 0} {bulkModalPlan?.birim}
              </Text>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Teslim aldığın miktar</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderStrong }]}
                value={bulkMiktar}
                onChangeText={setBulkMiktar}
                keyboardType="numeric"
                placeholder={bulkModalPlan?.birim ?? ''}
                placeholderTextColor={colors.textFaded}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalKaydetBtn}
                onPress={async () => {
                  const m = Number(String(bulkMiktar).replace(',', '.'))
                  if (!m || m <= 0) {
                    Alert.alert('Hata', 'Geçerli bir miktar gir.')
                    return
                  }
                  await bulkTeslimAl(bulkModalPlan.id, m, kullanici?.ad ?? 'Mobil')
                  setBulkModalPlan(null)
                  setBulkMiktar('')
                  yukle()
                }}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.modalKaydetText}>Teslim Al</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  headerBox: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  servisNo: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  firma: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },

  planOzet: {
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  planBaslik: { color: '#60a5fa', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  planSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  planAd: { color: '#fff', fontSize: 13, fontWeight: '600' },
  planDetay: { color: '#60a5fa', fontSize: 10, fontWeight: '600', marginTop: 1 },
  planProgress: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  planProgressText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  bitirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  bitirText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },

  teslimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  teslimAd: { color: '#fff', fontSize: 14, fontWeight: '700' },
  teslimSeri: { color: '#94a3b8', fontSize: 12, marginTop: 2, fontFamily: 'monospace' },

  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  bos: { color: '#64748b', fontStyle: 'italic', fontSize: 12 },

  taraFab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  taraFabText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  bulkTag: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
  },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
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
  modalUrunAd: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalHint: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  modalLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalKaydetBtn: {
    marginTop: 20,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalKaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
