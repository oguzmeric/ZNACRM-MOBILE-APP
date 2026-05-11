// Skia tabanlı çizim ekranı.
// - Apple Pencil / Android stylus / parmak destekli
// - Renk seçici + kalem kalınlığı + silgi
// - Geri al + temizle
// - "Kaydet" → PNG export → Supabase Storage'a yükle → çağıran ekrana çizim path'ini geri ver

import { useRef, useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import {
  Canvas, Path, Skia, useCanvasRef,
} from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as FileSystem from 'expo-file-system/legacy'
import { useTheme } from '../context/ThemeContext'
import { cizimYukle } from '../services/notService'

const RENKLER = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#a855f7']
const KALINLIKLAR = [2, 4, 6, 10]

export default function NotCizimScreen({ route, navigation }) {
  const { kullaniciId, notId } = route.params ?? {}
  const { colors } = useTheme()
  const canvasRef = useCanvasRef()

  // Path'leri tutuyoruz — geri al için
  const [paths, setPaths] = useState([])  // [{ path, renk, kalinlik }]
  const [aktifPath, setAktifPath] = useState(null)
  const [renk, setRenk] = useState('#0f172a')
  const [kalinlik, setKalinlik] = useState(4)
  const [silgi, setSilgi] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: 'Çizim' })
  }, [navigation])

  // Çizim için pan gesture — basit, basınçsız, parmak/kalem evrensel
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const yeniPath = Skia.Path.Make()
      yeniPath.moveTo(e.x, e.y)
      setAktifPath({
        path: yeniPath,
        renk: silgi ? '#ffffff' : renk,
        kalinlik: silgi ? 16 : kalinlik,
      })
    })
    .onUpdate((e) => {
      setAktifPath((prev) => {
        if (!prev) return prev
        prev.path.lineTo(e.x, e.y)
        // Force re-render: yeni Path objesi yarat
        return { ...prev, path: prev.path.copy() }
      })
    })
    .onEnd(() => {
      setAktifPath((prev) => {
        if (prev) {
          setPaths((eski) => [...eski, prev])
        }
        return null
      })
    })

  const geriAl = () => {
    setPaths((p) => p.slice(0, -1))
  }

  const temizle = () => {
    if (paths.length === 0) return
    Alert.alert('Tümünü temizle', 'Tüm çizimi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => setPaths([]) },
    ])
  }

  const kaydet = async () => {
    if (paths.length === 0) {
      Alert.alert('Boş', 'Önce bir şey çiz.')
      return
    }
    setKaydediliyor(true)
    try {
      // Canvas'tan PNG snapshot al
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

      // Storage'a yükle
      const sonuc = await cizimYukle(tempUri, kullaniciId, notId)
      if (!sonuc) {
        Alert.alert('Hata', 'Çizim yüklenemedi.')
        return
      }

      // Çağıran ekrana geri dön + yeni çizim path'ini params olarak ver
      navigation.navigate({ name: 'NotDuzenle', params: { yeniCizim: sonuc }, merge: true })
    } catch (e) {
      Alert.alert('Hata', e?.message ?? 'Çizim kaydedilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        {/* Üst toolbar */}
        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity onPress={geriAl} disabled={paths.length === 0} style={[styles.tbBtn, paths.length === 0 && { opacity: 0.3 }]}>
              <Feather name="rotate-ccw" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={temizle} disabled={paths.length === 0} style={[styles.tbBtn, paths.length === 0 && { opacity: 0.3 }]}>
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
            disabled={kaydediliyor || paths.length === 0}
            style={[styles.kaydetBtn, (kaydediliyor || paths.length === 0) && { opacity: 0.5 }]}
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

        {/* Canvas */}
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <Canvas ref={canvasRef} style={{ flex: 1 }}>
              {paths.map((p, i) => (
                <Path
                  key={i}
                  path={p.path}
                  color={p.renk}
                  style="stroke"
                  strokeWidth={p.kalinlik}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ))}
              {aktifPath && (
                <Path
                  path={aktifPath.path}
                  color={aktifPath.renk}
                  style="stroke"
                  strokeWidth={aktifPath.kalinlik}
                  strokeCap="round"
                  strokeJoin="round"
                />
              )}
            </Canvas>
          </View>
        </GestureDetector>

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
