import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { arrayToCamel } from '../../lib/mapper'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'

export default function AdminStokRaporuScreen({ navigation }) {
  const { colors } = useTheme()
  const [minAlti, setMinAlti] = useState([])
  const [toplamKalem, setToplamKalem] = useState(0)
  const [toplamCihaz, setToplamCihaz] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const [urunRes, kalemRes, cihazRes] = await Promise.all([
      supabase.from('stok_urunler').select('*').not('min_stok', 'is', null),
      supabase.from('stok_urunler').select('*', { count: 'exact', head: true }),
      supabase.from('stok_kalemleri').select('*', { count: 'exact', head: true }),
    ])
    const tum = arrayToCamel(urunRes.data ?? [])
    const altinda = tum.filter((u) => Number(u.stokMiktari ?? 0) < Number(u.minStok ?? 0))
    setMinAlti(altinda)
    setToplamKalem(kalemRes.count ?? 0)
    setToplamCihaz(cihazRes.count ?? 0)
    setLoading(false)
  }, [])

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

  return (
    <ScreenContainer>
      <FlatList
        data={minAlti}
        keyExtractor={(u) => u.stokKodu}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListHeaderComponent={
          <>
            <View style={styles.ozetRow}>
              <OzetKart sayi={toplamKalem} label="Sarf Kalem" ikon="package" renk={colors.purple} colors={colors} />
              <OzetKart sayi={toplamCihaz} label="S/N Cihaz" ikon="cpu" renk={colors.info} colors={colors} />
              <OzetKart sayi={minAlti.length} label="Min Altı" ikon="alert-triangle" renk={colors.danger} colors={colors} />
            </View>
            <Text style={[styles.baslik, { color: colors.textPrimary }]}>⚠️ Min Stok Altında</Text>
            {minAlti.length === 0 && (
              <Text style={{ color: colors.textFaded, marginTop: 10 }}>
                Şu an min seviye altında kalan kalem yok.
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger + '55' }]}
            onPress={() => navigation.navigate('BulkDetay', { stokKodu: item.stokKodu })}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.stokAd, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.stokAdi ?? item.stokKodu}
              </Text>
              <Text style={[styles.stokKodu, { color: colors.textFaded }]}>{item.stokKodu}</Text>
            </View>
            <View style={styles.miktarBlok}>
              <Text style={[styles.miktarSayi, { color: colors.danger }]}>
                {item.stokMiktari ?? 0}
              </Text>
              <Text style={[styles.miktarLabel, { color: colors.textFaded }]}>
                / min {item.minStok}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textFaded} />
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  )
}

function OzetKart({ sayi, label, ikon, renk, colors }) {
  return (
    <View style={[styles.ozetKart, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: renk }]}>
      <Feather name={ikon} size={16} color={renk} />
      <Text style={[styles.ozetSayi, { color: renk }]}>{sayi}</Text>
      <Text style={[styles.ozetLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  ozetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  ozetKart: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
  },
  ozetSayi: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  ozetLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },

  baslik: { fontSize: 14, fontWeight: '700', marginBottom: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  stokAd: { fontSize: 14, fontWeight: '700' },
  stokKodu: { fontSize: 11, marginTop: 2 },
  miktarBlok: { alignItems: 'flex-end' },
  miktarSayi: { fontSize: 18, fontWeight: '800' },
  miktarLabel: { fontSize: 10, marginTop: 2 },
})
