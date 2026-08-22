// Müşteri portalı — Ana Sayfa (webdeki MusteriDashboard'ın mobil karşılığı).
// Portal hesabı (tip='musteri') personel ekranlarını GÖRMEZ; bu dal yalnız
// portal kapsamını sunar: talepler, cihazlar, teklif isteği.
import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '../../components/ScreenContainer'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { servisTalepleriniGetir } from '../../services/servisService'
import { durumBul } from '../../utils/servisConstants'
import { tarihFormat } from '../../utils/format'
import { useCiftGeriCikis } from '../../hooks/useCiftGeriCikis'

const ACIK_DISI = ['tamamlandi', 'onaylandi', 'iptal']

export default function MusteriAnaScreen({ navigation }) {
  useCiftGeriCikis(navigation)   // Android: kökte tek basışta çıkma (22.08)
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [talepler, setTalepler] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    try {
      // RLS müşteriye yalnız kendi firmasının taleplerini verir
      const veri = await servisTalepleriniGetir()
      setTalepler(veri ?? [])
    } catch (e) {
      console.warn('[musteri ana] talepler alınamadı:', e?.message)
    }
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const ozet = useMemo(() => {
    const acik = talepler.filter((t) => !ACIK_DISI.includes((t.durum || '').toLowerCase()))
    const tamamlanan = talepler.filter((t) => ['tamamlandi', 'onaylandi'].includes((t.durum || '').toLowerCase()))
    return { acik: acik.length, tamamlanan: tamamlanan.length, toplam: talepler.length }
  }, [talepler])

  const sonTalepler = talepler.slice(0, 4)

  const izinliTurler = kullanici?.izinliTurler
  const teklifIzinli = !izinliTurler || izinliTurler.length === 0 || izinliTurler.includes('teklif')

  const hizliEylemler = [
    { ad: 'Yeni Talep', ikon: 'plus-circle', renk: colors.primary, nav: 'YeniTalep' },
    ...(teklifIzinli ? [{ ad: 'Teklif İste', ikon: 'briefcase', renk: '#10b981', nav: 'TeklifIste' }] : []),
    { ad: 'Cihazlarım', ikon: 'hard-drive', renk: '#7c3aed', nav: 'Cihazlarım', tab: true },
  ]

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 14, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
      >
        {/* Karşılama + bildirim */}
        <View style={styles.ustSatir}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.hosgeldin, { color: colors.textMuted }]}>Müşteri Portalı</Text>
            <Text style={[styles.ad, { color: colors.textPrimary }]} numberOfLines={1}>
              {kullanici?.firmaAdi || kullanici?.ad || ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.zil, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Bildirimler')}
            activeOpacity={0.8}
          >
            <Feather name="bell" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Talep özeti kartları */}
        <View style={styles.ozetSatir}>
          {[
            { etiket: 'Açık talep', deger: ozet.acik, renk: colors.warning },
            { etiket: 'Tamamlanan', deger: ozet.tamamlanan, renk: colors.success },
            { etiket: 'Toplam', deger: ozet.toplam, renk: colors.primary },
          ].map((k) => (
            <TouchableOpacity
              key={k.etiket}
              style={[styles.ozetKart, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Taleplerim')}
              activeOpacity={0.8}
            >
              <Text style={[styles.ozetDeger, { color: k.renk }]}>{k.deger}</Text>
              <Text style={[styles.ozetEtiket, { color: colors.textMuted }]}>{k.etiket}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hızlı eylemler */}
        <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>HIZLI İŞLEMLER</Text>
        <View style={styles.eylemSatir}>
          {hizliEylemler.map((e) => (
            <TouchableOpacity
              key={e.ad}
              style={[styles.eylemKart, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate(e.nav)}
              activeOpacity={0.8}
            >
              <View style={[styles.eylemIkon, { backgroundColor: `${e.renk}22` }]}>
                <Feather name={e.ikon} size={19} color={e.renk} />
              </View>
              <Text style={[styles.eylemAd, { color: colors.textPrimary }]} numberOfLines={1}>{e.ad}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Son talepler */}
        <View style={styles.sonBaslikSatir}>
          <Text style={[styles.bolumBaslik, { color: colors.textMuted, marginBottom: 0 }]}>SON TALEPLER</Text>
          {talepler.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Taleplerim')}>
              <Text style={[styles.tumunuGor, { color: colors.primary }]}>Tümünü gör</Text>
            </TouchableOpacity>
          )}
        </View>
        {sonTalepler.length === 0 ? (
          <View style={[styles.bosKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="inbox" size={22} color={colors.textFaded} />
            <Text style={[styles.bosMetin, { color: colors.textMuted }]}>
              Henüz talebiniz yok. "Yeni Talep" ile başlayabilirsiniz.
            </Text>
          </View>
        ) : (
          sonTalepler.map((t) => {
            const durum = durumBul(t.durum)
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.talepKart, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate('ServisDetay', { id: t.id })}
                activeOpacity={0.75}
              >
                <View style={styles.talepUst}>
                  <Text style={[styles.talepNo, { color: colors.textFaded }]}>{t.talepNo ?? `#${t.id}`}</Text>
                  {durum && (
                    <Text style={[styles.talepDurum, { color: durum.renk }]}>{durum.ikon} {durum.isim}</Text>
                  )}
                </View>
                <Text style={[styles.talepKonu, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t.konu || '—'}
                </Text>
                <Text style={[styles.talepAlt, { color: colors.textFaded }]} numberOfLines={1}>
                  {[t.lokasyon, tarihFormat(t.olusturmaTarihi)].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  ustSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  hosgeldin: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  ad: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  zil: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  ozetSatir: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  ozetKart: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  ozetDeger: { fontSize: 22, fontWeight: '800' },
  ozetEtiket: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  bolumBaslik: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  eylemSatir: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  eylemKart: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 12, alignItems: 'center', gap: 7,
  },
  eylemIkon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  eylemAd: { fontSize: 11.5, fontWeight: '700' },

  sonBaslikSatir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  tumunuGor: { fontSize: 12, fontWeight: '700' },

  bosKart: {
    borderRadius: 12, borderWidth: 1, padding: 18,
    alignItems: 'center', gap: 8,
  },
  bosMetin: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },

  talepKart: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  talepUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  talepNo: { fontSize: 11, fontWeight: '700' },
  talepDurum: { fontSize: 11, fontWeight: '700' },
  talepKonu: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  talepAlt: { fontSize: 11.5, marginTop: 3 },
})
