// Bildirimler listesi — kullanıcıya gelen tüm bildirimler, realtime güncel.
// Tıklayınca ilgili kayda navigate, otomatik okundu işaretler.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
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
  tumBildirimleriSilDb,
  bildirimleriDinle,
} from '../services/bildirimService'
import { badgeAyarla } from '../lib/pushBildirimKayit'
import { bildirimLinkHedefi } from '../lib/bildirimLink'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'

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
    // Link → ekran eşlemesi tek yerde (lib/bildirimLink) — push tıklamasıyla ortak
    const hedef = bildirimLinkHedefi(b.link, kullanici)
    if (hedef) navigation.navigate(...hedef)
  }

  const sil = (b) => {
    Alert.alert('Sil', 'Bildirim silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          const oncekiler = bildirimler
          setBildirimler(prev => prev.filter(x => x.id !== b.id))
          try {
            await bildirimSilDb(b.id)
          } catch (e) {
            setBildirimler(oncekiler)  // rollback
            Alert.alert('Hata', 'Bildirim silinemedi: ' + (e?.message ?? 'bilinmeyen'))
          }
        },
      },
    ])
  }

  const tumunuOku = async () => {
    const oncekiler = bildirimler
    setBildirimler(prev => prev.map(b => ({ ...b, okundu: true })))
    try {
      await tumBildirimleriOkuDb(kullanici.id)
    } catch (e) {
      setBildirimler(oncekiler)
      Alert.alert('Hata', 'Tüm bildirimler okundu işaretlenemedi: ' + (e?.message ?? 'bilinmeyen'))
    }
  }

  const topluSil = () => {
    const okunanSayi = bildirimler.filter(b => b.okundu).length
    const secenekler = [{ text: 'Vazgeç', style: 'cancel' }]
    if (okunanSayi > 0) {
      secenekler.push({
        text: `Okunanları Sil (${okunanSayi})`,
        onPress: () => topluSilCalistir(true),
      })
    }
    secenekler.push({
      text: `Hepsini Sil (${bildirimler.length})`,
      style: 'destructive',
      onPress: () => topluSilCalistir(false),
    })
    Alert.alert('Toplu Sil', 'Hangi bildirimler silinsin?', secenekler)
  }

  const topluSilCalistir = async (sadeceOkunan) => {
    const oncekiler = bildirimler
    setBildirimler(prev => (sadeceOkunan ? prev.filter(b => !b.okundu) : []))
    const ok = await tumBildirimleriSilDb(kullanici.id, { sadeceOkunan })
    if (!ok) {
      setBildirimler(oncekiler)  // rollback
      Alert.alert('Hata', 'Bildirimler silinemedi.')
    }
  }

  const okunmamisSayisi = bildirimler.filter(b => !b.okundu).length

  // iOS badge — okunmamış sayısı her değiştiğinde ikon üstündeki rakamı senkronla
  useEffect(() => {
    badgeAyarla(okunmamisSayisi)
  }, [okunmamisSayisi])

  if (yukleniyor) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {bildirimler.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, margin: 12, marginBottom: 0 }}>
          {okunmamisSayisi > 0 && (
            <TouchableOpacity
              onPress={tumunuOku}
              style={[styles.tumOkuBtn, { borderColor: colors.border, backgroundColor: colors.surface, flex: 1 }]}
            >
              <Feather name="check-circle" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                Tümünü okundu ({okunmamisSayisi})
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={topluSil}
            style={[styles.tumOkuBtn, {
              borderColor: 'rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              flex: 1,
            }]}
          >
            <Feather name="trash-2" size={14} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
              Toplu Sil
            </Text>
          </TouchableOpacity>
        </View>
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
          <EmptyState
            ikon="bell-off"
            baslik="Henüz bildirim yok"
            mesaj="Yeni etkinlikler burada görünecek"
          />
        }
        renderItem={({ item }) => {
          const renk = TIP_RENK[item.tip] || colors.primary
          const ikon = TIP_IKON[item.tip] || 'bell'
          return (
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
                },
              ]}
            >
              <View style={[styles.ikonKutu, { backgroundColor: `${renk}20` }]}>
                <Feather name={ikon} size={16} color={renk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.baslik, { color: colors.textPrimary, fontWeight: item.okundu ? '500' : '700' }]} numberOfLines={2}>
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
              <View style={{ alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                {!item.okundu && (
                  <View style={[styles.okunmamisDot, { backgroundColor: renk }]} />
                )}
                <TouchableOpacity
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  onPress={(e) => { e?.stopPropagation?.(); sil(item) }}
                  style={styles.silIkon}
                  activeOpacity={0.6}
                >
                  <Feather name="x" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tumOkuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
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
    flexShrink: 0,
  },
  silIkon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
})
