import { useCallback, useEffect, useState } from 'react'
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
  banaAtananTalepler,
  acikTalepler,
  servisTalepleriniGetir,
} from '../services/servisService'
import { turBul, aciliyetBul, durumBul } from '../utils/servisConstants'
import { tarihFormat } from '../utils/format'

const SEKMELER = [
  { id: 'bana', label: 'Bana' },
  { id: 'acik', label: 'Açık' },
  { id: 'tumu', label: 'Tümü' },
]

export default function ServisTalepleriScreen({ navigation, route }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const ilkSekme = route?.params?.sekme && SEKMELER.some((s) => s.id === route.params.sekme)
    ? route.params.sekme
    : 'bana'
  const [aktifSekme, setAktifSekme] = useState(ilkSekme)
  const [talepler, setTalepler] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    if (!kullanici) return
    let veri = []
    if (aktifSekme === 'bana') veri = await banaAtananTalepler(kullanici.id)
    else if (aktifSekme === 'acik') veri = await acikTalepler()
    else veri = await servisTalepleriniGetir()
    setTalepler(veri ?? [])
  }, [aktifSekme, kullanici])

  useEffect(() => {
    setLoading(true)
    yukle().finally(() => setLoading(false))
  }, [yukle])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  return (
    <ScreenContainer>
      <View style={styles.tabWrap}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
          {SEKMELER.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.tab,
                aktifSekme === s.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAktifSekme(s.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textMuted },
                  aktifSekme === s.id && { color: '#fff' },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={talepler}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>
              {aktifSekme === 'bana' ? 'Sana atanan talep yok.' : 'Talep yok.'}
            </Text>
          }
          renderItem={({ item }) => {
            const tur = turBul(item.anaTur)
            const aciliyet = aciliyetBul(item.aciliyet)
            const durum = durumBul(item.durum)
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ServisDetay', { id: item.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.talepNo, { color: colors.textFaded }]}>
                    {tur?.ikon} {item.talepNo ?? `#${item.id}`}
                  </Text>
                  {durum && (
                    <Text style={[styles.durumSade, { color: durum.renk }]}>
                      {durum.ikon} {durum.isim}
                    </Text>
                  )}
                </View>

                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.firmaAdi || item.musteriAd || '—'}
                </Text>

                {!!item.konu && (
                  <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.konu}
                  </Text>
                )}

                <Text style={[styles.altMeta, { color: colors.textFaded }]} numberOfLines={1}>
                  {[
                    aciliyet && `${aciliyet.ikon} ${aciliyet.isim}`,
                    item.planliTarih && tarihFormat(item.planliTarih),
                    aktifSekme !== 'bana' && item.atananKullaniciAd && `→ ${item.atananKullaniciAd}`,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniServisTalebi')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Talep</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabText: { fontWeight: '600', fontSize: 13 },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  talepNo: { color: '#64748b', fontWeight: '700', fontSize: 11 },
  durumSade: { fontSize: 11, fontWeight: '700' },

  firma: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  konu: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  altMeta: { color: '#64748b', fontSize: 11, marginTop: 4 },

  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },

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
    gap: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700' },
})
