import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView, TextInput,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { demoCihazlariGetir } from '../services/demoService'
import { musterileriGetir } from '../services/musteriService'
import { trIcerir } from '../utils/trSearch'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'

const SEKMELER = [
  { id: 'tumu',         isim: 'Tümü' },
  { id: 'depoda',       isim: 'Depoda' },
  { id: 'musteride',    isim: 'Müşteride' },
  { id: 'suresi_gecti', isim: 'Süresi Geçti' },
  { id: 'bakimda',      isim: 'Bakımda' },
]

const DURUM_RENK = {
  depoda: '#22c55e',
  musteride: '#3b82f6',
  suresi_gecti: '#dc2626',
  bakimda: '#94a3b8',
}

export default function DemolarScreen({ navigation }) {
  const { colors } = useTheme()
  const [cihazlar, setCihazlar] = useState([])
  const [musteriMap, setMusteriMap] = useState(new Map())
  const [aktifSekme, setAktifSekme] = useState('tumu')
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)

  const yukle = useCallback(async () => {
    const [c, m] = await Promise.all([demoCihazlariGetir(), musterileriGetir()])
    setCihazlar(c || [])
    setMusteriMap(new Map((m || []).map(x => [x.id, x])))
    setYukleniyor(false); setYenileniyor(false)
  }, [])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const sayilar = useMemo(() => {
    const s = { tumu: cihazlar.length, depoda: 0, musteride: 0, suresi_gecti: 0, bakimda: 0 }
    for (const c of cihazlar) s[c.hesaplananDurum] = (s[c.hesaplananDurum] || 0) + 1
    return s
  }, [cihazlar])

  const filtreli = useMemo(() => {
    let liste = cihazlar
    if (aktifSekme !== 'tumu') liste = liste.filter(c => c.hesaplananDurum === aktifSekme)
    if (arama.trim()) liste = liste.filter(c => trIcerir([c.ad, c.marka, c.model, c.seriNo], arama))
    return liste.slice().sort((a, b) => {
      if (a.hesaplananDurum === 'suresi_gecti' && b.hesaplananDurum !== 'suresi_gecti') return -1
      if (a.hesaplananDurum !== 'suresi_gecti' && b.hesaplananDurum === 'suresi_gecti') return 1
      return (b.gecenGun || 0) - (a.gecenGun || 0)
    })
  }, [cihazlar, aktifSekme, arama])

  if (yukleniyor) {
    return <ScreenContainer><LoadingState /></ScreenContainer>
  }

  return (
    <ScreenContainer>
      <View style={{ height: 48 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' }}>
          {SEKMELER.map(s => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setAktifSekme(s.id)}
              style={[
                styles.sekme,
                { backgroundColor: aktifSekme === s.id ? colors.primary : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sekmeText, { color: aktifSekme === s.id ? '#fff' : colors.textSecondary }]}>
                {s.isim} ({sayilar[s.id] ?? 0})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TextInput
        value={arama}
        onChangeText={setArama}
        placeholder="Ad / marka / model / S.N. ara..."
        placeholderTextColor={colors.textMuted}
        style={[styles.arama, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      <FlatList
        data={filtreli}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle() }} tintColor={colors.textPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            ikon="package"
            baslik="Demo cihaz yok"
            mesaj="Yeni demo cihaz ekleyerek başla"
          />
        }
        renderItem={({ item }) => {
          const m = item.aktifMusteriId ? musteriMap.get(item.aktifMusteriId) : null
          const musteriAd = m ? (m.firma || `${m.ad ?? ''} ${m.soyad ?? ''}`.trim()) : null
          const renk = DURUM_RENK[item.hesaplananDurum] || colors.textMuted
          const kalan = item.beklenenIadeTarihi
            ? Math.floor((new Date(item.beklenenIadeTarihi) - new Date()) / 86400000)
            : null
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('DemoCihazDetay', { id: item.id })}
              style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: renk }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cihazAd, { color: colors.textPrimary }]} numberOfLines={1}>{item.ad}</Text>
                <Text style={[styles.alt, { color: colors.textMuted }]} numberOfLines={1}>
                  {[item.marka, item.model].filter(Boolean).join(' · ') || '—'}
                </Text>
                {musteriAd && (
                  <Text style={[styles.musteri, { color: colors.textSecondary }]} numberOfLines={1}>
                    👤 {musteriAd}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={[styles.durum, { color: renk }]}>{item.hesaplananDurum.replace('_', ' ').toUpperCase()}</Text>
                  {kalan !== null && (
                    <Text style={[styles.alt, { color: renk }]}>
                      {kalan < 0 ? `${-kalan}g geçti` : kalan === 0 ? 'bugün' : `${kalan}g`}
                    </Text>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )
        }}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('YeniDemoCihaz')}
      >
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  sekme: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  sekmeText: { fontSize: 12, fontWeight: '700' },
  arama: { marginHorizontal: 12, marginBottom: 6, padding: 10, borderRadius: 8, borderWidth: 1 },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderLeftWidth: 4 },
  cihazAd: { fontSize: 14, fontWeight: '700' },
  alt: { fontSize: 11 },
  musteri: { fontSize: 12, marginTop: 2 },
  durum: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  fab: {
    position: 'absolute', right: 16, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
})
