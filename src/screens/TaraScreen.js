import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Vibration,
  Switch,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Audio } from 'expo-av'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { kalemAra } from '../services/stokKalemiService'

const BARKOD_TIPLERI = [
  'qr',
  'ean13',
  'ean8',
  'code39',
  'code93',
  'code128',
  'upc_a',
  'upc_e',
  'datamatrix',
  'pdf417',
  'itf14',
  'codabar',
  'aztec',
]

export default function TaraScreen({ navigation }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(true)
  const [aranıyor, setAraniyor] = useState(false)
  const [manuelKod, setManuelKod] = useState('')
  const [torch, setTorch] = useState(false)
  const [zoom, setZoom] = useState(0)
  const [sureklimod, setSureklimod] = useState(true) // sürekli tarama modu — default aktif
  const [banner, setBanner] = useState(null) // { tip: 'ok'|'ses'|'db'|'yok', metin, sn }
  const [sesiAc, setSesiAc] = useState(true)
  const sonOkunan = useRef(null)
  const sonOkunanZaman = useRef(0)
  const debounceRef = useRef(null)
  const bannerTimerRef = useRef(null)
  const scanLineAnim = useRef(new Animated.Value(0)).current
  const soundRef = useRef({ ok: null, uyari: null, hata: null })

  // Ses dosyalarını yükle (web-hosted URL — çevrimiçi tek seferlik)
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true })
        // Kısa ses efektleri — Google Actions freesound
        const [ok, uyari, hata] = await Promise.all([
          Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' }, { volume: 1 }),
          Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' }, { volume: 1 }),
          Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/dosimeter_alarm.ogg' }, { volume: 1 }),
        ])
        if (iptal) return
        soundRef.current = { ok: ok.sound, uyari: uyari.sound, hata: hata.sound }
      } catch (e) { console.warn('[TaraScreen] ses yükleme:', e?.message) }
    }
    yukle()
    return () => {
      iptal = true
      for (const k of Object.values(soundRef.current)) { try { k?.unloadAsync() } catch {} }
    }
  }, [])

  const sesCal = async (tip) => {
    if (!sesiAc) return
    const s = soundRef.current[tip]
    if (!s) return
    try { await s.replayAsync() } catch {}
  }

  const gosterBanner = (tip, metin, sn) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setBanner({ tip, metin, sn })
    bannerTimerRef.current = setTimeout(() => setBanner(null), 1500)
  }

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission()
    }
  }, [permission])

  // Tarama çizgisi animasyonu — sadece scanning aktifken çalışır
  useEffect(() => {
    if (!scanning || aranıyor) {
      scanLineAnim.stopAnimation()
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [scanning, aranıyor])

  const kodIsle = async (kod) => {
    if (!kod?.trim() || aranıyor) return
    const now = Date.now()
    // Aynı barkodu 1.5 sn içinde tekrar okuma (sürekli modda hız için kısa)
    if (sonOkunan.current === kod && now - sonOkunanZaman.current < 1500) return
    sonOkunan.current = kod
    sonOkunanZaman.current = now

    setAraniyor(true)
    if (!sureklimod) setScanning(false)
    const kalem = await kalemAra(kod)
    setAraniyor(false)

    if (kalem) {
      // Sürekli modda: DB'de kayıtlı → sarı banner + uyarı + hemen tekrar tarama
      if (sureklimod) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) } catch {}
        Vibration.vibrate([0, 100, 40, 60])
        sesCal('uyari')
        gosterBanner('db', 'Kayıtlı — atlandı', kod)
        return // scanning zaten açık
      }
      // Normal mod → CihazDetay
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) } catch {}
      Vibration.vibrate(60)
      sesCal('ok')
      navigation.navigate('CihazDetay', { id: kalem.id, taradigimKod: kod })
      return
    }

    // Kayıt bulunamadı
    if (sureklimod) {
      // Sürekli modda: kırmızı banner "yeni SN" — hemen tekrar tarama
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) } catch {}
      Vibration.vibrate([0, 200, 100, 200])
      sesCal('hata')
      gosterBanner('yok', 'Kayıtlı değil', kod)
      return
    }
    // Normal mod → Alert
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) } catch {}
    Alert.alert(
      'Bulunamadı',
      `S/N veya barkod: ${kod}\n\nBu cihaz sistemde kayıtlı değil. Yeni cihaz olarak eklemek ister misin?`,
      [
        {
          text: 'Tekrar Tara',
          onPress: () => { sonOkunan.current = null; setScanning(true) },
        },
        {
          text: 'Yeni Cihaz Ekle',
          onPress: () => navigation.navigate('YeniCihaz', { onaySeriNo: kod }),
        },
      ]
    )
  }

  const onBarcodeScanned = ({ data }) => {
    if (!scanning || aranıyor) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Sürekli modda daha hızlı — 100ms
    debounceRef.current = setTimeout(() => kodIsle(data), sureklimod ? 100 : 200)
  }

  const zoomArttir = () => setZoom((z) => Math.min(1, z + 0.1))
  const zoomAzalt = () => setZoom((z) => Math.max(0, z - 0.1))

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>📷 Kamera İzni Gerekli</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          S/N ve barkod taramak için kameraya erişim gerekiyor.
        </Text>
        <TouchableOpacity style={styles.izinBtn} onPress={requestPermission}>
          <Text style={styles.izinText}>İzin Ver</Text>
        </TouchableOpacity>
        <Text style={[styles.subtitle, { color: colors.textMuted, marginTop: 24 }]}>
          ya da elle gir:
        </Text>
        <ManuelGiris kod={manuelKod} setKod={setManuelKod} onSubmit={kodIsle} />
      </View>
    )
  }

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  })

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        zoom={zoom}
        onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: BARKOD_TIPLERI }}
      />

      {/* Üst bar: info + torch */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topText}>
            {aranıyor ? 'Aranıyor…' : sureklimod ? '⚡ Sürekli mod — arka arkaya tara' : 'Barkod / S-N etiketini çerçeveye yerleştir'}
          </Text>
          <Text style={styles.topSub}>QR · EAN · Code128 · PDF417 · DataMatrix</Text>
        </View>
        <TouchableOpacity
          style={[styles.torchBtn, torch && styles.torchBtnOn]}
          onPress={() => setTorch((t) => !t)}
          activeOpacity={0.7}
        >
          <Feather name={torch ? 'zap' : 'zap-off'} size={20} color={torch ? '#facc15' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Modlar bar */}
      <View style={[styles.modBar, { top: insets.top + 78 }]}>
        <View style={styles.modItem}>
          <Text style={styles.modText}>Sürekli</Text>
          <Switch value={sureklimod} onValueChange={setSureklimod}
            trackColor={{ true: '#10b981', false: '#64748b' }} thumbColor="#fff" />
        </View>
        <View style={styles.modItem}>
          <Text style={styles.modText}>Ses</Text>
          <Switch value={sesiAc} onValueChange={setSesiAc}
            trackColor={{ true: '#3b82f6', false: '#64748b' }} thumbColor="#fff" />
        </View>
      </View>

      {/* Anlık sonuç banner'ı — sürekli modda gösterilir */}
      {banner && (
        <View style={[styles.banner, { top: insets.top + 140, backgroundColor: BANNER_RENK[banner.tip] }]}>
          <Text style={styles.bannerIkon}>{BANNER_IKON[banner.tip]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerBaslik}>{banner.metin}</Text>
            <Text style={styles.bannerSN} numberOfLines={1}>{banner.sn}</Text>
          </View>
        </View>
      )}

      {/* Tarama çerçevesi */}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {scanning && !aranıyor && (
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineY }] },
              ]}
            />
          )}
        </View>
      </View>

      {/* Zoom kontrolü */}
      <View style={styles.zoomBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomAzalt} activeOpacity={0.7}>
          <Feather name="minus" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.zoomTrack}>
          <View style={[styles.zoomFill, { width: `${zoom * 100}%` }]} />
        </View>
        <TouchableOpacity style={styles.zoomBtn} onPress={zoomArttir} activeOpacity={0.7}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Alt: manuel giriş + tekrar tara */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={styles.manuelInput}
            placeholder="Elle S/N veya barkod…"
            placeholderTextColor="#94a3b8"
            value={manuelKod}
            onChangeText={setManuelKod}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.manuelBtn, !manuelKod.trim() && { opacity: 0.4 }]}
            onPress={() => kodIsle(manuelKod)}
            disabled={!manuelKod.trim() || aranıyor}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={styles.manuelBtnText}>Ara</Text>
          </TouchableOpacity>
        </View>

        {!scanning && !aranıyor && (
          <TouchableOpacity
            style={styles.tekrarBtn}
            onPress={() => {
              sonOkunan.current = null
              setScanning(true)
            }}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#fff" />
            <Text style={styles.tekrarText}>Tekrar Tara</Text>
          </TouchableOpacity>
        )}
      </View>

      {aranıyor && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={[styles.topText, { marginTop: 12 }]}>Aranıyor…</Text>
        </View>
      )}
    </View>
  )
}

function ManuelGiris({ kod, setKod, onSubmit }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 24 }}>
      <TextInput
        style={styles.manuelInput}
        placeholder="S/N yaz…"
        placeholderTextColor="#94a3b8"
        value={kod}
        onChangeText={setKod}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={styles.manuelBtn}
        onPress={() => onSubmit(kod)}
        disabled={!kod?.trim()}
      >
        <Feather name="search" size={16} color="#fff" />
        <Text style={styles.manuelBtnText}>Ara</Text>
      </TouchableOpacity>
    </View>
  )
}

const BANNER_RENK = { ok: '#10b981', ses: '#f59e0b', db: '#f59e0b', yok: '#dc2626' }
const BANNER_IKON = { ok: '✓', ses: '⚠', db: '⚠', yok: '✗' }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  modBar: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    justifyContent: 'space-around',
  },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modText: { color: '#e5e7eb', fontWeight: '600', fontSize: 13 },
  banner: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
  },
  bannerIkon: { color: '#fff', fontWeight: '800', fontSize: 24 },
  bannerBaslik: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bannerSN: { color: '#fff', fontFamily: 'monospace', fontSize: 12, opacity: 0.9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  izinBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  izinText: { color: '#fff', fontWeight: '700' },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topSub: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginTop: 2 },
  torchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtnOn: {
    backgroundColor: 'rgba(250,204,21,0.2)',
    borderColor: '#facc15',
  },

  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#22c55e',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },

  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },

  zoomBar: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 28,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomTrack: {
    width: 120,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  zoomFill: { height: '100%', backgroundColor: '#22c55e' },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 14,
    gap: 10,
  },
  manuelInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  manuelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  manuelBtnText: { color: '#fff', fontWeight: '700' },

  tekrarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 10,
  },
  tekrarText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
