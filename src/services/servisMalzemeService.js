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

// === Web'den eklenen malzemeler (mig 153 — servis_malzemeleri) ===
// Web ServisTalepDetay > "Kullanılan Malzemeler" kartından girilen kayıtlar;
// mobilde read-only gösterilir (mobilin kendi akışı: plan + teslim al + kullan).
export const webMalzemeleriGetir = async (servisTalepId) => {
  const { data, error } = await supabase
    .from('servis_malzemeleri')
    .select('*')
    .eq('servis_id', servisTalepId)
    .order('tarih', { ascending: false })
  if (error) { console.warn('[webMalzemeleriGetir]', error.message); return [] }
  return arrayToCamel(data)
}

// Madde 23.10 — malzeme faturalandırma işareti (mig 193). Web ile ortak;
// DB trigger'ı Kullanılan Malzemeler ekranındaki fatura durumunu senkron tutar.
export const FATURALANDIRMA_SECENEK = [
  { id: 'ucretli',               isim: '💰 Ücretli' },
  { id: 'garanti',               isim: '🛡 Garanti' },
  { id: 'sozlesme',              isim: '📋 Sözleşme' },
  { id: 'ucretsiz',              isim: '🎁 Ücretsiz' },
  { id: 'musteriden_alinan',     isim: '↩ Müşteriden' },
  { id: 'iade',                  isim: '📦 İade' },
  { id: 'faturalandirilmayacak', isim: '🚫 Faturasız' },
]

// Servis formu "Kullanılan Malzeme/Cihaz (Envanter)" — web + mobil S/N akışı birleşik
// (web servisMalzemeService.formEnvanterKalemleri ile aynı mantık; KRL-2026-0001 olayı:
//  mobil kullanım servis_malzemeleri'ne yazmadığı için formda görünmüyordu)
export const formEnvanterKalemleri = async (servisTalepId) => {
  const [webM, snM] = await Promise.all([
    supabase.from('servis_malzemeleri')
      .select('id, urun_adi, stok_kodu, seri_no, miktar, birim, durum')
      .eq('servis_id', servisTalepId).eq('durum', 'kullanildi'),
    supabase.from('servis_kalem_kullanimi')
      .select('id, durum, stok_kalemleri (seri_no, stok_kodu)')
      .eq('servis_talep_id', servisTalepId).eq('durum', 'kullanildi'),
  ])
  const webListe = (webM.data ?? []).map((m) => ({
    id: `w-${m.id}`, urunAdi: m.urun_adi, stokKodu: m.stok_kodu,
    seriNo: m.seri_no, miktar: m.miktar, birim: m.birim,
  }))
  const snSatir = snM.data ?? []
  const kodlar = [...new Set(snSatir.map((r) => r.stok_kalemleri?.stok_kodu).filter(Boolean))]
  let uMap = new Map()
  if (kodlar.length) {
    const { data: urunler } = await supabase
      .from('stok_urunler').select('stok_kodu, stok_adi, marka').in('stok_kodu', kodlar)
    uMap = new Map((urunler ?? []).map((u) => [u.stok_kodu, u]))
  }
  const snListe = snSatir.map((r) => {
    const kod = r.stok_kalemleri?.stok_kodu ?? ''
    const u = uMap.get(kod)
    return {
      id: `s-${r.id}`,
      urunAdi: u ? `${u.stok_adi}${u.marka ? ` — ${u.marka}` : ''}` : (kod || 'Envanter kalemi'),
      stokKodu: kod, seriNo: r.stok_kalemleri?.seri_no ?? '', miktar: 1, birim: 'Adet',
    }
  })
  const gorulen = new Set()
  return [...webListe, ...snListe].filter((m) => {
    const k = m.seriNo || m.id
    if (gorulen.has(k)) return false
    gorulen.add(k)
    return true
  })
}

export const malzemeFaturalandirmaIsaretle = async (id, deger) => {
  const { data, error } = await supabase
    .from('servis_malzemeleri')
    .update({ faturalandirma: deger || null })
    .eq('id', id)
    .select()
    .single()
  if (error) { console.warn('[malzemeIsaretle]', error.message); return null }
  return arrayToCamel([data])[0]
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

// UPSERT — cihaz başına (servis_talep_id, kalem_id) TEK satır (mig 218 unique
// index). teslim_alindi satırı sonra kullanildi ile GÜNCELLENİR; her dokunuşta
// yeni satır eklenmez (eski hata: aynı cihaz 5× teslim + 5× kullanildi birikti).
export const kalemKullanimEkle = async (kayit) => {
  const { id, tarih, ...rest } = kayit
  const { data, error } = await supabase
    .from('servis_kalem_kullanimi')
    .upsert(toSnake(rest), { onConflict: 'servis_talep_id,kalem_id' })
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
