// Sözleşme metni — YERLİ render (WebView yok).
//
// ⚠️ 07.08: bu bileşenden önce metin WebView'de gösteriliyor ve "sona gelindi"
// bilgisi WebView'in JS köprüsünden geliyordu. Köprü sessizce çalışmazsa onay
// kutusu hiç açılmaz, personel uygulamaya giremezdi. Aynı gün imza tuvalinde
// (react-native-signature-canvas) tam olarak bu yaşandı: Android System WebView
// güncellenince tuval dokunmayı almayı bıraktı ve teknisyen sahada imza
// alamadı. Kritik yolda WebView bırakmıyoruz.
//
// Sona gelme ScrollView'in kendi ölçümünden okunur; ayrıca içerik ekrana
// sığıyorsa (kaydırma hiç olmayacaksa) anında bildirilir.

import { useCallback, useRef } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { markdownToBloklar } from '../lib/markdownBloklar'

// Sona ne kadar yaklaşınca "okundu" sayılsın (px)
const SON_ESIK = 60

export default function SozlesmeMetni({ icerik, onSonaGelindi, style }) {
  const bildirildi = useRef(false)
  const gorunenYukseklik = useRef(0)

  const bildir = useCallback(() => {
    if (bildirildi.current) return
    bildirildi.current = true
    onSonaGelindi?.()
  }, [onSonaGelindi])

  const kaydirma = useCallback((e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    gorunenYukseklik.current = layoutMeasurement.height
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SON_ESIK) bildir()
  }, [bildir])

  // Metin ekrana sığıyorsa kaydırma olmaz — o hâlde de onay açılmalı
  const icerikOlcusu = useCallback((_g, y) => {
    if (gorunenYukseklik.current > 0 && y <= gorunenYukseklik.current + SON_ESIK) bildir()
  }, [bildir])

  const bloklar = markdownToBloklar(icerik)

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: '#fff' }, style]}
      contentContainerStyle={styles.govde}
      onScroll={kaydirma}
      onLayout={(e) => { gorunenYukseklik.current = e.nativeEvent.layout.height }}
      onContentSizeChange={icerikOlcusu}
      scrollEventThrottle={80}
    >
      {bloklar.map((b, i) => <Blok key={i} blok={b} />)}
    </ScrollView>
  )
}

function Blok({ blok }) {
  if (blok.tip === 'ayrac') return <View style={styles.ayrac} />

  if (blok.tip === 'baslik') {
    const s = blok.seviye
    return (
      <Text style={[styles.baslik, s === 1 ? styles.h1 : s === 2 ? styles.h2 : styles.h3]}>
        <Parcalar parcalar={blok.parcalar} />
      </Text>
    )
  }

  if (blok.tip === 'madde') {
    return (
      <View style={styles.maddeSatir}>
        <Text style={styles.madde}>•</Text>
        <Text style={[styles.paragraf, { flex: 1, marginBottom: 5 }]}>
          <Parcalar parcalar={blok.parcalar} />
        </Text>
      </View>
    )
  }

  return <Text style={styles.paragraf}><Parcalar parcalar={blok.parcalar} /></Text>
}

function Parcalar({ parcalar }) {
  return (parcalar || []).map((p, i) => (
    <Text key={i} style={p.kalin ? styles.kalin : p.kod ? styles.kod : null}>{p.metin}</Text>
  ))
}

const styles = StyleSheet.create({
  govde: { padding: 16, paddingBottom: 28 },
  baslik: { color: '#0f172a', fontWeight: '700' },
  h1: { fontSize: 20, marginBottom: 6 },
  h2: {
    fontSize: 16, marginTop: 22, marginBottom: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  h3: { fontSize: 14, marginTop: 14, marginBottom: 6 },
  paragraf: { fontSize: 15, lineHeight: 25, color: '#1e293b', marginBottom: 10 },
  maddeSatir: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  madde: { fontSize: 15, lineHeight: 25, color: '#64748b' },
  kalin: { fontWeight: '700', color: '#0f172a' },
  kod: { backgroundColor: '#f1f5f9', fontSize: 13.5, color: '#334155' },
  ayrac: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
})
