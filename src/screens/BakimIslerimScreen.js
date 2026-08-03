// Bakım İşlerim — teknik personele atanan toplu bakım iş emirleri.
import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { bakimIslerimGetir } from '../services/topluBakimService'
import { tbDurumBilgi, kalemBilgi, kalemDurumBilgi } from '../lib/bakimSablon'

const AKTIF_DURUMLAR = ['planlandi', 'atandi', 'yola_cikildi', 'lokasyona_ulasildi', 'bakim_basladi', 'devam_ediyor', 'eksik_bakim', 'imza_bekleniyor']

const SEKMELER = [
  { id: 'aktif', label: 'Aktif' },
  { id: 'tamamlanan', label: 'Tamamlanan' },
]

const fmtTarih = (t) => t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '—'

export default function BakimIslerimScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sekme, setSekme] = useState('aktif')

  const yukle = useCallback(async () => {
    if (!kullanici?.id) return
    // Obje geçiyoruz: saha sorumlusu (Salih, Mahmut, admin) tüm bakımları görür
    const l = await bakimIslerimGetir(kullanici)
    setListe(l)
    setLoading(false)
  }, [kullanici?.id])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const filtreli = liste.filter((t) =>
    sekme === 'aktif' ? AKTIF_DURUMLAR.includes(t.durum) : !AKTIF_DURUMLAR.includes(t.durum)
  )

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {SEKMELER.map((s) => {
          const sayi = liste.filter((t) =>
            s.id === 'aktif' ? AKTIF_DURUMLAR.includes(t.durum) : !AKTIF_DURUMLAR.includes(t.durum)
          ).length
          const aktif = sekme === s.id
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.tab, { backgroundColor: colors.surface }, aktif && { backgroundColor: colors.primary }]}
              onPress={() => setSekme(s.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, aktif && { color: '#fff' }]}>
                {s.label} · {sayi}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={filtreli}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Feather name="tool" size={36} color={colors.textFaded} />
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700', marginTop: 12 }}>
              {sekme === 'aktif' ? 'Aktif bakım işin yok' : 'Tamamlanan bakım yok'}
            </Text>
            <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
              Saha sorumlusu sana iş atadığında burada görünecek.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = tbDurumBilgi(item.durum)
          const tamam = (item.kalemler || []).filter((k) => k.durum === 'tamamlandi' || k.durum === 'ariza_tespit').length
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('BakimYap', { id: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.tbNo, { color: '#3b82f6' }]}>{item.tbNo}</Text>
                <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                  <Text style={[styles.chipText, { color: d.renk }]}>{d.isim}</Text>
                </View>
              </View>
              <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.musteriFirma || '—'}
              </Text>
              {!!item.lokasyonAdi && (
                <Text style={[styles.lokasyon, { color: colors.textSecondary }]} numberOfLines={1}>
                  📍 {item.lokasyonAdi}
                </Text>
              )}
              <View style={styles.altSatir}>
                <Text style={[styles.tarih, { color: colors.textFaded }]}>
                  {fmtTarih(item.planlananTarih)}{item.planlananSaat ? ` · ${item.planlananSaat}` : ''}
                </Text>
                <Text style={[styles.kalemSayi, { color: colors.textMuted }]}>
                  {tamam}/{(item.kalemler || []).length} kalem
                </Text>
              </View>
              <View style={styles.kalemler}>
                {(item.kalemler || []).map((k) => {
                  const kb = kalemBilgi(k.kalemTip)
                  const kd = kalemDurumBilgi(k.durum)
                  return (
                    <View key={k.id} style={[styles.kalemChip, { borderColor: kd.renk + '66', backgroundColor: kd.renk + '14' }]}>
                      <Feather name={kb.ikon} size={11} color={kb.renk} />
                      <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.textSecondary }}>{kb.isim}</Text>
                      {k.arizaVar && <Text style={{ fontSize: 10 }}>⚠️</Text>}
                    </View>
                  )
                })}
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
    flexDirection: 'row', gap: 6,
    paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1,
  },
  tab: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, flex: 1, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 12 },

  card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  tbNo: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 10.5, fontWeight: '700' },
  firma: { fontSize: 14, fontWeight: '700' },
  lokasyon: { fontSize: 12, marginTop: 3 },
  altSatir: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tarih: { fontSize: 11 },
  kalemSayi: { fontSize: 11, fontWeight: '700' },
  kalemler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kalemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
})
