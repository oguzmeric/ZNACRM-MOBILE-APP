// Müşteri portalı — Taleplerim (webdeki Taleplerim sayfasının mobil karşılığı).
// RLS müşteriye yalnız kendi firmasının servis taleplerini verir.
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { servisTalepleriniGetir } from '../../services/servisService'
import { turBul, aciliyetBul, durumBul } from '../../utils/servisConstants'
import { tarihFormat } from '../../utils/format'
import { trIcerir } from '../../utils/trSearch'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'

const SEKMELER = [
  { id: 'tumu', label: 'Tümü' },
  { id: 'acik', label: 'Açık' },
  { id: 'tamamlanan', label: 'Tamamlanan' },
]

const KAPALI_DURUMLAR = ['tamamlandi', 'onaylandi', 'iptal']
const kapaliMi = (t) => KAPALI_DURUMLAR.includes((t.durum ?? '').toLowerCase())

export default function MusteriTaleplerimScreen({ navigation }) {
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('tumu')
  const [talepler, setTalepler] = useState([])
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    try {
      const veri = await servisTalepleriniGetir()
      setTalepler(veri ?? [])
      setHata(null)
    } catch (e) {
      console.warn('[taleplerim] yükleme hatası:', e?.message)
      setHata(e?.message || 'Liste yüklenemedi')
      setTalepler([])
    }
  }, [])

  // Spinner yalnız ilk yüklemede — sekme dönüşleri sessiz tazelenir (19.08 dersi)
  const ilkYuklemeRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (ilkYuklemeRef.current) setLoading(true)
      yukle().finally(() => { setLoading(false); ilkYuklemeRef.current = false })
    }, [yukle])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const filtreli = useMemo(() => {
    let liste = talepler
    if (aktifSekme === 'acik') liste = liste.filter((t) => !kapaliMi(t))
    else if (aktifSekme === 'tamamlanan') liste = liste.filter(kapaliMi)
    if (!arama.trim()) return liste
    return liste.filter((t) => trIcerir([t.talepNo, t.konu, t.lokasyon, t.atananKullaniciAd], arama))
  }, [talepler, aktifSekme, arama])

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
                numberOfLines={1}
                style={[styles.tabText, { color: colors.textMuted }, aktifSekme === s.id && { color: '#fff' }]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="Talep no, konu veya lokasyon ara…"
          placeholderTextColor={colors.textMuted}
          value={arama}
          onChangeText={setArama}
          autoCorrect={false}
        />
        {!!arama && (
          <TouchableOpacity onPress={() => setArama('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtreli}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            arama.trim() ? (
              <EmptyState
                ikon="search"
                baslik="Aramaya uyan talep yok"
                mesaj={`"${arama.trim()}" için bu sekmede sonuç bulunamadı.`}
              />
            ) : hata ? (
              <EmptyState
                ikon="alert-triangle"
                baslik="Liste yüklenemedi"
                mesaj={`${hata}\n\nAşağı çekerek tekrar deneyin.`}
              />
            ) : (
              <EmptyState
                ikon="inbox"
                baslik={aktifSekme === 'acik' ? 'Açık talebiniz yok'
                  : aktifSekme === 'tamamlanan' ? 'Tamamlanan talep yok'
                  : 'Henüz talebiniz yok'}
                mesaj='Yeni talep oluşturmak için "+ Yeni Talep" butonunu kullanın.'
              />
            )
          }
          renderItem={({ item }) => {
            const tur = turBul(item.anaTur)
            const aciliyet = aciliyetBul(item.aciliyet)
            const durum = durumBul(item.durum)
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ServisDetay', { id: item.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.talepNo, { color: colors.textFaded }]}>
                    {tur?.ikon} {item.talepNo ?? `#${item.id}`}
                  </Text>
                  {durum && (
                    <Text style={[styles.durumSade, { color: durum.renk }]}>
                      {durum.ikon} {durum.isim}
                    </Text>
                  )}
                </View>

                <Text style={[styles.konu, { color: colors.textPrimary }]} numberOfLines={2}>
                  {item.konu || '—'}
                </Text>

                {!!(item.lokasyon || '').trim() && (
                  <Text style={[styles.lokasyon, { color: colors.textFaded }]} numberOfLines={1}>
                    📍 {item.lokasyon.trim()}
                  </Text>
                )}

                <Text style={[styles.altMeta, { color: colors.textFaded }]} numberOfLines={1}>
                  {[
                    aciliyet && `${aciliyet.ikon} ${aciliyet.isim}`,
                    item.atananKullaniciAd && `Ekip: ${item.atananKullaniciAd}`,
                    tarihFormat(item.olusturmaTarihi),
                  ].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => navigation.navigate('YeniTalep')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Talep</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 10, borderWidth: 1, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 7, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 12 },

  aramaKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 4,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  card: { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  talepNo: { fontWeight: '700', fontSize: 11 },
  durumSade: { fontSize: 11, fontWeight: '700' },
  konu: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  lokasyon: { fontSize: 11.5, marginTop: 2 },
  altMeta: { fontSize: 11, marginTop: 4 },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700' },
})
