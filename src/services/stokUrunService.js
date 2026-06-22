import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

// Bulk ürün katalog işlemleri (stok_urunler) ve hareket geçmişi (stok_hareketleri)

export const tumStokUrunleriniGetir = async () => {
  const { data, error } = await supabase
    .from('stok_urunler')
    .select('*')
    .order('stok_adi', { ascending: true })
  if (error) {
    console.warn('[stokUrun] liste hatası:', error.message)
    return []
  }
  return arrayToCamel(data ?? [])
}

export const stokUrunGetir = async (stokKodu) => {
  const { data } = await supabase
    .from('stok_urunler')
    .select('*')
    .eq('stok_kodu', stokKodu)
    .maybeSingle()
  return data ? toCamel(data) : null
}

export const stokUrunGuncelle = async (stokKodu, guncellenmis) => {
  const { id, olusturmaTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('stok_urunler')
    .update(toSnake(rest))
    .eq('stok_kodu', stokKodu)
    .select()
    .single()
  if (error) {
    console.error('stokUrunGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Bir modelin hareket geçmişi (en yeni en üstte)
export const stokKoduHareketleriniGetir = async (stokKodu) => {
  const { data } = await supabase
    .from('stok_hareketleri')
    .select('*')
    .eq('stok_kodu', stokKodu)
    .order('tarih', { ascending: false })
    .limit(100)
  return arrayToCamel(data)
}

// Yeni hareket ekle (bulk için)
// hareketTipi: 'giris' | 'cikis' | 'sayim'
// giris/cikis: miktar pozitif sayı (delta), stok_miktari +/- güncellenir
// sayim: miktar mutlak değer, stok_miktari direkt set edilir
export const bulkHareketEkle = async ({
  stokKodu,
  hareketTipi,
  miktar,
  aciklama = null,
  kullaniciAd = null,
  musteriAdi = null,
}) => {
  const urun = await stokUrunGetir(stokKodu)
  if (!urun) {
    console.error('bulkHareketEkle: ürün bulunamadı', stokKodu)
    return null
  }

  const oncekiMiktar = Number(urun.stokMiktari ?? 0)
  let sonrakiMiktar = oncekiMiktar
  if (hareketTipi === 'giris') sonrakiMiktar = oncekiMiktar + Number(miktar)
  else if (hareketTipi === 'cikis') sonrakiMiktar = oncekiMiktar - Number(miktar)
  else if (hareketTipi === 'sayim') sonrakiMiktar = Number(miktar)

  // Sayım için miktar = mutlak değer; giriş/çıkış için delta
  const hareketMiktari = hareketTipi === 'sayim' ? sonrakiMiktar : Number(miktar)

  const tamAciklama = musteriAdi
    ? (aciklama ? `${aciklama} (${musteriAdi})` : musteriAdi)
    : aciklama

  // Hareket kaydı
  const { data: h, error: e1 } = await supabase
    .from('stok_hareketleri')
    .insert(toSnake({
      stokKodu,
      stokAdi: urun.stokAdi,
      hareketTipi,
      miktar: hareketMiktari,
      oncekiMiktar,
      sonrakiMiktar,
      aciklama: tamAciklama,
      kullaniciAd,
    }))
    .select()
    .single()

  if (e1) {
    console.error('bulkHareketEkle hata:', e1.message)
    return null
  }

  // Stok miktarını güncelle
  await supabase
    .from('stok_urunler')
    .update({ stok_miktari: sonrakiMiktar })
    .eq('stok_kodu', stokKodu)

  return toCamel(h)
}

// Ürünü seri-takibe al: bayrağı set et + mevcut adedi hedef olarak kopyala
export const seriTakibineGec = async (stokKodu) => {
  const { data: mevcut } = await supabase
    .from('stok_urunler')
    .select('stok_miktari, seri_takipli, beklenen_adet')
    .eq('stok_kodu', stokKodu)
    .maybeSingle()
  if (!mevcut) return { ok: false, hata: 'Ürün bulunamadı.' }
  const hedef = mevcut.beklenen_adet ?? mevcut.stok_miktari ?? 0
  const { error } = await supabase
    .from('stok_urunler')
    .update({ seri_takipli: true, beklenen_adet: hedef })
    .eq('stok_kodu', stokKodu)
  return error ? { ok: false, hata: error.message } : { ok: true, beklenenAdet: hedef }
}

// Beklenen (hedef) adedi güncelle
export const beklenenAdetGuncelle = async (stokKodu, adet) => {
  const sayi = Number.isFinite(Number(adet)) ? Math.max(0, Math.trunc(Number(adet))) : null
  const { error } = await supabase
    .from('stok_urunler')
    .update({ beklenen_adet: sayi })
    .eq('stok_kodu', stokKodu)
  return !error
}
