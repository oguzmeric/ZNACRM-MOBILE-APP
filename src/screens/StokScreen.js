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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  tumKalemleriGetir,
  kalemleriDurumaGoreGetir,
  teknisyenStoktariniGetir,
  kalemMetinAra,
  modellerOzetiniGetir,
  durumBul,
  DURUMLAR,
} from '../services/stokKalemiService'
import { trIcerir } from '../utils/trSearch'
import { tarihFormat } from '../utils/format'

const SEKMELER = [
  { id: 'modeller', label: 'Modeller' },
  { id: 'tumu', label: 'Tümü' },
  { id: 'depoda', label: 'Depoda' },
  { id: 'sahada', label: 'Sahada' },
  { id: 'arizada', label: 'Arızalı' },
  { id: 'bana', label: 'Üstümde' },
]

export default function StokScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('modeller')
  const [tumKalemler, setTumKalemler] = useState([])
  const [modeller, setModeller] = useState([])
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    if (!kullanici) return
    if (aktifSekme === 'modeller') {
      const m = await modellerOzetiniGetir()
      setModeller(m ?? [])
      return
    }
    // "Depoda" sekmesi özel: hem S/N'li cihazlar hem bulk ürünler birlikte (model bazında)
    if (aktifSekme === 'depoda') {
      const tumModeller = await modellerOzetiniGetir()
      const depoda = (tumModeller ?? []).filter((m) =>
        m.tip === 'seri' ? (m.depoda ?? 0) > 0 : (m.stokMiktari ?? 0) > 0
      )
      setModeller(depoda)
      return
    }
    let veri = []
    if (aktifSekme === 'tumu') {
      veri = arama.trim()
        ? await kalemMetinAra(arama)
        : await tumKalemleriGetir()
    } else if (aktifSekme === 'bana') {
      veri = await teknisyenStoktariniGetir(kullanici.id)
      if (arama.trim()) {
        veri = (veri ?? []).filter((k) =>
          trIcerir([k.seriNo, k.barkod, k.marka, k.model, k.stokKodu], arama)
        )
      }
    } else {
      veri = await kalemleriDurumaGoreGetir(aktifSekme)
      if (arama.trim()) {
        veri = (veri ?? []).filter((k) =>
          trIcerir([k.seriNo, k.barkod, k.marka, k.model, k.stokKodu], arama)
        )
      }
    }
    setTumKalemler(veri ?? [])
  }, [aktifSekme, arama, kullanici])

  useEffect(() => {
    setLoading(true)
    yukle().finally(() => setLoading(false))
  }, [aktifSekme])

  // Arama debounce
  useEffect(() => {
    const t = setTimeout(() => yukle(), 300)
    return () => clearTimeout(t)
  }, [arama, yukle])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  return (
    <ScreenContainer>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <FlatList
          data={SEKMELER}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                { backgroundColor: colors.surface },
                aktifSekme === s.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAktifSekme(s.id)}
            >
              <Text style={[
                styles.tabText,
                { color: colors.textMuted },
                aktifSekme === s.id && { color: '#fff' },
              ]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.search, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          placeholder="Ara: S/N, marka, model..."
          placeholderTextColor={colors.textFaded}
          value={arama}
          onChangeText={setArama}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      ) : (aktifSekme === 'modeller' || aktifSekme === 'depoda') ? (
        <FlatList
          data={(modeller ?? []).filter((m) => {
            if (!arama.trim()) return true
            return trIcerir([m.stokKodu, m.marka, m.model], arama)
          })}
          keyExtractor={(m) => m.stokKodu}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>Henüz model yok.</Text>
          }
          renderItem={({ item: m }) => {
            const isSeri = m.tip === 'seri'
            return (
              <TouchableOpacity
                style={[styles.modelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() =>
                  isSeri
                    ? navigation.navigate('ModelDetay', { stokKodu: m.stokKodu })
                    : navigation.navigate('BulkDetay', { stokKodu: m.stokKodu })
                }
              >
                <View style={styles.modelMainRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.modelAd, { color: colors.textPrimary }]} numberOfLines={1}>
                      {m.marka ? `${m.marka} ` : ''}{m.model || m.stokAdi || m.stokKodu}
                    </Text>
                    <Text style={[styles.modelKod, { color: colors.textFaded }]}>{m.stokKodu}</Text>
                  </View>
                  <View style={styles.modelStokSayi}>
                    <Text style={styles.modelStokSayiBuyuk}>
                      {isSeri ? m.depoda : (m.stokMiktari ?? 0)}
                    </Text>
                    <Text style={[styles.modelStokSayiKucuk, { color: colors.textFaded }]}>
                      {isSeri ? 'depoda' : m.birim}
                    </Text>
                  </View>
                </View>

                {isSeri && (m.teknisyende > 0 || m.sahada > 0 || m.arizada > 0) && (
                  <Text style={[styles.modelAltMeta, { color: colors.textMuted }]}>
                    {[
                      m.teknisyende > 0 && `🚚 ${m.teknisyende}`,
                      m.sahada > 0 && `✅ ${m.sahada}`,
                      m.arizada > 0 && `⚠️ ${m.arizada}`,
                      `toplam ${m.toplam}`,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {!isSeri && m.minStok != null && m.stokMiktari < m.minStok && (
                  <Text style={styles.modelUyariKucuk}>⚠️ Min stok altında: {m.minStok}</Text>
                )}
              </TouchableOpacity>
            )
          }}
        />
      ) : (
        <FlatList
          data={tumKalemler}
          keyExtractor={(k) => String(k.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textFaded }]}>
              {arama ? 'Eşleşen cihaz yok.' : 'Henüz cihaz yok.'}
            </Text>
          }
          renderItem={({ item }) => {
            if (item.tip === 'bulk') {
              const minAlti = item.minStok != null && (item.stokMiktari ?? 0) < item.minStok
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.surface }]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('BulkDetay', { stokKodu: item.stokKodu })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.marka ? `${item.marka} ` : ''}{item.stokAdi || item.stokKodu}
                    </Text>
                    <View style={[styles.durumBadge, { backgroundColor: '#22c55e22', borderColor: '#22c55e' }]}>
                      <Text style={[styles.durumText, { color: '#22c55e' }]}>🧵 Sarf</Text>
                    </View>
                  </View>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>Kod: {item.stokKodu}</Text>
                  <Text style={[styles.meta, { color: '#22c55e', fontWeight: '700' }]}>
                    Stok: {item.stokMiktari ?? 0} {item.birim || 'Adet'}
                  </Text>
                  {minAlti && (
                    <Text style={[styles.meta, { color: '#ef4444' }]}>
                      ⚠️ Min stok altında: {item.minStok}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            }
            const d = durumBul(item.durum)
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('CihazDetay', { id: item.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.marka || ''} {item.model || item.stokKodu}
                  </Text>
                  {d && (
                    <View style={[styles.durumBadge, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                      <Text style={[styles.durumText, { color: d.renk }]}>
                        {d.ikon} {d.isim}
                      </Text>
                    </View>
                  )}
                </View>
                {!!item.seriNo && <Text style={[styles.meta, { color: colors.textMuted }]}>S/N: {item.seriNo}</Text>}
                {!!item.barkod && <Text style={[styles.meta, { color: colors.textMuted }]}>Barkod: {item.barkod}</Text>}
                {item.durum === 'sahada' && !!item.takilmaTarihi && (
                  <Text style={[styles.meta, { color: '#10b981' }]}>
                    📅 Takıldı: {tarihFormat(item.takilmaTarihi)}
                  </Text>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Tara')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
        <Text style={styles.fabText}>Tara</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

function KirilimBadge({ ikon, sayi, renk }) {
  return (
    <View style={[stilKirilim.badge, { backgroundColor: renk + '22', borderColor: renk }]}>
      <Text style={[stilKirilim.text, { color: renk }]}>{ikon} {sayi}</Text>
    </View>
  )
}

const stilKirilim = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '700' },
})

const styles = StyleSheet.create({
  tabs: {
    paddingVertical: 8,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },

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
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  durumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  durumText: { fontSize: 11, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 3 },

  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#22c55e',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modeller sekmesi — kompakt tek satır tasarım
  modelCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modelMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelAd: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modelKod: { color: '#64748b', fontSize: 11, marginTop: 2 },
  modelStokSayi: {
    alignItems: 'flex-end',
  },
  modelStokSayiBuyuk: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: '800',
  },
  modelStokSayiKucuk: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  modelAltMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
  },
  modelUyariKucuk: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },

  bulkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  bulkSayi: { color: '#22c55e', fontSize: 24, fontWeight: '800' },
  bulkBirim: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  minStokBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 6,
  },
  minStokText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },

  uyari: {
    color: '#f59e0b',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  rakamGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rakamKart: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  rakamSayi: { fontSize: 18, fontWeight: '800' },
  rakamLabel: { color: '#cbd5e1', fontSize: 10, fontWeight: '600', marginTop: 2 },
  rakamHint: { color: '#64748b', fontSize: 9, fontWeight: '700', marginTop: 1 },
  kirilimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
})
