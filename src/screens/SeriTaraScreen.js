import { useState, useRef, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../context/ThemeContext'
import { serileriTopluEkle, tumSeriNumaralarıSet } from '../services/stokKalemiService'

const BARKOD_TIPLERI = ['qr', 'ean13', 'ean8', 'code39', 'code93', 'code128', 'upc_a', 'upc_e', 'datamatrix', 'pdf417', 'itf14', 'codabar', 'aztec']

// Son sonuç durumu — kullanıcı okumadan gördüğü an
const SONUC = {
  ok:    { renk: '#10b981', ikon: '✓', metin: 'Eklendi' },
  ses:   { renk: '#f59e0b', ikon: '⚠', metin: 'Bu oturumda zaten okundu' },
  db:    { renk: '#dc2626', ikon: '✗', metin: 'DB\'de kayıtlı — atlandı' },
}

export default function SeriTaraScreen({ route, navigation }) {
  const { stokKodu, marka, model } = route.params
  const { colors } = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [seriler, setSeriler] = useState([])
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [globalSN, setGlobalSN] = useState(new Set())
  const [globalYukleniyor, setGlobalYukleniyor] = useState(true)
  const [sonSonuc, setSonSonuc] = useState(null) // { sn, tip: 'ok'|'ses'|'db' }
  const sonRef = useRef({ kod: null, t: 0 })

  useEffect(() => {
    tumSeriNumaralarıSet()
      .then(setGlobalSN)
      .catch((e) => console.warn('[globalSN] yüklenemedi:', e?.message))
      .finally(() => setGlobalYukleniyor(false))
  }, [])

  const onBarcodeScanned = useCallback(({ data }) => {
    const kod = String(data ?? '').trim()
    if (!kod) return
    const now = Date.now()
    // Aynı barkodu 2.5 sn içinde tekrar okuma
    if (sonRef.current.kod === kod && now - sonRef.current.t < 2500) return
    sonRef.current = { kod, t: now }
    const kodLower = kod.toLocaleLowerCase('tr')

    // 1) Bu oturumda okundu mu?
    if (seriler.some((s) => s.toLocaleLowerCase('tr') === kodLower)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      setSonSonuc({ sn: kod, tip: 'ses' })
      return
    }

    // 2) DB'de kayıtlı mı?
    if (globalSN.has(kodLower)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setSonSonuc({ sn: kod, tip: 'db' })
      return
    }

    // 3) Yeni SN — ekle
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setSonSonuc({ sn: kod, tip: 'ok' })
    setSeriler((onceki) => [kod, ...onceki])
  }, [seriler, globalSN])

  const bitir = async () => {
    if (seriler.length === 0) return navigation.goBack()
    setKaydediliyor(true)
    const r = await serileriTopluEkle(stokKodu, seriler, { marka, model })
    setKaydediliyor(false)
    Alert.alert(
      'Tamam',
      `${r.eklenen} eklendi.` +
        (r.zatenVar?.length ? `\n${r.zatenVar.length} zaten kayıtlı.` : ''),
      [{ text: 'Tamam', onPress: () => navigation.goBack() }]
    )
  }

  if (!permission) return <View style={styles.c} />

  if (!permission.granted) {
    return (
      <View style={[styles.c, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', marginBottom: 12 }}>Kamera izni gerekli.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnT}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.c}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={onBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: BARKOD_TIPLERI }}
      />

      {/* Anlık sonuç banner'ı — kamera üzerinde */}
      {sonSonuc && (
        <View style={[styles.banner, { backgroundColor: SONUC[sonSonuc.tip].renk }]}>
          <Text style={styles.bannerIkon}>{SONUC[sonSonuc.tip].ikon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerBaslik}>{SONUC[sonSonuc.tip].metin}</Text>
            <Text style={styles.bannerSN} numberOfLines={1}>{sonSonuc.sn}</Text>
          </View>
        </View>
      )}

      <View style={styles.alt}>
        <View style={styles.ozetSatir}>
          <Text style={styles.sayac}>{seriler.length} okundu</Text>
          {globalYukleniyor && (
            <Text style={styles.uyari}>DB kontrol yükleniyor…</Text>
          )}
          {!globalYukleniyor && (
            <Text style={styles.dbSayac}>DB: {globalSN.size} SN</Text>
          )}
        </View>
        <FlatList
          data={seriler}
          keyExtractor={(s, i) => s + i}
          style={{ maxHeight: 140 }}
          renderItem={({ item }) => <Text style={styles.seri}>• {item}</Text>}
        />
        <TouchableOpacity
          style={[styles.btn, kaydediliyor && { opacity: 0.6 }]}
          onPress={bitir}
          disabled={kaydediliyor}
        >
          <Text style={styles.btnT}>
            {kaydediliyor ? 'Kaydediliyor...' : `Bitir ve Kaydet (${seriler.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#000' },
  alt: { backgroundColor: '#0f172a', padding: 16, paddingBottom: 28 },
  ozetSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sayac: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dbSayac: { color: '#94a3b8', fontSize: 12 },
  uyari: { color: '#f59e0b', fontSize: 12 },
  seri: { color: '#cbd5e1', fontSize: 13, paddingVertical: 2 },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  banner: {
    position: 'absolute', top: 40, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
  },
  bannerIkon: { color: '#fff', fontWeight: '800', fontSize: 24 },
  bannerBaslik: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bannerSN: { color: '#fff', fontFamily: 'monospace', fontSize: 12, opacity: 0.9 },
})
