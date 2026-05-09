// Bildirimler listesi — kullanıcıya gelen tüm bildirimler, realtime güncel.
// Tıklayınca ilgili kayda navigate, otomatik okundu işaretler.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated, PanResponder,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  bildirimleriGetir,
  bildirimOkuDb,
  tumBildirimleriOkuDb,
  bildirimSilDb,
  bildirimleriDinle,
} from '../services/bildirimService'

const TIP_RENK = {
  bilgi: '#0176D3',
  uyari: '#f59e0b',
  hata: '#dc2626',
  basari: '#10b981',
  mention: '#8b5cf6',
}
const TIP_IKON = {
  bilgi: 'info',
  uyari: 'alert-triangle',
  hata: 'x-circle',
  basari: 'check-circle',
  mention: 'at-sign',
}

const goreceTarih = (t) => {
  if (!t) return ''
  const ms = Date.now() - new Date(t).getTime()
  const dk = Math.floor(ms / 60000)
  if (dk < 1) return 'şimdi'
  if (dk < 60) return `${dk} dk önce`
  const sa = Math.floor(dk / 60)
  if (sa < 24) return `${sa} saat önce`
  const gun = Math.floor(sa / 24)
  if (gun < 30) return `${gun} gün önce`
  return new Date(t).toLocaleDateString('tr-TR')
}

export default function BildirimlerScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [bildirimler, setBildirimler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)
  const subRef = useRef(null)

  const yukle = useCallback(async () => {
    if (!kullanici?.id) { setYukleniyor(false); return }
    const data = await bildirimleriGetir(kullanici.id, 100)
    setBildirimler(data)
    setYukleniyor(false)
    setYenileniyor(false)
  }, [kullanici?.id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Realtime — yeni gelince listeye ekle
  useEffect(() => {
    if (!kullanici?.id) return
    subRef.current = bildirimleriDinle(kullanici.id, (yeni) => {
      setBildirimler(prev => {
        if (prev.some(b => b.id === yeni.id)) return prev
        return [yeni, ...prev]
      })
    })
    return () => subRef.current?.unsubscribe?.()
  }, [kullanici?.id])

  const linkTap = async (b) => {
    if (!b.okundu) {
      setBildirimler(prev => prev.map(x => x.id === b.id ? { ...x, okundu: true } : x))
      await bildirimOkuDb(b.id)
    }
    if (!b.link) return
    // Link örnekleri: /gorevler/123, /servis-talepleri/456 → mobile screen'lere map
    const parcalar = b.link.split('/').filter(Boolean)
    if (parcalar[0] === 'gorevler' && parcalar[1]) {
      navigation.navigate('GörevDetay', { id: parseInt(parcalar[1]) })
    } else if (parcalar[0] === 'servis-talepleri' && parcalar[1]) {
      navigation.navigate('ServisDetay', { id: parseInt(parcalar[1]) })
    } else if (parcalar[0] === 'gorusmeler' && parcalar[1]) {
      navigation.navigate('GorusmeDetay', { id: parseInt(parcalar[1]) })
    } else if (parcalar[0] === 'teklifler' && parcalar[1]) {
      navigation.navigate('TeklifDetay', { id: parseInt(parcalar[1]) })
    }
  }

  const sil = (b) => {
    Alert.alert('Sil', 'Bildirim silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          setBildirimler(prev => prev.filter(x => x.id !== b.id))
          await bildirimSilDb(b.id)
        },
      },
    ])
  }

  const tumunuOku = async () => {
    setBildirimler(prev => prev.map(b => ({ ...b, okundu: true })))
    await tumBildirimleriOkuDb(kullanici.id)
  }

  const okunmamisSayisi = bildirimler.filter(b => !b.okundu).length

  if (yukleniyor) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {okunmamisSayisi > 0 && (
        <TouchableOpacity
          onPress={tumunuOku}
          style={[styles.tumOkuBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Feather name="check-circle" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
            Tümünü okundu işaretle ({okunmamisSayisi})
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={bildirimler}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={yenileniyor}
            onRefresh={() => { setYenileniyor(true); yukle() }}
            tintColor={colors.textPrimary}
          />
        }
        ListEmptyComponent={
          <View style={{ paddingTop: 64, alignItems: 'center' }}>
            <Feather name="bell-off" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
              Henüz bildirim yok
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const renk = TIP_RENK[item.tip] || colors.primary
          const ikon = TIP_IKON[item.tip] || 'bell'
          return (
            <SwipeSatir onSil={() => sil(item)} colors={colors}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => linkTap(item)}
                onLongPress={() => sil(item)}
                style={[
                  styles.kart,
                  {
                    backgroundColor: item.okundu ? colors.surface : `${colors.primary}08`,
                    borderColor: item.okundu ? colors.border : `${colors.primary}40`,
                    borderLeftColor: renk,
                    marginBottom: 0,  // swipeWrap marginBottom yönetiyor
                  },
                ]}
              >
                <View style={[styles.ikonKutu, { backgroundColor: `${renk}20` }]}>
                  <Feather name={ikon} size={16} color={renk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.baslik, { color: colors.textPrimary, fontWeight: item.okundu ? '500' : '700' }]}>
                    {item.baslik}
                  </Text>
                  {!!item.mesaj && (
                    <Text style={[styles.mesaj, { color: colors.textMuted }]} numberOfLines={3}>
                      {item.mesaj}
                    </Text>
                  )}
                  <Text style={[styles.tarih, { color: colors.textMuted }]}>
                    {goreceTarih(item.olusturmaTarih)}
                  </Text>
                </View>
                {!item.okundu && (
                  <View style={[styles.okunmamisDot, { backgroundColor: renk }]} />
                )}
              </TouchableOpacity>
            </SwipeSatir>
          )
        }}
      />
    </ScreenContainer>
  )
}

// Sol/sağ kaydırma → arkadan kırmızı "Sil" butonu açılır
// Pure JS PanResponder + Animated — react-native-gesture-handler gerektirmez
function SwipeSatir({ children, onSil, colors }) {
  const translateX = useRef(new Animated.Value(0)).current
  const acikRef = useRef(false)
  const ESIK = 60        // Bu kadar kaydırırsa açık kalır
  const SIL_ESIK = -200  // Bu kadar kaydırırsa direkt siler
  const ACIK_KONUM = -100

  const responder = useRef(PanResponder.create({
    // Yatay kaydırma dikeyden büyükse devral, aksi halde FlatList scroll devam etsin
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => {
      if (acikRef.current) {
        // Açıkken sağa kaydırırsa kapanma yönü
        translateX.setValue(Math.min(0, ACIK_KONUM + g.dx))
      } else {
        // Kapalıyken sola kaydır
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, SIL_ESIK))
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < SIL_ESIK + 20) {
        // Çok hızlı/uzaklara sola kaydırdı → direkt sil
        Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => {
          onSil?.()
          translateX.setValue(0)
          acikRef.current = false
        })
      } else if (acikRef.current) {
        // Açıkken sağa yetince kaydırdıysa kapat
        const kapat = g.dx > 30
        Animated.timing(translateX, {
          toValue: kapat ? 0 : ACIK_KONUM, duration: 180, useNativeDriver: true,
        }).start(() => { acikRef.current = !kapat })
      } else {
        // Yeterince sola kaydırdıysa açık konumda kalsın
        const ac = g.dx < -ESIK
        Animated.timing(translateX, {
          toValue: ac ? ACIK_KONUM : 0, duration: 180, useNativeDriver: true,
        }).start(() => { acikRef.current = ac })
      }
    },
  })).current

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.silArka}>
        <TouchableOpacity onPress={onSil} style={styles.silBtn} activeOpacity={0.85}>
          <Feather name="trash-2" size={20} color="#fff" />
          <Text style={styles.silText}>Sil</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={{ width: '100%', backgroundColor: colors.background, transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  tumOkuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    margin: 12, marginBottom: 0,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1,
    justifyContent: 'center',
  },
  kart: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, marginBottom: 8,
    borderRadius: 10, borderWidth: 1, borderLeftWidth: 4,
  },
  ikonKutu: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  baslik: { fontSize: 14, marginBottom: 2 },
  mesaj: { fontSize: 12, lineHeight: 16 },
  tarih: { fontSize: 11, marginTop: 4 },
  okunmamisDot: {
    width: 8, height: 8, borderRadius: 4,
    marginTop: 6, flexShrink: 0,
  },
  swipeWrap: { position: 'relative', overflow: 'hidden', borderRadius: 10, marginBottom: 8 },
  silArka: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: 100,
    backgroundColor: '#dc2626', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  silBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', width: 100 },
  silText: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 },
})
