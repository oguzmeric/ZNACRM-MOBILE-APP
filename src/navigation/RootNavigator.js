import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native'

// Push bildirimine dokununca App.js'in navigasyon yapabilmesi için global ref
export const navigationRef = createNavigationContainerRef()
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import AcilisEkrani from '../components/AcilisEkrani'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LoginScreen from '../screens/LoginScreen'
import KayitScreen from '../screens/KayitScreen'
import SifreSifirlaScreen from '../screens/SifreSifirlaScreen'
import HomeScreen from '../screens/HomeScreen'
import ProfilScreen from '../screens/ProfilScreen'
import DestekListeScreen from '../screens/DestekListeScreen'
import GizlilikPolitikasiScreen from '../screens/GizlilikPolitikasiScreen'
import KullanimKosullariScreen from '../screens/KullanimKosullariScreen'
import HesabiSilScreen from '../screens/HesabiSilScreen'
import YeniDestekScreen from '../screens/YeniDestekScreen'
import DestekDetayScreen from '../screens/DestekDetayScreen'
import PlaceholderScreen from '../screens/PlaceholderScreen'
import GorevlerScreen from '../screens/GorevlerScreen'
import GorevDetayScreen from '../screens/GorevDetayScreen'
import YeniGorevScreen from '../screens/YeniGorevScreen'
import MusterilerScreen from '../screens/MusterilerScreen'
import MusteriDetayScreen from '../screens/MusteriDetayScreen'
import YeniMusteriScreen from '../screens/YeniMusteriScreen'
import KisiFormScreen from '../screens/KisiFormScreen'
import ServisTalepleriScreen from '../screens/ServisTalepleriScreen'
import BakimIslerimScreen from '../screens/BakimIslerimScreen'
import BakimYapScreen from '../screens/BakimYapScreen'
import YeniTopluBakimScreen from '../screens/YeniTopluBakimScreen'
import IzinBordroScreen from '../screens/IzinBordroScreen'
import ServisTalebiDetayScreen from '../screens/ServisTalebiDetayScreen'
import YeniServisTalebiScreen from '../screens/YeniServisTalebiScreen'
import LokasyonFormScreen from '../screens/LokasyonFormScreen'
import GorusmelerScreen from '../screens/GorusmelerScreen'
import YeniGorusmeScreen from '../screens/YeniGorusmeScreen'
import GorusmeDetayScreen from '../screens/GorusmeDetayScreen'
import BildirimlerScreen from '../screens/BildirimlerScreen'
import SohbetScreen from '../screens/SohbetScreen'
import SohbetlerScreen from '../screens/SohbetlerScreen'
import DemolarScreen from '../screens/DemolarScreen'
import NotlarimScreen from '../screens/NotlarimScreen'
import NotDuzenleScreen from '../screens/NotDuzenleScreen'
import TakvimScreen from '../screens/TakvimScreen'
// NotCizimScreen artık Modal olarak NotDuzenleScreen içinde kullanılıyor
import DemoCihazDetayScreen from '../screens/DemoCihazDetayScreen'
import YeniDemoCihazScreen from '../screens/YeniDemoCihazScreen'
import YeniDemoZimmetScreen from '../screens/YeniDemoZimmetScreen'
import TaraScreen from '../screens/TaraScreen'
import CihazDetayScreen from '../screens/CihazDetayScreen'
import YeniCihazScreen from '../screens/YeniCihazScreen'
import StokScreen from '../screens/StokScreen'
import MobiltekScreen from '../screens/MobiltekScreen'
import AracRotaScreen from '../screens/AracRotaScreen'
import SozlesmeKapisi from '../components/SozlesmeKapisi'
import SozlesmeEkrani from '../screens/SozlesmeEkrani'
import CanliKameraScreen from '../screens/CanliKameraScreen'
import MesaiGecmisiScreen from '../screens/MesaiGecmisiScreen'
import AracKayitScreen from '../screens/AracKayitScreen'
import AracFotoDetayScreen from '../screens/AracFotoDetayScreen'
import KesiflerScreen from '../screens/KesiflerScreen'
import YeniKesifScreen from '../screens/YeniKesifScreen'
import KesifDetayScreen from '../screens/KesifDetayScreen'
import ModelDetayScreen from '../screens/ModelDetayScreen'
import SeriTaraScreen from '../screens/SeriTaraScreen'
import ArizaliCihazScreen from '../screens/ArizaliCihazScreen'
import BulkDetayScreen from '../screens/BulkDetayScreen'
import TekliflerScreen from '../screens/TekliflerScreen'
import TeklifDetayScreen from '../screens/TeklifDetayScreen'
import YeniTeklifScreen from '../screens/YeniTeklifScreen'
import MalzemeKullanScreen from '../screens/MalzemeKullanScreen'
import ServisFaturaHazirlaScreen from '../screens/ServisFaturaHazirlaScreen'
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen'
import AdminPersonelTakipScreen from '../screens/admin/AdminPersonelTakipScreen'
import AdminPersonelDetayScreen from '../screens/admin/AdminPersonelDetayScreen'
import AdminYeniPersonelScreen from '../screens/admin/AdminYeniPersonelScreen'
import AdminOnayKuyruguScreen from '../screens/admin/AdminOnayKuyruguScreen'
import AdminKullaniciOnayScreen from '../screens/admin/AdminKullaniciOnayScreen'
import AdminServisAtamaScreen from '../screens/admin/AdminServisAtamaScreen'
import AdminStokRaporuScreen from '../screens/admin/AdminStokRaporuScreen'
import AdminKronikArizaScreen from '../screens/admin/AdminKronikArizaScreen'
import AdminRaporlarScreen from '../screens/admin/AdminRaporlarScreen'
import AdminDestekTalepleriScreen from '../screens/admin/AdminDestekTalepleriScreen'
import AdminMenuYetkileriScreen from '../screens/admin/AdminMenuYetkileriScreen'
import AdminAktivitelerScreen from '../screens/admin/AdminAktivitelerScreen'
import AdminPersonelStokScreen from '../screens/admin/AdminPersonelStokScreen'
import { yonetimPaneliErisimi } from '../utils/yetki'
import MagicTabBar from '../components/MagicTabBar'
import MusteriAnaScreen from '../screens/musteri/MusteriAnaScreen'
import MusteriTaleplerimScreen from '../screens/musteri/MusteriTaleplerimScreen'
import MusteriTalepDetayScreen from '../screens/musteri/MusteriTalepDetayScreen'
import MusteriYeniTalepScreen from '../screens/musteri/MusteriYeniTalepScreen'
import MusteriCihazlarimScreen from '../screens/musteri/MusteriCihazlarimScreen'
import MusteriTeklifIsteScreen from '../screens/musteri/MusteriTeklifIsteScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// Müşteri portalı sekmeleri — portal hesabı (tip='musteri') PERSONEL
// arayüzünü GÖRMEZ; webdeki MusteriLayout menüsünün mobil karşılığı.
function MusteriTabs() {
  const { colors } = useTheme()
  return (
    <Tab.Navigator
      tabBar={(props) => <MagicTabBar {...props} />}
      screenOptions={() => ({
        headerShown: false,
        freezeOnBlur: true,   // TeknisyenTabs ile aynı gerekçe (19.08 perf)
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
      })}
    >
      <Tab.Screen name="Ana Sayfa" component={MusteriAnaScreen} />
      <Tab.Screen name="Taleplerim" component={MusteriTaleplerimScreen} options={{ headerShown: true, title: 'Taleplerim' }} />
      <Tab.Screen name="Cihazlarım" component={MusteriCihazlarimScreen} options={{ headerShown: true, title: 'Cihazlarım' }} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  )
}

function TeknisyenTabs() {
  const { colors } = useTheme()
  return (
    <Tab.Navigator
      tabBar={(props) => <MagicTabBar {...props} />}
      screenOptions={() => ({
        headerShown: false,
        // ⚠️ freezeOnBlur (19.08 performans denetimi): sekmeler bir kez açılınca
        // ASLA unmount olmuyor. Bu ayar olmadan altı ekran birden canlı kalıyor
        // ve odak dışındayken bile render/realtime/timer işlemeye devam ediyor.
        // react-native-screens ile odak dışı ekranın render'ı dondurulur —
        // state korunur, geri dönüşte yeniden yükleme olmaz.
        freezeOnBlur: true,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerTintColor: colors.textPrimary,
      })}
    >
      <Tab.Screen
        name="Ana Sayfa"
        component={HomeScreen}
        options={{ tabBarStyle: { display: 'none' } }}
      />
      <Tab.Screen name="Görevler" component={GorevlerScreen} options={{ headerShown: true, title: 'Görevler' }} />
      <Tab.Screen name="Servisler" component={ServisTalepleriScreen} options={{ headerShown: true, title: 'Servisler' }} />
      {/* Sohbet — personel yazışması, yetki gerektirmez.
          DİKKAT: gerçek sekme çubuğu BURASI (BottomTabs.js kullanılmıyordu). */}
      <Tab.Screen name="Sohbet" component={SohbetlerScreen} />
      <Tab.Screen name="Tara" component={TaraScreen} options={{ headerShown: true, title: 'Cihaz Tara', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  const { kullanici, loading, mod } = useAuth()
  const { colors } = useTheme()
  const adminModu = mod === 'admin' && yonetimPaneliErisimi(kullanici)
  // Müşteri portalı hesabı (tip='musteri') — web App.jsx ile aynı ayrım.
  // Eskiden özel dal yoktu: portal hesabı TEKNİSYEN arayüzüne düşüyor,
  // depo/stok/görev gibi personel ekranlarını görüyordu (21.08 bildirimi).
  const musteriModu = kullanici?.tip === 'musteri'

  const navTheme = {
    ...DefaultTheme,
    dark: colors.mod === 'gece',
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  }

  const stackHeader = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontWeight: '700' },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',  // iOS'ta sadece ok; text yok
    headerBackTitle: '',
  }

  // Native splash'in kesintisiz devamı — boş ekran + spinner yerine markalı
  // açılış. Ayrıntı ve gerekçe: src/components/AcilisEkrani.js
  if (loading) return <AcilisEkrani />

  const navKey = !kullanici ? 'auth' : musteriModu ? 'musteri' : adminModu ? 'admin' : 'teknisyen'

  return (
    // Zorunlu sözleşme onayı (mig 264/265): onaylamamış PERSONEL uygulamayı
    // kullanamaz. Kapsam kapısı sunucuda — müşteri/bayi hesapları etkilenmez.
    <SozlesmeKapisi>
    <NavigationContainer key={navKey} theme={navTheme} ref={navigationRef}>
      <Stack.Navigator screenOptions={stackHeader}>
        {!kullanici ? (
          <>
            <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Kayıt" component={KayitScreen} options={{ title: 'Hesap Oluştur' }} />
            <Stack.Screen name="SifreSifirla" component={SifreSifirlaScreen} options={{ title: 'Şifre Sıfırla' }} />
          </>
        ) : musteriModu ? (
          <>
            {/* ── MÜŞTERİ PORTALI ── webdeki 5 menünün mobil karşılığı.
                'ServisDetay' adı BİLEREK korunur: push bildirimi
                (/servis-talepleri/<id> → ServisDetay) portal hesabında da
                doğru ekrana düşer (bildirimLink.js değişmeden). */}
            <Stack.Screen name="MusteriAna" component={MusteriTabs} options={{ headerShown: false }} />
            <Stack.Screen name="ServisDetay" component={MusteriTalepDetayScreen} options={{ title: 'Talep Detayı' }} />
            <Stack.Screen name="YeniTalep" component={MusteriYeniTalepScreen} options={{ title: 'Yeni Talep' }} />
            <Stack.Screen name="TeklifIste" component={MusteriTeklifIsteScreen} options={{ title: 'Teklif İste' }} />
            {/* 'Taleplerim' ve 'Cihazlarım' SEKMEDE kayıtlı — stack'e İKİNCİ
                kez kaydetme (aynı ad iki navigator'da = navigate yanlış
                kopyayı bulur; SohbetDetay dersi). */}
            <Stack.Screen name="Bildirimler" component={BildirimlerScreen} options={{ title: 'Bildirimler' }} />
            {/* ProfilScreen'in navigate hedefleri (tip='musteri' görünümünde) */}
            <Stack.Screen name="DestekListe" component={DestekListeScreen} options={{ title: 'Destek Taleplerim' }} />
            <Stack.Screen name="YeniDestek" component={YeniDestekScreen} options={{ title: 'Yeni Destek Talebi' }} />
            <Stack.Screen name="DestekDetay" component={DestekDetayScreen} options={{ title: 'Talep Detayı' }} />
            <Stack.Screen name="GizlilikPolitikasi" component={GizlilikPolitikasiScreen} options={{ title: 'Gizlilik Politikası' }} />
            <Stack.Screen name="KullanimKosullari" component={KullanimKosullariScreen} options={{ title: 'Kullanım Koşulları' }} />
            <Stack.Screen name="HesabiSil" component={HesabiSilScreen} options={{ title: 'Hesabı Sil' }} />
          </>
        ) : adminModu ? (
          <>
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
              options={{ headerShown: false, title: 'Yönetim' }}
            />
            <Stack.Screen name="Profil" component={ProfilScreen} options={{ title: 'Profil' }} />
            <Stack.Screen name="GizlilikPolitikasi" component={GizlilikPolitikasiScreen} options={{ title: 'Gizlilik Politikası' }} />
            <Stack.Screen name="KullanimKosullari" component={KullanimKosullariScreen} options={{ title: 'Kullanım Koşulları' }} />
            <Stack.Screen name="HesabiSil" component={HesabiSilScreen} options={{ title: 'Hesabı Sil' }} />
            <Stack.Screen name="DestekListe" component={DestekListeScreen} options={{ title: 'Destek Taleplerim' }} />
            <Stack.Screen name="YeniDestek" component={YeniDestekScreen} options={{ title: 'Yeni Destek Talebi' }} />
            <Stack.Screen name="DestekDetay" component={DestekDetayScreen} options={{ title: 'Talep Detayı' }} />
            <Stack.Screen name="AdminPersonelTakip" component={AdminPersonelTakipScreen} options={{ title: 'Personel Takip' }} />
            <Stack.Screen name="AdminPersonelDetay" component={AdminPersonelDetayScreen} options={{ title: 'Personel Detayı' }} />
            <Stack.Screen name="AdminYeniPersonel" component={AdminYeniPersonelScreen} options={{ title: 'Yeni Personel' }} />
            <Stack.Screen name="AdminOnayKuyrugu" component={AdminOnayKuyruguScreen} options={{ title: 'Onay Kuyruğu' }} />
            <Stack.Screen name="AdminKullaniciOnay" component={AdminKullaniciOnayScreen} options={{ title: 'Kullanıcı Onayları' }} />
            <Stack.Screen name="AdminServisAtama" component={AdminServisAtamaScreen} options={{ title: 'Servis Atama' }} />
            <Stack.Screen name="YeniServisTalebi" component={YeniServisTalebiScreen} options={{ title: 'Yeni Servis Talebi' }} />
            <Stack.Screen name="YeniKişi" component={KisiFormScreen} options={{ title: 'Yeni İlgili Kişi' }} />
            <Stack.Screen name="KişiDüzenle" component={KisiFormScreen} options={{ title: 'Kişiyi Düzenle' }} />
            <Stack.Screen name="YeniLokasyon" component={LokasyonFormScreen} options={{ title: 'Yeni Lokasyon' }} />
            <Stack.Screen name="LokasyonDuzenle" component={LokasyonFormScreen} options={{ title: 'Lokasyonu Düzenle' }} />
            <Stack.Screen name="Müşteriler" component={MusterilerScreen} />
            <Stack.Screen name="MüşteriDetay" component={MusteriDetayScreen} options={{ title: 'Müşteri Detayı' }} />
            <Stack.Screen name="YeniMüşteri" component={YeniMusteriScreen} options={{ title: 'Yeni Müşteri' }} />
            <Stack.Screen name="MüşteriDüzenle" component={YeniMusteriScreen} options={{ title: 'Müşteriyi Düzenle' }} />
            <Stack.Screen name="Görevler" component={GorevlerScreen} />
            <Stack.Screen name="GörevDetay" component={GorevDetayScreen} options={{ title: 'Görev Detayı' }} />
            <Stack.Screen name="YeniGörev" component={YeniGorevScreen} options={{ title: 'Yeni Görev' }} />
            <Stack.Screen name="AdminStokRaporu" component={AdminStokRaporuScreen} options={{ title: 'Stok Raporu' }} />
            <Stack.Screen name="AdminKronikAriza" component={AdminKronikArizaScreen} options={{ title: 'Kronik Arıza' }} />
            <Stack.Screen name="AdminRaporlar" component={AdminRaporlarScreen} options={{ title: 'Raporlar' }} />
            <Stack.Screen name="AdminDestekTalepleri" component={AdminDestekTalepleriScreen} options={{ title: 'Destek Talepleri' }} />
            <Stack.Screen name="AdminMenuYetkileri" component={AdminMenuYetkileriScreen} options={{ title: 'Menü Yetkileri' }} />
            <Stack.Screen name="AdminAktiviteler" component={AdminAktivitelerScreen} options={{ title: 'Tüm Aktiviteler' }} />
            <Stack.Screen name="AdminPersonelStok" component={AdminPersonelStokScreen} options={{ title: 'Üzerindeki Stok' }} />
            {/* Depom = aynı ekranın KİŞİSEL kapısı (kisisel: true param'ıyla) */}
            <Stack.Screen name="Depom" component={AdminPersonelStokScreen} options={{ title: 'Depom' }} />
            <Stack.Screen name="ServisDetay" component={ServisTalebiDetayScreen} options={{ title: 'Servis Detayı' }} />
            <Stack.Screen name="ServisFaturaHazirla" component={ServisFaturaHazirlaScreen} options={{ title: 'Servis Faturası' }} />
            <Stack.Screen name="Servisler" component={ServisTalepleriScreen} options={{ title: 'Servis Talepleri' }} />
            <Stack.Screen name="BakimIslerim" component={BakimIslerimScreen} options={{ title: 'Bakım İşlerim' }} />
            <Stack.Screen name="BakimYap" component={BakimYapScreen} options={{ title: 'Toplu Bakım' }} />
            <Stack.Screen name="YeniTopluBakim" component={YeniTopluBakimScreen} options={{ title: 'Yeni Toplu Bakım' }} />
            <Stack.Screen name="IzinBordro" component={IzinBordroScreen} options={{ title: 'İzin & Bordro' }} />
            <Stack.Screen name="BulkDetay" component={BulkDetayScreen} options={{ title: 'Stok Detayı' }} />
            {/* 22.08 denetimi: admin dalında KAYITLI DEĞİLDİ — Üzerindeki Stok/Kronik Arıza/Müşteri Detayı/Stok Raporu
                ve bildirim hedefleri (görüşme/teklif/sözleşme) yönetici modunda sessizce açılmıyordu. */}
            <Stack.Screen name="CihazDetay" component={CihazDetayScreen} options={{ title: 'Cihaz Detayı' }} />
            <Stack.Screen name="ArizaliCihaz" component={ArizaliCihazScreen} options={{ title: 'Müşteri Cihazı (SN)' }} />
            <Stack.Screen name="ModelDetay" component={ModelDetayScreen} options={{ title: 'Model Detayı' }} />
            <Stack.Screen name="SeriTara" component={SeriTaraScreen} options={{ title: 'Seri Tara' }} />
            <Stack.Screen name="GorusmeDetay" component={GorusmeDetayScreen} options={{ title: 'Görüşme Detayı' }} />
            <Stack.Screen name="TeklifDetay" component={TeklifDetayScreen} options={{ title: 'Teklif Detayı' }} />
            <Stack.Screen name="KullaniciSozlesmesi" component={SozlesmeEkrani} options={{ title: 'Kullanıcı Sözleşmesi', headerShown: true }} />
            <Stack.Screen name="MalzemeKullan" component={MalzemeKullanScreen} options={{ title: 'Sahada Kullan' }} />
            <Stack.Screen name="Bildirimler" component={BildirimlerScreen} options={{ title: 'Bildirimler' }} />
            {/* Sohbet LİSTESİ alt sekmede (BottomTabs) — burada kayıtlı değil:
                useBottomTabBarHeight() sekme bağlamı olmadan hata verir. */}
            {/* SohbetScreen kendi başlık barını çiziyor — çift başlık olmasın */}
            {/* Adı "Sohbet" DEĞİL: sekmedeki liste ekranının adı "Sohbet".
                İkisi aynı adı taşıyınca navigate('Sohbet') en yakın
                navigator'daki LİSTEYİ buluyordu → satıra basınca hiçbir şey
                olmuyordu (kullanıcı: "mesajlara tıklayamıyorum"). */}
            <Stack.Screen name="SohbetDetay" component={SohbetScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Demolar" component={DemolarScreen} options={{ title: 'Demo Takip' }} />
            <Stack.Screen name="Notlarim" component={NotlarimScreen} options={{ title: 'Notlarım' }} />
            <Stack.Screen name="NotDuzenle" component={NotDuzenleScreen} options={{ title: 'Not' }} />
            <Stack.Screen name="Takvim" component={TakvimScreen} options={{ title: 'Takvim' }} />
            {/* NotCizim artık Modal — RootNavigator'dan kaldırıldı */}
            <Stack.Screen name="DemoCihazDetay" component={DemoCihazDetayScreen} options={{ title: 'Cihaz Detayı' }} />
            <Stack.Screen name="YeniDemoCihaz" component={YeniDemoCihazScreen} options={{ title: 'Yeni Demo Cihazı' }} />
            <Stack.Screen name="YeniDemoZimmet" component={YeniDemoZimmetScreen} options={{ title: 'Yeni Zimmet' }} />
          </>
        ) : (
          <>
            {/* Bottom tab — Ana Sayfa + Görevler + Servisler + Tara + Profil */}
            <Stack.Screen name="TeknisyenAna" component={TeknisyenTabs} options={{ headerShown: false }} />
            <Stack.Screen name="DestekListe" component={DestekListeScreen} options={{ title: 'Destek Taleplerim' }} />
            <Stack.Screen name="YeniDestek" component={YeniDestekScreen} options={{ title: 'Yeni Destek Talebi' }} />
            <Stack.Screen name="DestekDetay" component={DestekDetayScreen} options={{ title: 'Talep Detayı' }} />
            <Stack.Screen name="GörevDetay" component={GorevDetayScreen} options={{ title: 'Görev Detayı' }} />
            <Stack.Screen name="YeniGörev" component={YeniGorevScreen} options={{ title: 'Yeni Görev' }} />
            <Stack.Screen name="ServisDetay" component={ServisTalebiDetayScreen} options={{ title: 'Servis Detayı' }} />
            <Stack.Screen name="YeniServisTalebi" component={YeniServisTalebiScreen} options={{ title: 'Yeni Servis Talebi' }} />
            <Stack.Screen name="BakimIslerim" component={BakimIslerimScreen} options={{ title: 'Bakım İşlerim' }} />
            <Stack.Screen name="BakimYap" component={BakimYapScreen} options={{ title: 'Toplu Bakım' }} />
            <Stack.Screen name="YeniTopluBakim" component={YeniTopluBakimScreen} options={{ title: 'Yeni Toplu Bakım' }} />
            <Stack.Screen name="IzinBordro" component={IzinBordroScreen} options={{ title: 'İzin & Bordro' }} />
            <Stack.Screen name="MalzemeKullan" component={MalzemeKullanScreen} options={{ title: 'Sahada Kullan' }} />
            <Stack.Screen name="ServisFaturaHazirla" component={ServisFaturaHazirlaScreen} options={{ title: 'Servis Faturası' }} />
            <Stack.Screen name="CihazDetay" component={CihazDetayScreen} options={{ title: 'Cihaz Detayı' }} />
            <Stack.Screen name="YeniCihaz" component={YeniCihazScreen} options={{ title: 'Yeni Cihaz Kaydı' }} />
            <Stack.Screen name="Stok" component={StokScreen} />
            {/* Depom — teknisyenin üzerindeki S/N'li malzemeler (21.08 saha isteği) */}
            <Stack.Screen name="Depom" component={AdminPersonelStokScreen} options={{ title: 'Depom', headerShown: true }} />
            <Stack.Screen name="Mobiltek" component={MobiltekScreen} options={{ title: 'Mobiltek', headerShown: true }} />
            <Stack.Screen name="AracRota" component={AracRotaScreen} options={{ title: 'Rota Geçmişi', headerShown: true }} />
            <Stack.Screen name="KullaniciSozlesmesi" component={SozlesmeEkrani} options={{ title: 'Kullanıcı Sözleşmesi', headerShown: true }} />
            <Stack.Screen name="CanliKamera" component={CanliKameraScreen} options={{ title: 'Canlı Kamera', headerShown: true }} />
            <Stack.Screen name="MesaiGecmisi" component={MesaiGecmisiScreen} options={{ title: 'Mesai Geçmişi', headerShown: true }} />
            <Stack.Screen name="AracKayit" component={AracKayitScreen} options={{ title: 'Araç Foto Kayıt', headerShown: true }} />
            <Stack.Screen name="AracFotoDetay" component={AracFotoDetayScreen} options={{ title: 'Foto Kayıt', headerShown: true }} />
            <Stack.Screen name="Kesifler" component={KesiflerScreen} options={{ title: 'Keşifler', headerShown: true }} />
            <Stack.Screen name="YeniKesif" component={YeniKesifScreen} options={{ title: 'Yeni Keşif', headerShown: true }} />
            <Stack.Screen name="KesifDetay" component={KesifDetayScreen} options={{ title: 'Keşif Detayı', headerShown: true }} />
            <Stack.Screen name="ModelDetay" component={ModelDetayScreen} options={{ title: 'Model Detayı' }} />
            <Stack.Screen name="SeriTara" component={SeriTaraScreen} options={{ title: 'Seri Tara' }} />
            <Stack.Screen name="ArizaliCihaz" component={ArizaliCihazScreen} options={{ title: 'Müşteri Cihazı (SN)' }} />
            <Stack.Screen name="BulkDetay" component={BulkDetayScreen} options={{ title: 'Stok Detayı' }} />
            <Stack.Screen name="Teklif" component={TekliflerScreen} options={{ title: 'Teklifler' }} />
            <Stack.Screen name="TeklifDetay" component={TeklifDetayScreen} options={{ title: 'Teklif Detayı' }} />
            <Stack.Screen name="YeniTeklif" component={YeniTeklifScreen} options={{ title: 'Yeni Teklif' }} />
            <Stack.Screen name="Müşteriler" component={MusterilerScreen} />
            <Stack.Screen name="MüşteriDetay" component={MusteriDetayScreen} options={{ title: 'Müşteri Detayı' }} />
            <Stack.Screen name="YeniMüşteri" component={YeniMusteriScreen} options={{ title: 'Yeni Müşteri' }} />
            <Stack.Screen name="MüşteriDüzenle" component={YeniMusteriScreen} options={{ title: 'Müşteriyi Düzenle' }} />
            <Stack.Screen name="YeniKişi" component={KisiFormScreen} options={{ title: 'Yeni İlgili Kişi' }} />
            <Stack.Screen name="KişiDüzenle" component={KisiFormScreen} options={{ title: 'Kişiyi Düzenle' }} />
            <Stack.Screen name="YeniLokasyon" component={LokasyonFormScreen} options={{ title: 'Yeni Lokasyon' }} />
            <Stack.Screen name="LokasyonDuzenle" component={LokasyonFormScreen} options={{ title: 'Lokasyonu Düzenle' }} />
            <Stack.Screen name="GizlilikPolitikasi" component={GizlilikPolitikasiScreen} options={{ title: 'Gizlilik Politikası' }} />
            <Stack.Screen name="KullanimKosullari" component={KullanimKosullariScreen} options={{ title: 'Kullanım Koşulları' }} />
            <Stack.Screen name="HesabiSil" component={HesabiSilScreen} options={{ title: 'Hesabı Sil' }} />
            <Stack.Screen name="Gorusmeler" component={GorusmelerScreen} options={{ title: 'Görüşmelerim' }} />
            <Stack.Screen name="YeniGorusme" component={YeniGorusmeScreen} options={{ title: 'Yeni Görüşme' }} />
            <Stack.Screen name="GorusmeDetay" component={GorusmeDetayScreen} options={{ title: 'Görüşme Detayı' }} />
            <Stack.Screen name="Bildirimler" component={BildirimlerScreen} options={{ title: 'Bildirimler' }} />
            {/* Sohbet LİSTESİ alt sekmede (BottomTabs) — burada kayıtlı değil:
                useBottomTabBarHeight() sekme bağlamı olmadan hata verir. */}
            {/* SohbetScreen kendi başlık barını çiziyor — çift başlık olmasın */}
            {/* Adı "Sohbet" DEĞİL: sekmedeki liste ekranının adı "Sohbet".
                İkisi aynı adı taşıyınca navigate('Sohbet') en yakın
                navigator'daki LİSTEYİ buluyordu → satıra basınca hiçbir şey
                olmuyordu (kullanıcı: "mesajlara tıklayamıyorum"). */}
            <Stack.Screen name="SohbetDetay" component={SohbetScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Demolar" component={DemolarScreen} options={{ title: 'Demo Takip' }} />
            <Stack.Screen name="Notlarim" component={NotlarimScreen} options={{ title: 'Notlarım' }} />
            <Stack.Screen name="NotDuzenle" component={NotDuzenleScreen} options={{ title: 'Not' }} />
            <Stack.Screen name="Takvim" component={TakvimScreen} options={{ title: 'Takvim' }} />
            {/* NotCizim artık Modal — RootNavigator'dan kaldırıldı */}
            <Stack.Screen name="DemoCihazDetay" component={DemoCihazDetayScreen} options={{ title: 'Cihaz Detayı' }} />
            <Stack.Screen name="YeniDemoCihaz" component={YeniDemoCihazScreen} options={{ title: 'Yeni Demo Cihazı' }} />
            <Stack.Screen name="YeniDemoZimmet" component={YeniDemoZimmetScreen} options={{ title: 'Yeni Zimmet' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </SozlesmeKapisi>
  )
}
