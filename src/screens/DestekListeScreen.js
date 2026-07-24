import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  kullaniciDestekTalepleriniGetir, tumDestekTalepleriGetir,
  durumEtiket, DESTEK_YONETICISI_ID,
} from '../services/destekService'

const SEKMELER = [
  { id: 'acik', label: 'Açık' },
  { id: 'cevaplandi', label: 'Cevaplandı' },
  { id: 'kapandi', label: 'Kapandı' },
  { id: 'tumu', label: 'Tümü' },
]
import { tarihSaatFormat } from '../utils/format'

export default function DestekListeScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [talepler, setTalepler] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [aktifSekme, setAktifSekme] = useState('acik')

  // Destek yöneticisi (Oğuz, id 2) web'deki gibi HERKESİN taleplerini görür;
  // diğer kullanıcılar yalnız kendininkini. (Web /destek ile hizalı, 2026-07-24.)
  const yoneticiMi = Number(kullanici?.id) === DESTEK_YONETICISI_ID

  const yukle = useCallback(async () => {
    if (!kullanici) return
    const l = yoneticiMi
      ? await tumDestekTalepleriGetir()
      : await kullaniciDestekTalepleriniGetir(kullanici.id)
    setTalepler(l ?? [])
    setLoading(false)
  }, [kullanici, yoneticiMi])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  const filtrelenmis = aktifSekme === 'tumu'
    ? talepler
    : talepler.filter((t) => t.durum === aktifSekme)

  return (
    <ScreenContainer>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {SEKMELER.map((s) => {
          const sayi = s.id === 'tumu'
            ? talepler.length
            : talepler.filter((t) => t.durum === s.id).length
          const aktif = aktifSekme === s.id
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.tab,
                { backgroundColor: colors.surface },
                aktif && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAktifSekme(s.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, aktif && { color: '#fff' }]}>
                {s.label} · {sayi}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <FlatList
        data={filtrelenmis}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          talepler.length > 0 ? (
            <View style={styles.bosWrap}>
              <Text style={[styles.bosBaslik, { color: colors.textSecondary }]}>Bu sekmede talep yok</Text>
            </View>
          ) : (
            <View style={styles.bosWrap}>
              <Text style={[styles.bosBaslik, { color: colors.textSecondary }]}>Henüz destek talebin yok</Text>
              <Text style={[styles.bosAciklama, { color: colors.textFaded }]}>
                Uygulamada bir sorunla karşılaşırsan veya öneri paylaşmak istersen{'\n'}
                aşağıdaki butonla yeni talep oluşturabilirsin.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const d = durumEtiket(item.durum)
          const ozet = (item.mesaj ?? '').split('\n')[0].slice(0, 80)
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('DestekDetay', { id: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardBaslik, { color: colors.textPrimary }]} numberOfLines={1}>{ozet}</Text>
                <View style={[styles.durumChip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                  <Text style={[styles.durumText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
                </View>
              </View>
              {yoneticiMi && !!item.kullaniciAd && (
                <Text style={[styles.cardSahip, { color: colors.textSecondary }]} numberOfLines={1}>
                  👤 {item.kullaniciAd}
                </Text>
              )}
              <Text style={[styles.cardTarih, { color: colors.textFaded }]}>{tarihSaatFormat(item.olusturmaTarih)}</Text>
              {!!item.cevap && (
                <View style={styles.cevapBanner}>
                  <Feather name="message-circle" size={12} color={colors.primaryLight} />
                  <Text style={[styles.cevapText, { color: colors.textSecondary }]} numberOfLines={1}>
                    Cevap: {item.cevap}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniDestek')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>Yeni Talep</Text>
      </TouchableOpacity>
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

  bosWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  bosBaslik: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  bosAciklama: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  cardBaslik: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  durumChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  durumText: { fontSize: 11, fontWeight: '700' },
  cardTarih: { color: '#64748b', fontSize: 11 },
  cardSahip: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cevapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderRadius: 6,
  },
  cevapText: { color: '#cbd5e1', fontSize: 12, flex: 1 },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
