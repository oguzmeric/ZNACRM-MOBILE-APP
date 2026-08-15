// Mesai giriş kartı — kompakt tek-satır varyant, tema uyumlu.
//
// NOT (2026-07-22): HAFTA İÇİ normal mesaide "Bitir" butonu YOK. Mesai 18:30'da
// sunucudaki cron (mesai_otomatik_kapat) ile kendiliğinden kapanır. Kapanır
// kapanmaz yeniden başlatılabilmesini engellemek için 18:30–19:00 arası "Başla"
// pasiftir; 19:00'dan sonra tekrar aktifleşir. Buton her durumda GÖRÜNÜR kalır,
// neden basılamadığı üstünde yazar (kullanıcı isteği).
//
// NOT (2026-08-14): HAFTA SONU bunun İSTİSNASI — "Bitir" butonu VAR ve aynı gün
// birden çok kez başla/bitir yapılabilir. Teknisyen hafta sonu gün içinde parça
// parça işe gidiyor (ör. 08:30–11:30, sonra 14:00–16:00); tek kayıt + 18:30
// kapanışı 3 saatlik çalışmayı 10 saat gösteriyordu.
// Sunucu tarafı zaten destekliyordu: mesai-cikis tip ayrımı yapmıyor ve tek
// kısıt `mesai_aktif_tek` (AYNI ANDA tek açık kayıt) — kapalı kayıt sayısı
// sınırsız, yani süreler toplanır.
import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Alert, Linking, ActivityIndicator, Modal, StyleSheet } from 'react-native'
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

// HAFTA SONU ücretlendirmede hafta içiyle AYNI (kullanıcı kararı 14.08):
// kayıt normal mesai olarak açılır — 'ekstra' etiketi yok, ücret aynı.
// FARKLAR: (1) QR istenmez (ofis kapalı, personel sahada),
//          (2) ELLE bitirilir ve gün içinde tekrar başlatılabilir (14.08 revize).
// 18:30 cron'u yine yedek olarak durur: personel kapatmayı unutursa kayıt
// sonsuza kadar açık kalmasın diye. 19:00+ her gün fazla mesai kuralına girer.
// Sunucu (mesai-giris) aynı kuralı uygular — burası yalnız ekran davranışı.
function istanbulHaftaSonuMu(tarih = new Date()) {
  try {
    const gun = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul', weekday: 'short',
    }).format(tarih)
    return gun === 'Sat' || gun === 'Sun'
  } catch {
    const g = tarih.getDay()
    return g === 0 || g === 6
  }
}

// Açık kaydın BAŞLADIĞI gün hafta sonu mu? "Şu an" değil başlangıç önemli:
// Cumartesi 23:00 başlayan kayıt Pazar 01:00'da hâlâ hafta sonu mesaisidir.
const girisHaftaSonuMu = (iso) => {
  if (!iso) return false
  const t = new Date(iso)
  return isNaN(t) ? false : istanbulHaftaSonuMu(t)
}

// 18:30-19:00 kilidi: cron kapanışının hemen ardından yeniden başlatmayı önler.
// Hafta sonu kayıtları da aynı cron'la kapandığından kilit her gün geçerli
// (sunucuyla aynı kural).
const kilitliMi = (dk) => dk >= KILIT_BASLANGIC_DK && dk < KILIT_BITIS_DK

// FAZLA MESAİ (mig 252): 19:00 ve sonrasında başlatılan çalışma ayrı tutulur ve
// ayrı ücretlendirilir. Normal mesainin aksine 18:30 cron'u dokunmaz; personel
// ELLE bitirir, unutulursa gece 02:00'da yedek cron kapatır.
const FAZLA_BASLANGIC_DK = 19 * 60
const fazlaPenceresiMi = (dk) => dk >= FAZLA_BASLANGIC_DK || istanbulHaftaSonuMu()
// Saat biçimleyici modül seviyesinde: her render'da yeniden oluşmasın ve
// bileşen içinde 'aşağıda tanımlı ama yukarıda kullanılıyor' tuzağı doğmasın.
const saatMetni = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export default function MesaiKarti() {
  const { colors } = useTheme()
  const nav = useNavigation()
  const [acik, setAcik] = useState(null)
  const [_tick, setTick] = useState(0)
  const [qrAcik, setQrAcik] = useState(false)
  const [kameraHazir, setKameraHazir] = useState(false)
  const [meshgul, setMeshgul] = useState(false)
  const [izin, izinIste] = useCameraPermissions()
  const okundu = useRef(false)
  // Mesai başlatmada senkron çift dokunma kilidi — bkz. konumAlVeGiris
  const girisKilidi = useRef(false)

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
    okundu.current = false
    setKameraHazir(false)
    // ⚠️ İzin YOKSA da ekranı AÇIYORUZ: modal içinde ne yapılacağı yazıyor.
    // Eskiden burada Alert basılıp dönülüyordu, "bir daha sorma" demiş
    // kullanıcı hiçbir çıkış yolu göremiyordu.
    if (!izin?.granted && izin?.canAskAgain !== false) await izinIste().catch(() => {})
    setQrAcik(true)
  }

  const konumAlVeGiris = async (qr_payload, zorla = false) => {
    // ⚠️ SENKRON KİLİT (12.08.2026). setMeshgul(true) asenkron: buton ancak bir
    // sonraki render'da pasifleşir, o aralıkta gelen ikinci dokunuş kapıdan
    // geçip İKİNCİ mesai kaydı açardı. useState tek başına yetmez —
    // aynı desen web'de 7 mükerrer teklif üretmişti.
    if (girisKilidi.current) return
    girisKilidi.current = true
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
      // ⚠️ 12.08.2026: eski metin "Zaten mesaidesin — Kapatıp yenisini açayım
      // mı? [İptal] [Evet]" idi. Personel bunu "başlatılamadı, tekrar dene"
      // sanıp Evet'e basıyordu → açık kayıt kapanıp yenisi açılıyor, ilk kayıt
      // 0 dakikalık çöp oluyordu (Emin Erdem 12.08 · Irmak İnan 06.08, 19-20 sn).
      // Artık: mesai zaten AÇIK olduğu net söyleniyor, sonucu yazıyor ve
      // yeniden başlatma yıkıcı seçenek olarak İKİNCİ sırada.
      if (cvp.hata === 'zaten_acik') {
        const basladi = acik?.giris_zamani ? saatMetni(acik.giris_zamani) : null
        Alert.alert(
          'Mesain zaten açık',
          (basladi ? `Mesain ${basladi}'de başlamış ve şu an devam ediyor.` : 'Şu an açık bir mesain var.')
          + '\n\nYeniden başlatman gerekmiyor. Yeniden başlatırsan mevcut kayıt kapanır ve süre sıfırdan işlemeye başlar.',
          [
            { text: 'Tamam, devam ediyorum', style: 'cancel' },
            {
              text: 'Yine de yeniden başlat',
              style: 'destructive',
              onPress: () => konumAlVeGiris(qr_payload, true),
            },
          ],
        )
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
    } finally { girisKilidi.current = false; setMeshgul(false) }
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
    // 19:00+ her gün fazla mesaidir; hafta sonu GÜNDÜZ ise normal mesai
    // gibi işlenir (aynı ücret) — metin buna göre seçilir.
    const fazlaSaat = istanbulDakika() >= FAZLA_BASLANGIC_DK
    Alert.alert(
      fazlaSaat ? 'Fazla mesai başlat' : 'Hafta sonu mesaisi başlat',
      fazlaSaat
        ? 'Şimdi başlatılan çalışma FAZLA MESAİ olarak kaydedilir ve bitişini sen kapatırsın. Başlatılsın mı?'
        : 'Hafta sonu mesaisi normal mesai olarak işlenir. İş bitince BİTİR ile kapat; '
          + 'gün içinde başka işe gidersen tekrar başlatabilirsin, süreler toplanır. Başlatılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Başlat', onPress: () => konumAlVeGiris(null) },
    ])
  }

  /**
   * QR OKUTMA — TAM EKRAN MODAL (12.08.2026 saha arızası).
   *
   * ⚠️ Eskiden kamera, kartın içinde `borderRadius:16 + overflow:'hidden'`
   * olan 380px'lik bir kutuda gösteriliyordu. Android'de expo-camera
   * önizlemesi ayrı bir yüzey katmanında çizilir; üstüne konan yuvarlatma
   * maskesi bazı cihazlarda o katmanı tamamen gizler ve kullanıcı SİYAH
   * DİKDÖRTGEN görür (Gurbet Çiftçi'nin cihazında böyle oldu).
   *
   * Uygulamadaki diğer tarayıcılar (QuickScanner, TaraScreen) zaten tam ekran
   * `absoluteFill` kullanıyor ve hiç sorun çıkarmadı — desen onlarla eşitlendi.
   * Tam ekran QR'ı okutmayı da kolaylaştırır.
   */
  const qrEkrani = (
    <Modal visible={qrAcik} animationType="slide" statusBarTranslucent
      onRequestClose={() => setQrAcik(false)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {!izin ? (
          <View style={qrOrta}><ActivityIndicator color="#fff" /></View>
        ) : !izin.granted ? (
          // İzin yoksa siyah ekran YERİNE ne yapılacağı yazsın. "Bir daha
          // sorma" denmişse tekrar istemek sessizce başarısız olur — o durumda
          // tek çıkış sistem ayarlarıdır.
          <View style={qrOrta}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Kamera izni gerekli
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              Mesai başlatmak için ofisteki QR kodu okutman gerekiyor.
            </Text>
            <TouchableOpacity
              onPress={() => (izin.canAskAgain ? izinIste() : Linking.openSettings())}
              style={{ backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {izin.canAskAgain ? 'İzin Ver' : 'Ayarları Aç'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQrAcik(false)}
              style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={qrIslendi}
              onCameraReady={() => setKameraHazir(true)}
            />
            {/* Kamera açılana kadar geçen 1-2 saniye "bozuk" sanılmasın */}
            {!kameraHazir && (
              <View style={[StyleSheet.absoluteFill, qrOrta]} pointerEvents="none">
                <ActivityIndicator color="#fff" />
                <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 10 }}>Kamera açılıyor…</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setQrAcik(false)}
              style={{ position: 'absolute', top: 48, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>× Kapat</Text>
            </TouchableOpacity>
            <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 12 }}>
              <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
                Ofisin QR kodunu kamerayla okut
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  )

  // Buton HER ZAMAN görünür; basılamıyorsa nedeni altta yazar.
  // (_tick 30sn'de bir arttığı için kilit penceresi kendiliğinden güncellenir.)
  const suAnDk = istanbulDakika()
  const kilitli = kilitliMi(suAnDk)
  const fazlaPencere = fazlaPenceresiMi(suAnDk)
  const fazlaAcik = acik?.tip === 'fazla'

  // Fazla mesai turuncu, normal mesai yeşil — ekipte "hangisindeyim" sorusu olmasın
  const kartBg = fazlaAcik ? 'rgba(245,158,11,0.12)' : acik ? 'rgba(34,197,94,0.10)' : colors.surface
  const kartBorder = fazlaAcik ? 'rgba(245,158,11,0.40)' : acik ? 'rgba(34,197,94,0.35)' : colors.border

  // ⚠️ HAFTA SONU MESAİSİ ELLE BİTİRİLİR (14.08 saha talebi).
  // Teknisyenler hafta sonu gün içinde parça parça çalışıyor (ör. Alp Aslan
  // 08:30–11:30). Kayıt 18:30 cron'una kadar açık kalınca 3 saatlik çalışma
  // 10 saat görünüyordu. Artık fazla mesai gibi elle kapatılabiliyor.
  // Sunucu tarafı zaten hazırdı: mesai-cikis edge fn tip AYRIMI YAPMIYOR.
  const haftaSonuAcik = !!acik && !fazlaAcik && girisHaftaSonuMu(acik.giris_zamani)
  const elleBitir = fazlaAcik || haftaSonuAcik

  // Elle bitirilebilen mesaide buton AKTİF kalır ve "Bitir" olur.
  // 18:30-19:00 kilidi yalnız BAŞLATMAYI kilitler — açık kaydı bitirmeyi değil.
  const butonPasif = meshgul || (!!acik && !elleBitir) || (kilitli && !elleBitir)
  // 19:00+ her gün FAZLA; hafta sonu gündüz NORMAL işlenir (QR'sız tek fark).
  const fazlaSaatte = suAnDk >= FAZLA_BASLANGIC_DK
  const haftaSonu = istanbulHaftaSonuMu()
  const butonEtiket = elleBitir ? 'Bitir'
    : acik ? 'Mesaide'
    : kilitli ? '19:00'
    : fazlaSaatte ? 'Fazla Mesai'
    : haftaSonu ? 'Mesai Başlat'
    : 'Başla'
  const altYazi = fazlaAcik
    ? `Fazla mesai · başlangıç ${saatMetni(acik.giris_zamani)} · bitirmeyi unutma`
    : haftaSonuAcik
      // Hafta sonu: iş bitince kapat, aynı gün yeniden başlatabilir
      ? `Hafta sonu mesaisi · başlangıç ${saatMetni(acik.giris_zamani)} · iş bitince kapat`
      : acik
        ? `Başlangıç ${saatMetni(acik.giris_zamani)} · 18:30'da otomatik kapanır`
        : kilitli
          ? 'Mesai 18:30\'da kapandı · 19:00\'dan sonra başlatabilirsin'
          : fazlaSaatte
            ? 'Şimdi başlatılan mesai FAZLA MESAİ sayılır · bitişini sen kapatırsın'
            : haftaSonu
              ? 'Hafta sonu · QR\'sız başlar, bitince sen kapatırsın · gün içinde tekrar başlatabilirsin'
              : 'Bugün henüz başlamadın · geçmişi gör →'

  // Açık mesaiyi elle kapat (fazla mesai + hafta sonu mesaisi).
  // Konum best-effort: alınamazsa kayıt yine kapanır, çünkü asıl amaç bitiş
  // SAATİNİ doğru yazmak.
  const mesaiElleBitir = () => {
    // Hafta sonu: gün içinde birden çok iş olabildiği için "tekrar başlatabilirsin"
    // bilgisi veriliyor — personel kapatmaktan çekinmesin.
    const haftaSonuKaydi = !!acik && acik.tip !== 'fazla' && girisHaftaSonuMu(acik.giris_zamani)
    Alert.alert(
      haftaSonuKaydi ? 'Mesaiyi bitir' : 'Fazla mesaiyi bitir',
      haftaSonuKaydi
        ? 'Bu mesai kapatılsın mı? Bugün yeni bir işe gidersen tekrar başlatabilirsin; süreler toplanır.'
        : 'Mesai şimdi kapatılsın mı?', [
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
              const sure = dk > 0 ? `Süre: ${Math.floor(dk / 60)} sa ${dk % 60} dk` : 'Kayıt kapatıldı.'
              Alert.alert(
                haftaSonuKaydi ? 'Mesai kapatıldı' : 'Fazla mesai kapatıldı',
                haftaSonuKaydi ? `${sure}\n\nYeni işe gidersen tekrar başlatabilirsin.` : sure,
              )
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
    <>
    {qrAcik && qrEkrani}
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
              : haftaSonuAcik ? `Hafta sonu mesaisi · ${sureFormat(acik.giris_zamani)}`
              : acik ? `Mesaide · ${sureFormat(acik.giris_zamani)}`
              : 'Mesai'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {altYazi}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Sağ — hafta içi normal mesaide yalnız "Başla" (QR + 18:30 cron kapatır),
          19:00 sonrası "Fazla Mesai" (QR'SIZ, onayla başlar),
          fazla mesai VE hafta sonu mesaisinde "Bitir" (elle kapatılır;
          hafta sonu aynı gün tekrar başlatılabilir). */}
      <TouchableOpacity
        onPress={elleBitir ? mesaiElleBitir : fazlaPencere ? fazlaMesaiBaslat : qrOku}
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
    </>
  )
}

const qrOrta = { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }
