import { useState, useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { View, Text, StyleSheet } from 'react-native'
import HomeScreen from '../screens/HomeScreen'
import GorevlerScreen from '../screens/GorevlerScreen'
import ServisTalepleriScreen from '../screens/ServisTalepleriScreen'
import StokScreen from '../screens/StokScreen'
import MusterilerScreen from '../screens/MusterilerScreen'
import SohbetlerScreen from '../screens/SohbetlerScreen'
import { colors } from '../theme'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { kullaniciMenuYetkileri, menuGorunurMu } from '../services/menuYetkiService'
import { okunmamisMesajSayisi } from '../services/chatService'

const Tab = createBottomTabNavigator()

// Sekme tasarımı: koyu glassmorphism, aktif sekme mavi vurgu
const tabBarStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderTopWidth: 1,
  borderTopColor: 'rgba(255, 255, 255, 0.08)',
  height: 64,
  paddingBottom: 8,
  paddingTop: 8,
}

export default function BottomTabs() {
  const { kullanici } = useAuth()
  const [harita, setHarita] = useState({})
  const [mesajSayisi, setMesajSayisi] = useState(0)

  // Sekmeler de web "Modül erişimleri" + mobil menü yetkilerine uyar
  // (eskiden herkes 5 sekmenin hepsini görüyordu)
  useEffect(() => {
    if (!kullanici?.id) return
    kullaniciMenuYetkileri(kullanici.id).then(setHarita).catch(() => {})
  }, [kullanici?.id])

  const g = (anahtar) => menuGorunurMu(anahtar, kullanici, harita)

  // Sohbet sekmesi rozeti — okunmamış mesaj (birebir + grup).
  // Ana ekranın üst barında duruyordu, uzun isimlerle çakışıyordu (kullanıcı
  // "isim yarım çıkıyor, başka bir yere alalım" dedi) — sekmeye taşındı.
  useEffect(() => {
    if (!kullanici?.id) { setMesajSayisi(0); return }
    let iptal = false
    const yenile = () => {
      okunmamisMesajSayisi(kullanici.id)
        .then((s) => { if (!iptal) setMesajSayisi(s || 0) })
        .catch(() => {})
    }
    yenile()
    // Payload kullanılmıyor, sadece sayaç tazeleniyor — veri sızıntısı yok
    const kanal = supabase
      .channel(`sekme_mesaj_${kullanici.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesajlar' }, yenile)
      .subscribe()
    return () => { iptal = true; supabase.removeChannel(kanal) }
  }, [kullanici?.id])

  return (
    <Tab.Navigator
      initialRouteName="Ana"
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Ana"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      {g('gorevler') && (
        <Tab.Screen
          name="Görevler"
          component={GorevlerScreen}
          options={{
            tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} />,
          }}
        />
      )}
      {/* Sohbet — personel yazışması; yetki gerektirmez, herkes erişir */}
      <Tab.Screen
        name="Sohbet"
        component={SohbetlerScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
          tabBarBadge: mesajSayisi > 0 ? (mesajSayisi > 99 ? '99+' : mesajSayisi) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#dc2626', fontSize: 10, fontWeight: '700' },
        }}
      />
      {g('servisler') && (
        <Tab.Screen
          name="Servisler"
          component={ServisTalepleriScreen}
          options={{
            tabBarIcon: ({ color }) => <Feather name="tool" size={22} color={color} />,
            tabBarLabel: 'Servis',
          }}
        />
      )}
      {g('stok') && (
        <Tab.Screen
          name="Stok"
          component={StokScreen}
          options={{
            tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} />,
          }}
        />
      )}
      {g('musteriler') && (
        <Tab.Screen
          name="Müşteriler"
          component={MusterilerScreen}
          options={{
            tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
            tabBarLabel: 'Müşteri',
          }}
        />
      )}
    </Tab.Navigator>
  )
}
