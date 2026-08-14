// Açılış ekranı — native splash'in KESİNTİSİZ devamı.
//
// Eskiden: native splash (koyu zemin + logo) → bir anda BOŞ ekran + küçük
// ActivityIndicator → uygulama. Üç ayrı görüntü, arada kopukluk; kullanıcı
// "takıldı mı?" diye düşünüyordu.
//
// Şimdi: aynı zemin, aynı logo, logonun etrafında dönen ince bir halka.
// Kullanıcı tek bir açılış görür.
//
// ⚠️ ARKA PLAN SABİT '#0a0f1e' — colors.bg DEĞİL. Native splash rengi
// app.json'da sabit; açık temadaki kullanıcıda tema rengi kullanılsaydı splash
// koyu, devamı beyaz olur ve kopukluk geri gelirdi.
//
// ⚠️ react-native-reanimated DEĞİL, RN'in yerleşik Animated'ı kullanılıyor:
// yeni native modül gerektirmez, OTA güncellemesiyle sahaya iner
// (yeni expo-* paketi eski build'e inince uygulama çöküyor).
//
// ⚠️ LOGO TAM DAİRE (borderRadius = boyutun yarısı). Bu yalnız biçim tercihi
// değil: assets/logo.jpeg ŞEFFAF DEĞİL, köşelerinde gri bir kutu taşıyor.
// Daireye kırpılınca o köşeler kayboluyor — app.json'daki splash görselini
// PNG'ye çevirmek için yeni build beklemeye gerek kalmıyor.
import { useEffect, useRef } from 'react'
import { View, Image, Text, Animated, Easing, StyleSheet } from 'react-native'

const ZEMIN = '#0a0f1e'
const LOGO = 96
const HALKA = 124

export default function AcilisEkrani() {
  const donus = useRef(new Animated.Value(0)).current
  const belirginlik = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Logo yumuşak belirir — native splash ile aramızdaki ölçü farkını yumuşatır
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
          <Image
            source={require('../../assets/logo.jpeg')}
            style={stil.logo}
            resizeMode="cover"
          />
        </View>

        <Text style={stil.marka}>ZNA Teknoloji</Text>
        <Text style={stil.altMarka}>Yönetim Sistemi</Text>
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
  },
  orta: { alignItems: 'center' },
  halkaKutu: {
    width: HALKA,
    height: HALKA,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  logo: {
    width: LOGO,
    height: LOGO,
    // ⚠️ Tam daire — köşelerdeki gri kutuyu kırpar (yukarıdaki nota bakın)
    borderRadius: LOGO / 2,
  },
  marka: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  altMarka: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '400',
    marginTop: 3,
  },
})
