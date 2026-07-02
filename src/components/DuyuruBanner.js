// Aktif duyuruları HomeScreen üstünde gösterir.
// Kullanıcı X ile kapatınca AsyncStorage'da tutulur, bir daha görmez.

import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../context/ThemeContext'
import { aktifDuyurulariGetir } from '../services/duyuruService'

const SEVIYE = {
  info:    { renk: '#2563EB', icon: 'info' },
  warning: { renk: '#B45309', icon: 'alert-triangle' },
  success: { renk: '#047857', icon: 'check-circle' },
}

const OKUNAN_KEY = (uid) => `duyuru_okunanlar_${uid || 'anon'}`

export default function DuyuruBanner({ kullaniciId }) {
  const { colors } = useTheme()
  const [duyurular, setDuyurular] = useState([])
  const [okunanlar, setOkunanlar] = useState([])

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(OKUNAN_KEY(kullaniciId))
        if (!iptal) setOkunanlar(raw ? JSON.parse(raw) : [])
      } catch {}
    })()
    return () => { iptal = true }
  }, [kullaniciId])

  useEffect(() => {
    aktifDuyurulariGetir().then(setDuyurular).catch(err => console.error('[DuyuruBanner]', err))
  }, [])

  const okundu = async (id) => {
    const yeni = [...new Set([...okunanlar, id])]
    setOkunanlar(yeni)
    try { await AsyncStorage.setItem(OKUNAN_KEY(kullaniciId), JSON.stringify(yeni)) } catch {}
  }

  const gorunecek = duyurular.filter(d => !okunanlar.includes(d.id))
  if (gorunecek.length === 0) return null

  return (
    <View style={{ gap: 8, marginTop: 8, marginBottom: 4 }}>
      {gorunecek.map(d => {
        const s = SEVIYE[d.seviye] || SEVIYE.info
        return (
          <View
            key={d.id}
            style={[
              styles.kart,
              {
                backgroundColor: colors.surface,
                borderColor: s.renk + '55',
                borderLeftColor: s.renk,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Feather name="volume-2" size={14} color={s.renk} />
              <Feather name={s.icon} size={14} color={s.renk} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.baslik, { color: colors.textPrimary }]} numberOfLines={2}>
                {d.baslik}
              </Text>
              {d.icerik ? (
                <Text style={[styles.icerik, { color: colors.textMuted }]}>
                  {d.icerik}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => okundu(d.id)} hitSlop={10} style={{ padding: 4 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  baslik: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginBottom: 2 },
  icerik: { fontSize: 12, lineHeight: 17 },
})
