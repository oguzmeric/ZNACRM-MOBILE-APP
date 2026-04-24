import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const servisTalepleriniGetir = async () => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.order('olusturma_tarihi', { ascending: false })
  )
  return arrayToCamel(data)
}

export const banaAtananTalepler = async (kullaniciId) => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.eq('atanan_kullanici_id', kullaniciId).order('olusturma_tarihi', { ascending: false })
  )
  return arrayToCamel(data)
}

// Kapalı sayılan durumlar — aktif sayım/listelerden hariç
export const KAPALI_DURUMLAR = '(tamamlandi,onaylandi,iptal)'

// Bana atanan, aktif (tamamlanmamış/onaylanmamış/iptal edilmemiş) servis talebi sayısı
export const banaAtananAktifTalepSayisi = async (kullaniciId) => {
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .eq('atanan_kullanici_id', kullaniciId)
    .not('durum', 'in', KAPALI_DURUMLAR)
  return count ?? 0
}

export const acikTalepler = async () => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.not('durum', 'in', KAPALI_DURUMLAR).order('olusturma_tarihi', { ascending: false })
  )
  return arrayToCamel(data)
}

export const servisTalepGetir = async (id) => {
  const { data } = await supabase
    .from('servis_talepleri')
    .select('*')
    .eq('id', id)
    .single()
  return toCamel(data)
}

// Belirli prefix için o yılın bir sonraki numarasını üretir.
// Örn: sonrakiTalepNo('ARZ') → 'ARZ-2026-0007'
export const sonrakiTalepNo = async (prefix = 'TLP') => {
  const yil = new Date().getFullYear()
  const { count } = await supabase
    .from('servis_talepleri')
    .select('*', { count: 'exact', head: true })
    .like('talep_no', `${prefix}-${yil}-%`)
  const sira = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefix}-${yil}-${sira}`
}

export const servisTalepEkle = async (talep) => {
  const { id, olusturmaTarihi, guncellemeTarihi, ...rest } = talep
  const { data, error } = await supabase
    .from('servis_talepleri')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('servisTalepEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const servisTalepGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarihi, guncellemeTarihi, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('servis_talepleri')
    .update({
      ...toSnake(rest),
      guncelleme_tarihi: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('servisTalepGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Durum güncelle + durum_gecmisi'ne kayıt ekle
export const durumGuncelle = async (id, yeniDurum, kullaniciAd) => {
  // Önce mevcut talebi al
  const mevcut = await servisTalepGetir(id)
  if (!mevcut) return null

  const yeniGecmis = [
    ...(mevcut.durumGecmisi ?? []),
    {
      durum: yeniDurum,
      kullanici: kullaniciAd ?? '',
      tarih: new Date().toISOString(),
    },
  ]

  return servisTalepGuncelle(id, {
    durum: yeniDurum,
    durumGecmisi: yeniGecmis,
  })
}

// Notlar jsonb array — yeni not ekle
export const notEkle = async (id, metin, kullaniciAd) => {
  const mevcut = await servisTalepGetir(id)
  if (!mevcut) return null

  const yeniNotlar = [
    ...(mevcut.notlar ?? []),
    {
      metin,
      kullanici: kullaniciAd ?? '',
      tarih: new Date().toISOString(),
    },
  ]

  return servisTalepGuncelle(id, { notlar: yeniNotlar })
}

// Admin: atanmamış servis talepleri — durum='bekliyor' olanlar
export const atanmamisTalepler = async () => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.eq('durum', 'bekliyor').order('olusturma_tarihi', { ascending: false })
  )
  return arrayToCamel(data)
}

// Servis talebine teknisyen ata + durumu 'atandi' yap + geçmişe kayıt
export const servisAta = async (id, kullanici, atayanAd) => {
  const mevcut = await servisTalepGetir(id)
  if (!mevcut) return null
  const yeniGecmis = [
    ...(mevcut.durumGecmisi ?? []),
    {
      durum: 'atandi',
      kullanici: atayanAd ?? '',
      tarih: new Date().toISOString(),
      not: `${kullanici.ad} üzerine atandı`,
    },
  ]
  return servisTalepGuncelle(id, {
    atananKullaniciId: kullanici.id,
    atananKullaniciAd: kullanici.ad,
    durum: 'atandi',
    durumGecmisi: yeniGecmis,
  })
}

// Admin: onay kuyruğu — teknisyenin tamamladığı servisler
export const tamamlananTalepler = async () => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.eq('durum', 'tamamlandi').order('guncelleme_tarihi', { ascending: false })
  )
  return arrayToCamel(data)
}

export const servisTalepSil = async (id) => {
  await supabase.from('servis_talepleri').delete().eq('id', id)
}
