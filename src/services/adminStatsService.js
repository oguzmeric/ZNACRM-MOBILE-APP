import { supabase } from '../lib/supabase'
import { KAPALI_DURUMLAR } from './servisService'

// Yönetim paneli KPI verileri — sayım sorguları

// Atanmamış / onay bekleyen servis talepleri (aynı şey: durum='bekliyor')
export const onayBekleyenSayisi = async () => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .eq('durum', 'bekliyor')
  return count ?? 0
}
export const atanmamisSayisi = onayBekleyenSayisi

// Aktif (henüz kapanmamış) servis talepleri — servisService ile aynı tanım
export const aktifServisSayisi = async () => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .not('durum', 'in', KAPALI_DURUMLAR)
  return count ?? 0
}

// Kronik arıza: aynı cihaz S/N üzerinde 3+ arıza servis talebi
// cihaz_turu alanından " · S/N: xxxxx" pattern'ini regex ile çıkarıp grupluyoruz
const SN_REGEX = /S\/N\s*[:：]\s*([A-Za-z0-9\-_.]+)/i
export const kronikArizaListesi = async () => {
  const { data } = await supabase
    .from('servis_talepleri')
    .select('cihaz_turu, durum, ana_tur')
    .eq('ana_tur', 'ariza')
    .range(0, 9999)
  if (!data) return []
  const sayac = new Map()
  for (const satir of data) {
    if (!satir.cihaz_turu) continue
    const m = satir.cihaz_turu.match(SN_REGEX)
    const anahtar = m ? m[1].trim().toUpperCase() : null
    if (!anahtar) continue
    sayac.set(anahtar, (sayac.get(anahtar) ?? 0) + 1)
  }
  return [...sayac.entries()]
    .filter(([, sayi]) => sayi >= 3)
    .map(([seriNo, sayi]) => ({ seriNo, arizaSayisi: sayi }))
    .sort((a, b) => b.arizaSayisi - a.arizaSayisi)
}

export const kronikArizaSayisi = async () => {
  const liste = await kronikArizaListesi()
  return liste.length
}

// Aktivite feed'i — son 20 olay (servis, destek, kullanıcı eklemeleri)
export const aktiviteFeed = async (limit = 20) => {
  const [servisRes, destekRes, kullaniciRes] = await Promise.all([
    supabase
      .from('servis_talepleri')
      .select('id, talep_no, firma_adi, durum, olusturma_tarihi, guncelleme_tarihi, atanan_kullanici_ad')
      .order('guncelleme_tarihi', { ascending: false })
      .limit(limit),
    supabase
      .from('destek_talepleri')
      .select('id, kullanici_ad, durum, olusturma_tarih, cevap_tarihi')
      .order('olusturma_tarih', { ascending: false })
      .limit(limit),
    supabase
      .from('kullanicilar')
      .select('id, ad, unvan, olusturma_tarih')
      .order('olusturma_tarih', { ascending: false })
      .limit(limit / 2),
  ])

  const olaylar = []
  for (const s of servisRes.data ?? []) {
    const olusturma = s.olusturma_tarihi
    const guncelleme = s.guncelleme_tarihi ?? s.olusturma_tarihi
    if (s.durum === 'onaylandi') {
      olaylar.push({
        id: `servis-onay-${s.id}`,
        tip: 'servis_onay',
        tarih: guncelleme,
        metin: `${s.talep_no ?? '#' + s.id} onaylandı`,
        altMetin: s.firma_adi,
        ikon: 'check-circle',
        renk: '#10b981',
        rota: { name: 'ServisDetay', params: { id: s.id } },
      })
    } else if (s.durum === 'reddedildi') {
      olaylar.push({
        id: `servis-red-${s.id}`,
        tip: 'servis_red',
        tarih: guncelleme,
        metin: `${s.talep_no ?? '#' + s.id} reddedildi`,
        altMetin: s.firma_adi,
        ikon: 'x-circle',
        renk: '#dc2626',
        rota: { name: 'ServisDetay', params: { id: s.id } },
      })
    } else if (s.durum === 'tamamlandi') {
      olaylar.push({
        id: `servis-tmm-${s.id}`,
        tip: 'servis_tamam',
        tarih: guncelleme,
        metin: `${s.talep_no ?? '#' + s.id} tamamlandı · onay bekliyor`,
        altMetin: s.firma_adi,
        ikon: 'clock',
        renk: '#22c55e',
        rota: { name: 'ServisDetay', params: { id: s.id } },
      })
    } else {
      olaylar.push({
        id: `servis-yeni-${s.id}`,
        tip: 'servis_yeni',
        tarih: olusturma,
        metin: `Yeni servis: ${s.talep_no ?? '#' + s.id}`,
        altMetin: s.firma_adi,
        ikon: 'plus-circle',
        renk: '#2563eb',
        rota: { name: 'ServisDetay', params: { id: s.id } },
      })
    }
  }
  for (const d of destekRes.data ?? []) {
    olaylar.push({
      id: `destek-${d.id}`,
      tip: 'destek',
      tarih: d.cevap_tarihi ?? d.olusturma_tarih,
      metin: d.cevap_tarihi ? 'Destek cevaplandı' : `Yeni destek talebi`,
      altMetin: d.kullanici_ad,
      ikon: 'help-circle',
      renk: d.cevap_tarihi ? '#3b82f6' : '#f59e0b',
      rota: { name: 'AdminDestekTalepleri' },
    })
  }
  for (const k of kullaniciRes.data ?? []) {
    if (!k.olusturma_tarih) continue
    olaylar.push({
      id: `kullanici-${k.id}`,
      tip: 'kullanici',
      tarih: k.olusturma_tarih,
      metin: `Yeni kullanıcı: ${k.ad}`,
      altMetin: k.unvan,
      ikon: 'user-plus',
      renk: '#a855f7',
    })
  }

  return olaylar
    .filter((o) => o.tarih)
    .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
    .slice(0, limit)
}

// Dönem bazlı istatistik — bugün, 7 gün, 30 gün, bu ay, tüm zamanlar
export const donemIstatistigi = async (baslangicTarihi) => {
  const baslangic = baslangicTarihi ? baslangicTarihi.toISOString() : null
  let q = supabase.from('servis_talepleri').select('durum, ana_tur, olusturma_tarihi, atanan_kullanici_ad')
  if (baslangic) q = q.gte('olusturma_tarihi', baslangic)
  const { data } = await q.range(0, 19999)
  if (!data) return null

  const durumSay = {}
  const turSay = {}
  const personelSay = {}
  for (const r of data) {
    durumSay[r.durum] = (durumSay[r.durum] ?? 0) + 1
    if (r.ana_tur) turSay[r.ana_tur] = (turSay[r.ana_tur] ?? 0) + 1
    if (r.atanan_kullanici_ad) {
      personelSay[r.atanan_kullanici_ad] = (personelSay[r.atanan_kullanici_ad] ?? 0) + 1
    }
  }
  const topPersonel = Object.entries(personelSay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([ad, sayi]) => ({ ad, sayi }))
  return {
    toplam: data.length,
    durumSay,
    turSay,
    topPersonel,
  }
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
