import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

const BARKOD_TIPLERI = [
  'qr', 'ean13', 'ean8', 'code39', 'code93', 'code128',
  'upc_a', 'upc_e', 'datamatrix', 'pdf417', 'itf14', 'codabar',
]

// Tek bir alan için hızlı tarayıcı.
// Kullanım:
//   <QuickScanner visible={open} onClose={...} onScan={(value) => setField(value)} title="Modeli Tara" />

export default function QuickScanner({ visible, onClose, onScan, title }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(true)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (visible) {
      setScanning(true)
      if (permission && !permission.granted && permission.canAskAgain) {
        requestPermission()
      }
    }
  }, [visible])

  const onBarcodeScanned = ({ data }) => {
    if (!scanning) return
    setScanning(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onScan?.(data?.trim() ?? '')
      onClose?.()
    }, 150)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.title}>📷 Kamera İzni Gerekli</Text>
            <TouchableOpacity style={styles.izinBtn} onPress={requestPermission}>
              <Text style={styles.izinText}>İzin Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.izinBtn, { marginTop: 12, backgroundColor: '#1e293b' }]} onPress={onClose}>
              <Text style={styles.izinText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
              barcodeScannerSettings={{ barcodeTypes: BARKOD_TIPLERI }}
            />

            <View style={styles.overlay}>
              <View style={styles.overlayTop}>
                <Text style={styles.overlayTitle}>{title ?? 'Tara'}</Text>
                <Text style={styles.overlayHint}>
                  Etiketteki ilgili barkodu çerçeveye yerleştir
                </Text>
              </View>

              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>

              <View style={styles.overlayBottom}>
                <TouchableOpacity style={styles.kapatBtn} onPress={onClose}>
                  <Text style={styles.kapatText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  izinBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  izinText: { color: '#fff', fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center' },
  overlayTop: {
    width: '100%',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  overlayHint: { color: '#cbd5e1', fontSize: 13, textAlign: 'center' },

  scanFrame: { width: 280, height: 200, position: 'relative' },
  corner: { position: 'absolute', width: 35, height: 35, borderColor: '#22c55e' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },

  overlayBottom: {
    width: '100%',
    paddingBottom: 30,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  kapatBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  kapatText: { color: '#fff', fontWeight: '700' },
})
