import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

// Servis malzeme planı = operatörün "bu iş için şu ürünlerden şu kadar gerek" dediği liste.
// Sadece adet bazında, S/N seçilmez.

export const malzemePlaniGetir = async (servisTalepId) => {
  const { data } = await supabase
    .from('servis_malzeme_plani')
    .select('*')
    .eq('servis_talep_id', servisTalepId)
    .order('olusturma_tarihi', { ascending: true })
  return arrayToCamel(data)
}

export const malzemePlanEkle = async (plan) => {
  const { id, olusturmaTarihi, ...rest } = plan
  const { data, error } = await supabase
    .from('servis_malzeme_plani')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('malzemePlanEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const malzemePlanGuncelle = async (id, guncel) => {
  const { id: _id, olusturmaTarihi, ...rest } = guncel
  const { data, error } = await supabase
    .from('servis_malzeme_plani')
    .update(toSnake(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('malzemePlanGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const malzemePlanSil = async (id) => {
  await supabase.from('servis_malzeme_plani').delete().eq('id', id)
}

// === Servis kalem kullanımı (S/N bazlı) ===

export const kullanilanKalemleriGetir = async (servisTalepId) => {
  const { data } = await supabase
    .from('servis_kalem_kullanimi')
    .select('*')
    .eq('servis_talep_id', servisTalepId)
    .order('tarih', { ascending: true })
  return arrayToCamel(data)
}

export const kalemKullanimEkle = async (kayit) => {
  const { id, tarih, ...rest } = kayit
  const { data, error } = await supabase
    .from('servis_kalem_kullanimi')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('kalemKullanimEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Servis için teslim alınmış (ama henüz kullanılmamış) kalemler
export const teslimAlinanKalemler = async (servisTalepId) => {
  const { data } = await supabase
    .from('servis_kalem_kullanimi')
    .select('*, stok_kalemleri (*)')
    .eq('servis_talep_id', servisTalepId)
    .eq('durum', 'teslim_alindi')
  return arrayToCamel(data)
}

// === BULK ÜRÜNLER (Cat6, vida, jack gibi miktar bazlı) ===

// Bulk teslim al:
// - Plan satırının teslim_alinan_miktar +ekMiktar
// - stok_urunler.stok_miktari - ekMiktar  (depodan düş)
// - stok_hareketleri'ne 'cikis' kaydı (web'den de görünür — müşteri bilgisi ile)
export const bulkTeslimAl = async (planId, ekMiktar, kullaniciAd = 'Mobil') => {
  const miktar = Number(ekMiktar)
  // Mevcut planı + servis talebini al (müşteri bilgisi için)
  const { data: plan } = await supabase
    .from('servis_malzeme_plani')
    .select('*')
    .eq('id', planId)
    .single()
  if (!plan) return null

  // Servis talebinden firma/konu bilgisi çek
  const { data: talep } = await supabase
    .from('servis_talepleri')
    .select('talep_no, firma_adi, konu')
    .eq('id', plan.servis_talep_id)
    .maybeSingle()

  // 1) Plan teslim_alinan_miktar güncelle
  const yeniTeslim = Number(plan.teslim_alinan_miktar ?? 0) + miktar
  const { data: guncelPlan } = await supabase
    .from('servis_malzeme_plani')
    .update({ teslim_alinan_miktar: yeniTeslim })
    .eq('id', planId)
    .select()
    .single()

  // 2) stok_urunler'dan düş
  if (plan.stok_kodu) {
    const { data: urun } = await supabase
      .from('stok_urunler')
      .select('stok_miktari')
      .eq('stok_kodu', plan.stok_kodu)
      .maybeSingle()
    if (urun) {
      const oncekiMiktar = Number(urun.stok_miktari ?? 0)
      const sonrakiMiktar = oncekiMiktar - miktar
      await supabase
        .from('stok_urunler')
        .update({ stok_miktari: sonrakiMiktar })
        .eq('stok_kodu', plan.stok_kodu)

      // 3) Stok hareketi kaydı (web için — müşteri/talep detayı ile)
      const parcalar = [
        talep?.firma_adi && `Müşteri: ${talep.firma_adi}`,
        talep?.talep_no && `Talep: ${talep.talep_no}`,
        talep?.konu && `Konu: ${talep.konu}`,
      ].filter(Boolean)
      const aciklama = parcalar.length > 0
        ? parcalar.join(' · ')
        : `Servis #${plan.servis_talep_id}`

      await supabase.from('stok_hareketleri').insert({
        stok_kodu: plan.stok_kodu,
        stok_adi: plan.stok_adi,
        hareket_tipi: 'transfer_cikis',
        miktar,
        onceki_miktar: oncekiMiktar,
        sonraki_miktar: sonrakiMiktar,
        aciklama: `Servise Teslim · ${aciklama}`,
        kullanici_ad: kullaniciAd,
      })
    }
  }

  return toCamel(guncelPlan)
}

// Bulk kullan (depodan değil teknisyenden çıkar — stok_urunler'a ek etki yok)
export const bulkKullan = async (planId, ekMiktar) => {
  const { data: mevcut } = await supabase
    .from('servis_malzeme_plani')
    .select('kullanilan_miktar')
    .eq('id', planId)
    .single()
  const yeni = Number(mevcut?.kullanilan_miktar ?? 0) + Number(ekMiktar)
  const { data } = await supabase
    .from('servis_malzeme_plani')
    .update({ kullanilan_miktar: yeni })
    .eq('id', planId)
    .select()
    .single()
  return toCamel(data)
}
