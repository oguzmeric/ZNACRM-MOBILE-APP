// Müşteri portalı — Cihazlarım (webdeki Cihazlarim sayfasının mobil karşılığı).
// Kaynak: portal_cihazlarim GÖRÜNÜMÜ (mig 298→318) — cihaz şifresi/IP/MAC gelmez,
// satır filtresi (musteri_id = current_musteri_id()) görünümün içindedir.
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { portalCihazlariGetir, CIHAZ_DURUMLARI } from '../../services/portalService'
import { tarihFormat } from '../../utils/format'
import { trIcerir } from '../../utils/trSearch'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'

const lokasyonEtiketi = (c) => c.lokasyonAd || c.altLokasyon || null

export default function MusteriCihazlarimScreen() {
  const { colors } = useTheme()
  const [cihazlar, setCihazlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('hepsi')

  const yukle = useCallback(async () => {
    try {
      const veri = await portalCihazlariGetir()
      setCihazlar(veri ?? [])
      setHata(null)
    } catch (e) {
      console.warn('[cihazlarım]', e?.message)
      setHata(e?.message || 'Cihazlar yüklenemedi')
      setCihazlar([])
    }
  }, [])

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

  // Durum çipleri — mevcut envanterdeki durumlardan, sayılarıyla
  const durumSecenekleri = useMemo(() => {
    const h = new Map()
    for (const c of cihazlar) h.set(c.durum, (h.get(c.durum) || 0) + 1)
    return [...h.entries()].sort((a, b) => b[1] - a[1])
  }, [cihazlar])

  const filtreli = useMemo(() => {
    let liste = cihazlar
    if (durumFiltre !== 'hepsi') liste = liste.filter((c) => c.durum === durumFiltre)
    if (!arama.trim()) return liste
    return liste.filter((c) =>
      trIcerir([c.seriNo, c.marka, c.model, c.urunAdi, lokasyonEtiketi(c)], arama))
  }, [cihazlar, arama, durumFiltre])

  const servisteki = cihazlar.filter((c) => ['arizali_depoda', 'arizada', 'teknisyende'].includes(c.durum)).length

  return (
    <ScreenContainer>
      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="Seri no, model veya lokasyon ara…"
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

      {/* Durum filtresi */}
      {durumSecenekleri.length > 1 && (
        <View style={styles.cipSatir}>
          <TouchableOpacity
            style={[styles.cip, {
              backgroundColor: durumFiltre === 'hepsi' ? `${colors.primary}22` : colors.surface,
              borderColor: durumFiltre === 'hepsi' ? colors.primary : colors.border,
            }]}
            onPress={() => setDurumFiltre('hepsi')}
            activeOpacity={0.8}
          >
            <Text style={[styles.cipYazi, { color: durumFiltre === 'hepsi' ? colors.primary : colors.textSecondary }]}>
              Tümü ({cihazlar.length})
            </Text>
          </TouchableOpacity>
          {durumSecenekleri.map(([d, adet]) => {
            const meta = CIHAZ_DURUMLARI[d] || { etiket: d }
            const secili = durumFiltre === d
            return (
              <TouchableOpacity
                key={d}
                style={[styles.cip, {
                  backgroundColor: secili ? `${colors.primary}22` : colors.surface,
                  borderColor: secili ? colors.primary : colors.border,
                }]}
                onPress={() => setDurumFiltre(secili ? 'hepsi' : d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cipYazi, { color: secili ? colors.primary : colors.textSecondary }]}>
                  {meta.etiket} ({adet})
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Serviste cihaz uyarısı */}
      {servisteki > 0 && !loading && (
        <View style={[styles.uyari, { backgroundColor: `${colors.warning}18`, borderColor: colors.border }]}>
          <Feather name="alert-triangle" size={14} color={colors.warning} />
          <Text style={[styles.uyariText, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '800' }}>{servisteki}</Text> cihazınız serviste — durumunu listeden takip edebilirsiniz.
          </Text>
        </View>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtreli}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            arama.trim() || durumFiltre !== 'hepsi' ? (
              <EmptyState ikon="search" baslik="Filtreye uyan cihaz yok" mesaj="Arama veya durum seçimini genişletmeyi deneyin." />
            ) : hata ? (
              <EmptyState ikon="alert-triangle" baslik="Cihaz listesi alınamadı" mesaj={`${hata}\n\nAşağı çekerek tekrar deneyin.`} />
            ) : (
              <EmptyState
                ikon="hard-drive"
                baslik="Kayıtlı cihazınız görünmüyor"
                mesaj="Sahada devreye alınan cihazlarınız seri numarasıyla kaydedildikçe burada listelenir."
              />
            )
          }
          renderItem={({ item }) => {
            const durum = CIHAZ_DURUMLARI[item.durum] || { etiket: item.durum, renk: colors.textMuted }
            const lok = lokasyonEtiketi(item)
            return (
              <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.kartUst}>
                  <Text style={[styles.model, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.model || item.urunAdi || 'Cihaz'}
                  </Text>
                  <Text style={[styles.durum, { color: durum.renk }]}>{durum.etiket}</Text>
                </View>
                {!!item.marka && (
                  <Text style={[styles.marka, { color: colors.textMuted }]}>{item.marka}</Text>
                )}
                <Text style={[styles.seriNo, { color: colors.textSecondary }]} numberOfLines={1}>
                  # {item.seriNo}
                </Text>
                <Text style={[styles.lokasyon, { color: lok ? colors.textSecondary : colors.textFaded }]} numberOfLines={1}>
                  📍 {lok || 'Lokasyon girilmemiş'}{item.kanalNo != null ? ` · Kanal ${item.kanalNo}` : ''}
                </Text>
                <Text style={[styles.tarihler, { color: colors.textFaded }]} numberOfLines={1}>
                  {[
                    item.takilmaTarihi && `Kurulum: ${tarihFormat(item.takilmaTarihi)}`,
                    item.garantiBitisTarihi && `Garanti: ${tarihFormat(item.garantiBitisTarihi)}`,
                  ].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            )
          }}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 8,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  cipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  cip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  cipYazi: { fontSize: 11.5, fontWeight: '600' },

  uyari: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  uyariText: { flex: 1, fontSize: 12, lineHeight: 17 },

  kart: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  model: { fontSize: 14, fontWeight: '800', flex: 1 },
  durum: { fontSize: 11.5, fontWeight: '700' },
  marka: { fontSize: 11.5, marginTop: 1 },
  seriNo: { fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  lokasyon: { fontSize: 12, marginTop: 3 },
  tarihler: { fontSize: 11, marginTop: 6 },
})
