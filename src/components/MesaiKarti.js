// Mesai giriş/çıkış kartı — kompakt tek-satır varyant, tema uyumlu.
import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import { mesaiyeBasla, mesaiyiBitir, acikMesaiGetir } from '../services/mesaiService'

function sureFormat(baslangicIso) {
  const ms = Date.now() - new Date(baslangicIso).getTime()
  const dk = Math.floor(ms / 60000)
  const s = String(Math.floor(dk / 60)).padStart(2, '0')
  const m = String(dk % 60).padStart(2, '0')
  return `${s}:${m}`
}

export default function MesaiKarti() {
  const { colors } = useTheme()
  const nav = useNavigation()
  const [acik, setAcik] = useState(null)
  const [_tick, setTick] = useState(0)
  const [qrAcik, setQrAcik] = useState(false)
  const [meshgul, setMeshgul] = useState(false)
  const [izin, izinIste] = useCameraPermissions()
  const okundu = useRef(false)

  const yenile = async () => {
    try { setAcik(await acikMesaiGetir()) } catch {}
  }
  useEffect(() => { yenile() }, [])

  // Kart yüklendiğinde konum izni iste — verilmemişse kullanıcı ayarlara yönlendirilir.
  useEffect(() => {
    (async () => {
      try {
        const mevcut = await Location.getForegroundPermissionsAsync()
        if (mevcut.status === 'granted') return
        if (mevcut.canAskAgain === false) return
        await Location.requestForegroundPermissionsAsync()
      } catch {}
    })()
  }, [])
  useEffect(() => {
    if (!acik) return
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [acik])

  const qrOku = async () => {
    if (!izin?.granted) {
      const r = await izinIste()
      if (!r.granted) { Alert.alert('Kamera İzni', 'Kamera izni verilmedi.'); return }
    }
    okundu.current = false
    setQrAcik(true)
  }

  const konumAlVeGiris = async (qr_payload, zorla = false) => {
    setMeshgul(true)
    try {
      const konumIzin = await Location.requestForegroundPermissionsAsync()
      if (konumIzin.status !== 'granted') {
        Alert.alert('Konum İzni Gerekli', 'Mesai başlatmak için konum izni zorunlu.',
          [{ text: 'Ayarlara Git', onPress: () => Linking.openSettings() }, { text: 'İptal' }])
        return
      }
      let konum
      try {
        konum = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      } catch {
        Alert.alert('Konum', 'Konum alınamadı. Açık havada tekrar dene.'); return
      }
      const { latitude: lat, longitude: lng } = konum.coords
      const cvp = await mesaiyeBasla({ qr_payload, lat, lng, zorla })
      if (cvp.ok) {
        Alert.alert('✅ Mesaiye başladın', cvp.mesafe_m !== null ? `Ofise ~${cvp.mesafe_m} m` : '')
        yenile(); return
      }
      if (cvp.uyari === 'ofis_disi') {
        Alert.alert('Ofis dışı', `Ofis konumundan ~${cvp.mesafe_m} m uzaktasın. Yine de başlayayım mı?`,
          [{ text: 'İptal', style: 'cancel' }, { text: 'Evet', onPress: () => konumAlVeGiris(qr_payload, true) }])
        return
      }
      if (cvp.hata === 'zaten_acik') {
        Alert.alert('Zaten mesaidesin', 'Kapatıp yenisini açayım mı?',
          [{ text: 'İptal', style: 'cancel' }, { text: 'Evet', onPress: () => konumAlVeGiris(qr_payload, true) }])
        return
      }
      if (cvp.hata === 'gecersiz_qr') { Alert.alert('QR', 'Bu QR mesai kodu değil.'); return }
      if (cvp.hata === 'modul_yok') { Alert.alert('Yetki', 'Mesai takip modülü bu hesaba tanımlı değil.'); return }
      Alert.alert('Hata', cvp.hata ?? 'Bilinmeyen hata')
    } finally { setMeshgul(false) }
  }

  const qrIslendi = ({ data }) => {
    if (okundu.current) return
    okundu.current = true
    setQrAcik(false)
    if (!data || !data.startsWith('ZNA-MESAI:v1:')) {
      Alert.alert('QR', 'Bu QR mesai kodu değil.'); return
    }
    konumAlVeGiris(data)
  }

  const bitir = () => {
    Alert.alert('Mesaiyi bitir?', `Süre: ${sureFormat(acik.giris_zamani)}`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Bitir', style: 'destructive', onPress: async () => {
        setMeshgul(true)
        let lat = null, lng = null
        try {
          const iz = await Location.getForegroundPermissionsAsync()
          if (iz.granted) {
            const k = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
            lat = k.coords.latitude; lng = k.coords.longitude
          }
        } catch {}
        const r = await mesaiyiBitir({ lat, lng })
        setMeshgul(false)
        if (r.ok) {
          const s = String(Math.floor((r.sure_dakika ?? 0) / 60)).padStart(2, '0')
          const d = String((r.sure_dakika ?? 0) % 60).padStart(2, '0')
          Alert.alert('Mesai bitti ✅', `Toplam ${s}:${d}`); yenile()
        } else { Alert.alert('Hata', r.hata ?? 'Bitirilemedi') }
      }},
    ])
  }

  if (qrAcik) {
    return (
      <View style={{ height: 380, borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000' }}>
        <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={qrIslendi} />
        <TouchableOpacity onPress={() => setQrAcik(false)}
          style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>× Kapat</Text>
        </TouchableOpacity>
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>Ofisin QR kodunu kamerayla okut</Text>
        </View>
      </View>
    )
  }

  const kartBg = acik ? 'rgba(34,197,94,0.10)' : colors.surface
  const kartBorder = acik ? 'rgba(34,197,94,0.35)' : colors.border

  return (
    <View style={{
      backgroundColor: kartBg,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: kartBorder,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    }}>
      {/* Sol — ikon + durum (tıklanınca geçmişe git) */}
      <TouchableOpacity
        onPress={() => nav.navigate('MesaiGecmisi')}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
      >
        <View style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: acik ? colors.success : colors.surfaceDark,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Feather name="clock" size={20} color={acik ? '#fff' : colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
            {acik ? `Mesaide · ${sureFormat(acik.giris_zamani)}` : 'Mesai'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {acik
              ? `Başlangıç ${new Date(acik.giris_zamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · geçmişi gör →`
              : 'Bugün henüz başlamadın · geçmişi gör →'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Sağ — buton */}
      <TouchableOpacity
        onPress={acik ? bitir : qrOku}
        disabled={meshgul}
        activeOpacity={0.8}
        style={{
          backgroundColor: acik ? colors.danger : colors.success,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: meshgul ? 0.6 : 1,
        }}
      >
        {meshgul
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Feather name={acik ? 'square' : 'maximize'} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {acik ? 'Bitir' : 'Başla'}
              </Text>
            </>
        }
      </TouchableOpacity>
    </View>
  )
}
