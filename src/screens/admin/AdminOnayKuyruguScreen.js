import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { arrayToCamel } from '../../lib/mapper'
import { durumBul } from '../../utils/servisConstants'
import { tarihSaatFormat } from '../../utils/format'

const SEKMELER = [
  { id: 'tamamlandi', label: 'Bekleyen' },
  { id: 'onaylandi', label: 'Onaylanan' },
  { id: 'reddedildi', label: 'Reddedilen' },
]

export default function AdminOnayKuyruguScreen({ navigation }) {
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('tamamlandi')
  const [hepsi, setHepsi] = useState({ tamamlandi: [], onaylandi: [], reddedildi: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const { data } = await supabase
      .from('servis_talepleri')
      .select('*')
      .in('durum', ['tamamlandi', 'onaylandi', 'reddedildi'])
      .order('guncelleme_tarihi', { ascending: false })
    const l = arrayToCamel(data ?? [])
    setHepsi({
      tamamlandi: l.filter((t) => t.durum === 'tamamlandi'),
      onaylandi: l.filter((t) => t.durum === 'onaylandi'),
      reddedildi: l.filter((t) => t.durum === 'reddedildi'),
    })
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

  const veri = hepsi[aktifSekme] ?? []

  return (
    <ScreenContainer>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {SEKMELER.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.tab,
              { backgroundColor: colors.surface },
              aktifSekme === s.id && { backgroundColor: colors.primary },
            ]}
            onPress={() => setAktifSekme(s.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === s.id && { color: '#fff' }]}>
              {s.label} · {hepsi[s.id]?.length ?? 0}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={veri}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListHeaderComponent={
          aktifSekme === 'tamamlandi' ? (
            <Text style={[styles.aciklama, { color: colors.textMuted }]}>
              Teknisyenin tamamladığı, onay bekleyen servisler. Detaya girerek onayla / reddet.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 40 }}>
            Bu kategoride kayıt yok.
          </Text>
        }
        renderItem={({ item }) => {
          const d = durumBul(item.durum)
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('ServisDetay', { id: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.talepNo, { color: colors.primaryLight }]}>
                  {item.talepNo ?? `#${item.id}`}
                </Text>
                {d && (
                  <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                    <Text style={[styles.chipText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
                  </View>
                )}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="user" size={12} color={colors.textFaded} />
                  <Text style={[styles.meta, { color: colors.textFaded }]}>
                    {item.atananKullaniciAd ?? '—'}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.textFaded }]}>
                  {tarihSaatFormat(item.guncellemeTarihi ?? item.olusturmaTarihi)}
                </Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />
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
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: { fontWeight: '600', fontSize: 12 },

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
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  firma: { fontSize: 15, fontWeight: '700' },
  konu: { fontSize: 12, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  meta: { fontSize: 11 },
})
