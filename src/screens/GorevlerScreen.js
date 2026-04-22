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
  banaAtananGorevler,
  atadigimGorevler,
  gorevleriGetir,
} from '../services/gorevService'
import {
  tarihFormat,
  renkDurum,
  renkOncelik,
  etiketDurum,
  etiketOncelik,
} from '../utils/format'

const SEKMELER = [
  { id: 'bana', label: 'Bana' },
  { id: 'atadigim', label: 'Atadıklarım' },
  { id: 'tumu', label: 'Tümü' },
]

export default function GorevlerScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('bana')
  const [gorevler, setGorevler] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    if (!kullanici) return
    let veri = []
    if (aktifSekme === 'bana') veri = await banaAtananGorevler(kullanici.id)
    else if (aktifSekme === 'atadigim') veri = await atadigimGorevler(kullanici.ad)
    else veri = await gorevleriGetir()
    setGorevler(veri ?? [])
  }, [aktifSekme, kullanici])

  useEffect(() => {
    setLoading(true)
    yukle().finally(() => setLoading(false))
  }, [yukle])

  // Ekrana her dönüşte yenile (yeni görev eklendiğinde liste güncellensin)
  useFocusEffect(
    useCallback(() => {
      yukle()
    }, [yukle])
  )

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
              <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === s.id && { color: '#fff' }]}>
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
          data={gorevler}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>Görev yok.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('GörevDetay', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: renkOncelik(item.oncelik) }]} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.baslik}
                </Text>
                <Text style={[styles.durumSade, { color: renkDurum(item.durum) }]}>
                  {etiketDurum(item.durum)}
                </Text>
              </View>
              <Text style={[styles.meta, { color: colors.textFaded }]} numberOfLines={1}>
                {[
                  item.atananAd && `→ ${item.atananAd}`,
                  item.bitisTarihi && tarihFormat(item.bitisTarihi),
                ].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniGörev')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Görev</Text>
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
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  durumSade: { fontSize: 11, fontWeight: '700' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 4 },

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
