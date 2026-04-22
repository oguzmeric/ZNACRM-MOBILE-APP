import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

const BARKOD_TIPLERI = [
  'qr', 'ean13', 'ean8', 'code39', 'code93', 'code128',
  'upc_a', 'upc_e', 'datamatrix', 'pdf417', 'itf14', 'codabar',
]

const ALANLAR = [
  { id: 'seriNo', label: 'Seri No' },
  { id: 'barkod', label: 'Barkod' },
  { id: 'model', label: 'Model' },
  { id: 'stokKodu', label: 'Stok Kodu' },
]

// Etiketteki TÜM barkodları bir seferde yakala, sonra hangisinin nereye yazılacağını sor.
//
// Kullanım:
//   <EtiketTarayici
//     visible={open}
//     onClose={() => setOpen(false)}
//     onTamam={(atamalar) => {
//       // atamalar = { seriNo: 'G123', model: 'DS-2CD', barkod: '...', stokKodu: '...' }
//       if (atamalar.seriNo) setSeriNo(atamalar.seriNo)
//       if (atamalar.model) setModel(atamalar.model)
//       ...
//     }}
//   />

export default function EtiketTarayici({ visible, onClose, onTamam }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [bulunan, setBulunan] = useState([]) // [{value, type}]
  const [atamalar, setAtamalar] = useState({}) // { value: alanId }
  const [scanning, setScanning] = useState(true)
  const seenRef = useRef(new Set())

  useEffect(() => {
    if (visible) {
      setBulunan([])
      setAtamalar({})
      setScanning(true)
      seenRef.current = new Set()
      if (permission && !permission.granted && permission.canAskAgain) {
        requestPermission()
      }
    }
  }, [visible])

  const onBarcodeScanned = ({ data, type }) => {
    if (!scanning || !data) return
    if (seenRef.current.has(data)) return
    seenRef.current.add(data)
    setBulunan((prev) => [...prev, { value: data, type }])
  }

  const ata = (value, alanId) => {
    setAtamalar((prev) => {
      const copy = { ...prev }
      // Aynı alana başka kod atanmışsa kaldır
      Object.keys(copy).forEach((v) => {
        if (copy[v] === alanId) delete copy[v]
      })
      copy[value] = alanId
      return copy
    })
  }

  const atamaKaldir = (value) => {
    setAtamalar((prev) => {
      const copy = { ...prev }
      delete copy[value]
      return copy
    })
  }

  const tamam = () => {
    // value -> alan eşlemesini, alan -> value formatına çevir
    const sonuc = {}
    Object.entries(atamalar).forEach(([value, alanId]) => {
      sonuc[alanId] = value
    })
    onTamam?.(sonuc)
    onClose?.()
  }

  const tekrarTara = () => {
    setBulunan([])
    setAtamalar({})
    seenRef.current = new Set()
    setScanning(true)
  }

  const taramayi_durdur = () => setScanning(false)

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
            {scanning && (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: BARKOD_TIPLERI }}
              />
            )}

            <View style={styles.overlay}>
              <View style={styles.overlayTop}>
                <Text style={styles.overlayTitle}>
                  {scanning ? 'Etiketi Tara' : 'Tarama Durduruldu'}
                </Text>
                <Text style={styles.overlayHint}>
                  {scanning
                    ? `Etiketi kameraya tut, tüm barkodları okusun (${bulunan.length} bulundu)`
                    : 'Aşağıdan her bir kodu hangi alana yazılacağını seç'}
                </Text>
              </View>

              {scanning && (
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
              )}

              <View style={styles.bottomSheet}>
                {bulunan.length === 0 ? (
                  <Text style={styles.bekliyorText}>
                    Henüz barkod bulunamadı. Etiketi kameraya yaklaştır.
                  </Text>
                ) : (
                  <ScrollView style={{ maxHeight: 320 }}>
                    {bulunan.map((b, i) => {
                      const atananAlan = atamalar[b.value]
                      return (
                        <View key={i} style={styles.bulunanCard}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={styles.bulunanType}>{b.type?.toUpperCase() ?? 'CODE'}</Text>
                            {atananAlan && (
                              <TouchableOpacity onPress={() => atamaKaldir(b.value)}>
                                <Text style={styles.kaldirText}>× kaldır</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.bulunanValue} selectable>{b.value}</Text>
                          <View style={styles.alanRow}>
                            {ALANLAR.map((a) => {
                              const aktif = atananAlan === a.id
                              return (
                                <TouchableOpacity
                                  key={a.id}
                                  style={[styles.alanBtn, aktif && styles.alanBtnActive]}
                                  onPress={() => ata(b.value, a.id)}
                                >
                                  <Text style={[styles.alanBtnText, aktif && { color: '#fff' }]}>
                                    {a.label}
                                  </Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        </View>
                      )
                    })}
                  </ScrollView>
                )}

                <View style={styles.actionRow}>
                  {scanning ? (
                    <TouchableOpacity style={styles.durduBtn} onPress={taramayi_durdur}>
                      <Text style={styles.durduText}>Taramayı Durdur</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.tekrarBtn} onPress={tekrarTara}>
                      <Text style={styles.durduText}>↻ Tekrar Tara</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.tamamBtn, Object.keys(atamalar).length === 0 && { opacity: 0.4 }]}
                    onPress={tamam}
                    disabled={Object.keys(atamalar).length === 0}
                  >
                    <Text style={styles.tamamText}>
                      Tamam ({Object.keys(atamalar).length})
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.iptalBtn} onPress={onClose}>
                  <Text style={styles.iptalText}>İptal</Text>
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
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  izinBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  izinText: { color: '#fff', fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'space-between' },
  overlayTop: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  overlayHint: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 4 },

  scanFrame: { width: 280, height: 180, position: 'relative', alignSelf: 'center' },
  corner: { position: 'absolute', width: 35, height: 35, borderColor: '#22c55e' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },

  bottomSheet: {
    backgroundColor: '#0f172a',
    padding: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bekliyorText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },

  bulunanCard: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  bulunanType: { color: '#3b82f6', fontSize: 10, fontWeight: '700' },
  bulunanValue: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, fontFamily: 'monospace' },
  kaldirText: { color: '#ef4444', fontSize: 12 },

  alanRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  alanBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  alanBtnActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  alanBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  durduBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tekrarBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  durduText: { color: '#fff', fontWeight: '700' },

  tamamBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tamamText: { color: '#fff', fontWeight: '700' },

  iptalBtn: {
    marginTop: 8,
    padding: 10,
    alignItems: 'center',
  },
  iptalText: { color: '#94a3b8', fontWeight: '600' },
})
