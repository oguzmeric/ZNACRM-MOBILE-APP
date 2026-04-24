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
  Alert,
  Pressable,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { acikTalepler, servisAta } from '../../services/servisService'
import { kullanicilariGetir } from '../../services/kullaniciService'
import { turBul, aciliyetBul, durumBul } from '../../utils/servisConstants'
import { tarihSaatFormat } from '../../utils/format'

export default function AdminServisAtamaScreen({ navigation }) {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const [aktifSekme, setAktifSekme] = useState('atanmamis')
  const [talepler, setTalepler] = useState([])
  const [personeller, setPersoneller] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [secilenTalep, setSecilenTalep] = useState(null)
  const [atanıyor, setAtaniyor] = useState(false)

  const yukle = useCallback(async () => {
    const [ttl, kul] = await Promise.all([acikTalepler(), kullanicilariGetir()])
    setTalepler(ttl ?? [])
    const aktif = (kul ?? []).filter((k) => !k.hesapSilindi)
    setPersoneller(aktif)
    setLoading(false)
  }, [])

  const gosterilen = aktifSekme === 'atanmamis'
    ? talepler.filter((t) => !t.atananKullaniciId || t.durum === 'bekliyor')
    : talepler

  const atanmamisSayi = talepler.filter((t) => !t.atananKullaniciId || t.durum === 'bekliyor').length

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const atamaYap = async (personel) => {
    if (!secilenTalep) return
    setAtaniyor(true)
    const guncel = await servisAta(secilenTalep.id, personel, kullanici?.ad)
    setAtaniyor(false)
    if (!guncel) {
      Alert.alert('Hata', 'Atama başarısız.')
      return
    }
    setSecilenTalep(null)
    Alert.alert('✅ Atandı', `${secilenTalep.talepNo ?? '#' + secilenTalep.id} · ${personel.ad}`, [
      { text: 'Tamam', onPress: yukle },
    ])
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
      {/* Sekmeler */}
      <View style={styles.tabWrap}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, aktifSekme === 'atanmamis' && { backgroundColor: colors.primary }]}
            onPress={() => setAktifSekme('atanmamis')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === 'atanmamis' && { color: '#fff' }]}>
              Atanmamış · {atanmamisSayi}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, aktifSekme === 'tumu' && { backgroundColor: colors.primary }]}
            onPress={() => setAktifSekme('tumu')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === 'tumu' && { color: '#fff' }]}>
              Aktif · {talepler.length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={gosterilen}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={44} color={colors.textFaded} />
            <Text style={[styles.emptyBaslik, { color: colors.textSecondary }]}>
              {aktifSekme === 'atanmamis' ? '🎉 Tüm talepler atanmış' : 'Aktif servis talebi yok'}
            </Text>
            <Text style={[styles.emptyAciklama, { color: colors.textFaded }]}>
              {aktifSekme === 'atanmamis'
                ? 'Yeni bir talep geldiğinde burada görünecek.'
                : 'Sağ alttaki "+ Yeni Talep" butonu ile yeni servis talebi oluşturabilirsin.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tur = turBul(item.anaTur)
          const aciliyet = aciliyetBul(item.aciliyet)
          const durum = durumBul(item.durum)
          const atanmamis = !item.atananKullaniciId || item.durum === 'bekliyor'
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => setSecilenTalep(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.talepNo, { color: colors.primaryLight }]}>
                  {tur?.ikon} {item.talepNo ?? `#${item.id}`}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {durum && (
                    <View style={[styles.chip, { backgroundColor: durum.renk + '22', borderColor: durum.renk }]}>
                      <Text style={[styles.chipText, { color: durum.renk }]}>{durum.isim}</Text>
                    </View>
                  )}
                  {aciliyet && aciliyet.id !== 'normal' && (
                    <View style={[styles.chip, { backgroundColor: aciliyet.renk + '22', borderColor: aciliyet.renk }]}>
                      <Text style={[styles.chipText, { color: aciliyet.renk }]}>{aciliyet.isim}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.firmaAdi ?? '—'}
              </Text>
              {!!item.konu && (
                <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={2}>
                  {item.konu}
                </Text>
              )}
              <View style={styles.cardFooter}>
                <Text style={[styles.meta, { color: colors.textFaded }]}>
                  {tarihSaatFormat(item.olusturmaTarihi)}
                </Text>
                <TouchableOpacity
                  style={[styles.ataBtn, {
                    backgroundColor: atanmamis ? colors.primary : colors.surface,
                    borderColor: atanmamis ? colors.primary : colors.borderStrong,
                  }]}
                  onPress={() => setSecilenTalep(item)}
                  activeOpacity={0.85}
                >
                  <Feather name={atanmamis ? 'user-plus' : 'users'} size={13} color={atanmamis ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.ataBtnText, { color: atanmamis ? '#fff' : colors.textSecondary }]}>
                    {atanmamis ? 'Personel Ata' : (item.atananKullaniciAd ?? 'Değiştir')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('YeniServisTalebi')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Talep</Text>
      </TouchableOpacity>

      {/* Personel seçim modalı */}
      <Modal
        visible={!!secilenTalep}
        animationType="slide"
        transparent
        onRequestClose={() => setSecilenTalep(null)}
      >
        <View style={styles.modalBg}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSecilenTalep(null)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.bgDark }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Personel Seç</Text>
                <Text style={[styles.modalAlt, { color: colors.textMuted }]}>
                  {secilenTalep?.talepNo} · {secilenTalep?.firmaAdi}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSecilenTalep(null)}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={personeller}
              keyExtractor={(p) => String(p.id)}
              ListEmptyComponent={
                <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 30 }}>
                  Saha personeli bulunamadı.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.personelRow, { borderBottomColor: colors.border }]}
                  onPress={() => atamaYap(item)}
                  disabled={atanıyor}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarInitial}>{(item.ad?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.personelAd, { color: colors.textPrimary }]}>{item.ad}</Text>
                    <Text style={[styles.personelUnvan, { color: colors.textMuted }]}>{item.unvan}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textFaded} />
                </TouchableOpacity>
              )}
            />
            {atanıyor && (
              <View style={styles.yukleniyorOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 13 },

  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30, gap: 8 },
  emptyBaslik: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptyAciklama: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

  ataBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  ataBtnText: { fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700' },

  aciklama: { fontSize: 12, marginBottom: 12, lineHeight: 17 },
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
  },
  talepNo: { fontSize: 12, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  firma: { fontSize: 15, fontWeight: '700' },
  konu: { fontSize: 12, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  meta: { fontSize: 11 },
  metaAta: { fontSize: 12, fontWeight: '700' },

  modalBg: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalAlt: { fontSize: 11, marginTop: 2 },

  personelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 15 },
  personelAd: { fontSize: 14, fontWeight: '700' },
  personelUnvan: { fontSize: 11, marginTop: 2 },

  yukleniyorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
