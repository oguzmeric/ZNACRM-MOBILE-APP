// Mesai giriş kartı — kompakt tek-satır varyant, tema uyumlu.
//
// NOT (2026-07-22): "Bitir" butonu KALDIRILDI. Mesai 18:30'da sunucudaki cron
// (mesai_otomatik_kapat) ile kendiliğinden kapanır. Kapanır kapanmaz yeniden
// başlatılabilmesini engellemek için 18:30–19:00 arası "Başla" pasiftir;
// 19:00'dan sonra tekrar aktifleşir. Buton her durumda GÖRÜNÜR kalır, neden
// basılamadığı üstünde yazar (kullanıcı isteği).
import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import { mesaiyeBasla, acikMesaiGetir } from '../services/mesaiService'

function sureFormat(baslangicIso) {
  const ms = Date.now() - new Date(baslangicIso).getTime()
  const dk = Math.floor(ms / 60000)
  const s = String(Math.floor(dk / 60)).padStart(2, '0')
  const m = String(dk % 60).padStart(2, '0')
  return `${s}:${m}`
}

// Kilit penceresi — sunucudaki mesai-giris edge fn ile AYNI değerler olmalı.
const KILIT_BASLANGIC_DK = 18 * 60 + 30   // 18:30
const KILIT_BITIS_DK     = 19 * 60        // 19:00

// İstanbul saatine göre gün içi dakika. Cihaz saat dilimi farklı olabilir
// (yurt dışı / yanlış ayar) diye TZ'yi açıkça veriyoruz; Intl patlarsa cihaz
// saatine düşeriz — nihai karar zaten sunucuda veriliyor.
function istanbulDakika() {
  try {
    const bicim = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const [saat, dakika] = bicim.format(new Date()).split(':').map(Number)
    if (Number.isFinite(saat) && Number.isFinite(dakika)) return saat * 60 + dakika
  } catch { /* Intl yoksa cihaz saatine düş */ }
  const simdi = new Date()
  return simdi.getHours() * 60 + simdi.getMinutes()
}

const kilitliMi = (dk) => dk >= KILIT_BASLANGIC_DK && dk < KILIT_BITIS_DK

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
  // Tick HER ZAMAN çalışır: mesaideyken süreyi, mesai dışındayken 18:30/19:00
  // kilit penceresinin açılıp kapanmasını ekrana yansıtmak için.
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

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
      if (cvp.hata === 'cok_uzak') {
        Alert.alert(
          'Görünüşe göre henüz ofiste değilsin',
          `Ofis konumundan ~${cvp.mesafe_m} m uzaktasın. Ofise geldiğinde tekrar dene.`
        )
        return
      }
      if (cvp.hata === 'gecersiz_qr') { Alert.alert('QR', 'Bu QR mesai kodu değil.'); return }
      if (cvp.hata === 'modul_yok') { Alert.alert('Yetki', 'Mesai takip modülü bu hesaba tanımlı değil.'); return }
      if (cvp.hata === 'mesai_kilitli') {
        Alert.alert('Mesai kapanış saatinde',
          cvp.mesaj ?? 'Mesai 18:30\'da otomatik kapanır. Yeni mesai 19:00\'dan sonra başlatılabilir.')
        return
      }
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

  // Buton HER ZAMAN görünür; basılamıyorsa nedeni altta yazar.
  // (_tick 30sn'de bir arttığı için kilit penceresi kendiliğinden güncellenir.)
  const kilitli = kilitliMi(istanbulDakika())
  const butonPasif = meshgul || !!acik || kilitli
  const butonEtiket = acik ? 'Mesaide' : kilitli ? '19:00' : 'Başla'
  const altYazi = acik
    ? `Başlangıç ${new Date(acik.giris_zamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · 18:30'da otomatik kapanır`
    : kilitli
      ? 'Mesai 18:30\'da kapandı · 19:00\'dan sonra başlatabilirsin'
      : 'Bugün henüz başlamadın · geçmişi gör →'

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
            {altYazi}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Sağ — yalnız "Başla". Bitir butonu YOK: mesai 18:30'da otomatik kapanır. */}
      <TouchableOpacity
        onPress={qrOku}
        disabled={butonPasif}
        activeOpacity={0.8}
        style={{
          backgroundColor: butonPasif ? colors.surfaceDark : colors.success,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: butonPasif ? 0.55 : 1,
        }}
      >
        {meshgul
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Feather
                name={acik ? 'check' : kilitli ? 'lock' : 'maximize'}
                size={14}
                color={butonPasif ? colors.textMuted : '#fff'}
              />
              <Text style={{
                color: butonPasif ? colors.textMuted : '#fff',
                fontWeight: '700', fontSize: 13,
              }}>
                {butonEtiket}
              </Text>
            </>
        }
      </TouchableOpacity>
    </View>
  )
}
