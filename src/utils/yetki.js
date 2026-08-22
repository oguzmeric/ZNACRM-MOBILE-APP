// Kullanıcı yetkileri — TEK KAYNAK: rol + moduller (kullanicilar tablosu).
//
// 🔴 22.08 GÜVENLİK DÜZELTMESİ: bu dosya eskiden yetkiyi UNVAN METNİNDEN
// okuyordu ('Genel Müdür', 'Teknik Müdür'...). Kişi kendi unvanını Profil
// ekranından yazabildiği için bu bir YETKİ YÜKSELTME yoluydu (teknisyen
// unvanını değiştirip yönetim paneline girebiliyordu). Artık web ve DB ile
// aynı kural geçerli: rol='admin' AND tip='zna' (mig 246 is_admin / mig 323).
// Unvan bundan sonra yalnız İK etiketidir ve yalnız yönetici atayabilir.

// Yönetim paneli (admin mod) erişimi — web MainLayout ve DB is_admin() ile aynı.
export const yonetimPaneliErisimi = (kullanici) => {
  if (!kullanici) return false
  return kullanici.rol === 'admin' && (kullanici.tip ?? 'zna') === 'zna'
}

// Sayım yetkisi — yönetim + 'stok' modülü olan depo personeli.
// Eski unvan listesi (Admin / Teknik Müdür / Depo Sorumlusu) kaldırıldı:
// unvanı yazılmamış depocular sayım yapamıyordu, yetki de unvana bağlıydı.
export const sayimYapabilir = (kullanici) => {
  if (!kullanici) return false
  if (yonetimPaneliErisimi(kullanici)) return true
  return Array.isArray(kullanici.moduller) && kullanici.moduller.includes('stok')
}

// Servis onaylama/kapatma yetkisi — yönetim + depo sorumluları
// (Salih Çakmaklı id 34, Mahmut Sarı id 45 — 2026-07-20 karar; web servisOnaylayabilirMi ile aynı)
// ⚠️ Bu ID sabitleri 22.08 denetiminde "ekrandan yönetilemeyen gizli kapı" olarak
// işaretlendi; Faz 3'te adlandırılmış yetkiye taşınacak.
const SERVIS_ONAY_KULLANICI_IDLERI = [34, 45]

export const servisOnaylayabilir = (kullanici) => {
  if (!kullanici) return false
  return yonetimPaneliErisimi(kullanici) || SERVIS_ONAY_KULLANICI_IDLERI.includes(Number(kullanici.id))
}

// Bordro & maaş — DB'de bordro_yetkili() (mig 324). Yalnız 'bordro_yonetim'
// modülü; admin rolü BYPASS EDEMEZ. Mobilde bordro ekranı yok, kapı ileride
// eklenecek ekranlar için burada duruyor.
export const bordroGorebilir = (kullanici) =>
  Array.isArray(kullanici?.moduller) && kullanici.moduller.includes('bordro_yonetim')
