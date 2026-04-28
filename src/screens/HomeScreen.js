import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ScreenContainer from '../components/ScreenContainer'
import Avatar from '../components/Avatar'
import { banaAtananAktifGorevSayisi } from '../services/gorevService'
import { banaAtananAktifTalepSayisi } from '../services/servisService'
import { kullaniciMenuYetkileri } from '../services/menuYetkiService'

export default function HomeScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  let tabBarHeight = 0
  try { tabBarHeight = useBottomTabBarHeight() } catch (_) {}
  const [gorevSayisi, setGorevSayisi] = useState(0)
  const [servisSayisi, setServisSayisi] = useState(0)
  const [yetki, setYetki] = useState({})

  const sayilariYukle = useCallback(async () => {
    if (!kullanici?.id) return
    const [g, s] = await Promise.all([
      banaAtananAktifGorevSayisi(kullanici.id),
      banaAtananAktifTalepSayisi(kullanici.id),
    ])
    setGorevSayisi(g)
    setServisSayisi(s)
  }, [kullanici])

  const yetkiYukle = useCallback(async () => {
    if (!kullanici?.id) return
    const harita = await kullaniciMenuYetkileri(kullanici.id)
    setYetki(harita)
  }, [kullanici])

  // Default: kayıt yoksa görünür (true)
  const gorunur = (anahtar) => yetki[anahtar] !== false

  useEffect(() => { sayilariYukle(); yetkiYukle() }, [sayilariYukle, yetkiYukle])
  useFocusEffect(useCallback(() => { sayilariYukle(); yetkiYukle() }, [sayilariYukle, yetkiYukle]))

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Üst bar — selamlama solda, avatar sağda */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.welcome, { color: colors.textPrimary }]}>Merhaba {kullanici?.ad ?? 'Kullanıcı'}</Text>
            <Text style={[styles.role, { color: colors.textMuted }]}>{kullanici?.unvan ?? 'Kullanıcı'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profil')}
            activeOpacity={0.7}
            style={styles.avatarWrap}
          >
            <Avatar
              ad={kullanici?.ad}
              fotoUrl={kullanici?.fotoUrl}
              size={44}
            />
          </TouchableOpacity>
        </View>

        {/* Grid */}
        <View style={styles.gridArea}>
          <View style={styles.grid}>
            {gorunur('gorevler') && (
              <Tile
                title="Görevlerim"
                hint="Bana atananlar"
                icon={<Feather name="check-square" size={28} color="#60a5fa" />}
                badge={gorevSayisi}
                onPress={() => navigation.navigate('Görevler')}
              />
            )}
            {gorunur('servisler') && (
              <Tile
                title="Servislerim"
                hint="Atanan talepler"
                icon={<Feather name="tool" size={28} color="#f59e0b" />}
                badge={servisSayisi}
                onPress={() => navigation.navigate('Servisler')}
              />
            )}
            {gorunur('tara') && (
              <Tile
                title="Tara"
                hint="S/N · Barkod · QR"
                icon={<MaterialCommunityIcons name="barcode-scan" size={30} color="#ef4444" />}
                onPress={() => navigation.navigate('Tara')}
              />
            )}
            {gorunur('stok') && (
              <Tile
                title="Stok"
                hint="Tüm stok + cihazlar"
                icon={<Feather name="package" size={28} color="#22c55e" />}
                onPress={() => navigation.navigate('Stok')}
              />
            )}
            {gorunur('teklif') && (
              <Tile
                title="Teklif"
                hint="Hazırla & gönder"
                icon={<Feather name="file-text" size={28} color="#a855f7" />}
                onPress={() => navigation.navigate('Teklif')}
              />
            )}
            {gorunur('musteriler') && (
              <Tile
                title="Müşteriler"
                hint="Arama / detay"
                icon={<Feather name="users" size={28} color="#06b6d4" />}
                onPress={() => navigation.navigate('Müşteriler')}
              />
            )}
            {gorunur('gorusmeler') && (
              <Tile
                title="Görüşmelerim"
                hint="Yeni & geçmiş"
                icon={<Feather name="message-circle" size={28} color="#fbbf24" />}
                onPress={() => navigation.navigate('Gorusmeler')}
              />
            )}
          </View>
        </View>

        {/* Destek kestirme kartı */}
        {gorunur('destek') && (
        <TouchableOpacity
          style={styles.destekCard}
          onPress={() => navigation.navigate('DestekListe')}
          activeOpacity={0.8}
        >
          <Feather name="help-circle" size={18} color={colors.primaryLight} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.destekTitle, { color: colors.textSecondary }]}>Sorun mu yaşıyorsun?</Text>
            <Text style={[styles.destekHint, { color: colors.textMuted }]}>Destek ekibine ulaş</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

function Tile({ title, hint, onPress, icon, badge }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {!!icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.tileHint, { color: colors.textMuted }]}>{hint}</Text>

      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },

  destekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
    backgroundColor: 'rgba(96, 165, 250, 0.06)',
  },
  destekTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  destekHint: { color: '#64748b', fontSize: 11, marginTop: 2 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  welcome: { color: '#fff', fontSize: 22, fontWeight: '700' },
  role: {
    color: '#94a3b8',
    textTransform: 'capitalize',
    fontSize: 13,
    marginTop: 2,
  },
  avatarWrap: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  gridArea: {
    paddingTop: 32,
    paddingBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 18,
    borderRadius: 14,
    minHeight: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  iconWrap: { marginBottom: 10 },
  tileTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tileHint: { color: '#94a3b8', marginTop: 4, fontSize: 12 },

  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ef4444',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0f1e',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
})
