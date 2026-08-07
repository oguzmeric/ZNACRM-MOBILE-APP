// İmza tuvali — Skia (YERLİ çizim motoru).
//
// ⚠️ NEDEN WEBVIEW DEĞİL: eskiden react-native-signature-canvas kullanılıyordu;
// o paket imzayı bir WebView içindeki HTML canvas'a çizdiriyor. Android System
// WebView güncellendiğinde tuval dokunmayı almayı bırakabiliyor ve teknisyen
// "ekrana hiçbir şey çizilmiyor" durumuna düşüyor (07.08, Alp Aslan sahada
// imza alamadı — aynı gün sabah aynı telefonda çalışmıştı).
// Skia native çizer: WebView'den, sistem güncellemelerinden ve internetten
// bağımsız. Keşif krokisi/foto çizimi zaten bu motorla çalışıyor.
//
// Kullanım:
//   const ref = useRef()
//   <ImzaTuvali ref={ref} />
//   ref.current.bosMu()        → true/false
//   ref.current.temizle()
//   ref.current.pngBase64()    → 'data:image/png;base64,...' | null

import { forwardRef, useImperativeHandle, useState } from 'react'
import { View, StyleSheet, Keyboard } from 'react-native'
import { Canvas, Path, Rect, useCanvasRef } from '@shopify/react-native-skia'

const CIZGI_RENK = '#0f172a'
const CIZGI_KALINLIK = 3
const ZEMIN = '#ffffff'   // servis formu beyaz kâğıda basılıyor

const noktalardanPath = (noktalar) => {
  if (!noktalar?.length) return ''
  const ilk = noktalar[0]
  let s = `M ${ilk.x.toFixed(2)} ${ilk.y.toFixed(2)}`
  for (let i = 1; i < noktalar.length; i++) {
    s += ` L ${noktalar[i].x.toFixed(2)} ${noktalar[i].y.toFixed(2)}`
  }
  return s
}

const ImzaTuvali = forwardRef(function ImzaTuvali({ style }, ref) {
  const canvasRef = useCanvasRef()
  const [strokeler, setStrokeler] = useState([])
  const [aktif, setAktif] = useState([])
  const [olcu, setOlcu] = useState({ w: 0, h: 0 })

  useImperativeHandle(ref, () => ({
    bosMu: () => strokeler.length === 0 && aktif.length === 0,
    temizle: () => { setStrokeler([]); setAktif([]) },
    pngBase64: () => {
      const snapshot = canvasRef.current?.makeImageSnapshot()
      if (!snapshot) return null
      return `data:image/png;base64,${snapshot.encodeToBase64()}`
    },
  }), [strokeler.length, aktif.length])

  return (
    <View
      style={[styles.tuval, style]}
      onLayout={e => setOlcu({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      // Dokunma doğrudan bu View'da yakalanır — WebView köprüsü yok
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        Keyboard.dismiss()   // ad alanından gelen klavye tuvali ezmesin
        const { locationX, locationY } = e.nativeEvent
        setAktif([{ x: locationX, y: locationY }])
      }}
      onResponderMove={(e) => {
        const { locationX, locationY } = e.nativeEvent
        setAktif(prev => [...prev, { x: locationX, y: locationY }])
      }}
      onResponderRelease={() => {
        setAktif(mevcut => {
          if (mevcut.length > 0) setStrokeler(prev => [...prev, mevcut])
          return []
        })
      }}
      onResponderTerminate={() => {
        setAktif(mevcut => {
          if (mevcut.length > 0) setStrokeler(prev => [...prev, mevcut])
          return []
        })
      }}
    >
      <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
        {/* Zemin: snapshot yalnız ÇİZİLENİ yakalar — beyaz dikdörtgen şart,
            yoksa imza saydam PNG olur ve koyu zeminde görünmez */}
        <Rect x={0} y={0} width={olcu.w} height={olcu.h} color={ZEMIN} />
        {strokeler.map((noktalar, i) => (
          <Path key={i} path={noktalardanPath(noktalar)} color={CIZGI_RENK}
            style="stroke" strokeWidth={CIZGI_KALINLIK} strokeCap="round" strokeJoin="round" />
        ))}
        {aktif.length > 0 && (
          <Path path={noktalardanPath(aktif)} color={CIZGI_RENK}
            style="stroke" strokeWidth={CIZGI_KALINLIK} strokeCap="round" strokeJoin="round" />
        )}
      </Canvas>
    </View>
  )
})

const styles = StyleSheet.create({
  tuval: { flex: 1, backgroundColor: ZEMIN, overflow: 'hidden' },
})

export default ImzaTuvali
