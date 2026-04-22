import { supabase } from '../lib/supabase'
import { KAPALI_DURUMLAR } from './servisService'

// Yönetim paneli KPI verileri — sayım sorguları

// Atanmamış / onay bekleyen servis talepleri
export const onayBekleyenSayisi = async () => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .eq('durum', 'bekliyor')
  return count ?? 0
}

// Aktif (henüz kapanmamış) servis talepleri — servisService ile aynı tanım
export const aktifServisSayisi = async () => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .not('durum', 'in', KAPALI_DURUMLAR)
  return count ?? 0
}

// Kronik arıza: aynı cihaz (seri no) üzerinde 3+ servis talebi
// Şu an servis_talepleri şemasında cihaz_id / seri_no FK yok, bu KPI sonra gelecek.
export const kronikArizaSayisi = async () => {
  return null
}

// Min stok altına düşen bulk ürün sayısı (stok_miktari < min_stok)
export const minStokAltiSayisi = async () => {
  const { data } = await supabase
    .from('stok_urunler')
    .select('stok_kodu, stok_miktari, min_stok')
    .not('min_stok', 'is', null)
  if (!data) return 0
  return data.filter(
    (u) => Number(u.stok_miktari ?? 0) < Number(u.min_stok ?? 0)
  ).length
}

// Açık (cevaplanmamış) destek talebi sayısı
export const acikDestekSayisi = async () => {
  const { count } = await supabase
    .from('destek_talepleri')
    .select('*', { count: 'exact', head: true })
    .eq('durum', 'acik')
  return count ?? 0
}

// Onay kuyruğundaki (tamamlandi işaretli) servis sayısı
export const onayKuyruguSayisi = async () => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .eq('durum', 'tamamlandi')
  return count ?? 0
}

// Hepsini paralel çek
export const adminKpiGetir = async () => {
  const [onay, aktif, kronik, minStok, acikDestek, onayKuyrugu] = await Promise.all([
    onayBekleyenSayisi(),
    aktifServisSayisi(),
    kronikArizaSayisi(),
    minStokAltiSayisi(),
    acikDestekSayisi(),
    onayKuyruguSayisi(),
  ])
  return {
    onayBekleyen: onay,
    aktifServis: aktif,
    kronikAriza: kronik,
    minStokAlti: minStok,
    acikDestek,
    onayKuyrugu,
  }
}
