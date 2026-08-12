// Servis → Proforma Fatura köprüsü (mobil). Web faturaTalepService ile aynı akış:
// servisi tamamlayan personel "Fatura Kesilecek" işaretler → fatura_talepleri'nde
// bekleyen proforma açılır (müşteri künyesi + servis konusu; tutar boş, muhasebe
// keserken girer). mig 177: fatura_talepleri.servis_talep_id + servis geri-link.

import { supabase } from '../lib/supabase'
import { toCamel, toSnake } from '../lib/mapper'
import { bildirimEkleDb } from './bildirimService'
import { formEnvanterKalemleri } from './servisMalzemeService'
import { faturaHesapla, kalemPayload, paraMetni } from '../lib/faturaHesap'

/**
 * Bakım kapsamı = servisin yükümlülüğü "bakım" → bedel alınmaz (mig 282).
 * ⚠️ Web'de aynı kural faturaTalepService.bakimKapsamiMi'de; ayrı repo
 * olduğu için kod paylaşılamıyor, ikisi AYNI kalmalı.
 */
export const bakimKapsamiMi = (servis) =>
  String(servis?.yukumluluk || '').trim().toLocaleLowerCase('tr') === 'bakim'

// Servisin proforma fatura durumu (buton/rozet için)
export const servisFaturaTalebiGetir = async (servisId) => {
  const { data } = await supabase
    .from('fatura_talepleri')
    .select('id, talep_no, durum, fatura_no, red_nedeni')
    .eq('servis_talep_id', servisId)
    .order('id', { ascending: false })
    .limit(1)
  return data?.[0] ? toCamel(data[0]) : null
}

/**
 * Servisten proforma açar.
 *
 * @param kalemler  ServisFaturaHazirla ekranından gelen FİYATLI kalemler.
 *   Verilirse tutarlar bunlardan hesaplanır (12.08.2026 akışı: fiyatı işi
 *   yapan teknisyen girer, muhasebe hazır proforma alır).
 *   Verilmezse ESKİ davranış: serviste kullanılan malzemeler fiyatsız taşınır
 *   ve tutarı muhasebe kesim anında girer — web tarafı ve eski mobil
 *   sürümler bu yoldan geliyor, bozulmamalı.
 */
export const servistenFaturaTalebiAc = async ({ servis, kullanici, not = '', kalemler = null }) => {
  // Zaten açık talep var mı? (uq_fatura_talep_acik_servis)
  const { data: mevcut } = await supabase
    .from('fatura_talepleri')
    .select('id, talep_no')
    .eq('servis_talep_id', servis.id)
    .eq('durum', 'bekliyor')
    .maybeSingle()
  if (mevcut) return { _hata: `Bu servise zaten açık bir proforma var (${mevcut.talep_no}).` }

  // Müşteri künyesi (vergi bilgileri opsiyonel — muhasebe faturada kullanır)
  let m = null
  if (servis.musteriId) {
    const { data } = await supabase
      .from('musteriler')
      .select('firma, ad, soyad, vergi_no, vergi_dairesi, adres, sehir, telefon, email')
      .eq('id', servis.musteriId).maybeSingle()
    m = data
  }

  // Teknisyen fiyat girdiyse ONU kullan; yoksa serviste kullanılan malzemeleri
  // fiyatsız taşı (FTL-2026-000025: bomboş proforma "hata" sanılmıştı).
  const teknisyenGirdi = Array.isArray(kalemler) && kalemler.length > 0
  const satirlar = teknisyenGirdi
    ? kalemler.map(kalemPayload)
    // ⚠️ parametre adı `mlz` — dıştaki `m` MÜŞTERİ künyesi, gölgelenmemeli
    : (await formEnvanterKalemleri(servis.id).catch(() => [])).map((mlz) => ({
      stokKodu: mlz.stokKodu || '',
      urunAdi: mlz.seriNo ? `${mlz.urunAdi || ''} (S/N: ${mlz.seriNo})` : (mlz.urunAdi || ''),
      aciklama: '',
      miktar: Number(mlz.miktar) || 1,
      birim: mlz.birim || 'Adet',
      birimFiyat: 0, iskontoOran: 0, kdvOran: 20,
      araToplam: 0, kdvTutar: 0, satirToplam: 0,
    }))
  const toplam = teknisyenGirdi
    ? faturaHesapla(kalemler)
    : { araToplam: 0, kdvToplam: 0, genelToplam: 0 }

  const payload = {
    servisTalepId: servis.id ? Number(servis.id) : null,
    musteriId: servis.musteriId ? Number(servis.musteriId) : null,
    firmaAdi: servis.firmaAdi || m?.firma || servis.musteriAd || '',
    yetkiliAdi: [m?.ad, m?.soyad].filter(Boolean).join(' ') || servis.musteriAd || '',
    vergiNo: m?.vergi_no || '',
    vergiDairesi: m?.vergi_dairesi || '',
    adres: [m?.adres, m?.sehir].filter(Boolean).join(' · '),
    telefon: m?.telefon || '',
    email: m?.email || '',
    konu: servis.konu ? `Servis: ${servis.konu}` : 'Servis faturası',
    paraBirimi: 'TL',
    // BAKIM KAPSAMI (mig 282): yükümlülüğü "bakım" olan işte bedel alınmaz.
    // Proforma bedelsiz açılır; muhasebe fatura no/tutar girmeden kapatabilir.
    // Web tarafındaki faturaTalepService.bakimKapsamiMi ile AYNI kural.
    ...(bakimKapsamiMi(servis)
      ? { bedelsiz: true, bedelsizSebep: 'Bakım anlaşması kapsamında' }
      : { bedelsiz: false, bedelsizSebep: null }),
    kalemler: satirlar,
    araToplam: toplam.araToplam,
    kdvToplam: toplam.kdvToplam,
    genelToplam: toplam.genelToplam,
    durum: 'bekliyor',
    talepNotu: not || '',
    talepEdenId: kullanici?.id ?? null,
    talepEdenAd: kullanici?.ad ?? '',
  }

  const { data, error } = await supabase
    .from('fatura_talepleri')
    .insert(toSnake(payload))   // talep_no DB trigger'ından gelir
    .select()
    .single()
  if (error) {
    if (String(error.message).includes('uq_fatura_talep_acik_servis')) {
      return { _hata: 'Bu servise zaten açık bir proforma var.' }
    }
    console.error('[servistenFaturaTalebiAc]', error.message)
    return { _hata: 'Proforma açılamadı: ' + error.message }
  }
  const kayit = toCamel(data)

  // Servise geri-link
  await supabase.from('servis_talepleri').update({ fatura_talep_id: kayit.id }).eq('id', servis.id)

  // Fatura yetkililerine bildir (admin + fatura_yetkilisi)
  try {
    const { data: yetkililer } = await supabase
      .from('kullanicilar').select('id').eq('tip', 'zna')
      .or('fatura_yetkilisi.eq.true,rol.eq.admin')
    const alicilar = [...new Set((yetkililer || []).map(k => k.id))]
    for (const aliciId of alicilar) {
      await bildirimEkleDb({
        aliciId,
        gonderenId: kullanici?.id,
        baslik: `Proforma fatura — ${kayit.firmaAdi}`,
        // Tutar bildirimde görünsün: teknisyen fiyatladıysa muhasebe ne
        // geldiğini listeye girmeden bilir
        mesaj: teknisyenGirdi
          ? `${kayit.talepNo} · ${satirlar.length} kalem · ${paraMetni(toplam.genelToplam)} · ${kullanici?.ad || 'teknisyen'} gönderdi`
          : `${kayit.talepNo} · servisten · fatura kesilecek`,
        tip: 'uyari',
        link: '/fatura-talepleri',
        meta: { kaynak: 'fatura_talebi', talep_id: kayit.id },
      })
    }
  } catch (e) { console.warn('[servistenFaturaTalebiAc] bildirim:', e?.message) }

  return kayit
}
