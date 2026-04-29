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
const ADMIN_UNVANLARI = ['Genel Müdür', 'Teknik Müdür', 'Yazılım Geliştirmeci']
const norm = (s) => (s ?? '').trim().toLocaleLowerCase('tr-TR')
const adminMi = (unvan) => ADMIN_UNVANLARI.map(norm).includes(norm(unvan))

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
