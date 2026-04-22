import { ScrollView, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'

export default function KullanimKosullariScreen() {
  const { colors } = useTheme()
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.baslik, { color: colors.textPrimary }]}>ZNA CRM — Kullanım Koşulları</Text>
        <Text style={[styles.tarih, { color: colors.textFaded }]}>Son güncelleme: 20 Nisan 2026</Text>

        <Bolum
          colors={colors}
          baslik="1. Kabul"
          metin={
            'Bu uygulamayı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. ' +
            'Koşulları kabul etmiyorsanız uygulamayı kullanmayın.'
          }
        />

        <Bolum
          colors={colors}
          baslik="2. Kullanım Kapsamı"
          metin={
            'ZNA CRM uygulaması, ZNA Teknoloji ve yetkilendirdiği iş ortaklarının kurumsal kullanımına yönelik bir saha yönetim aracıdır. ' +
            'Hesaplar yalnızca yetkili personele açılır; üçüncü şahıslarla paylaşılamaz.'
          }
        />

        <Bolum
          colors={colors}
          baslik="3. Hesap Güvenliği"
          metin={
            '• Kullanıcı adı ve şifrenizin güvenliğinden siz sorumlusunuz.\n' +
            '• Şifrenizi başkalarıyla paylaşmayın.\n' +
            '• Hesabınızda yetkisiz erişim şüphesi varsa hemen destek@zna.com.tr adresine bildirin.'
          }
        />

        <Bolum
          colors={colors}
          baslik="4. Yasaklı Kullanımlar"
          metin={
            'Aşağıdaki davranışlar yasaktır ve hesap kapatma nedeni oluşturur:\n\n' +
            '• Sisteme zarar verme, güvenlik açığı istismarı\n' +
            '• Başkasının hesabını kullanma / taklit etme\n' +
            '• Yanlış/yanıltıcı servis/görev verisi girme\n' +
            '• Müşteri verisini şirket politikalarına aykırı şekilde dışarı çıkarma\n' +
            '• Uygulamanın tersine mühendisliği, klonlanması veya ticarileştirilmesi'
          }
        />

        <Bolum
          colors={colors}
          baslik="5. Fikri Mülkiyet"
          metin={
            'Uygulama, kaynak kodu, arayüzü, logosu ve veritabanı yapısı ZNA Teknoloji mülkiyetindedir. ' +
            'Kullanıcıya yalnızca kullanım için sınırlı, münhasır olmayan bir lisans verilir.'
          }
        />

        <Bolum
          colors={colors}
          baslik="6. Veri Sorumluluğu"
          metin={
            'Uygulama üzerinden girilen tüm iş verileri (servis kayıtları, fotoğraflar, imzalar, notlar) ' +
            'ZNA Teknoloji veya yetkilendirdiği iş ortağının mülkiyetindedir. ' +
            'Kullanıcı, bu verilerin şirket politikasına uygun işlenmesinden sorumludur.'
          }
        />

        <Bolum
          colors={colors}
          baslik="7. Hizmet Değişiklikleri ve Kesintiler"
          metin={
            'ZNA Teknoloji, uygulamanın içeriğini, özelliklerini veya çalışma şartlarını önceden bildirimde bulunmaksızın değiştirme veya durdurma hakkını saklı tutar. ' +
            'Bakım kesintileri için kullanıcılar önceden bilgilendirilmeye çalışılır.'
          }
        />

        <Bolum
          colors={colors}
          baslik="8. Sorumluluk Sınırı"
          metin={
            'ZNA Teknoloji, uygulama kullanımından doğabilecek dolaylı zararlardan (veri kaybı, kâr kaybı vb.) sorumlu tutulamaz. ' +
            'Saha ekipmanlarının fiziksel bakımında son karar kullanıcının teknik bilgisine dayanır.'
          }
        />

        <Bolum
          colors={colors}
          baslik="9. Hesap Kapatma"
          metin={
            'Kullanıcı, profil ekranından uygulama içinden hesabını silebilir. ' +
            'Şirket, koşulların ihlali durumunda hesabı tek taraflı olarak askıya alma veya kapatma hakkını saklı tutar.'
          }
        />

        <Bolum
          colors={colors}
          baslik="10. Uygulanacak Hukuk"
          metin={
            'Bu koşullar Türkiye Cumhuriyeti yasalarına tabidir. Uyuşmazlıklarda İstanbul mahkemeleri yetkilidir.'
          }
        />

        <Bolum
          colors={colors}
          baslik="11. İletişim"
          metin={'destek@zna.com.tr'}
        />
      </ScrollView>
    </ScreenContainer>
  )
}

function Bolum({ baslik, metin, colors }) {
  return (
    <>
      <Text style={[styles.bolumBaslik, { color: colors.textPrimary }]}>{baslik}</Text>
      <Text style={[styles.metin, { color: colors.textSecondary }]}>{metin}</Text>
    </>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  baslik: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  tarih: { fontSize: 12, marginBottom: 20, fontStyle: 'italic' },
  bolumBaslik: { fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  metin: { fontSize: 13, lineHeight: 20 },
})
