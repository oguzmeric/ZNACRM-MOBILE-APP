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
import { mesaiyeBasla, mesaiyiBitir, acikMesaiGetir } from '../services/mesaiService'

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

// FAZLA MESAİ (mig 252): 19:00 ve sonrasında başlatılan çalışma ayrı tutulur ve
// ayrı ücretlendirilir. Normal mesainin aksine 18:30 cron'u dokunmaz; personel
// ELLE bitirir, unutulursa gece 02:00'da yedek cron kapatır.
const FAZLA_BASLANGIC_DK = 19 * 60
const fazlaPenceresiMi = (dk) => dk >= FAZLA_BASLANGIC_DK

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

  // FAZLA MESAİ QR'SIZ BAŞLAR: akşam personel BAŞKA lokasyonda çalışmaya devam
  // edebiliyor, ofisteki QR'a erişemez. Sunucu da 19:00+ isteklerde QR aramaz
  // (mesai-giris edge fn ile birlikte değişti). QR adımı kalkınca tek tık
  // mesai açmasın diye onay sorusu var.
  const fazlaMesaiBaslat = () => {
    Alert.alert('Fazla mesai başlat', 'Şimdi başlatılan çalışma FAZLA MESAİ olarak kaydedilir ve bitişini sen kapatırsın. Başlatılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Başlat', onPress: () => konumAlVeGiris(null) },
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

  // Buton HER ZAMAN görünür; basılamıyorsa nedeni altta yazar.
  // (_tick 30sn'de bir arttığı için kilit penceresi kendiliğinden güncellenir.)
  const suAnDk = istanbulDakika()
  const kilitli = kilitliMi(suAnDk)
  const fazlaPencere = fazlaPenceresiMi(suAnDk)
  const fazlaAcik = acik?.tip === 'fazla'

  // Fazla mesai turuncu, normal mesai yeşil — ekipte "hangisindeyim" sorusu olmasın
  const kartBg = fazlaAcik ? 'rgba(245,158,11,0.12)' : acik ? 'rgba(34,197,94,0.10)' : colors.surface
  const kartBorder = fazlaAcik ? 'rgba(245,158,11,0.40)' : acik ? 'rgba(34,197,94,0.35)' : colors.border

  // Fazla mesaide buton AKTİF kalır ve "Bitir" olur (normal mesaide Bitir yok).
  const butonPasif = meshgul || (!!acik && !fazlaAcik) || kilitli
  const butonEtiket = fazlaAcik ? 'Bitir'
    : acik ? 'Mesaide'
    : kilitli ? '19:00'
    : fazlaPencere ? 'Fazla Mesai'
    : 'Başla'
  const saatMetni = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const altYazi = fazlaAcik
    ? `Fazla mesai · başlangıç ${saatMetni(acik.giris_zamani)} · bitirmeyi unutma`
    : acik
      ? `Başlangıç ${saatMetni(acik.giris_zamani)} · 18:30'da otomatik kapanır`
      : kilitli
        ? 'Mesai 18:30\'da kapandı · 19:00\'dan sonra başlatabilirsin'
        : fazlaPencere
          ? 'Şimdi başlatılan mesai FAZLA MESAİ sayılır · bitişini sen kapatırsın'
          : 'Bugün henüz başlamadın · geçmişi gör →'

  // Fazla mesaiyi elle kapat. Konum best-effort: alınamazsa kayıt yine kapanır,
  // çünkü asıl amaç bitiş SAATİNİ doğru yazmak.
  const fazlaMesaiBitir = () => {
    Alert.alert('Fazla mesaiyi bitir', 'Mesai şimdi kapatılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Bitir',
        onPress: async () => {
          setMeshgul(true)
          try {
            let lat = null, lng = null
            try {
              const k = await Location.getCurrentPositionAsync({})
              lat = k.coords.latitude; lng = k.coords.longitude
            } catch { /* konum yoksa da kapat */ }
            const cvp = await mesaiyiBitir({ lat, lng })
            if (cvp?.ok) {
              const dk = Number(cvp.sure_dakika ?? 0)
              Alert.alert('Fazla mesai kapatıldı',
                dk > 0 ? `Süre: ${Math.floor(dk / 60)} sa ${dk % 60} dk` : 'Kayıt kapatıldı.')
              yenile()
            } else {
              Alert.alert('Hata', cvp?.hata ?? 'Mesai kapatılamadı.')
            }
          } finally { setMeshgul(false) }
        },
      },
    ])
  }

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
          backgroundColor: fazlaAcik ? '#f59e0b' : acik ? colors.success : colors.surfaceDark,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Feather name={fazlaAcik ? 'moon' : 'clock'} size={20} color={acik ? '#fff' : colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
            {fazlaAcik ? `Fazla mesaide · ${sureFormat(acik.giris_zamani)}`
              : acik ? `Mesaide · ${sureFormat(acik.giris_zamani)}`
              : 'Mesai'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {altYazi}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Sağ — normal mesaide yalnız "Başla" (QR + 18:30'da otomatik kapanır),
          19:00 sonrası "Fazla Mesai" (QR'SIZ, onayla başlar),
          fazla mesaide "Bitir" (elle kapatılır). */}
      <TouchableOpacity
        onPress={fazlaAcik ? fazlaMesaiBitir : fazlaPencere ? fazlaMesaiBaslat : qrOku}
        disabled={butonPasif}
        activeOpacity={0.8}
        style={{
          backgroundColor: butonPasif ? colors.surfaceDark
            : fazlaAcik ? '#f59e0b'
            : colors.success,
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
                name={fazlaAcik ? 'stop-circle' : acik ? 'check' : kilitli ? 'lock' : 'maximize'}
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
