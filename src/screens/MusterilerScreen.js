import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { musterileriGetir } from '../services/musteriService'
import { trIcerir } from '../utils/trSearch'

export default function MusterilerScreen({ navigation }) {
  const { colors } = useTheme()
  const [musteriler, setMusteriler] = useState([])
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const data = await musterileriGetir()
    setMusteriler(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    yukle().finally(() => setLoading(false))
  }, [yukle])

  useFocusEffect(
    useCallback(() => {
      yukle()
    }, [yukle])
  )

  // Türkçe büyük/küçük + aksan fark etmeksizin client-side filtre
  const filtrelenmis = useMemo(() => {
    if (!arama.trim()) return musteriler
    return musteriler.filter((m) =>
      trIcerir([m.firma, m.ad, m.soyad, m.telefon, m.email, m.kod, m.sehir, m.adres], arama)
    )
  }, [arama, musteriler])

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  return (
    <ScreenContainer>
      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.search, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          placeholder="Ara: ad, firma, telefon, kod..."
          placeholderTextColor={colors.textFaded}
          value={arama}
          onChangeText={setArama}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.sonucSayi, { color: colors.textFaded }]}>
          {arama.trim()
            ? `${filtrelenmis.length} sonuç · toplam ${musteriler.length}`
            : `${musteriler.length} müşteri`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtrelenmis}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>
              {arama ? 'Eşleşen müşteri yok.' : 'Henüz müşteri yok.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MüşteriDetay', { id: item.id })}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.firma || `${item.ad} ${item.soyad}`}
                </Text>
                {!!item.kod && <Text style={[styles.kod, { color: colors.textFaded }]}>{item.kod}</Text>}
              </View>
              {(item.sehir || item.telefon) && (
                <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                  {[item.sehir, item.telefon].filter(Boolean).join(' · ')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniMüşteri')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Müşteri</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
  sonucSayi: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  firma: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  kod: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  meta: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
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
