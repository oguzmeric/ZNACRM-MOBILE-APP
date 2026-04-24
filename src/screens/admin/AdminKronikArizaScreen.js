import { useCallback, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { kronikArizaListesi } from '../../services/adminStatsService'
import { kalemAra } from '../../services/stokKalemiService'

export default function AdminKronikArizaScreen({ navigation }) {
  const { colors } = useTheme()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const l = await kronikArizaListesi()
    setListe(l ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const cihazaGit = async (seriNo) => {
    const kalem = await kalemAra(seriNo)
    if (kalem) navigation.navigate('CihazDetay', { id: kalem.id })
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <FlatList
        data={liste}
        keyExtractor={(item) => item.seriNo}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListHeaderComponent={
          <Text style={[styles.aciklama, { color: colors.textMuted }]}>
            3 veya daha fazla arıza kaydı olan cihazlar. Tekrarlayan sorunların olduğu bu cihazların üretici değişimi veya yenilenmesi değerlendirilebilir.
          </Text>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 40 }}>
            🎉 Kronik arıza yaşayan cihaz yok.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger + '44' }]}
            onPress={() => cihazaGit(item.seriNo)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.danger + '22' }]}>
              <Feather name="alert-triangle" size={18} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.seriNo, { color: colors.textPrimary }]} numberOfLines={1}>
                S/N: {item.seriNo}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Detay için karta dokun
              </Text>
            </View>
            <View style={styles.sayiBlok}>
              <Text style={[styles.sayi, { color: colors.danger }]}>{item.arizaSayisi}</Text>
              <Text style={[styles.sayiLabel, { color: colors.textFaded }]}>arıza</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  aciklama: { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriNo: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  meta: { fontSize: 11, marginTop: 2 },
  sayiBlok: { alignItems: 'center', minWidth: 44 },
  sayi: { fontSize: 22, fontWeight: '800' },
  sayiLabel: { fontSize: 10, fontWeight: '600', marginTop: -2 },
})
