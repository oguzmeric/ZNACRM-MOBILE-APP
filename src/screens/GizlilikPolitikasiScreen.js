import { ScrollView, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'

export default function GizlilikPolitikasiScreen() {
  const { colors } = useTheme()
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.baslik, { color: colors.textPrimary }]}>ZNA CRM — Gizlilik Politikası</Text>
        <Text style={[styles.tarih, { color: colors.textFaded }]}>Son güncelleme: 20 Nisan 2026</Text>

        <Bolum
          colors={colors}
          baslik="1. Veri Sorumlusu"
          metin={
            'ZNA Teknoloji, bu uygulama aracılığıyla topladığı kişisel verilerin veri sorumlusudur. ' +
            'İletişim: destek@zna.com.tr'
          }
        />

        <Bolum
          colors={colors}
          baslik="2. Toplanan Veriler"
          metin={
            '• Kimlik bilgileri: ad, soyad, kullanıcı adı, unvan\n' +
            '• İletişim bilgileri: telefon, e-posta (opsiyonel)\n' +
            '• Profil fotoğrafı (opsiyonel — kullanıcı tarafından yüklenirse)\n' +
            '• Uygulama içi oluşturulan iş verileri: servis talepleri, görev notları, fotoğraflar, imzalar, müşteri/lokasyon bilgileri, stok hareketleri\n' +
            '• Teknik veriler: cihaz modeli, işletim sistemi sürümü (hata ayıklama için)'
          }
        />

        <Bolum
          colors={colors}
          baslik="3. Verilerin İşleme Amacı"
          metin={
            '• Kurumsal CRM hizmetinin sağlanması (servis, görev, stok, teklif yönetimi)\n' +
            '• Kullanıcı hesaplarının oluşturulması ve yönetimi\n' +
            '• Saha çalışanlarının iş takibi ve raporlaması\n' +
            '• Yasal yükümlülüklerin yerine getirilmesi'
          }
        />

        <Bolum
          colors={colors}
          baslik="4. Veri Saklama"
          metin={
            'Veriler, Supabase altyapısı üzerinde AB bölgesindeki sunucularda güvenli şekilde saklanır. ' +
            'Şifreler karşılaştırma amaçlı tutulur; parola karmalama (hash) gelecek sürümde uygulanacaktır. ' +
            'Veriler, yasal saklama süreleri boyunca veya kullanıcı silme talebinde bulunana kadar tutulur.'
          }
        />

        <Bolum
          colors={colors}
          baslik="5. Üçüncü Taraflarla Paylaşım"
          metin={
            'Verileriniz; yalnızca hizmet sağlayıcı altyapı ortağımız Supabase ile (veri barındırma) ve yasal zorunluluk halinde resmi makamlarla paylaşılır. ' +
            'Pazarlama amaçlı üçüncü taraf paylaşımı yapılmaz.'
          }
        />

        <Bolum
          colors={colors}
          baslik="6. Kullanıcı Hakları (KVKK 11 & GDPR)"
          metin={
            '• Kişisel verilerin işlenip işlenmediğini öğrenme\n' +
            '• İşlenen veriler hakkında bilgi talep etme\n' +
            '• Verilerin düzeltilmesini/silinmesini isteme\n' +
            '• Verilerin aktarıldığı üçüncü kişileri bilme\n' +
            '• Otomatik sistemlerle yapılan analiz sonucuna itiraz\n\n' +
            'Hesabı Sil: Profil ekranından uygulama içinden hesabınızı silebilirsiniz. ' +
            'Silme işleminden sonra kişisel bilgileriniz anonimleştirilir, ' +
            'ancak iş sürekliliği gereği bağlı servis/görev kayıtları silinmez.'
          }
        />

        <Bolum
          colors={colors}
          baslik="7. Çocukların Gizliliği"
          metin={
            'Uygulama kurumsal kullanım içindir ve 18 yaş altı kullanıcılara yönelik değildir. ' +
            'Bilerek 18 yaş altından veri toplanmaz.'
          }
        />

        <Bolum
          colors={colors}
          baslik="8. Değişiklikler"
          metin={
            'Bu politika gerektiğinde güncellenebilir. Önemli değişikliklerde uygulama içi bildirim yapılır.'
          }
        />

        <Bolum
          colors={colors}
          baslik="9. İletişim"
          metin={
            'Her türlü soru ve talep için: destek@zna.com.tr\n' +
            'Uygulama içi "Destek Talebi" özelliğini de kullanabilirsiniz.'
          }
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
