import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  banaAtananTalepler,
  acikTalepler,
  servisTalepleriniGetir,
} from '../services/servisService'
import { turBul, aciliyetBul, durumBul } from '../utils/servisConstants'
import { tarihFormat } from '../utils/format'
import { trIcerir } from '../utils/trSearch'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'

const SEKMELER = [
  { id: 'bana', label: 'Bana' },
  { id: 'acik', label: 'Açık' },
  { id: 'tamamlanan', label: 'Tamamlanan' },
  { id: 'tumu', label: 'Tümü' },
]

// Bir talebin "kapanmış" (tamamlanmış/iptal) sayılıp sayılmadığı
const KAPALI_DURUMLAR = ['tamamlandi', 'onaylandi', 'iptal', 'kapali']
const kapaliMi = (t) => KAPALI_DURUMLAR.includes((t.durum ?? '').toLowerCase())

export default function ServisTalepleriScreen({ navigation, route }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const ilkSekme = route?.params?.sekme && SEKMELER.some((s) => s.id === route.params.sekme)
    ? route.params.sekme
    : 'bana'
  const [aktifSekme, setAktifSekme] = useState(ilkSekme)
  const [talepler, setTalepler] = useState([])
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [acikUyariGosterildi, setAcikUyariGosterildi] = useState(false)
  const [acikSayisi, setAcikSayisi] = useState(0)
  const [arama, setArama] = useState('')

  // ⚠️ Hata YUTULMAZ. Eskiden try/catch yoktu: sorgu patlayınca setTalepler hiç
  // çağrılmıyor, ekran sessizce boş kalıyordu ve kullanıcı "yüklenmiyor" diyordu
  // ama sebebini göremiyordu (14.08 "Tümü sekmesi" vakası).
  const yukle = useCallback(async () => {
    if (!kullanici) return
    try {
      let veri = []
      if (aktifSekme === 'bana') {
        veri = await banaAtananTalepler(kullanici.id)
      } else if (aktifSekme === 'acik') {
        // Bana atanmış + henüz kapanmamış olanlar
        const benim = await banaAtananTalepler(kullanici.id)
        veri = (benim ?? []).filter((t) => !kapaliMi(t))
      } else if (aktifSekme === 'tamamlanan') {
        // Bana atanmış + kapanmış (tamamlanmış/onaylanmış/iptal) olanlar
        const benim = await banaAtananTalepler(kullanici.id)
        veri = (benim ?? []).filter((t) => kapaliMi(t))
      } else {
        veri = await servisTalepleriniGetir()
      }
      setTalepler(veri ?? [])
      setHata(null)
    } catch (e) {
      console.warn('[servis talepleri] yükleme hatası:', e?.message)
      setHata(e?.message || 'Liste yüklenemedi')
      setTalepler([])
    }
  // ⚠️ kullanici?.id: nesne referansı foreground'da değişiyor (19.08).
  }, [aktifSekme, kullanici?.id])

  // Bana atanmış açık servis sayısı — banner ve popup için
  useEffect(() => {
    if (!kullanici) return
    ;(async () => {
      const benim = await banaAtananTalepler(kullanici.id)
      const sayi = (benim ?? []).filter((t) => !kapaliMi(t)).length
      setAcikSayisi(sayi)

      // İlk açılışta popup
      if (sayi > 0 && !acikUyariGosterildi) {
        setAcikUyariGosterildi(true)
        setTimeout(() => {
          Alert.alert(
            `📋 ${sayi} açık servisin var`,
            `Sana atanmış ${sayi} aktif servis talebi bulunuyor.`,
            [
              { text: 'Tamam', style: 'cancel' },
              { text: 'Açık Sekmesine Geç', onPress: () => setAktifSekme('acik') },
            ]
          )
        }, 400)
      }
    })()
  }, [kullanici])

  // ⚠️ TEK yükleme noktası (19.08 performans denetimi).
  // Eskiden useEffect + useFocusEffect birlikte vardı: aynı sorgu mount'ta
  // İKİ KEZ gidiyordu. useFocusEffect zaten mount'ta da çalışır.
  // Ayrıca setLoading(true) koşulsuzdu; her sekmeye dönüşte liste sökülüp
  // spinner geliyordu — "sekmeler arası çok bekletiyor" şikayeti buydu.
  // Artık spinner YALNIZ ilk yüklemede; sonraki tazelemeler sessiz.
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

  // Arama (21.08 saha isteği): "1 ay önce gittiğimiz lokasyonu tek tek inmeden
  // bulmak" — lokasyon, firma, konu, talep no, atanan kişiyle süzer.
  const filtreli = useMemo(() => {
    if (!arama.trim()) return talepler
    return talepler.filter((t) =>
      trIcerir([t.talepNo, t.firmaAdi, t.musteriAd, t.konu, t.lokasyon, t.atananKullaniciAd], arama))
  }, [talepler, arama])

  return (
    <ScreenContainer>
      <View style={styles.tabWrap}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
          {SEKMELER.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.tab,
                aktifSekme === s.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setAktifSekme(s.id)}
              activeOpacity={0.85}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.tabText,
                  { color: colors.textMuted },
                  aktifSekme === s.id && { color: '#fff' },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Arama — lokasyon / firma / konu / talep no / atanan (21.08) */}
      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="Lokasyon, firma, konu, talep no…"
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
      {!!arama.trim() && !loading && (
        <Text style={[styles.aramaSayac, { color: colors.textMuted }]}>
          {filtreli.length} sonuç ({talepler.length} kayıt içinde)
        </Text>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtreli}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
          ListEmptyComponent={
            arama.trim() ? (
              // Arama eşleşmedi — "servis yok" başlıkları yanıltmasın
              // (sayaç ↔ liste kapsam kuralı)
              <EmptyState
                ikon="search"
                baslik="Aramaya uyan servis yok"
                mesaj={`"${arama.trim()}" için bu sekmede sonuç bulunamadı. Tüm kayıtlarda aramak için "Tümü" sekmesine geçin.`}
              />
            ) : hata ? (
              // Boş liste ile HATA ayrı şeyler — kullanıcı "kayıt yok" mu
              // "yüklenemedi" mi bilmeli. Aşağı çekince tekrar denenir.
              <EmptyState
                ikon="alert-triangle"
                baslik="Liste yüklenemedi"
                mesaj={`${hata}\n\nAşağı çekerek tekrar deneyin.`}
              />
            ) : (
            <EmptyState
              ikon="tool"
              baslik={
                aktifSekme === 'acik'
                  ? 'Açık servisin yok'
                  : aktifSekme === 'tamamlanan'
                    ? 'Tamamlanan servis yok'
                    : aktifSekme === 'bana'
                      ? 'Sana atanan talep yok'
                      : 'Servis talebi yok'
              }
              mesaj={
                aktifSekme === 'acik'
                  ? 'Sana atanmış açık servis bulunmuyor'
                  : aktifSekme === 'tamamlanan'
                    ? 'Henüz tamamladığın bir servis yok'
                    : aktifSekme === 'bana'
                      ? 'Henüz sana iş atanmamış'
                      : 'Yeni talep oluşturarak başla'
              }
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

                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.firmaAdi || item.musteriAd || '—'}
                </Text>

                {!!item.konu && (
                  <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.konu}
                  </Text>
                )}

                {/* Lokasyon — teknisyen NEREYE gideceğini karttan görsün (20.08
                    saha isteği); boşsa satır hiç yer kaplamaz, başlık şişmez. */}
                {!!(item.lokasyon || '').trim() && (
                  <Text style={[styles.lokasyon, { color: colors.textFaded }]} numberOfLines={1}>
                    📍 {item.lokasyon.trim()}
                  </Text>
                )}

                <Text style={[styles.altMeta, { color: colors.textFaded }]} numberOfLines={1}>
                  {[
                    aciliyet && `${aciliyet.ikon} ${aciliyet.isim}`,
                    item.planliTarih && tarihFormat(item.planliTarih),
                    aktifSekme !== 'bana' && item.atananKullaniciAd && `→ ${item.atananKullaniciAd}`,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('YeniServisTalebi')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Talep</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabText: { fontWeight: '600', fontSize: 12 },

  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  talepNo: { color: '#64748b', fontWeight: '700', fontSize: 11 },
  durumSade: { fontSize: 11, fontWeight: '700' },

  firma: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  konu: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  lokasyon: { fontSize: 11.5, marginTop: 2 },
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 4,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  aramaSayac: { fontSize: 11.5, fontWeight: '600', paddingHorizontal: 18, marginBottom: 2 },
  altMeta: { color: '#64748b', fontSize: 11, marginTop: 4 },

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
