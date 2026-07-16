// Servis → Proforma Fatura köprüsü (mobil). Web faturaTalepService ile aynı akış:
// servisi tamamlayan personel "Fatura Kesilecek" işaretler → fatura_talepleri'nde
// bekleyen proforma açılır (müşteri künyesi + servis konusu; tutar boş, muhasebe
// keserken girer). mig 177: fatura_talepleri.servis_talep_id + servis geri-link.

import { supabase } from '../lib/supabase'
import { toCamel, toSnake } from '../lib/mapper'
import { bildirimEkleDb } from './bildirimService'

// Servisin proforma fatura durumu (buton/rozet için)
export const servisFaturaTalebiGetir = async (servisId) => {
  const { data } = await supabase
    .from('fatura_talepleri')
    .select('id, talep_no, durum, fatura_no')
    .eq('servis_talep_id', servisId)
    .order('id', { ascending: false })
    .limit(1)
  return data?.[0] ? toCamel(data[0]) : null
}

export const servistenFaturaTalebiAc = async ({ servis, kullanici, not = '' }) => {
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
    kalemler: [],
    araToplam: 0, kdvToplam: 0, genelToplam: 0,
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
        mesaj: `${kayit.talepNo} · servisten · fatura kesilecek`,
        tip: 'uyari',
        link: '/fatura-talepleri',
        meta: { kaynak: 'fatura_talebi', talep_id: kayit.id },
      })
    }
  } catch (e) { console.warn('[servistenFaturaTalebiAc] bildirim:', e?.message) }

  return kayit
}
