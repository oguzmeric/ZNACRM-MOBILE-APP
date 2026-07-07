// Canlı kamera izleme — Mobiltek MDVR (mobile).
// Transport: HLS via expo-video (native, iOS/Android'de sıfır konfigürasyon).
// Warm-up: motor açıkken 15-20 sn, kapalıyken 1-2 dk.
//
// Route: navigation.navigate('CanliKamera', { aracId, aracPlaka })

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
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

export default function CanliKameraScreen({ route, navigation }) {
  const { aracId, aracPlaka } = route.params
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

  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = false
    p.muted = false
    p.play()
  })

  useEffect(() => {
    navigation.setOptions({ title: `Canlı Kamera — ${aracPlaka || aracId}`, headerBackTitle: 'Geri' })
  }, [navigation, aracPlaka, aracId])

  const temizleTimers = useCallback(() => {
    if (busyIntervalRef.current) { clearInterval(busyIntervalRef.current); busyIntervalRef.current = null }
    if (warmUpTimerRef.current) { clearTimeout(warmUpTimerRef.current); warmUpTimerRef.current = null }
  }, [])

  const baslat = useCallback(async (secilenKanal) => {
    suanKiKanalRef.current = secilenKanal
    temizleTimers()
    setYukleniyor(true)
    setBusyBekleme(0)
    setHata(null)
    setStreamUrl(null)

    // İzleme log
    const yeniLog = await izlemeLogBaslat({
      aracId,
      aracPlaka,
      kanal: secilenKanal,
      kullaniciId: kullanici?.id,
    })
    logIdRef.current = yeniLog

    const cevap = await canliKameraBaslat(aracId, secilenKanal)
    if (!cevap) {
      setYukleniyor(false)
      setHata('Kamera başlatılamadı — kredensiyel/ağ sorunu olabilir.')
      return
    }

    const cam = cevap.veri?.camera
    if (cam?.resultCode && cam.resultCode !== '100') {
      // 302 Device busy → 90 sn countdown + auto-retry
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
    // Mobile için HLS öncelikli (expo-video native destekler)
    const hlsUrl = su.hls ? proxyleStreamUrl(su.hls) : null
    if (!hlsUrl) {
      setYukleniyor(false)
      setHata('Kullanılabilir HLS stream URL yok.')
      return
    }
    setStreamUrl(hlsUrl)

    // 2 dk içinde ilk frame gelmezse hata
    warmUpTimerRef.current = setTimeout(() => {
      if (player && player.status !== 'readyToPlay' && player.status !== 'loading') {
        setYukleniyor(false)
        setHata('Yayın 2 dakikada başlamadı. Motor kapalıysa açın veya birazdan tekrar deneyin.')
      }
    }, WARM_UP_MAKS_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, aracPlaka, kullanici?.id, temizleTimers])

  // İlk mount + kanal değişimi → başlat
  useEffect(() => {
    baslat(kanal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanal])

  // Player statüsünü izle → yukleniyor state'i güncelle
  useEffect(() => {
    if (!player) return
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') {
        setYukleniyor(false)
        if (warmUpTimerRef.current) { clearTimeout(warmUpTimerRef.current); warmUpTimerRef.current = null }
      }
      if (status === 'error') {
        console.warn('[canli-kamera] player error:', error)
        // Ağ hatası → 5 sn sonra yeniden dene (max 3 kez)
        // Basit implementasyon: hata mesajı göster
      }
    })
    return () => sub?.remove?.()
  }, [player])

  // Ekran unmount → stop + log finalize
  useEffect(() => {
    return () => {
      canliKameraDurdur(aracId, suanKiKanalRef.current).catch(() => {})
      if (logIdRef.current) izlemeLogBitir(logIdRef.current).catch(() => {})
      temizleTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const yenidenDene = () => baslat(kanal)

  return (
    <ScreenContainer>
      {/* Kanal seçim tab */}
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

      {/* Video */}
      <View style={styles.videoWrap}>
        {streamUrl && !hata && (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        )}

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
            <Text style={[styles.hataTxt]}>{hata}</Text>
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
