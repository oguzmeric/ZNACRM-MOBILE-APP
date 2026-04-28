import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { gorusmeGetir } from '../services/gorusmeService'

const DURUM_ETIKET = {
  acik: 'Açık',
  beklemede: 'Beklemede',
  kapali: 'Kapalı',
  tamamlandi: 'Tamamlandı',
  planlandi: 'Planlandı',
}

export default function GorusmeDetayScreen({ route }) {
  const { id } = route.params
  const { colors } = useTheme()
  const [g, setG] = useState(null)
  const [loading, setLoading] = useState(true)

  const yukle = useCallback(async () => {
    const veri = await gorusmeGetir(id)
    setG(veri)
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }

  if (!g) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textMuted, padding: 24, textAlign: 'center' }}>
          Görüşme bulunamadı.
        </Text>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Başlık */}
        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.firmaAd, { color: colors.textPrimary }]}>{g.firmaAdi || '—'}</Text>
          {!!g.musteriAdi && (
            <Text style={[styles.alt, { color: colors.textMuted }]}>{g.musteriAdi}</Text>
          )}
          <View style={styles.rozetRow}>
            {!!g.konu && <Rozet renk={colors.primary} text={g.konu} />}
            {!!g.tip && <Rozet renk={colors.info ?? '#06b6d4'} text={g.tip} />}
            {!!g.durum && <Rozet renk={colors.warning ?? '#f59e0b'} text={DURUM_ETIKET[g.durum] ?? g.durum} />}
          </View>
        </View>

        {/* Bilgiler */}
        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Satir ikon="calendar" label="Tarih" value={g.tarih ? `${g.tarih}${g.saat ? ` · ${g.saat}` : ''}` : '—'} colors={colors} />
          <Satir ikon="user" label="Hazırlayan" value={g.hazirlayan ?? '—'} colors={colors} />
          {!!g.aktNo && <Satir ikon="hash" label="Akt No" value={g.aktNo} colors={colors} />}
        </View>

        {/* Notlar */}
        {!!g.notlar && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>NOTLAR</Text>
            <Text style={[styles.notlar, { color: colors.textPrimary }]} selectable>
              {g.notlar}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

function Rozet({ text, renk }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: renk + '22', marginRight: 6, marginBottom: 4 }}>
      <Text style={{ color: renk, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  )
}

function Satir({ ikon, label, value, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={ikon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  kart: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  firmaAd: { fontSize: 18, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 4 },
  rozetRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  notlar: { fontSize: 13, lineHeight: 20 },
})
