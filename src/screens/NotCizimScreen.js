// Skia tabanlı çizim ekranı.
// - Apple Pencil / Android stylus / parmak destekli
// - Renk seçici + kalem kalınlığı + silgi
// - Geri al + temizle
// - "Kaydet" → PNG export → Supabase Storage'a yükle
//
// NOT: Path objesi yerine SVG path STRING kullanıyoruz. JSI host object'i
// React state'te mutate etmek crash'e neden oluyordu — string immutable, güvenli.

import { useRef, useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import {
  Canvas, Path, useCanvasRef,
} from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system/legacy'
import { useTheme } from '../context/ThemeContext'
import { cizimYukle } from '../services/notService'

const RENKLER = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#a855f7']
const KALINLIKLAR = [2, 4, 6, 10]

// Noktalar listesinden SVG path string üret
function noktalardanPath(noktalar) {
  if (!noktalar || noktalar.length === 0) return ''
  const ilk = noktalar[0]
  let s = `M ${ilk.x.toFixed(2)} ${ilk.y.toFixed(2)}`
  for (let i = 1; i < noktalar.length; i++) {
    s += ` L ${noktalar[i].x.toFixed(2)} ${noktalar[i].y.toFixed(2)}`
  }
  return s
}

export default function NotCizimScreen({ route, navigation }) {
  const { kullaniciId, notId } = route.params ?? {}
  const { colors } = useTheme()
  const canvasRef = useCanvasRef()

  // Tamamlanmış stroke'lar
  const [strokeler, setStrokeler] = useState([])  // [{points, renk, kalinlik}]
  // Aktif (çizilmekte olan) stroke
  const [aktifNoktalar, setAktifNoktalar] = useState([])

  const [renk, setRenk] = useState('#0f172a')
  const [kalinlik, setKalinlik] = useState(4)
  const [silgi, setSilgi] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Aktif stroke'un renk/kalınlığını ref'te tutuyoruz — çizim sırasında renk değişimi
  // mevcut stroke'a yansımasın
  const aktifStilRef = useRef({ renk: '#0f172a', kalinlik: 4 })

  useEffect(() => {
    navigation.setOptions({ title: 'Çizim' })
  }, [navigation])

  const dokunBasla = (e) => {
    const { locationX, locationY } = e.nativeEvent
    aktifStilRef.current = {
      renk: silgi ? '#ffffff' : renk,
      kalinlik: silgi ? 16 : kalinlik,
    }
    setAktifNoktalar([{ x: locationX, y: locationY }])
  }

  const dokunHareket = (e) => {
    const { locationX, locationY } = e.nativeEvent
    setAktifNoktalar((prev) => [...prev, { x: locationX, y: locationY }])
  }

  const dokunBitir = () => {
    setAktifNoktalar((mevcut) => {
      if (mevcut.length > 0) {
        setStrokeler((prev) => [
          ...prev,
          { noktalar: mevcut, renk: aktifStilRef.current.renk, kalinlik: aktifStilRef.current.kalinlik },
        ])
      }
      return []
    })
  }

  const geriAl = () => {
    setStrokeler((p) => p.slice(0, -1))
  }

  const temizle = () => {
    if (strokeler.length === 0) return
    Alert.alert('Tümünü temizle', 'Tüm çizimi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => setStrokeler([]) },
    ])
  }

  const kaydet = async () => {
    if (strokeler.length === 0) {
      Alert.alert('Boş', 'Önce bir şey çiz.')
      return
    }
    setKaydediliyor(true)
    try {
      const snapshot = canvasRef.current?.makeImageSnapshot()
      if (!snapshot) {
        Alert.alert('Hata', 'Çizim alınamadı.')
        return
      }
      const base64 = snapshot.encodeToBase64()
      const tempUri = `${FileSystem.cacheDirectory}cizim_${Date.now()}.png`
      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const sonuc = await cizimYukle(tempUri, kullaniciId, notId)
      if (!sonuc) {
        Alert.alert('Hata', 'Çizim yüklenemedi.')
        return
      }

      navigation.navigate({ name: 'NotDuzenle', params: { yeniCizim: sonuc }, merge: true })
    } catch (e) {
      Alert.alert('Hata', e?.message ?? 'Çizim kaydedilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  // Aktif stroke'un path string'i
  const aktifPathStr = noktalardanPath(aktifNoktalar)

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Üst toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={geriAl} disabled={strokeler.length === 0} style={[styles.tbBtn, strokeler.length === 0 && { opacity: 0.3 }]}>
            <Feather name="rotate-ccw" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={temizle} disabled={strokeler.length === 0} style={[styles.tbBtn, strokeler.length === 0 && { opacity: 0.3 }]}>
            <Feather name="trash-2" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSilgi((s) => !s)}
            style={[styles.tbBtn, silgi && { backgroundColor: '#fde68a' }]}
          >
            <Feather name="x-square" size={18} color={silgi ? '#92400e' : colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={kaydet}
          disabled={kaydediliyor || strokeler.length === 0}
          style={[styles.kaydetBtn, (kaydediliyor || strokeler.length === 0) && { opacity: 0.5 }]}
        >
          {kaydediliyor ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.kaydetText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Canvas — ham View touch event'leri */}
      <View
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={dokunBasla}
        onResponderMove={dokunHareket}
        onResponderRelease={dokunBitir}
        onResponderTerminate={dokunBitir}
      >
        <Canvas ref={canvasRef} style={{ flex: 1 }}>
          {strokeler.map((s, i) => {
            const pathStr = noktalardanPath(s.noktalar)
            if (!pathStr) return null
            return (
              <Path
                key={i}
                path={pathStr}
                color={s.renk}
                style="stroke"
                strokeWidth={s.kalinlik}
                strokeCap="round"
                strokeJoin="round"
              />
            )
          })}
          {!!aktifPathStr && (
            <Path
              path={aktifPathStr}
              color={aktifStilRef.current.renk}
              style="stroke"
              strokeWidth={aktifStilRef.current.kalinlik}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </View>

      {/* Alt toolbar — renkler + kalınlık */}
      <View style={[styles.altToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
          {RENKLER.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => { setRenk(r); setSilgi(false) }}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: r,
                borderWidth: renk === r && !silgi ? 3 : 1,
                borderColor: renk === r && !silgi ? colors.primary : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            />
          ))}
        </ScrollView>

        <View style={{ width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 10 }} />

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {KALINLIKLAR.map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => setKalinlik(k)}
              style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: kalinlik === k ? 2 : 1,
                borderColor: kalinlik === k ? colors.primary : colors.border,
                backgroundColor: colors.bg,
              }}
            >
              <View style={{ width: k * 1.5, height: k * 1.5, borderRadius: k, backgroundColor: colors.textPrimary }} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tbBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  kaydetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#22c55e', borderRadius: 8,
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  altToolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1,
  },
})
