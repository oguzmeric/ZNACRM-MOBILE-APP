import { useState, useRef, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTheme } from '../context/ThemeContext'
import { serileriTopluEkle } from '../services/stokKalemiService'

const BARKOD_TIPLERI = ['qr', 'ean13', 'ean8', 'code39', 'code93', 'code128', 'upc_a', 'upc_e', 'datamatrix', 'pdf417', 'itf14', 'codabar', 'aztec']

export default function SeriTaraScreen({ route, navigation }) {
  const { stokKodu, marka, model } = route.params
  const { colors } = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [seriler, setSeriler] = useState([])
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const sonRef = useRef({ kod: null, t: 0 })

  const onBarcodeScanned = useCallback(({ data }) => {
    const kod = String(data ?? '').trim()
    if (!kod) return
    const now = Date.now()
    if (sonRef.current.kod === kod && now - sonRef.current.t < 2500) return
    sonRef.current = { kod, t: now }
    setSeriler((onceki) =>
      onceki.some((s) => s.toLocaleLowerCase('tr') === kod.toLocaleLowerCase('tr'))
        ? onceki
        : [kod, ...onceki]
    )
  }, [])

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
      <View style={styles.alt}>
        <Text style={styles.sayac}>{seriler.length} seri okundu</Text>
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
  sayac: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  seri: { color: '#cbd5e1', fontSize: 13, paddingVertical: 2 },
  btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
