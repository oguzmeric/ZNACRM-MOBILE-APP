import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { aktiviteFeed } from '../../services/adminStatsService'
import { tarihSaatFormat } from '../../utils/format'

export default function AdminAktivitelerScreen({ navigation }) {
  const { colors } = useTheme()
  const [olaylar, setOlaylar] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const feed = await aktiviteFeed(100)
    setOlaylar(feed ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
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
        data={olaylar}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz aktivite yok.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => item.rota && navigation.navigate(item.rota.name, item.rota.params)}
            activeOpacity={item.rota ? 0.7 : 1}
            disabled={!item.rota}
          >
            <View style={[styles.ikonWrap, { backgroundColor: (item.renk ?? '#3b82f6') + '22' }]}>
              <Feather name={item.ikon ?? 'activity'} size={16} color={item.renk ?? '#3b82f6'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.metin, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.metin}
              </Text>
              {!!item.altMetin && (
                <Text style={[styles.alt, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.altMetin}
                </Text>
              )}
            </View>
            <Text style={[styles.tarih, { color: colors.textFaded }]}>
              {tarihSaatFormat(item.tarih)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  ikonWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metin: { fontSize: 13, fontWeight: '700' },
  alt: { fontSize: 11, marginTop: 2 },
  tarih: { fontSize: 10, fontWeight: '600', marginLeft: 6 },
  bos: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
})
