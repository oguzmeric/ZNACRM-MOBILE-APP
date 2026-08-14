// Açılış ekranı — native splash'in KESİNTİSİZ devamı.
//
// Eskiden: native splash (koyu zemin + logo) → bir anda BOŞ ekran + küçük
// ActivityIndicator → uygulama. Üç ayrı görüntü, arada kopukluk; kullanıcı
// "takıldı mı?" diye düşünüyordu.
//
// Şimdi: aynı zemin, beyaz madalyon içinde logo, etrafında dönen ince halka,
// altında web giriş sayfasındaki slogan. Kullanıcı tek bir açılış görür.
//
// ⚠️ ARKA PLAN SABİT '#0a0f1e' — colors.bg DEĞİL. Native splash rengi
// app.json'da sabit; açık temadaki kullanıcıda tema rengi kullanılsaydı splash
// koyu, devamı beyaz olur ve kopukluk geri gelirdi.
//
// ⚠️ react-native-reanimated DEĞİL, RN'in yerleşik Animated'ı kullanılıyor:
// yeni native modül gerektirmez, OTA güncellemesiyle sahaya iner
// (yeni expo-* paketi eski build'e inince uygulama çöküyor).
//
// ⚠️ LOGO BEYAZ MADALYON İÇİNDE, resizeMode="contain".
// Logo YATAY bir dikdörtgen (ZNA + TEKNOLOJİ yan yana). Daireye "cover" ile
// kırpılınca ortası kalıp "ZN" görünüyordu. Beyaz daire hem logonun kendi beyaz
// zeminiyle kaynaşıyor hem tamamını gösteriyor.
//
// ⚠️ KAYNAK logo.jpeg DEĞİL, logo-zna.png. Ham JPEG'in içeriği 873x483 tuvalde
// 776x326; çevresinde EŞİT OLMAYAN beyaz boşluk var (üstte 116px, altta 43px).
// Doğrudan kullanılınca logo madalyonun içinde AŞAĞI KAYIYOR ve olduğundan
// küçük görünüyordu. logo-zna.png bu boşluk kırpılmış hâli (oran 2.38).
//
// ⚠️ SİSTEM FONTU — web'deki 'Bricolage Grotesque' DEĞİL. Özel font açılış
// sırasında yüklenir; yüklenene kadar yazı sistem fontuyla çıkıp sonra ZIPLAR,
// yani düzeltmeye çalıştığımız kopukluk geri gelir. Ayrıca expo-font kurulu
// değil (yeni native modül → yeni build). Bricolage giriş ekranına planlandı.
//
// ⚠️ "ZNA Teknoloji" alt yazısı BİLEREK YOK: logonun kendisi zaten
// "ZNA TEKNOLOJİ" yazıyor, altına tekrar yazmak fazlalıktı.
import { useEffect, useRef } from 'react'
import { View, Image, Text, Animated, Easing, StyleSheet } from 'react-native'

const ZEMIN = '#0a0f1e'
const HALKA = 148
const MADALYON = 120

export default function AcilisEkrani() {
  const donus = useRef(new Animated.Value(0)).current
  const belirginlik = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Yumuşak beliriş — native splash ile aramızdaki ölçü farkını yumuşatır
    Animated.timing(belirginlik, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()

    // Kesintisiz dönüş — 1,35 sn/tur. Daha hızlısı telaşlı duruyor.
    const dongu = Animated.loop(
      Animated.timing(donus, {
        toValue: 1,
        duration: 1350,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    dongu.start()
    return () => dongu.stop()
  }, [donus, belirginlik])

  const aci = donus.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={stil.zemin}>
      <Animated.View style={[stil.orta, { opacity: belirginlik }]}>
        <View style={stil.halkaKutu}>
          {/* Soluk çember sabit, üstündeki mavi yay döner */}
          <Animated.View style={[stil.halka, { transform: [{ rotate: aci }] }]} />
          <View style={stil.madalyon}>
            <Image
              source={require('../../assets/logo-zna.png')}
              style={stil.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={stil.slogan}>
          Saha. Servis. Çözüm.{'\n'}
          <Text style={stil.sloganVurgu}>Tek panelde.</Text>
        </Text>
      </Animated.View>
    </View>
  )
}

const stil = StyleSheet.create({
  zemin: {
    flex: 1,
    backgroundColor: ZEMIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  orta: { alignItems: 'center' },
  halkaKutu: {
    width: HALKA,
    height: HALKA,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  halka: {
    position: 'absolute',
    width: HALKA,
    height: HALKA,
    borderRadius: HALKA / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.07)',
    borderTopColor: '#2563eb',
  },
  madalyon: {
    width: MADALYON,
    height: MADALYON,
    borderRadius: MADALYON / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Logo 2.38:1 yatay (kırpılmış hâli); contain ile oranı bozulmadan oturur
  logo: { width: 98, height: 42 },
  slogan: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 24,
    textAlign: 'center',
  },
  sloganVurgu: { color: '#60a5fa' },
})
