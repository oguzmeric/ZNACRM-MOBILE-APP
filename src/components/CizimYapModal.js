// Çizim için Modal — NotDuzenleScreen içinde kullanılır.
// Tam ekran modal, native navigation yok, route params yok.
// Avantaj: state akışı tek yönlü ve test edilebilir; race condition yok.

import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { Canvas, Path, useCanvasRef } from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system/legacy'
import { useTheme } from '../context/ThemeContext'
import { cizimYukle } from '../services/notService'

const RENKLER = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#a855f7']
const KALINLIKLAR = [2, 4, 6, 10]

function noktalardanPath(noktalar) {
  if (!noktalar || noktalar.length === 0) return ''
  const ilk = noktalar[0]
  let s = `M ${ilk.x.toFixed(2)} ${ilk.y.toFixed(2)}`
  for (let i = 1; i < noktalar.length; i++) {
    s += ` L ${noktalar[i].x.toFixed(2)} ${noktalar[i].y.toFixed(2)}`
  }
  return s
}

export default function CizimYapModal({ visible, kullaniciId, notId, onKapat, onKaydedildi }) {
  const { colors } = useTheme()
  const canvasRef = useCanvasRef()
  const insets = useSafeAreaInsets()

  const [strokeler, setStrokeler] = useState([])
  const [aktifNoktalar, setAktifNoktalar] = useState([])
  const [renk, setRenk] = useState('#0f172a')
  const [kalinlik, setKalinlik] = useState(4)
  const [silgi, setSilgi] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [aktifStil, setAktifStil] = useState({ renk: '#0f172a', kalinlik: 4 })

  // Modal her açıldığında temizle
  const sifirla = () => {
    setStrokeler([])
    setAktifNoktalar([])
    setRenk('#0f172a')
    setKalinlik(4)
    setSilgi(false)
    setKaydediliyor(false)
    setAktifStil({ renk: '#0f172a', kalinlik: 4 })
  }

  const dokunBasla = (e) => {
    const { locationX, locationY } = e.nativeEvent
    const stil = {
      renk: silgi ? '#ffffff' : renk,
      kalinlik: silgi ? 16 : kalinlik,
    }
    setAktifStil(stil)
    setAktifNoktalar([{ x: locationX, y: locationY }])
  }

  const dokunHareket = (e) => {
    const { locationX, locationY } = e.nativeEvent
    setAktifNoktalar((prev) => [...prev, { x: locationX, y: locationY }])
  }

  const dokunBitir = () => {
    setAktifNoktalar((mevcut) => {
      if (mevcut.length > 0) {
        setStrokeler((prev) => [...prev, { noktalar: mevcut, ...aktifStil }])
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

      // Parent'a yeni çizimi ilet — navigation yok, direkt callback
      onKaydedildi?.(sonuc)
      sifirla()
      onKapat?.()
    } catch (e) {
      Alert.alert('Hata', e?.message ?? 'Çizim kaydedilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  const kapat = () => {
    if (strokeler.length > 0) {
      Alert.alert('Çizim Kaybolacak', 'Kaydetmeden kapatmak istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kapat', style: 'destructive', onPress: () => { sifirla(); onKapat?.() } },
      ])
    } else {
      sifirla()
      onKapat?.()
    }
  }

  const aktifPathStr = noktalardanPath(aktifNoktalar)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={kapat}>
      <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
        {/* Üst toolbar */}
        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={kapat} style={styles.tbBtn}>
            <Feather name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

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

        {/* Canvas */}
        <View
          style={{ flex: 1, backgroundColor: '#ffffff' }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={dokunBasla}
          onResponderMove={dokunHareket}
          onResponderRelease={dokunBitir}
          onResponderTerminate={dokunBitir}
        >
          <Canvas ref={canvasRef} style={StyleSheet.absoluteFill} pointerEvents="none">
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
                color={aktifStil.renk}
                style="stroke"
                strokeWidth={aktifStil.kalinlik}
                strokeCap="round"
                strokeJoin="round"
              />
            )}
          </Canvas>
        </View>

        {/* Alt toolbar */}
        <View style={[
          styles.altToolbar,
          { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 10 + (insets.bottom || 0) },
        ]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, alignItems: 'center' }}>
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
    </Modal>
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
