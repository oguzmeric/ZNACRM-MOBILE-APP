import { useCallback, useEffect, useState, useMemo } from 'react'
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
import {
  modelKalemleriniGetir,
  durumBul,
  DURUMLAR,
} from '../services/stokKalemiService'
import { tarihFormat } from '../utils/format'
import { useTheme } from '../context/ThemeContext'

const FILTRELER = [
  { id: 'tumu', label: 'Tümü' },
  { id: 'depoda', label: '📦 Depoda' },
  { id: 'teknisyende', label: '🚚 Teknisyen' },
  { id: 'sahada', label: '✅ Sahada' },
  { id: 'arizada', label: '⚠️ Arızalı' },
  { id: 'hurda', label: '🗑️ Hurda' },
]

export default function ModelDetayScreen({ route, navigation }) {
  const { stokKodu } = route.params
  const { colors } = useTheme()
  const [kalemler, setKalemler] = useState([])
  const [filtre, setFiltre] = useState('tumu')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: stokKodu })
  }, [navigation, stokKodu])

  const yukle = useCallback(async () => {
    const liste = await modelKalemleriniGetir(stokKodu)
    setKalemler(liste ?? [])
    setLoading(false)
  }, [stokKodu])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const sayilar = useMemo(() => {
    const s = { toplam: kalemler.length, depoda: 0, teknisyende: 0, sahada: 0, arizada: 0, hurda: 0 }
    kalemler.forEach((k) => {
      if (s[k.durum] !== undefined) s[k.durum] += 1
    })
    return s
  }, [kalemler])

  const filtrelenmis = filtre === 'tumu'
    ? kalemler
    : kalemler.filter((k) => k.durum === filtre)

  const ornek = kalemler[0]

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.ozetBox, { backgroundColor: colors.surface, borderBottomColor: colors.bg }]}>
        <Text style={[styles.modelAd, { color: colors.textPrimary }]} numberOfLines={2}>
          {ornek?.marka ? `${ornek.marka} ` : ''}{ornek?.model || stokKodu}
        </Text>
        <Text style={[styles.modelKod, { color: colors.primary }]}>{stokKodu}</Text>
        <View style={styles.rakamRow}>
          <Sayi label="📦" sayi={sayilar.depoda} renk="#3b82f6" />
          <Sayi label="🚚" sayi={sayilar.teknisyende} renk="#a855f7" />
          <Sayi label="✅" sayi={sayilar.sahada} renk="#10b981" />
          <Sayi label="⚠️" sayi={sayilar.arizada} renk="#f59e0b" />
          <Sayi label="🌐" sayi={sayilar.toplam} renk={colors.textPrimary} />
        </View>
      </View>

      <View style={[styles.filtreWrap, { backgroundColor: colors.bg, borderBottomColor: colors.surface }]}>
        <FlatList
          data={FILTRELER}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filtre, { backgroundColor: colors.surface }, filtre === f.id && styles.filtreActive]}
              onPress={() => setFiltre(f.id)}
            >
              <Text style={[styles.filtreText, { color: colors.textMuted }, filtre === f.id && { color: '#fff' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtrelenmis}
        keyExtractor={(k) => String(k.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textFaded }]}>Bu durumda kalem yok.</Text>
        }
        renderItem={({ item }) => {
          const d = durumBul(item.durum)
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CihazDetay', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.seriNo, { color: colors.textPrimary }]} numberOfLines={1}>
                  S/N: {item.seriNo || '—'}
                </Text>
                {d && (
                  <View style={[styles.durumBadge, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                    <Text style={[styles.durumText, { color: d.renk }]}>
                      {d.ikon} {d.isim}
                    </Text>
                  </View>
                )}
              </View>
              {!!item.barkod && <Text style={[styles.meta, { color: colors.textMuted }]}>Barkod: {item.barkod}</Text>}
              {item.durum === 'sahada' && !!item.takilmaTarihi && (
                <Text style={[styles.meta, { color: '#10b981' }]}>
                  📅 {tarihFormat(item.takilmaTarihi)}
                </Text>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

function Sayi({ label, sayi, renk }) {
  return (
    <View style={styles.sayiBox}>
      <Text style={[styles.sayiSayi, { color: renk }]}>{sayi}</Text>
      <Text style={styles.sayiLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  ozetBox: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  modelAd: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modelKod: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginTop: 2 },
  rakamRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  sayiBox: { alignItems: 'center', minWidth: 50 },
  sayiSayi: { fontSize: 22, fontWeight: '800' },
  sayiLabel: { fontSize: 14, marginTop: 2 },

  filtreWrap: {
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filtre: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  filtreActive: { backgroundColor: '#2563eb' },
  filtreText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },

  card: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  seriNo: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, fontFamily: 'monospace' },
  durumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  durumText: { fontSize: 11, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
})
