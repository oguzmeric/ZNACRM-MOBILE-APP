import { supabase } from '../lib/supabase'
import { arrayToCamel } from '../lib/mapper'

// Menü anahtarları — HomeScreen'deki tile'lar + destek shortcut
export const MENU_LISTESI = [
  { anahtar: 'gorevler',   ad: 'Görevler' },
  { anahtar: 'servisler',  ad: 'Servisler' },
  { anahtar: 'tara',       ad: 'Tara' },
  { anahtar: 'stok',       ad: 'Stok' },
  { anahtar: 'teklif',     ad: 'Teklif' },
  { anahtar: 'musteriler', ad: 'Müşteriler' },
  { anahtar: 'gorusmeler', ad: 'Görüşmelerim' },
  { anahtar: 'destek',     ad: 'Destek' },
]

// Yetki yönetiminde gizlenecek admin unvanları — kendi yetkisini kısıtlamasın
const ADMIN_UNVANLARI = ['Genel Müdür', 'Genel Müdür Yardımcısı', 'Teknik Müdür', 'Yazılım Geliştirmeci']
const norm = (s) => (s ?? '').trim().toLocaleLowerCase('tr-TR')
const adminMi = (unvan) => ADMIN_UNVANLARI.map(norm).includes(norm(unvan))

// Mobil menü anahtarı → web "Modül erişimleri" (kullanicilar.moduller) eşlemesi.
// Web Kullanıcılar sayfasında verilen yetkiler mobilde de geçerli olsun diye
// (eskiden mobil yalnız menu_yetkileri'ne bakıyor, web yetkilerini YOK SAYIYORDU).
export const MODUL_ESLEME = {
  gorevler:   'gorevler',
  servisler:  'servis_talepleri',
  stok:       'stok',
  tara:       'stok',            // barkod tarama = stok işlemi
  teklif:     'musteriler',      // web'de Teklifler "Müşteri & Satış" modülüne bağlı
  kesif:      'musteriler',
  musteriler: 'musteriler',
  gorusmeler: 'gorusmeler',
  demolar:    'demolar',
  arac_takip: 'arac_takip',
  destek:     null,              // herkes
}

// Tek karar noktası (web MainLayout filtresiyle aynı kural):
// 1) mobil-özel gizleme (menu_yetkileri gorunur=false) her zaman kazanır
// 2) admin rolü her modülü görür
// 3) modül eşlemesi yoksa (Takvim, Notlarım, Destek...) herkes görür
// 4) aksi halde kullanicilar.moduller listesinde olmalı
export const menuGorunurMu = (anahtar, kullanici, harita = {}) => {
  if (harita[anahtar] === false) return false
  if (kullanici?.rol === 'admin') return true
  const modul = MODUL_ESLEME[anahtar]
  if (modul === undefined || modul === null) return true
  return Array.isArray(kullanici?.moduller) && kullanici.moduller.includes(modul)
}

// Bir kullanıcının yetki haritası: { menu_anahtari: gorunur }
// Kayıt yoksa default true (görünür)
export const kullaniciMenuYetkileri = async (kullaniciId) => {
  if (!kullaniciId) return {}
  const { data, error } = await supabase
    .from('menu_yetkileri')
    .select('menu_anahtari, gorunur')
    .eq('kullanici_id', kullaniciId)
  if (error) {
    console.warn('[menuYetki] çekim hatası:', error.message)
    return {}
  }
  const harita = {}
  for (const r of data ?? []) harita[r.menu_anahtari] = r.gorunur
  return harita
}

// Yetki yönetimi için kullanıcı listesi: admin OLMAYAN, hesabı silinmemiş,
// müşteri portal kullanıcısı OLMAYAN
export const yetkiyeUygunKullanicilar = async () => {
  const { data, error } = await supabase
    .from('kullanicilar')
    .select('*')
    .order('ad', { ascending: true })
  if (error) {
    console.warn('[menuYetki] kullanıcı listesi hatası:', error.message)
    return []
  }
  const tum = arrayToCamel(data ?? [])
  return tum.filter((k) => {
    if (k.hesapSilindi === true) return false
    if (adminMi(k.unvan)) return false
    if (k.tip === 'musteri') return false
    if (k.musteriId) return false
    return true
  })
}

// Upsert: bir kullanıcı + menü için gorunur değerini set et
export const menuYetkisiAyarla = async (kullaniciId, menuAnahtari, gorunur) => {
  const { error } = await supabase
    .from('menu_yetkileri')
    .upsert(
      [{ kullanici_id: kullaniciId, menu_anahtari: menuAnahtari, gorunur }],
      { onConflict: 'kullanici_id,menu_anahtari' }
    )
  if (error) {
    console.error('[menuYetki] upsert hatası:', error.message)
    return false
  }
  return true
}
