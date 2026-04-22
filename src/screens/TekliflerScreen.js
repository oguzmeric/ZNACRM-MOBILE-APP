import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  teklifleriGetir,
  benimTekliflerim,
  onayDurumuBul,
} from '../services/teklifService'
import { tarihFormat } from '../utils/format'
import { paraFormat } from '../utils/paraFormat'

const SEKMELER = [
  { id: 'takipte', label: 'Takipte' },
  { id: 'kabul', label: 'Kabul' },
  { id: 'vazgecildi', label: 'Red' },
  { id: 'tumu', label: 'Tümü' },
]

export default function TekliflerScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('takipte')
  const [teklifler, setTeklifler] = useState([])
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    if (!kullanici) return
    let veri = []
    if (aktifSekme === 'tumu') {
      veri = await teklifleriGetir()
    } else {
      const hepsi = await teklifleriGetir()
      veri = (hepsi ?? []).filter((t) => {
        if (aktifSekme === 'takipte') return ['takipte', 'revizyon'].includes(t.onayDurumu)
        return t.onayDurumu === aktifSekme
      })
    }
    setTeklifler(veri ?? [])
  }, [aktifSekme, kullanici])

  useEffect(() => {
    setLoading(true)
    yukle().finally(() => setLoading(false))
  }, [yukle])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const filtrelenmis = useMemo(() => {
    if (!arama.trim()) return teklifler
    const q = arama.toLowerCase()
    return teklifler.filter((t) =>
      [t.teklifNo, t.firmaAdi, t.konu, t.musteriYetkilisi]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [teklifler, arama])

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
              style={[styles.tab, aktifSekme === s.id && { backgroundColor: colors.primary }]}
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

      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.search, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          placeholder="Ara: teklif no, firma, konu..."
          placeholderTextColor={colors.textFaded}
          value={arama}
          onChangeText={setArama}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtrelenmis}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>
              {arama ? 'Eşleşen teklif yok.' : 'Henüz teklif yok.'}
            </Text>
          }
          renderItem={({ item }) => {
            const d = onayDurumuBul(item.onayDurumu)
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('TeklifDetay', { id: item.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.teklifNo, { color: colors.textFaded }]}>
                    {item.teklifNo ?? `#${item.id}`}
                    {item.revizyon > 0 && ` · R${item.revizyon}`}
                  </Text>
                  {d && (
                    <Text style={[styles.durumTextSade, { color: d.renk }]}>
                      {d.ikon} {d.isim}
                    </Text>
                  )}
                </View>

                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.firmaAdi || '—'}
                </Text>

                {!!item.konu && (
                  <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.konu}
                  </Text>
                )}

                <View style={styles.cardFooter}>
                  <Text style={[styles.tutar, { color: colors.success }]}>
                    {paraFormat(item.genelToplam, item.paraBirimi)}
                  </Text>
                  {!!item.tarih && (
                    <Text style={[styles.tarih, { color: colors.textFaded }]}>{tarihFormat(item.tarih)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniTeklif')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Teklif</Text>
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

  searchWrap: {
    padding: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  search: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },

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
  teklifNo: { color: '#64748b', fontWeight: '600', fontSize: 11 },
  durumTextSade: { fontSize: 11, fontWeight: '700' },

  firma: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  konu: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  tutar: { color: '#22c55e', fontSize: 15, fontWeight: '800' },
  tarih: { color: '#64748b', fontSize: 11 },

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
