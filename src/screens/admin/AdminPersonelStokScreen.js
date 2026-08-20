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
import { teknisyenStoktariniGetir, teknisyeninTaktiklari } from '../../services/stokKalemiService'
import { trIcerir } from '../../utils/trSearch'
import { tarihFormat } from '../../utils/format'

// İKİ KAPIDAN açılır (21.08): admin listesinden (kullaniciId + ad) VE
// teknisyenin kendi "Depom" kartından (kisisel: true) — kişi üzerindeki
// S/N'li kalemleri ('teknisyende' + 'arizada') listeler.
export default function AdminPersonelStokScreen({ route, navigation }) {
  const { kullaniciId, ad, kisisel } = route.params ?? {}
  const { colors } = useTheme()
  const [stok, setStok] = useState([])
  const [taktiklar, setTaktiklar] = useState(null)   // null = henüz çekilmedi (lazy)
  const [sekme, setSekme] = useState('uzerimde')     // uzerimde | taktiklarim
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [arama, setArama] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: kisisel ? 'Depom' : ad ? `${ad} — Stok` : 'Üzerindeki Stok' })
  }, [navigation, ad, kisisel])

  const yukle = useCallback(async () => {
    const veri = await teknisyenStoktariniGetir(kullaniciId)
    setStok(veri ?? [])
    setLoading(false)
  }, [kullaniciId])

  useEffect(() => { yukle() }, [yukle])

  // Taktıklarım LAZY: sekme ilk açıldığında çekilir (üzerimde listesini bekletmez)
  useEffect(() => {
    if (sekme !== 'taktiklarim' || taktiklar !== null) return
    let iptal = false
    ;(async () => {
      const veri = await teknisyeninTaktiklari(kullaniciId)
      if (!iptal) setTaktiklar(veri ?? [])
    })()
    return () => { iptal = true }
  }, [sekme, taktiklar, kullaniciId])

  const onRefresh = async () => {
    setRefreshing(true)
    if (sekme === 'taktiklarim') {
      const veri = await teknisyeninTaktiklari(kullaniciId)
      setTaktiklar(veri ?? [])
    } else {
      await yukle()
    }
    setRefreshing(false)
  }

  const filtreli = useMemo(() => {
    if (sekme === 'taktiklarim') {
      const liste = taktiklar ?? []
      if (!arama.trim()) return liste
      return liste.filter((s) => trIcerir([s.seriNo, s.marka, s.model, s.stokKodu, s.talepNo, s.firmaAdi], arama))
    }
    if (!arama.trim()) return stok
    return stok.filter((s) => trIcerir([s.seriNo, s.barkod, s.marka, s.model, s.stokKodu], arama))
  }, [sekme, stok, taktiklar, arama])

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {/* Üzerimde / Taktıklarım sekmeleri (21.08) */}
      <View style={styles.sekmeSatir}>
        {[
          { id: 'uzerimde', l: kisisel ? 'Üzerimde' : 'Üzerinde' },
          { id: 'taktiklarim', l: kisisel ? 'Taktıklarım' : 'Taktıkları' },
        ].map((s) => {
          const aktif = sekme === s.id
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSekme(s.id)}
              style={[
                styles.sekmeBtn,
                { backgroundColor: aktif ? '#2563eb' : colors.surface, borderColor: aktif ? '#2563eb' : colors.border },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ color: aktif ? '#fff' : colors.textMuted, fontSize: 13, fontWeight: '700' }}>{s.l}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder={sekme === 'taktiklarim' ? 'S/N, marka, talep no, firma' : 'S/N, marka, model, stok kodu'}
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
        {sekme === 'taktiklarim' && taktiklar === null
          ? 'Yükleniyor…'
          : `${filtreli.length} kalem${arama ? ` (${(sekme === 'taktiklarim' ? (taktiklar ?? []) : stok).length} içinden)` : ''}`}
      </Text>

      <FlatList
        data={sekme === 'taktiklarim' && taktiklar === null ? [] : filtreli}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          sekme === 'taktiklarim' && taktiklar === null ? (
            <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 24 }} />
          ) : (
            <Text style={[styles.bos, { color: colors.textFaded }]}>
              {arama
                ? 'Eşleşen kalem yok.'
                : sekme === 'taktiklarim'
                  ? (kisisel
                    ? 'Henüz taktığın kayıtlı ürün yok. Serviste S/N okutup kullandıkların burada listelenir.'
                    : 'Taktığı kayıtlı ürün yok.')
                  : kisisel
                    ? 'Üzerinde kayıtlı malzeme yok. Depodan S/N okutarak aldığın ürünler burada listelenir.'
                    : 'Personelde stok bulunmuyor.'}
            </Text>
          )
        }
        renderItem={({ item }) => sekme === 'taktiklarim' ? (
          /* TAKTIKLARIM — hangi SN'yi, hangi serviste, ne zaman taktı */
          <TouchableOpacity
            style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => item.servisTalepId && navigation.navigate('ServisDetay', { id: item.servisTalepId })}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.ad, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.marka || ''} {item.model || item.stokKodu || ''}
              </Text>
              <Text style={[styles.alt, { color: colors.textMuted }]} numberOfLines={1}>
                S/N: {item.seriNo || '—'}
              </Text>
              <Text style={[styles.alt, { color: colors.textFaded }]} numberOfLines={1}>
                {[item.talepNo, item.firmaAdi, item.tarih ? tarihFormat(item.tarih) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textFaded} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CihazDetay', { id: item.id })}
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
            {/* Üzerindeki ARIZALI kalem gözden kaçmasın — liste artık iki durumu
                da kapsıyor ('teknisyende' + 'arizada') */}
            {item.durum === 'arizada' && (
              <Text style={styles.arizaliRozet}>⚠ Arızalı</Text>
            )}
            <Feather name="chevron-right" size={16} color={colors.textFaded} />
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  sekmeSatir: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  sekmeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
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
  arizaliRozet: { fontSize: 10.5, fontWeight: '800', color: '#f59e0b', marginRight: 8 },
  bos: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
})
