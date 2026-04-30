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

// İleride: cihazSilebilir, teklifHazirlayabilir, faturaOlusturabilir vs.
