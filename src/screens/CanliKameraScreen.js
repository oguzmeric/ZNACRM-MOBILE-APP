// Canlı kamera izleme — Mobiltek MDVR (mobile).
// Transport: HLS via expo-video (native, iOS/Android'de sıfır konfigürasyon).
// Warm-up: motor açıkken 15-20 sn, kapalıyken 1-2 dk.
//
// Route: navigation.navigate('CanliKamera', { aracId, aracPlaka })

import { Component, useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  canliKameraBaslat,
  canliKameraDurdur,
  proxyleStreamUrl,
  izlemeLogBaslat,
  izlemeLogBitir,
} from '../services/mobiltekService'

const KANAL_SEC = [1, 2]
const BUSY_BEKLEME_SN = 90
const WARM_UP_MAKS_MS = 120000

// expo-video runtime import — native modül eksikse crash yerine hata state
let VideoView = null
let useVideoPlayer = null
let expoVideoImportError = null
try {
  const mod = require('expo-video')
  VideoView = mod.VideoView
  useVideoPlayer = mod.useVideoPlayer
} catch (e) {
  expoVideoImportError = e?.message || 'expo-video yüklenemedi'
  console.warn('[canli-kamera] expo-video import fail:', expoVideoImportError)
}

// Error boundary — herhangi bir render hatasında crash yerine mesaj göster
class HataSiniri extends Component {
  constructor(props) { super(props); this.state = { hata: null } }
  static getDerivedStateFromError(e) { return { hata: e?.message || 'Beklenmeyen hata' } }
  componentDidCatch(err, info) { console.warn('[canli-kamera] ErrorBoundary:', err?.message, info?.componentStack) }
  render() {
    if (this.state.hata) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Feather name="alert-triangle" size={48} color="#f59e0b" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
            Canlı Kamera Yüklenemedi
          </Text>
          <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
            {this.state.hata}
          </Text>
          <TouchableOpacity
            onPress={() => this.props.geriDon?.()}
            style={{ marginTop: 20, backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

export default function CanliKameraScreen({ route, navigation }) {
  return (
    <HataSiniri geriDon={() => navigation.goBack?.()}>
      {expoVideoImportError ? (
        <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Feather name="alert-triangle" size={48} color="#f59e0b" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16 }}>
            Video oynatıcı yüklenemedi
          </Text>
          <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            {expoVideoImportError}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack?.()}
            style={{ marginTop: 20, backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Geri</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KameraIcerik route={route} navigation={navigation} />
      )}
    </HataSiniri>
  )
}

function KameraIcerik({ route, navigation }) {
  const { aracId, aracPlaka } = route.params || {}
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const [kanal, setKanal] = useState(1)
  const [streamUrl, setStreamUrl] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [busyBekleme, setBusyBekleme] = useState(0)
  const [hata, setHata] = useState(null)

  const logIdRef = useRef(null)
  const suanKiKanalRef = useRef(1)
  const busyIntervalRef = useRef(null)
  const warmUpTimerRef = useRef(null)

  // Player defensive — null ve callback her koşulda safe
  const player = useVideoPlayer(streamUrl, (p) => {
    try {
      if (!p) return
      p.loop = false
      p.muted = false
    } catch (e) {
      console.warn('[canli-kamera] player setup:', e?.message)
    }
  })

  // streamUrl geldiğinde play başlat
  useEffect(() => {
    if (!player || !streamUrl) return
    try { player.play() } catch (e) { console.warn('[canli-kamera] play:', e?.message) }
  }, [player, streamUrl])

  useEffect(() => {
    if (navigation?.setOptions) {
      navigation.setOptions({ title: `Canlı Kamera — ${aracPlaka || aracId || ''}`, headerBackTitle: 'Geri' })
    }
  }, [navigation, aracPlaka, aracId])

  const temizleTimers = useCallback(() => {
    if (busyIntervalRef.current) { clearInterval(busyIntervalRef.current); busyIntervalRef.current = null }
    if (warmUpTimerRef.current) { clearTimeout(warmUpTimerRef.current); warmUpTimerRef.current = null }
  }, [])

  const baslat = useCallback(async (secilenKanal) => {
    if (!aracId) return
    suanKiKanalRef.current = secilenKanal
    temizleTimers()
    setYukleniyor(true)
    setBusyBekleme(0)
    setHata(null)
    setStreamUrl(null)

    try {
      const yeniLog = await izlemeLogBaslat({
        aracId, aracPlaka, kanal: secilenKanal, kullaniciId: kullanici?.id,
      }).catch(() => null)
      logIdRef.current = yeniLog

      const cevap = await canliKameraBaslat(aracId, secilenKanal)
      if (!cevap) {
        setYukleniyor(false)
        setHata('Kamera başlatılamadı — kredensiyel/ağ sorunu olabilir.')
        return
      }

      const cam = cevap.veri?.camera
      if (cam?.resultCode && cam.resultCode !== '100') {
        if (cam.resultCode === '302' || (cam.resultMsg || '').toLowerCase().includes('busy')) {
          setBusyBekleme(BUSY_BEKLEME_SN)
          const t0 = Date.now()
          busyIntervalRef.current = setInterval(() => {
            const kalan = Math.max(0, BUSY_BEKLEME_SN - Math.floor((Date.now() - t0) / 1000))
            setBusyBekleme(kalan)
            if (kalan === 0) {
              clearInterval(busyIntervalRef.current)
              busyIntervalRef.current = null
              baslat(suanKiKanalRef.current)
            }
          }, 1000)
          return
        }
        setYukleniyor(false)
        setHata(`Kamera hatası: ${cam.resultMsg || cam.resultCode}. Motor kapalıysa açın veya Mobiltek destek çağırın.`)
        return
      }

      const su = cam?.streamingUrls || cevap.veri?.streamingUrls || {}
      const hlsUrl = su.hls ? proxyleStreamUrl(su.hls) : null
      if (!hlsUrl) {
        setYukleniyor(false)
        setHata('Kullanılabilir HLS stream URL yok.')
        return
      }
      setStreamUrl(hlsUrl)

      warmUpTimerRef.current = setTimeout(() => {
        try {
          if (player && player.status !== 'readyToPlay' && player.status !== 'loading') {
            setYukleniyor(false)
            setHata('Yayın 2 dakikada başlamadı. Motor kapalıysa açın veya birazdan tekrar deneyin.')
          }
        } catch {}
      }, WARM_UP_MAKS_MS)
    } catch (e) {
      console.warn('[canli-kamera] baslat:', e?.message)
      setYukleniyor(false)
      setHata('Beklenmeyen hata: ' + (e?.message || 'bilinmeyen'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, aracPlaka, kullanici?.id, temizleTimers, player])

  useEffect(() => {
    baslat(kanal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanal])

  // Player statüs listener — defensive
  useEffect(() => {
    if (!player) return
    let sub
    try {
      sub = player.addListener?.('statusChange', (payload) => {
        try {
          const status = payload?.status
          if (status === 'readyToPlay') {
            setYukleniyor(false)
            if (warmUpTimerRef.current) { clearTimeout(warmUpTimerRef.current); warmUpTimerRef.current = null }
          }
          if (status === 'error') console.warn('[canli-kamera] player error:', payload?.error)
        } catch (e) { console.warn('[canli-kamera] statusChange:', e?.message) }
      })
    } catch (e) { console.warn('[canli-kamera] addListener:', e?.message) }
    return () => { try { sub?.remove?.() } catch {} }
  }, [player])

  useEffect(() => {
    return () => {
      try {
        if (aracId) canliKameraDurdur(aracId, suanKiKanalRef.current).catch(() => {})
        if (logIdRef.current) izlemeLogBitir(logIdRef.current).catch(() => {})
        temizleTimers()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const yenidenDene = () => baslat(kanal)

  return (
    <ScreenContainer>
      <View style={[styles.kanalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {KANAL_SEC.map(k => (
          <TouchableOpacity
            key={k}
            onPress={() => { if (k !== kanal) setKanal(k) }}
            style={[
              styles.kanalBtn,
              { backgroundColor: k === kanal ? '#2563eb' : 'transparent', borderColor: k === kanal ? '#2563eb' : colors.border },
            ]}
          >
            <Text style={{ color: k === kanal ? '#fff' : colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
              Kanal {k}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.videoWrap}>
        {streamUrl && !hata && VideoView && player && (() => {
          try {
            return (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                allowsFullscreen
                allowsPictureInPicture
                nativeControls
              />
            )
          } catch (e) {
            console.warn('[canli-kamera] VideoView render:', e?.message)
            return null
          }
        })()}

        {yukleniyor && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="#60a5fa" />
            {busyBekleme > 0 ? (
              <>
                <Text style={styles.baslikTxt}>Cihaz meşgul — otomatik yeniden deneme</Text>
                <Text style={styles.sayacTxt}>{busyBekleme}s</Text>
                <Text style={styles.aciklamaTxt}>
                  Önceki yayın hâlâ aktif. Mobiltek cihazı serbest bırakınca otomatik başlatılacak.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.baslikTxt}>Yayın başlatılıyor…</Text>
                <Text style={styles.aciklamaTxt}>
                  Motor açıkken 15-20 sn, motor kapalıyken 1-2 dakika sürebilir.
                </Text>
              </>
            )}
          </View>
        )}

        {hata && (
          <View style={styles.centerOverlay}>
            <Feather name="alert-triangle" size={40} color="#dc2626" />
            <Text style={styles.hataTxt}>{hata}</Text>
            <TouchableOpacity onPress={yenidenDene} style={styles.yenidenBtn}>
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Yeniden Dene</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.infoBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {aracPlaka || `#${aracId}`} · Kanal {kanal}
        </Text>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  kanalRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  kanalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
  },
  videoWrap: {
    flex: 1,
    backgroundColor: '#000',
    minHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  baslikTxt: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 14 },
  sayacTxt: { color: '#fbbf24', fontSize: 40, fontWeight: '800', marginTop: 8 },
  aciklamaTxt: { color: '#cbd5e1', fontSize: 12, marginTop: 8, textAlign: 'center', maxWidth: 340, lineHeight: 18 },
  hataTxt: { color: '#fca5a5', fontSize: 13, marginTop: 10, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  yenidenBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  infoBar: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
})
