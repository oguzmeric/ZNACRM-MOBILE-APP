// Kullanıcı yetkilerinin unvan bazlı kontrolü
// kullanicilar.unvan (text) alanına göre yetki verilir.
//
// Liste genişletilebilir — ileride başka unvan-bazlı yetkiler de ekleyebiliriz.

const SAYIM_YETKILI_UNVANLAR = ['Admin', 'Teknik Müdür', 'Depo Sorumlusu']

export const sayimYapabilir = (kullanici) => {
  if (!kullanici) return false
  const u = (kullanici.unvan ?? '').trim()
  if (!u) return false
  return SAYIM_YETKILI_UNVANLAR.includes(u)
}

// Yönetim paneline (admin mod) erişim yetkisi olan unvan'lar
const YONETIM_UNVANLARI = ['Teknik Müdür', 'Genel Müdür', 'Genel Müdür Yardımcısı', 'Yazılım Geliştirmeci']

export const yonetimPaneliErisimi = (kullanici) => {
  if (!kullanici) return false
  const u = (kullanici.unvan ?? '').trim()
  if (!u) return false
  return YONETIM_UNVANLARI.some(
    (y) => y.toLocaleLowerCase('tr-TR') === u.toLocaleLowerCase('tr-TR')
  )
}

// Servis onaylama/kapatma yetkisi — yönetim unvanları + depo sorumluları
// (Salih Çakmaklı id 34, Mahmut Sarı id 45 — 2026-07-20 karar; web servisOnaylayabilirMi ile aynı)
const SERVIS_ONAY_KULLANICI_IDLERI = [34, 45]

export const servisOnaylayabilir = (kullanici) => {
  if (!kullanici) return false
  return yonetimPaneliErisimi(kullanici) || SERVIS_ONAY_KULLANICI_IDLERI.includes(Number(kullanici.id))
}

// İleride: cihazSilebilir, teklifHazirlayabilir, faturaOlusturabilir vs.
