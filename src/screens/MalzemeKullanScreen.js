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
  ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import CihazTeknikBilgiModal from '../components/CihazTeknikBilgiModal'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { servisTalepGetir } from '../services/servisService'
import {
  kullanilanKalemleriGetir,
  kalemKullanimEkle,
  malzemePlaniGetir,
  malzemePlanGuncelle,
  bulkKullan,
} from '../services/servisMalzemeService'
import {
  stokKalemGetir,
  cihazTak,
} from '../services/stokKalemiService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'

export default function MalzemeKullanScreen({ route, navigation }) {
  const { servisTalepId } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const [talep, setTalep] = useState(null)
  const [plan, setPlan] = useState([])
  const [kayitlar, setKayitlar] = useState([])
  const [lokasyon, setLokasyon] = useState(null)
  const [loading, setLoading] = useState(true)

  // Teknik bilgi popup (kullanıldı → popup açılır)
  const [teknikPopupKalem, setTeknikPopupKalem] = useState(null)

  // Bulk kullanım modal
  const [bulkModalPlan, setBulkModalPlan] = useState(null)
  const [bulkMiktar, setBulkMiktar] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: 'Sahada Kullan' })
  }, [navigation])

  const yukle = useCallback(async () => {
    const [t, p, k] = await Promise.all([
      servisTalepGetir(servisTalepId),
      malzemePlaniGetir(servisTalepId),
      kullanilanKalemleriGetir(servisTalepId),
    ])
    setTalep(t)
    setPlan(p ?? [])
    setKayitlar(k ?? [])
    // Servis için müşteri lokasyonunu yükle (ilk aktif lokasyon)
    if (t?.musteriId) {
      const ls = await musteriLokasyonlariniGetir(t.musteriId)
      const aktif = (ls ?? []).filter((l) => l.aktif)
      setLokasyon(aktif[0] ?? null)
    }
    setLoading(false)
  }, [servisTalepId])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Teslim alınmış ama henüz kullanılmamış — sahada kullanılabilir
  const kullanilacakKalemIdleri = useCallback(() => {
    const kullanilanIds = new Set(
      kayitlar.filter((k) => k.durum === 'kullanildi').map((k) => k.kalemId)
    )
    const teslimIds = kayitlar
      .filter((k) => k.durum === 'teslim_alindi' && !kullanilanIds.has(k.kalemId))
      .map((k) => k.kalemId)
    return teslimIds
  }, [kayitlar])

  const [envanter, setEnvanter] = useState([])
  useEffect(() => {
    ;(async () => {
      const ids = kullanilacakKalemIdleri()
      if (ids.length === 0) {
        setEnvanter([])
        return
      }
      // Her kalem için veri al (basit yaklaşım)
      const items = []
      for (const kid of ids) {
        const k = await stokKalemGetir(kid)
        if (k) items.push(k)
      }
      setEnvanter(items)
    })()
  }, [kayitlar, kullanilacakKalemIdleri])

  const kullanilanKayitlar = kayitlar.filter((k) => k.durum === 'kullanildi')

  const sahadaKullan = async (kalem) => {
    if (!talep?.musteriId) {
      Alert.alert('Hata', 'Servis talebinde müşteri yok.')
      return
    }
    if (!lokasyon) {
      Alert.alert(
        'Lokasyon yok',
        'Müşteride aktif lokasyon yok. Müşteri detayından lokasyon ekleyin.',
      )
      return
    }

    // 1) Cihazı müşteriye tak (sahada)
    const guncel = await cihazTak({
      kalemId: kalem.id,
      musteriId: talep.musteriId,
      musteriLokasyonId: lokasyon.id,
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
      servisTalepId,
      not: `Servis: ${talep.talepNo ?? talep.id}`,
    })

    if (!guncel) {
      Alert.alert('Hata', 'Cihaz takılamadı.')
      return
    }

    // 2) Kullanım kaydı (kullanildi)
    const plan_id = (plan.find((p) => p.stokKodu === kalem.stokKodu))?.id ?? null
    await kalemKullanimEkle({
      servisTalepId,
      kalemId: kalem.id,
      planId: plan_id,
      durum: 'kullanildi',
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
    })

    // 3) Plan satırı → kullanılan miktar +1
    if (plan_id) {
      const p = plan.find((x) => x.id === plan_id)
      await malzemePlanGuncelle(plan_id, {
        kullanilanMiktar: (p.kullanilanMiktar ?? 0) + 1,
      })
    }

    // 4) Teknik bilgi popup'ı aç
    setTeknikPopupKalem(guncel)
  }

  const popupKapandi = () => {
    setTeknikPopupKalem(null)
    yukle()
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
        {lokasyon && <Text style={styles.lokasyon}>📍 {lokasyon.ad}</Text>}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* SARF malzemeler (Cat6, vida, jack — miktar bazlı) */}
        {plan.filter((p) => p.tip === 'bulk').length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              🧵 Sarf Malzemeler ({plan.filter((p) => p.tip === 'bulk').length})
            </Text>
            <Text style={[styles.aciklama, { color: colors.textMuted }]}>
              Kablo, vida, jack gibi miktar bazlı malzemeler. Sahada kullandığın miktarı gir.
            </Text>
            {plan.filter((p) => p.tip === 'bulk').map((p) => {
              const kalan = (p.teslimAlinanMiktar ?? 0) - (p.kullanilanMiktar ?? 0)
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.bulkCard}
                  activeOpacity={0.85}
                  disabled={kalan <= 0}
                  onPress={() => {
                    setBulkModalPlan(p)
                    setBulkMiktar(String(kalan))
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bulkAd, { color: colors.textPrimary }]} numberOfLines={1}>{p.stokAdi}</Text>
                    <Text style={[styles.bulkDetay, { color: colors.textMuted }]}>
                      Teslim: {p.teslimAlinanMiktar ?? 0} · Kullanılan: {p.kullanilanMiktar ?? 0} ·
                      {' '}
                      <Text style={{ color: kalan > 0 ? '#22c55e' : colors.textFaded, fontWeight: '700' }}>
                        Kalan: {kalan}
                      </Text>{' '}{p.birim}
                    </Text>
                  </View>
                  {kalan > 0 ? (
                    <Feather name="chevron-right" size={20} color="#60a5fa" />
                  ) : (
                    <Feather name="check" size={20} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )
            })}
          </>
        )}

        {/* SERİ NO'lu cihazlar */}
        {envanter.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: plan.filter((p) => p.tip === 'bulk').length > 0 ? 20 : 0 }]}>
              📹 Envanterdeki Cihazlar ({envanter.length})
            </Text>
            <Text style={[styles.aciklama, { color: colors.textMuted }]}>
              Kamera, switch, NVR gibi S/N takipli cihazlar. Üstüne dokun → müşteriye takılır + teknik bilgi sorulur.
            </Text>
            {envanter.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.kalemCard}
                onPress={() => sahadaKullan(item)}
                activeOpacity={0.85}
              >
                <View style={styles.kalemIkon}>
                  <Feather name="video" size={18} color="#60a5fa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kalemAd, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.marka ? `${item.marka} ` : ''}{item.model ?? item.stokKodu}
                  </Text>
                  <Text style={[styles.kalemSeri, { color: colors.textMuted }]}>S/N: {item.seriNo ?? '—'}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#475569" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {envanter.length === 0 && plan.filter((p) => p.tip === 'bulk').length === 0 && (
          <View style={styles.empty}>
            <Feather name="package" size={42} color="#334155" />
            <Text style={[styles.emptyText, { color: colors.textFaded }]}>
              Henüz teslim alınmış malzeme yok.{'\n'}
              Önce "Teslim Al" ekranından malzemeleri al.
            </Text>
          </View>
        )}

        {/* Kullanılan (tamamlanmış) S/N cihazlar */}
        {kullanilanKayitlar.length > 0 && (
          <View style={styles.kullanilanBox}>
            <Text style={styles.kullanilanBaslik}>
              ✅ Takılan Cihaz: {kullanilanKayitlar.length}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Cihaz popup (teknik bilgi — müşteriye takılınca otomatik açılır) */}
      <CihazTeknikBilgiModal
        visible={!!teknikPopupKalem}
        onClose={popupKapandi}
        kalem={teknikPopupKalem}
        onSave={popupKapandi}
        zorunlu={true}
      />

      {/* Bulk kullanım modal */}
      <Modal visible={!!bulkModalPlan} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kullanılan Miktar</Text>
              <TouchableOpacity onPress={() => setBulkModalPlan(null)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={[styles.modalUrunAd, { color: colors.textPrimary }]}>{bulkModalPlan?.stokAdi}</Text>
              <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                Elinde {(bulkModalPlan?.teslimAlinanMiktar ?? 0) - (bulkModalPlan?.kullanilanMiktar ?? 0)} {bulkModalPlan?.birim} var.
              </Text>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Sahada kullandığın miktar</Text>
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
                  const kalan = (bulkModalPlan.teslimAlinanMiktar ?? 0) - (bulkModalPlan.kullanilanMiktar ?? 0)
                  if (!m || m <= 0) return Alert.alert('Hata', 'Geçerli bir miktar gir.')
                  if (m > kalan) return Alert.alert('Uyarı', `Elinde sadece ${kalan} ${bulkModalPlan.birim} var.`)
                  await bulkKullan(bulkModalPlan.id, m)
                  setBulkModalPlan(null)
                  setBulkMiktar('')
                  yukle()
                }}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.modalKaydetText}>Kullanımı Kaydet</Text>
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
  lokasyon: { color: '#22c55e', fontSize: 13, marginTop: 6, fontWeight: '600' },

  sectionLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  aciklama: { color: '#94a3b8', fontSize: 12, marginBottom: 12, lineHeight: 17 },

  kalemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  kalemIkon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kalemAd: { color: '#fff', fontSize: 14, fontWeight: '700' },
  kalemSeri: { color: '#94a3b8', fontSize: 12, marginTop: 2, fontFamily: 'monospace' },

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

  kullanilanBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  kullanilanBaslik: { color: '#22c55e', fontWeight: '800', fontSize: 14 },

  bulkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  bulkAd: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bulkDetay: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

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
