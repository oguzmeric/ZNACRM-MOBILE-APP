// Gizlilik Politikası — uygulama içi okuma ekranı (Profil → Gizlilik Politikası).
//
// ⚠️ Metin, webdeki src/pages/Gizlilik.jsx (talep.znateknoloji.com/gizlilik) ile
// AYNI olmalı. O adres App Store Connect'in "Privacy Policy URL" alanına
// girilir; mağazadaki politika ile uygulama içindeki politikanın farklı olması
// hem hukuki risk hem de inceleme sorunudur. Biri değişirse diğeri de değişir.
//
// 18.08 düzeltmeleri (ölçülerek): Supabase bölgesi West EU (Ireland) doğrulandı;
// `kullanicilar` tablosunda şifre kolonu OLMADIĞI doğrulandı — eski metindeki
// "parola karmalama gelecek sürümde uygulanacaktır" ifadesi yanlıştı, parolalar
// Supabase Auth'ta hash'li tutuluyor. İletişim adresi de yanlış alan adındaydı
// (zna.com.tr → znateknoloji.com.tr).

import { ScrollView, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'

const DESTEK_EPOSTA = 'destek@znateknoloji.com.tr'

const BOLUMLER = [
  {
    baslik: '1. Veri Sorumlusu',
    metin:
      'ZNA Teknoloji, ZNA CRM uygulaması aracılığıyla işlenen kişisel verilerin 6698 sayılı ' +
      'KVKK anlamında veri sorumlusudur.\n\n' +
      `İletişim: ${DESTEK_EPOSTA}`,
  },
  {
    baslik: '2. Uygulamanın Amacı ve Kullanıcıları',
    metin:
      'ZNA CRM; güvenlik ve bilişim sistemleri kurulum, bakım ve servis süreçlerini yöneten bir ' +
      'saha hizmet uygulamasıdır. İki kullanıcı grubu vardır:\n\n' +
      '• Saha ve ofis personeli: servis talepleri, görevler, keşifler, stok ve mesai takibi\n' +
      '• Müşteriler: kendi arıza/servis taleplerini açma, sürecini izleme ve cihaz envanterini görme\n\n' +
      'Hesaplar kurum yöneticisi tarafından tanımlanır veya davet bağlantısı ile oluşturulur. ' +
      'Uygulama içi satın alma veya reklam yoktur.',
  },
  {
    baslik: '3. Toplanan Veriler',
    metin:
      '• Kimlik bilgileri: ad, soyad, kullanıcı adı, unvan\n' +
      '• İletişim bilgileri: e-posta, telefon\n' +
      '• Profil fotoğrafı (isteğe bağlı — yalnız kullanıcı yüklerse)\n' +
      '• İş verileri: servis talepleri, görev ve keşif kayıtları, fotoğraflar, imzalar, müşteri ve ' +
      'lokasyon bilgileri, stok hareketleri\n' +
      '• Konum verisi (yalnız 4. bölümde sayılan işlemlerde)\n' +
      '• Teknik veriler: cihaz modeli, işletim sistemi sürümü, uygulama sürümü ve hata kayıtları',
  },
  {
    baslik: '4. Konum Verisi',
    metin:
      'Konum yalnızca kullanıcı bir işlemi başlattığı anda, o işlem için alınır. Uygulama arka ' +
      'planda konum takibi YAPMAZ.\n\n' +
      '• Mesai başlatma/bitirme: işlemin tanımlı çalışma noktasında yapıldığının doğrulanması\n' +
      '• Servis ve keşif kaydı: işin yapıldığı adresin kayda geçirilmesi\n' +
      '• Araç fotoğraf kaydı: kaydın nerede alındığının belgelenmesi\n\n' +
      'Konum izni reddedilirse uygulamanın diğer bölümleri çalışmaya devam eder; yalnız yukarıdaki ' +
      'işlemler konum bilgisi olmadan tamamlanamaz.',
  },
  {
    baslik: '5. Kamera ve Fotoğraflar',
    metin:
      'Kamera; barkod/seri numarası okuma ve servis, keşif, bakım kayıtlarına fotoğraf ekleme için ' +
      'kullanılır. Galeri erişimi yalnız kullanıcının seçtiği fotoğrafı yüklemek içindir. Uygulama, ' +
      'kullanıcı seçmediği hiçbir görsele erişmez ve galeriyi taramaz.',
  },
  {
    baslik: '6. Bildirimler',
    metin:
      'Kendisine atanan iş, gelen mesaj ve onay talepleri için anlık bildirim gönderilir. ' +
      'Bildirimler yalnız iş süreçleriyle ilgilidir; pazarlama bildirimi gönderilmez. Bildirim izni ' +
      'reddedilebilir veya sonradan sistem ayarlarından kapatılabilir.',
  },
  {
    baslik: '7. Verilerin İşlenme Amacı ve Hukuki Sebebi',
    metin:
      '• Sözleşmenin kurulması ve ifası: hizmetin sağlanması, iş takibi ve raporlama\n' +
      '• Meşru menfaat: saha operasyonunun denetimi, iş güvenliği ve kalite takibi\n' +
      '• Hukuki yükümlülük: yasal saklama ve bildirim yükümlülükleri',
  },
  {
    baslik: '8. Saklama ve Güvenlik',
    metin:
      'Veriler, Supabase altyapısı üzerinde Avrupa Birliği (İrlanda) bölgesindeki sunucularda ' +
      'barındırılır. Aktarım TLS ile şifrelenir.\n\n' +
      'Parolalar geri döndürülemez biçimde şifrelenerek (hash) saklanır. ZNA Teknoloji personeli ' +
      'dâhil hiç kimse bir kullanıcının parolasını görüntüleyemez.\n\n' +
      'Veriye erişim, satır düzeyinde yetkilendirme (RLS) ile sınırlandırılır: her kullanıcı yalnız ' +
      'yetkili olduğu kayıtları görür. Veriler, yasal saklama süreleri boyunca veya silme talebine ' +
      'kadar tutulur.',
  },
  {
    baslik: '9. Üçüncü Taraflarla Paylaşım',
    metin:
      'Verileriniz pazarlama amacıyla hiçbir üçüncü tarafla paylaşılmaz ve satılmaz. Hizmetin ' +
      'çalışması için yalnız aşağıdaki altyapı sağlayıcıları kullanılır:\n\n' +
      '• Supabase — veri barındırma ve kimlik doğrulama (AB/İrlanda)\n' +
      '• Apple Push Notification service ve Google Firebase Cloud Messaging — bildirim iletimi\n' +
      '• Expo — uygulama sürüm dağıtımı ve güncellemeler\n' +
      '• Sentry — uygulama hata kayıtları (teşhis amaçlı teknik veriler)\n\n' +
      'Ayrıca yasal zorunluluk hâlinde yetkili resmî makamlarla paylaşım yapılabilir.',
  },
  {
    baslik: '10. Haklarınız (KVKK m.11 ve GDPR)',
    metin:
      '• Kişisel verilerinizin işlenip işlenmediğini öğrenme\n' +
      '• İşlenen veriler hakkında bilgi talep etme\n' +
      '• Verilerin düzeltilmesini veya silinmesini isteme\n' +
      '• Verilerin aktarıldığı üçüncü kişileri bilme\n' +
      '• Otomatik sistemlerle yapılan analiz sonucuna itiraz etme\n' +
      '• Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme\n\n' +
      `Taleplerinizi ${DESTEK_EPOSTA} adresine iletebilirsiniz; başvurular en geç 30 gün içinde ` +
      'sonuçlandırılır.',
  },
  {
    baslik: '11. Hesabın Silinmesi',
    metin:
      'Hesabınızı uygulama içinden silebilirsiniz: Profil → Hesabı Sil. Silme sonrasında kimlik ve ' +
      'iletişim bilgileriniz anonimleştirilir ve hesabınızla giriş yapılamaz.\n\n' +
      'İş sürekliliği ve yasal saklama yükümlülüğü nedeniyle, tamamlanmış servis, görev ve stok ' +
      'kayıtlarının kendisi silinmez; bu kayıtlardaki kişi bağlantısı anonim hâle getirilir.',
  },
  {
    baslik: '12. Çocukların Gizliliği',
    metin:
      'Uygulama kurumsal kullanım içindir ve 18 yaş altındaki kullanıcılara yönelik değildir. ' +
      'Bilerek 18 yaş altından veri toplanmaz.',
  },
  {
    baslik: '13. Değişiklikler',
    metin:
      'Bu politika gerektiğinde güncellenir. Önemli değişikliklerde uygulama içi bildirim yapılır ve ' +
      'bu sayfadaki güncelleme tarihi değiştirilir.',
  },
  {
    baslik: '14. İletişim',
    metin:
      `Her türlü soru ve talep için: ${DESTEK_EPOSTA}\n` +
      'Ayrıntılı yardım sayfası: talep.znateknoloji.com/yardim',
  },
]

export default function GizlilikPolitikasiScreen() {
  const { colors } = useTheme()
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.baslik, { color: colors.textPrimary }]}>ZNA CRM — Gizlilik Politikası</Text>
        <Text style={[styles.tarih, { color: colors.textFaded }]}>Son güncelleme: 18 Ağustos 2026</Text>

        {BOLUMLER.map((b) => (
          <Bolum key={b.baslik} colors={colors} baslik={b.baslik} metin={b.metin} />
        ))}
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
