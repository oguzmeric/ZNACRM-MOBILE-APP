import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native'
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
import { okunmamisBildirimSayisi, bildirimleriDinle } from '../services/bildirimService'
import { aktifZimmetleriGetir } from '../services/demoService'
import { demoBildirimleriniKontrolEt } from '../lib/demoBildirim'
import DuyuruBanner from '../components/DuyuruBanner'
import MesaiKarti from '../components/MesaiKarti'
import { mesaiTakipVarMi } from '../services/mesaiService'
import { aracFotoModulVarMi } from '../services/aracFotoService'

export default function HomeScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  let tabBarHeight = 0
  try { tabBarHeight = useBottomTabBarHeight() } catch (_) {}
  const [gorevSayisi, setGorevSayisi] = useState(0)
  const [servisSayisi, setServisSayisi] = useState(0)
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0)
  const [demoGecikmisSayisi, setDemoGecikmisSayisi] = useState(0)
  const [yetki, setYetki] = useState({})

  // 2-sütun kompakt grid — kesin px hesap
  const tileGenislik = useMemo(() => {
    const ekran = Dimensions.get('window').width
    const yatayPad = 16 * 2
    const gap = 10
    return Math.floor((ekran - yatayPad - gap) / 2)
  }, [])

  const sayilariYukle = useCallback(async () => {
    if (!kullanici?.id) return
    const [g, s, b, dz] = await Promise.all([
      banaAtananAktifGorevSayisi(kullanici.id),
      banaAtananAktifTalepSayisi(kullanici.id),
      okunmamisBildirimSayisi(kullanici.id),
      aktifZimmetleriGetir(),
    ])
    setGorevSayisi(g)
    setServisSayisi(s)
    setOkunmamisSayisi(b)
    setDemoGecikmisSayisi((dz || []).filter(z => z.beklenenIadeTarihi && new Date(z.beklenenIadeTarihi) < new Date()).length)
  }, [kullanici])

  // Demo bildirim kontrolü — oturum başına 1 kez
  useEffect(() => {
    if (kullanici?.id) demoBildirimleriniKontrolEt(kullanici).catch(() => {})
  }, [kullanici?.id])

  // Realtime — yeni bildirim gelince badge anlık artsın
  useEffect(() => {
    if (!kullanici?.id) return
    const sub = bildirimleriDinle(kullanici.id, () => {
      setOkunmamisSayisi(n => n + 1)
    })
    return () => sub?.unsubscribe?.()
  }, [kullanici?.id])

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
        {/* Üst bar — selamlama solda, çan + avatar sağda */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.welcome, { color: colors.textPrimary }]}>Merhaba {kullanici?.ad ?? 'Kullanıcı'}</Text>
            <Text style={[styles.role, { color: colors.textMuted }]}>{kullanici?.unvan ?? 'Kullanıcı'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Bildirimler')}
            activeOpacity={0.7}
            style={{ position: 'relative', padding: 8, marginRight: 4 }}
          >
            <Feather name="bell" size={22} color={colors.textPrimary} />
            {okunmamisSayisi > 0 && (
              <View style={{
                position: 'absolute',
                top: 4, right: 2,
                minWidth: 18, height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: '#dc2626',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                  {okunmamisSayisi > 99 ? '99+' : okunmamisSayisi}
                </Text>
              </View>
            )}
          </TouchableOpacity>
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

        {/* Aktif duyurular — Oğuz'un yayınladığı bildirimler herkese düşer */}
        <DuyuruBanner kullaniciId={kullanici?.id} />

        {/* Mesai kartı — modülü olan teknisyen/depo/yönetim görür */}
        {mesaiTakipVarMi(kullanici) && <MesaiKarti />}

        {/* Grid */}
        <View style={styles.gridArea}>
          <View style={styles.grid}>
            {gorunur('gorevler') && (
              <Tile width={tileGenislik}
                title="Görevlerim"
                hint="Bana atananlar"
                icon={<Feather name="check-square" size={22} color="#60a5fa" />}
                badge={gorevSayisi}
                onPress={() => navigation.navigate('Görevler')}
              />
            )}
            {gorunur('servisler') && (
              <Tile width={tileGenislik}
                title="Servislerim"
                hint="Atanan talepler"
                icon={<Feather name="tool" size={22} color="#f59e0b" />}
                badge={servisSayisi}
                onPress={() => navigation.navigate('Servisler')}
              />
            )}
            {gorunur('tara') && (
              <Tile width={tileGenislik}
                title="Tara"
                hint="S/N · Barkod · QR"
                icon={<MaterialCommunityIcons name="barcode-scan" size={22} color="#ef4444" />}
                onPress={() => navigation.navigate('Tara')}
              />
            )}
            {gorunur('stok') && (
              <Tile width={tileGenislik}
                title="Stok"
                hint="Tüm stok + cihazlar"
                icon={<Feather name="package" size={22} color="#22c55e" />}
                onPress={() => navigation.navigate('Stok')}
              />
            )}
            {gorunur('arac_takip') && (
              <Tile width={tileGenislik}
                title="Mobiltek"
                hint="Araç takip · kamera"
                icon={<Feather name="truck" size={22} color="#60a5fa" />}
                onPress={() => navigation.navigate('Mobiltek')}
              />
            )}
            {aracFotoModulVarMi(kullanici) && (
              <Tile width={tileGenislik}
                title="Araç Foto"
                hint="Sabah / akşam kayıt"
                icon={<Feather name="camera" size={22} color="#ec4899" />}
                onPress={() => navigation.navigate('AracKayit')}
              />
            )}
            {gorunur('teklif') && (
              <Tile width={tileGenislik}
                title="Teklif"
                hint="Hazırla & gönder"
                icon={<Feather name="file-text" size={22} color="#a855f7" />}
                onPress={() => navigation.navigate('Teklif')}
              />
            )}
            {gorunur('musteriler') && (
              <Tile width={tileGenislik}
                title="Müşteriler"
                hint="Arama / detay"
                icon={<Feather name="users" size={22} color="#06b6d4" />}
                onPress={() => navigation.navigate('Müşteriler')}
              />
            )}
            {gorunur('gorusmeler') && (
              <Tile width={tileGenislik}
                title="Görüşmelerim"
                hint="Yeni & geçmiş"
                icon={<Feather name="message-circle" size={22} color="#fbbf24" />}
                onPress={() => navigation.navigate('Gorusmeler')}
              />
            )}
            {gorunur('demolar') && (
              <Tile width={tileGenislik}
                title="Demo Takip"
                hint="Müşteride/depoda"
                icon={<Feather name="package" size={22} color="#a855f7" />}
                badge={demoGecikmisSayisi}
                onPress={() => navigation.navigate('Demolar')}
              />
            )}
            <Tile width={tileGenislik}
              title="Notlarım"
              hint="Keşif & fikirler"
              icon={<Feather name="edit-3" size={22} color="#f59e0b" />}
              onPress={() => navigation.navigate('Notlarim')}
            />
            <Tile width={tileGenislik}
              title="Takvim"
              hint="Toplantı + Meet"
              icon={<Feather name="calendar" size={22} color="#1a73e8" />}
              onPress={() => navigation.navigate('Takvim')}
            />
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

      {/* Status bar backdrop — scroll içeriği yukarı çıkınca iOS saati ile
          başlık metinleri çakışmasın diye üstte opak bir bant. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: insets.top,
          backgroundColor: colors.bg,
        }}
      />
    </ScreenContainer>
  )
}

function Tile({ title, hint, onPress, icon, badge, width }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.tile, width ? { width } : null, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
    paddingTop: 20,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    minHeight: 92,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  iconWrap: { marginBottom: 8 },
  tileTitle: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  tileHint: { color: '#94a3b8', marginTop: 2, fontSize: 11 },

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
