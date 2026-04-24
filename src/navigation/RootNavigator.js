import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import LoginScreen from '../screens/LoginScreen'
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
import ServisTalebiDetayScreen from '../screens/ServisTalebiDetayScreen'
import YeniServisTalebiScreen from '../screens/YeniServisTalebiScreen'
import LokasyonFormScreen from '../screens/LokasyonFormScreen'
import TaraScreen from '../screens/TaraScreen'
import CihazDetayScreen from '../screens/CihazDetayScreen'
import YeniCihazScreen from '../screens/YeniCihazScreen'
import StokScreen from '../screens/StokScreen'
import ModelDetayScreen from '../screens/ModelDetayScreen'
import BulkDetayScreen from '../screens/BulkDetayScreen'
import TekliflerScreen from '../screens/TekliflerScreen'
import TeklifDetayScreen from '../screens/TeklifDetayScreen'
import YeniTeklifScreen from '../screens/YeniTeklifScreen'
import MalzemeTeslimAlScreen from '../screens/MalzemeTeslimAlScreen'
import MalzemeKullanScreen from '../screens/MalzemeKullanScreen'
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen'
import AdminPersonelTakipScreen from '../screens/admin/AdminPersonelTakipScreen'
import AdminPersonelDetayScreen from '../screens/admin/AdminPersonelDetayScreen'
import AdminYeniPersonelScreen from '../screens/admin/AdminYeniPersonelScreen'
import AdminOnayKuyruguScreen from '../screens/admin/AdminOnayKuyruguScreen'
import AdminServisAtamaScreen from '../screens/admin/AdminServisAtamaScreen'
import AdminStokRaporuScreen from '../screens/admin/AdminStokRaporuScreen'
import AdminKronikArizaScreen from '../screens/admin/AdminKronikArizaScreen'
import AdminRaporlarScreen from '../screens/admin/AdminRaporlarScreen'
import AdminDestekTalepleriScreen from '../screens/admin/AdminDestekTalepleriScreen'
import { yonetimPaneliErisimi } from '../utils/yetki'

const Stack = createNativeStackNavigator()

export default function RootNavigator() {
  const { kullanici, loading, mod } = useAuth()
  const { colors } = useTheme()
  const adminModu = mod === 'admin' && yonetimPaneliErisimi(kullanici)

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    )
  }

  const navKey = !kullanici ? 'auth' : adminModu ? 'admin' : 'teknisyen'

  return (
    <NavigationContainer key={navKey} theme={navTheme}>
      <Stack.Navigator screenOptions={stackHeader}>
        {!kullanici ? (
          <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
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
            <Stack.Screen name="ServisDetay" component={ServisTalebiDetayScreen} options={{ title: 'Servis Detayı' }} />
            <Stack.Screen name="BulkDetay" component={BulkDetayScreen} options={{ title: 'Stok Detayı' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Ana Sayfa" component={HomeScreen} />
            <Stack.Screen name="Profil" component={ProfilScreen} options={{ title: 'Profil' }} />
            <Stack.Screen name="DestekListe" component={DestekListeScreen} options={{ title: 'Destek Taleplerim' }} />
            <Stack.Screen name="YeniDestek" component={YeniDestekScreen} options={{ title: 'Yeni Destek Talebi' }} />
            <Stack.Screen name="DestekDetay" component={DestekDetayScreen} options={{ title: 'Talep Detayı' }} />
            <Stack.Screen name="Görevler" component={GorevlerScreen} />
            <Stack.Screen name="GörevDetay" component={GorevDetayScreen} options={{ title: 'Görev Detayı' }} />
            <Stack.Screen name="YeniGörev" component={YeniGorevScreen} options={{ title: 'Yeni Görev' }} />
            <Stack.Screen name="Servisler" component={ServisTalepleriScreen} options={{ title: 'Servis Talepleri' }} />
            <Stack.Screen name="ServisDetay" component={ServisTalebiDetayScreen} options={{ title: 'Servis Detayı' }} />
            <Stack.Screen name="YeniServisTalebi" component={YeniServisTalebiScreen} options={{ title: 'Yeni Servis Talebi' }} />
            <Stack.Screen name="MalzemeTeslimAl" component={MalzemeTeslimAlScreen} options={{ title: 'Malzeme Teslim Al' }} />
            <Stack.Screen name="MalzemeKullan" component={MalzemeKullanScreen} options={{ title: 'Sahada Kullan' }} />
            <Stack.Screen name="Tara" component={TaraScreen} options={{ title: 'Cihaz Tara', headerStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="CihazDetay" component={CihazDetayScreen} options={{ title: 'Cihaz Detayı' }} />
            <Stack.Screen name="YeniCihaz" component={YeniCihazScreen} options={{ title: 'Yeni Cihaz Kaydı' }} />
            <Stack.Screen name="Stok" component={StokScreen} />
            <Stack.Screen name="ModelDetay" component={ModelDetayScreen} options={{ title: 'Model Detayı' }} />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
