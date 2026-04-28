import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import Avatar from '../../components/Avatar'
import { useTheme } from '../../context/ThemeContext'
import { kullanicilariGetir } from '../../services/kullaniciService'
import { banaAtananAktifTalepSayisi } from '../../services/servisService'
import { banaAtananAktifGorevSayisi } from '../../services/gorevService'

export default function AdminPersonelTakipScreen({ navigation }) {
  const { colors } = useTheme()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const tum = (await kullanicilariGetir()) ?? []
    // Müşteri portal kullanıcılarını ele — sadece personel görünsün
    const kisiler = tum.filter((k) => k.tip !== 'musteri' && !k.musteriId)
    const zengin = await Promise.all(
      kisiler.map(async (k) => {
        const [servis, gorev] = await Promise.all([
          banaAtananAktifTalepSayisi(k.id),
          banaAtananAktifGorevSayisi(k.id),
        ])
        return { ...k, aktifServis: servis, aktifGorev: gorev }
      })
    )
    setListe(zengin)
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
        data={liste}
        keyExtractor={(k) => String(k.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 40 }}>
            Saha personeli bulunamadı.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('AdminPersonelDetay', { kullaniciId: item.id, ad: item.ad })}
            activeOpacity={0.85}
          >
            <Avatar ad={item.ad} fotoUrl={item.fotoUrl} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.ad, { color: colors.textPrimary }]}>{item.ad}</Text>
              <Text style={[styles.unvan, { color: colors.textMuted }]}>{item.unvan}</Text>
            </View>
            <View style={styles.sayilar}>
              <Rozet label="Servis" sayi={item.aktifServis} renk={colors.warning} colors={colors} />
              <Rozet label="Görev" sayi={item.aktifGorev} renk={colors.primaryLight} colors={colors} />
            </View>
            <Feather name="chevron-right" size={18} color={colors.textFaded} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AdminYeniPersonel')}
        activeOpacity={0.85}
      >
        <Feather name="user-plus" size={18} color="#fff" />
        <Text style={styles.fabText}>Yeni Personel</Text>
      </TouchableOpacity>
    </ScreenContainer>
  )
}

function Rozet({ label, sayi, renk, colors }) {
  return (
    <View style={styles.rozet}>
      <Text style={[styles.rozetSayi, { color: renk }]}>{sayi ?? 0}</Text>
      <Text style={[styles.rozetLabel, { color: colors.textFaded }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  ad: { fontSize: 15, fontWeight: '700' },
  unvan: { fontSize: 12, marginTop: 2 },
  sayilar: { flexDirection: 'row', gap: 12 },
  rozet: { alignItems: 'center', minWidth: 44 },
  rozetSayi: { fontSize: 18, fontWeight: '800' },
  rozetLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700' },
})
