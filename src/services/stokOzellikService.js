// Stok v2 — kategori ağacı + teknik özellik tanımları + ürün değerleri
// (mig 151-152). Akıllı arama (utils/stokAkilliArama) için bağlam verisi.
import { supabase } from '../lib/supabase'
import { arrayToCamel } from '../lib/mapper'

// Modül içi basit cache — picker her açılışta DB'ye gitmesin (oturum boyu yeter)
let _kategoriler = null
let _tanimlar = null
let _urunOzellikMap = null
let _kodBilgi = null

export const kategorileriGetir = async () => {
  if (_kategoriler) return _kategoriler
  const { data, error } = await supabase
    .from('stok_kategoriler')
    .select('id, ad, ust_id, aktif')
    .eq('aktif', true)
    .order('sira')
  if (error) { console.error('[kategorileriGetir]', error.message); return [] }
  _kategoriler = arrayToCamel(data) ?? []
  return _kategoriler
}

export const ozellikTanimlariGetir = async () => {
  if (_tanimlar) return _tanimlar
  const { data, error } = await supabase
    .from('stok_kategori_ozellikler')
    .select('id, kategori_id, ad, tip, secenekler, birim, aktif')
    .eq('aktif', true)
    .order('sira')
  if (error) { console.error('[ozellikTanimlariGetir]', error.message); return [] }
  _tanimlar = arrayToCamel(data) ?? []
  return _tanimlar
}

// Map<urunId, Map<ozellikId, deger>>
export const tumUrunOzellikleriGetir = async () => {
  if (_urunOzellikMap) return _urunOzellikMap
  const { data, error } = await supabase
    .from('stok_urun_ozellikler')
    .select('urun_id, ozellik_id, deger')
  if (error) { console.error('[tumUrunOzellikleriGetir]', error.message); return new Map() }
  const map = new Map()
  for (const r of data || []) {
    if (!map.has(r.urun_id)) map.set(r.urun_id, new Map())
    map.get(r.urun_id).set(r.ozellik_id, r.deger)
  }
  _urunOzellikMap = map
  return map
}

// Map<stok_kodu, { id, kategoriId }> — picker satırları stok_kodu bazlı olduğu
// için özellik eşleştirmesinde ürün id/kategori köprüsü lazım
export const urunKodBilgileriGetir = async () => {
  if (_kodBilgi) return _kodBilgi
  const { data, error } = await supabase
    .from('stok_urunler')
    .select('id, stok_kodu, kategori_id')
  if (error) { console.error('[urunKodBilgileriGetir]', error.message); return new Map() }
  const map = new Map()
  for (const r of data || []) {
    map.set(r.stok_kodu, { id: r.id, kategoriId: r.kategori_id })
  }
  _kodBilgi = map
  return map
}

// Hepsini tek seferde yükle (picker açılışı)
export const akilliAramaBaglami = async () => {
  const [kategoriler, tanimlar, urunOzellikMap, kodBilgi] = await Promise.all([
    kategorileriGetir(), ozellikTanimlariGetir(), tumUrunOzellikleriGetir(), urunKodBilgileriGetir(),
  ])
  return { kategoriler, tanimlar, urunOzellikMap, kodBilgi }
}
