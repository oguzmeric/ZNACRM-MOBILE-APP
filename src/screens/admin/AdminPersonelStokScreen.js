import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { teknisyenStoktariniGetir } from '../../services/stokKalemiService'
import { trIcerir } from '../../utils/trSearch'

export default function AdminPersonelStokScreen({ route, navigation }) {
  const { kullaniciId, ad } = route.params
  const { colors } = useTheme()
  const [stok, setStok] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [arama, setArama] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: ad ? `${ad} — Stok` : 'Üzerindeki Stok' })
  }, [navigation, ad])

  const yukle = useCallback(async () => {
    const veri = await teknisyenStoktariniGetir(kullaniciId)
    setStok(veri ?? [])
    setLoading(false)
  }, [kullaniciId])

  useEffect(() => { yukle() }, [yukle])

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const filtreli = useMemo(() => {
    if (!arama.trim()) return stok
    return stok.filter((s) => trIcerir([s.seriNo, s.barkod, s.marka, s.model, s.stokKodu], arama))
  }, [stok, arama])

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="S/N, marka, model, stok kodu"
          placeholderTextColor={colors.textMuted}
          value={arama}
          onChangeText={setArama}
        />
        {!!arama && (
          <TouchableOpacity onPress={() => setArama('')}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.sayac, { color: colors.textMuted }]}>
        {filtreli.length} kalem{arama ? ` (${stok.length} içinden)` : ''}
      </Text>

      <FlatList
        data={filtreli}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <Text style={[styles.bos, { color: colors.textFaded }]}>
            {arama ? 'Eşleşen kalem yok.' : 'Personelde stok bulunmuyor.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CihazDetay', { kalemId: item.id })}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.ad, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.marka ?? ''} {item.model ?? ''}
              </Text>
              <Text style={[styles.alt, { color: colors.textMuted }]} numberOfLines={1}>
                S/N: {item.seriNo ?? '—'}
              </Text>
              {!!item.stokKodu && (
                <Text style={[styles.alt, { color: colors.textFaded }]} numberOfLines={1}>
                  {item.stokKodu}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={16} color={colors.textFaded} />
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    margin: 16,
    marginBottom: 8,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  sayac: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  ad: { fontSize: 14, fontWeight: '700' },
  alt: { fontSize: 11, marginTop: 2 },
  bos: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
})
