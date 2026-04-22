import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { arrayToCamel } from '../../lib/mapper'
import { banaAtananTalepler } from '../../services/servisService'
import { durumBul } from '../../utils/servisConstants'
import { tarihSaatFormat } from '../../utils/format'

export default function AdminPersonelDetayScreen({ route, navigation }) {
  const { kullaniciId, ad } = route.params
  const { colors } = useTheme()

  const [talepler, setTalepler] = useState([])
  const [malzemeler, setMalzemeler] = useState([])
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    navigation.setOptions({ title: ad ?? 'Personel Detayı' })
  }, [navigation, ad])

  const yukle = useCallback(async () => {
    // Atanan tüm talepler (aktif + geçmiş)
    const atanan = (await banaAtananTalepler(kullaniciId)) ?? []
    setTalepler(atanan)

    // Bu personelin talepleri üzerindeki kullanılan malzemeler
    const talepIds = atanan.map((t) => t.id)
    if (talepIds.length > 0) {
      const { data: m } = await supabase
        .from('servis_malzeme_plani')
        .select('*')
        .in('servis_talep_id', talepIds)
        .gt('kullanilan_miktar', 0)
      const toplamMalzeme = {}
      for (const row of arrayToCamel(m ?? [])) {
        const key = row.stokKodu ?? row.stokAdi
        if (!toplamMalzeme[key]) {
          toplamMalzeme[key] = {
            stokKodu: row.stokKodu,
            stokAdi: row.stokAdi,
            birim: row.birim,
            toplamKullanilan: 0,
          }
        }
        toplamMalzeme[key].toplamKullanilan += Number(row.kullanilanMiktar ?? 0)
      }
      setMalzemeler(Object.values(toplamMalzeme).sort((a, b) => b.toplamKullanilan - a.toplamKullanilan))
    } else {
      setMalzemeler([])
    }

    // Gittiği lokasyonlar (unique)
    const lokSayac = {}
    for (const t of atanan) {
      const lok = t.lokasyon?.trim()
      if (!lok) continue
      lokSayac[lok] = (lokSayac[lok] ?? 0) + 1
    }
    setLokasyonlar(
      Object.entries(lokSayac)
        .map(([lokasyon, sayi]) => ({ lokasyon, sayi }))
        .sort((a, b) => b.sayi - a.sayi)
    )

    setLoading(false)
  }, [kullaniciId])

  useEffect(() => { yukle() }, [yukle])

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  const aktif = talepler.filter((t) => !['tamamlandi', 'onaylandi', 'iptal'].includes(t.durum))
  const tamamlanan = talepler.filter((t) => ['tamamlandi', 'onaylandi'].includes(t.durum))

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Özet */}
        <View style={styles.ozetRow}>
          <Ozet sayi={aktif.length} label="Aktif" renk={colors.warning} colors={colors} />
          <Ozet sayi={tamamlanan.length} label="Tamamlanan" renk={colors.success} colors={colors} />
          <Ozet sayi={talepler.length} label="Toplam" renk={colors.primaryLight} colors={colors} />
        </View>

        {/* Gittiği lokasyonlar */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          📍 Gittiği Lokasyonlar ({lokasyonlar.length})
        </Text>
        {lokasyonlar.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Kayıtlı lokasyon yok.</Text>
        ) : (
          lokasyonlar.slice(0, 10).map((l) => (
            <View key={l.lokasyon} style={[styles.lokCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.primaryLight} />
              <Text style={[styles.lokAd, { color: colors.textPrimary }]} numberOfLines={1}>{l.lokasyon}</Text>
              <Text style={[styles.lokSayi, { color: colors.textMuted }]}>{l.sayi}×</Text>
            </View>
          ))
        )}

        {/* Kullanılan malzemeler */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
          🔧 Kullanılan Malzemeler ({malzemeler.length})
        </Text>
        {malzemeler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Kullanılan malzeme kaydı yok.</Text>
        ) : (
          malzemeler.slice(0, 20).map((m) => (
            <View key={m.stokKodu ?? m.stokAdi} style={[styles.malzemeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.malzemeAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.stokAdi ?? m.stokKodu}
                </Text>
                {!!m.stokKodu && (
                  <Text style={[styles.malzemeKodu, { color: colors.textFaded }]}>{m.stokKodu}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.malzemeMiktar, { color: colors.success }]}>
                  {m.toplamKullanilan}
                </Text>
                <Text style={[styles.malzemeBirim, { color: colors.textFaded }]}>{m.birim ?? ''}</Text>
              </View>
            </View>
          ))
        )}

        {/* Son servisler */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
          🗂️ Son Servisler ({talepler.length})
        </Text>
        {talepler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Atanmış servis yok.</Text>
        ) : (
          talepler.slice(0, 15).map((t) => {
            const d = durumBul(t.durum)
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.servisCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate('ServisDetay', { id: t.id })}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.talepNo, { color: colors.primaryLight }]}>
                    {t.talepNo ?? `#${t.id}`}
                  </Text>
                  {d && (
                    <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                      <Text style={[styles.chipText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t.firmaAdi ?? '—'}
                </Text>
                {!!t.konu && (
                  <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={1}>
                    {t.konu}
                  </Text>
                )}
                <Text style={[styles.tarih, { color: colors.textFaded }]}>
                  {tarihSaatFormat(t.olusturmaTarihi)}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

function Ozet({ sayi, label, renk, colors }) {
  return (
    <View style={[styles.ozetKart, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: renk }]}>
      <Text style={[styles.ozetSayi, { color: renk }]}>{sayi}</Text>
      <Text style={[styles.ozetLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  ozetRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  ozetKart: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
  },
  ozetSayi: { fontSize: 22, fontWeight: '800' },
  ozetLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  bos: { fontStyle: 'italic', fontSize: 12 },

  lokCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  lokAd: { flex: 1, fontSize: 13, fontWeight: '600' },
  lokSayi: { fontSize: 12, fontWeight: '700' },

  malzemeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  malzemeAd: { fontSize: 14, fontWeight: '700' },
  malzemeKodu: { fontSize: 11, marginTop: 2 },
  malzemeMiktar: { fontSize: 17, fontWeight: '800' },
  malzemeBirim: { fontSize: 10, marginTop: 1 },

  servisCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  talepNo: { fontSize: 11, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  firma: { fontSize: 14, fontWeight: '700' },
  konu: { fontSize: 12, marginTop: 2 },
  tarih: { fontSize: 10, marginTop: 6 },
})
