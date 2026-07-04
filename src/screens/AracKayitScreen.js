// Araç foto kayıt — plaka listesi. Her plaka bugün "sabah X/6 · akşam Y/6" gösterir.
import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import ScreenContainer from '../components/ScreenContainer'
import { tumAraclarBugunOzet, BOLGELER } from '../services/aracFotoService'

export default function AracKayitScreen({ navigation }) {
  const { colors } = useTheme()
  const [araclar, setAraclar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [tazele, setTazele] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try { setAraclar(await tumAraclarBugunOzet()) } catch {}
    setYukleniyor(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onTazele = async () => { setTazele(true); await yukle(); setTazele(false) }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={tazele} onRefresh={onTazele} tintColor={colors.textMuted} />}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>Araç Foto Kayıt</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 20 }}>
          Kullandığın aracın plakasını seç, sabah ve akşam foto çek.
        </Text>

        {yukleniyor && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!yukleniyor && araclar.length === 0 && (
          <View style={{ padding: 30, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Feather name="truck" size={28} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              Kayıtlı araç yok. Yönetici web'den plaka ekleyecek.
            </Text>
          </View>
        )}

        <View style={{ gap: 10 }}>
          {araclar.map(a => (
            <AracKart key={a.id} arac={a} colors={colors}
              onBas={() => navigation.navigate('AracFotoDetay', { aracId: a.id, plaka: a.plaka })} />
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

function AracKart({ arac, colors, onBas }) {
  const toplam = BOLGELER.length
  const sabahTamam = arac.sabahSayisi >= toplam
  const aksamTamam = arac.aksamSayisi >= toplam
  return (
    <TouchableOpacity onPress={onBas} activeOpacity={0.75}
      style={{
        backgroundColor: colors.surface, borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: colors.border,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }}>
      <View style={{
        width: 46, height: 46, borderRadius: 10,
        backgroundColor: colors.primary + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Feather name="truck" size={22} color={colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
          {arac.plaka}
        </Text>
        {(arac.marka || arac.model) && (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {[arac.marka, arac.model].filter(Boolean).join(' · ')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Rozet colors={colors} etiket="Sabah" sayi={arac.sabahSayisi} toplam={toplam} tamam={sabahTamam} />
          <Rozet colors={colors} etiket="Akşam" sayi={arac.aksamSayisi} toplam={toplam} tamam={aksamTamam} />
        </View>
      </View>

      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  )
}

function Rozet({ colors, etiket, sayi, toplam, tamam }) {
  const bos = sayi === 0
  const bg = tamam ? colors.success + '22' : bos ? colors.surfaceDark : colors.warning + '22'
  const fg = tamam ? colors.success : bos ? colors.textMuted : colors.warning
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    }}>
      {tamam && <Feather name="check-circle" size={11} color={fg} />}
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>
        {etiket} {sayi}/{toplam}
      </Text>
    </View>
  )
}
