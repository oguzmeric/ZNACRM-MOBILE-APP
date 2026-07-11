// Keşifler — saha keşif kayıtları listesi (mobile).
// Web karşılığı: /kesifler. Yeni keşif + detay ekranlarına yönlendirir.

import { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { kesifleriGetir, KESIF_DURUMLARI, KESIF_ONCELIKLERI } from '../services/kesifService'

const fmtTarih = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '—'

export default function KesiflerScreen({ navigation }) {
  const { colors } = useTheme()
  const [kesifler, setKesifler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    const liste = await kesifleriGetir()
    setKesifler(liste)
    setYukleniyor(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const q = arama.trim().toLocaleLowerCase('tr')
  const gorunen = q
    ? kesifler.filter(k =>
        `${k.kesifNo || ''} ${k.firmaAdi || ''} ${k.lokasyon || ''} ${k.kesifBasligi || ''}`
          .toLocaleLowerCase('tr').includes(q))
    : kesifler

  return (
    <ScreenContainer>
      <View style={{ flex: 1, padding: 16 }}>
        {/* Arama + yeni */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder="Keşif no, firma, adres ara…"
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1, height: 44, paddingHorizontal: 12, borderRadius: 10,
              borderWidth: 1, borderColor: colors.border,
              backgroundColor: colors.surface, color: colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('YeniKesif')}
            activeOpacity={0.8}
            style={{
              width: 44, height: 44, borderRadius: 10,
              backgroundColor: colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Feather name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={gorunen}
          keyExtractor={(k) => String(k.id)}
          refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} tintColor={colors.textMuted} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={!yukleniyor ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Feather name="compass" size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>
                {q ? 'Aramayla eşleşen keşif yok.' : 'Henüz keşif kaydı yok.\n+ ile ilk saha keşfini oluştur.'}
              </Text>
            </View>
          ) : null}
          renderItem={({ item: k }) => {
            const durum = KESIF_DURUMLARI.find(d => d.id === k.durum)
            const oncelik = KESIF_ONCELIKLERI.find(o => o.id === k.oncelik)
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('KesifDetay', { kesifId: k.id })}
                activeOpacity={0.75}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.border,
                  borderRadius: 12, padding: 14, marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, fontFamily: 'monospace' }}>
                    {k.kesifNo}
                  </Text>
                  {durum && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: durum.renk + '22' }}>
                      <Text style={{ color: durum.renk, fontSize: 11, fontWeight: '700' }}>{durum.ad}</Text>
                    </View>
                  )}
                  {oncelik && oncelik.id !== 'normal' && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: oncelik.renk + '22' }}>
                      <Text style={{ color: oncelik.renk, fontSize: 11, fontWeight: '700' }}>{oncelik.ad.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                  {k.firmaAdi || '—'}
                </Text>
                {!!k.kesifBasligi && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {k.kesifBasligi}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                    {k.lokasyon ? `📍 ${k.lokasyon}` : ''}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fmtTarih(k.kesifTarihi)}</Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      </View>
    </ScreenContainer>
  )
}
