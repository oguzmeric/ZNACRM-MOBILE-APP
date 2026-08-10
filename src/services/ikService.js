// İK servisi (mobil) — Bordrolar + İzin Talepleri (migration 204-205).
//
// GİZLİLİK: Bordro ve izin KİŞİYE ÖZELDİR. Herkes YALNIZ kendi kaydını görür.
// Sunucu tarafında RLS zaten kısıtlıyor (bordro_sel / izin_sel: kullanici_id =
// ik_kendi_id() OR ik_yetkili()), burada da her sorgu kullanıcı id'siyle
// filtrelenir — çift emniyet. Mobilde İK YÖNETİM ekranı YOKTUR: onay/red ve
// bordro yükleme yalnız webde (Abdullah Bey).
//
// Bordro dosyaları PRIVATE 'bordrolar' bucket'ında — indirme yalnız signed URL.

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'
import { bildirimEkleDb } from './bildirimService'

const BUCKET = 'bordrolar'

// ---------- Sabitler (web ikService ile birebir) ----------
export const IZIN_TURLERI = [
  { id: 'yillik', isim: 'Yıllık İzin' },
  { id: 'mazeret', isim: 'Mazeret İzni' },
  { id: 'rapor', isim: 'Raporlu' },
  { id: 'ucretsiz', isim: 'Ücretsiz İzin' },
  { id: 'diger', isim: 'Diğer' },
]

export const IZIN_DURUM = {
  bekliyor:   { isim: 'Bekliyor',   renk: '#f59e0b' },
  onaylandi:  { isim: 'Onaylandı',  renk: '#10b981' },
  reddedildi: { isim: 'Reddedildi', renk: '#dc2626' },
  iptal:      { isim: 'İptal',      renk: '#6b7280' },
}

export const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export const izinTurBilgi = (id) =>
  IZIN_TURLERI.find(t => t.id === id) || { id, isim: id || '—' }

export const izinDurumBilgi = (id) =>
  IZIN_DURUM[id] || { isim: id || '—', renk: '#6b7280' }

/** Hafta sonu HARİÇ iş günü sayısı (her iki uç dahil) — web ile aynı hesap. */
export function isGunuHesapla(baslangic, bitis) {
  if (!baslangic || !bitis) return 0
  const bas = new Date(typeof baslangic === 'string' ? `${baslangic.slice(0, 10)}T12:00:00` : baslangic)
  const bit = new Date(typeof bitis === 'string' ? `${bitis.slice(0, 10)}T12:00:00` : bitis)
  if (isNaN(bas) || isNaN(bit) || bit < bas) return 0
  let sayac = 0
  const imlec = new Date(bas)
  while (imlec <= bit) {
    const g = imlec.getDay()          // 0=Pazar, 6=Cumartesi
    if (g !== 0 && g !== 6) sayac++
    imlec.setDate(imlec.getDate() + 1)
  }
  return sayac
}

// ---------- Bordrolar (yalnız kendi) ----------
export const bordrolarimiGetir = async (kullaniciId) => {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('bordrolar')
    .select('id, kullanici_id, donem_yil, donem_ay, dosya_yol, dosya_ad, aciklama, olusturma_tarih')
    .eq('kullanici_id', Number(kullaniciId))
    .order('donem_yil', { ascending: false })
    .order('donem_ay', { ascending: false })
  if (error) { console.error('[bordrolarim]', error.message); return [] }
  return arrayToCamel(data || [])
}

/** Private bucket — geçici indirme bağlantısı (varsayılan 5 dk). */
export const bordroIndirUrl = async (dosyaYol, saniye = 300) => {
  if (!dosyaYol) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(dosyaYol, saniye)
  if (error) { console.error('[bordroIndirUrl]', error.message); return null }
  return data?.signedUrl || null
}

// ---------- İzin talepleri (yalnız kendi) ----------
export const izinTaleplerimiGetir = async (kullaniciId) => {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('izin_talepleri')
    .select('id, kullanici_id, tur, baslangic, bitis, gun_sayisi, aciklama, durum, onaylayan_id, onay_tarihi, karar_notu, olusturma_tarih')
    .eq('kullanici_id', Number(kullaniciId))
    .order('olusturma_tarih', { ascending: false })
  if (error) { console.error('[izinTaleplerim]', error.message); return [] }

  const onaylayanIdler = [...new Set((data || []).map(r => r.onaylayan_id).filter(Boolean))]
  let adMap = new Map()
  if (onaylayanIdler.length) {
    const { data: k } = await supabase.from('kullanicilar').select('id, ad').in('id', onaylayanIdler)
    adMap = new Map((k || []).map(x => [Number(x.id), x.ad]))
  }
  return arrayToCamel(data || []).map(r => ({
    ...r,
    onaylayanAd: r.onaylayanId ? (adMap.get(Number(r.onaylayanId)) || null) : null,
  }))
}

/** İK yetkilileri (moduller içinde 'ik_yonetim') — onaya gidecek kişiler. */
const ikYetkilileriGetir = async () => {
  const { data, error } = await supabase
    .from('kullanicilar')
    .select('id, ad')
    .contains('moduller', ['ik_yonetim'])
  if (error) { console.warn('[ikYetkilileri]', error.message); return [] }
  return data || []
}

/** Yeni izin talebi — durum 'bekliyor' açılır, İK yetkililerine bildirim gider
 *  (webdeki akışın aynısı: onayı Abdullah Bey verir). */
export const izinTalepEkle = async ({ kullaniciId, tur, baslangic, bitis, gunSayisi, aciklama }) => {
  if (!kullaniciId) throw new Error('Oturum bulunamadı.')
  if (!tur) throw new Error('İzin türü seçin.')
  if (!baslangic || !bitis) throw new Error('Başlangıç ve bitiş tarihi girin.')

  const gun = gunSayisi != null && gunSayisi !== '' ? Number(gunSayisi) : isGunuHesapla(baslangic, bitis)
  if (!gun) throw new Error('Geçersiz tarih aralığı.')

  const { data, error } = await supabase
    .from('izin_talepleri')
    .insert({
      kullanici_id: Number(kullaniciId),
      tur,
      baslangic,
      bitis,
      gun_sayisi: gun,
      aciklama: (aciklama || '').trim() || null,
      durum: 'bekliyor',
    })
    .select('id, kullanici_id, tur, baslangic, bitis, gun_sayisi, aciklama, durum, olusturma_tarih')
    .single()
  if (error) throw error

  // Bildirim akışı BEKLETMEZ (web dersi: bildirim timeout'u talebi kaybettiriyordu)
  ;(async () => {
    const ikler = await ikYetkilileriGetir()
    const turAd = izinTurBilgi(tur).isim
    for (const k of ikler) {
      if (Number(k.id) === Number(kullaniciId)) continue
      await bildirimEkleDb({
        aliciId: Number(k.id),        // DİKKAT: servis camelCase bekliyor
        gonderenId: Number(kullaniciId),
        baslik: '🏖️ Yeni izin talebi',
        mesaj: `${turAd} talebi: ${baslangic} → ${bitis} (${gun} iş günü).`,
        tip: 'bilgi',
        link: '/ik-yonetim',
      })
    }
  })().catch(e => console.warn('[izin bildirim]', e?.message))

  return toCamel(data)
}

/** Kendi bekleyen talebini iptal et (RLS: kendi + durum='bekliyor'). */
export const izinIptal = async (id) => {
  const { error } = await supabase
    .from('izin_talepleri')
    .update({ durum: 'iptal' })
    .eq('id', id)
  if (error) throw error
}

// ---------- Avans talepleri (yalnız kendi) ----------
// Akış web ile birebir: talep (bekliyor) → İK kararı → ÖDEME işareti → taksit
// planı DB trigger'ı üretir → her ay taksit "kesildi" işaretlenir.
// Karar/ödeme/taksit adımları MOBİLDE YOK (web, Abdullah Bey); personel burada
// yalnız talep açar, listeler ve bekleyeni iptal eder.
//
// ⚠️ İzinden farkı: avans bildirimleri İSTEMCİDEN GÖNDERİLMEZ — DB trigger'ı
// (tr_avans_bildir) yollar. Buradan ayrıca bildirim yazılırsa İK'ya ÇİFT
// bildirim gider.

export const AVANS_DURUM = {
  bekliyor:   { isim: 'Bekliyor',   renk: '#f59e0b' },
  onaylandi:  { isim: 'Onaylandı',  renk: '#10b981' },
  reddedildi: { isim: 'Reddedildi', renk: '#dc2626' },
  iptal:      { isim: 'İptal',      renk: '#6b7280' },
}

export const avansDurumBilgi = (id) =>
  AVANS_DURUM[id] || { isim: id || '—', renk: '#6b7280' }

// ⚠️ Üst sınır 4 (10.08 kararı — 12 taksit fazla bulundu). Üç yerde birden
// tutulur: bu liste, avansTalepEkle guard'ı ve DB CHECK kısıtı (mig 279).
export const TAKSIT_SECENEKLERI = [1, 2, 3, 4]
export const MAKS_TAKSIT = 4

export const tutarBicim = (t) =>
  (Number(t) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

export const donemBicim = (d) => {
  if (!d) return '—'
  const t = new Date(String(d).length <= 10 ? `${d}T00:00:00` : d)
  return isNaN(t) ? '—' : t.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

/** "9.000" / "9000,50" / "9000" → sayı (web ikService ile aynı kural). */
export const tutarCoz = (metin) =>
  Number(String(metin ?? '').replace(/\./g, '').replace(',', '.'))

/** Kendi avans taleplerim + taksit planları. */
export const avansTaleplerimiGetir = async (kullaniciId) => {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('avans_talepleri')
    .select(`
      id, kullanici_id, tutar, taksit_sayisi, gerekce, durum,
      onaylayan_id, onay_tarihi, karar_notu,
      odeme_tarihi, odeyen_id, ilk_kesinti_donemi, olusturma_tarih,
      avans_taksitleri ( id, sira, donem, tutar, kesinti_tarihi, kesen_id )
    `)
    .eq('kullanici_id', Number(kullaniciId))
    .order('olusturma_tarih', { ascending: false })
  if (error) { console.error('[avanslarim]', error.message); return [] }

  const onaylayanIdler = [...new Set((data || []).map(r => r.onaylayan_id).filter(Boolean))]
  let adMap = new Map()
  if (onaylayanIdler.length) {
    const { data: k } = await supabase.from('kullanicilar').select('id, ad').in('id', onaylayanIdler)
    adMap = new Map((k || []).map(x => [Number(x.id), x.ad]))
  }

  // ⚠️ toCamel iç içe diziyi düzleştirmez (web dersi) — taksitleri elle çevir + sırala
  return (data || []).map(r => {
    const taksitler = arrayToCamel(r.avans_taksitleri || []).sort((a, b) => a.sira - b.sira)
    const kesilen = taksitler.filter(t => t.kesintiTarihi)
    const kesilenTutar = kesilen.reduce((s, t) => s + Number(t.tutar || 0), 0)
    const { avansTaksitleri, ...temel } = toCamel(r)
    return {
      ...temel,
      taksitler,
      onaylayanAd: r.onaylayan_id ? (adMap.get(Number(r.onaylayan_id)) || null) : null,
      kesilenTaksit: kesilen.length,
      kesilenTutar,
      // Ödenmemiş avansta borç DOĞMAMIŞTIR — plan yok, kalan da 0
      kalanBorc: r.odeme_tarihi ? Number(r.tutar || 0) - kesilenTutar : 0,
      sonrakiTaksit: taksitler.find(t => !t.kesintiTarihi) || null,
    }
  })
}

/** Yeni avans talebi — durum 'bekliyor'. Bildirimi DB trigger'ı gönderir. */
export const avansTalepEkle = async ({ kullaniciId, tutar, taksitSayisi, gerekce }) => {
  if (!kullaniciId) throw new Error('Oturum bulunamadı.')
  const t = tutarCoz(tutar)
  if (!Number.isFinite(t) || t <= 0) throw new Error('Geçerli bir avans tutarı girin.')
  const taksit = Number(taksitSayisi) || 1
  if (taksit < 1 || taksit > MAKS_TAKSIT) throw new Error(`Taksit sayısı 1–${MAKS_TAKSIT} arasında olmalı.`)

  const { data, error } = await supabase
    .from('avans_talepleri')
    .insert({
      kullanici_id: Number(kullaniciId),
      tutar: t,
      taksit_sayisi: taksit,
      gerekce: (gerekce || '').trim() || null,
      durum: 'bekliyor',
    })
    .select('id, tutar, taksit_sayisi, durum, olusturma_tarih')
    .single()
  if (error) throw error
  return toCamel(data)
}

/** Kendi bekleyen avans talebini iptal et (RLS: kendi + durum='bekliyor'). */
export const avansIptal = async (id) => {
  const { error } = await supabase
    .from('avans_talepleri')
    .update({ durum: 'iptal' })
    .eq('id', id)
  if (error) throw error
}
