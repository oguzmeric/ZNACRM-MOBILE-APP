import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

/**
 * LİSTE kolonları — ⚠️ `select('*')` KULLANMA.
 *
 * servis_talepleri tablosunda `personel_imza` (base64 imza) ve dolu form
 * alanları var. Filtresiz `select('*')` her kaydın imzasını da indiriyordu;
 * kayıt sayısı büyüdükçe istemcinin 5 sn'lik fetch bütçesi aşılıyor,
 * tumSayfalariCek hatada sessizce `break` ettiği için ekran BOŞ kalıyordu
 * ("Tümü sekmesi yüklenmiyor" — 14.08).
 *
 * Buradaki alanlar ServisTalepleriScreen'in gerçekten kullandıklarıdır
 * (+ filtre/sıralama için gerekli olanlar).
 */
const LISTE_KOLONLARI = [
  'id', 'talep_no', 'konu', 'durum', 'aciliyet', 'ana_tur',
  'firma_adi', 'musteri_ad', 'planli_tarih',
  'atanan_kullanici_id', 'atanan_kullanici_ad', 'olusturma_tarihi',
].join(',')

// Liste için makul üst sınır — sahada tarih sırasına göre en yeniler önemli.
const LISTE_LIMIT = 400

/**
 * Liste sorgusu — hafif kolon seti + limit.
 *
 * ⚠️ Kolon whitelist'i PostgREST'te YANLIŞ AD = 400 + BOŞ LİSTE demek (sessiz).
 * Bu yüzden hata gelirse `select('*')`e düşülür: liste yavaş da olsa çalışır,
 * kullanıcı boş ekranla kalmaz. Hata `console.warn` ile iz bırakır.
 */
const listeCek = async (filtreKur = (q) => q) => {
  const kur = (secim) =>
    filtreKur(supabase.from('servis_talepleri').select(secim))
      .order('olusturma_tarihi', { ascending: false })
      .order('id', { ascending: false })   // tiebreaker
      .limit(LISTE_LIMIT)

  const { data, error } = await kur(LISTE_KOLONLARI)
  if (!error) return arrayToCamel(data ?? [])

  console.warn('[servis listesi] kolon seti reddedildi, select(*) ile tekrar:', error.message)
  const { data: hepsi, error: hata2 } = await kur('*')
  if (hata2) throw new Error(hata2.message)
  return arrayToCamel(hepsi ?? [])
}

export const servisTalepleriniGetir = async () => listeCek()

export const banaAtananTalepler = async (kullaniciId) =>
  listeCek((q) => q.eq('atanan_kullanici_id', kullaniciId))

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

// ⚠️ LISTE_KOLONLARI ŞART (19.08 ölçümü): tablo 178 satır ama 33 MB —
// personel_imza (ort. 126 kB) + musteri_imza (ort. 72 kB) base64 satırda
// duruyor, tablonun %97'si bu iki kolon. Bu üç fonksiyon tumSayfalariCek
// üzerinden select('*') yapıyordu; her satırda ~200 kB imza iniyordu ve
// sorgunun DB ortalaması 1160 ms'ydi. Liste ekranları imzayı hiç göstermiyor.
export const acikTalepler = async () => {
  const data = await tumSayfalariCek('servis_talepleri', (q) =>
    q.not('durum', 'in', KAPALI_DURUMLAR).order('olusturma_tarihi', { ascending: false }),
    LISTE_KOLONLARI
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
// ⚠️ count+1 DEĞİL max+1: talepler silindikçe count en büyük numaranın gerisine
// düşüyor, count+1 DOLU bir numaraya denk gelince UNIQUE ihlali = mobilden
// "Talep oluşturulamadı" (05.08: 68 kayıt / max 97, TLP-2026-0069 doluydu).
// Zero-pad'li numaralarda string sıralaması sayısal sırayla aynı.
export const sonrakiTalepNo = async (prefix = 'TLP') => {
  const yil = new Date().getFullYear()
  const { data } = await supabase
    .from('servis_talepleri')
    .select('talep_no')
    .like('talep_no', `${prefix}-${yil}-%`)
    .order('talep_no', { ascending: false })
    .limit(1)
  const enBuyuk = Number(data?.[0]?.talep_no?.match(/\d+$/)?.[0] ?? 0)
  return `${prefix}-${yil}-${String(enBuyuk + 1).padStart(4, '0')}`
}

export const servisTalepEkle = async (talep) => {
  const { id, olusturmaTarihi, guncellemeTarihi, ...rest } = talep
  let { data, error } = await supabase
    .from('servis_talepleri')
    .insert(toSnake(rest))
    .select()
    .single()
  // Numara çakışması (iki kullanıcı aynı anda talep açtı ya da istemci sayacı
  // şaştı): numarayı DB trigger'ına bırakıp BİR kez daha dene — trigger boş
  // talep_no görünce TLP üretiyor. Talep kaybolmasın; prefix TLP'ye düşebilir.
  if (error?.code === '23505' && rest.talepNo) {
    ;({ data, error } = await supabase
      .from('servis_talepleri')
      .insert(toSnake({ ...rest, talepNo: null }))
      .select()
      .single())
  }
  if (error) {
    console.error('servisTalepEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Görevden servis talebi oluştur — iki yönlü FK ile bağlar
// gorev: { id, baslik, aciklama, musteriId, firmaAdi, lokasyonId?, atananId?, atananAd?, gorusmeId?, bitisTarihi? }
export const talepOlusturGorevden = async (gorev, kullanici) => {
  // Lokasyon adını çek (varsa)
  let lokasyonMetni = ''
  if (gorev.lokasyonId) {
    const { data: lok } = await supabase
      .from('musteri_lokasyonlari').select('ad').eq('id', gorev.lokasyonId).maybeSingle()
    lokasyonMetni = lok?.ad || ''
  }
  // Müşteri kaydı (telefon, vs. için)
  let musteri = null
  if (gorev.musteriId) {
    const { data } = await supabase
      .from('musteriler').select('*').eq('id', gorev.musteriId).maybeSingle()
    musteri = data ? toCamel(data) : null
  }

  const talepNo = await sonrakiTalepNo('TLP')
  const yeniTalep = {
    talepNo,
    musteriId: gorev.musteriId || null,
    musteriAd: musteri ? `${musteri.ad || ''} ${musteri.soyad || ''}`.trim() : '',
    firmaAdi: gorev.firmaAdi || musteri?.firma || '',
    anaTur: 'ariza',
    altKategori: '',
    konu: gorev.baslik,
    aciklama: gorev.aciklama || '',
    aciliyet: 'normal',
    lokasyon: lokasyonMetni,
    cihazTuru: '',
    ilgiliKisi: musteri ? `${musteri.ad || ''} ${musteri.soyad || ''}`.trim() : kullanici?.ad || '',
    telefon: musteri?.telefon || '',
    durum: gorev.atananId ? 'atandi' : 'bekliyor',
    atananKullaniciId: gorev.atananId || null,
    atananKullaniciAd: gorev.atananAd || null,
    planliTarih: gorev.bitisTarihi || null,
    notlar: [],
    durumGecmisi: [
      {
        durum: 'bekliyor',
        tarih: new Date().toISOString(),
        kullaniciAd: kullanici?.ad || '',
        aciklama: 'Görevden oluşturuldu',
      },
    ],
    musteriOnay: null,
    gorevId: gorev.id,
    gorusmeId: gorev.gorusmeId || null,
  }
  const yeni = await servisTalepEkle(yeniTalep)
  if (!yeni) return null
  // Görev tarafına geri bağla (FK iki yönlü olur)
  try {
    await supabase
      .from('gorevler')
      .update({ servis_talep_id: yeni.id })
      .eq('id', gorev.id)
  } catch (err) {
    console.error('[talepOlusturGorevden] görev FK güncelleme hatası:', err)
  }
  return yeni
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
      // `kullaniciAd` WEB ile ortak alan adı. Eskiden yalnız `kullanici`
      // yazılıyordu ve mobilden yapılan durum değişiklikleri web zaman
      // çizelgesinde isimsiz görünüyordu. İkisi de yazılıyor: eski mobil
      // sürümler `kullanici`yı okumaya devam ediyor.
      kullaniciAd: kullaniciAd ?? '',
      kullanici: kullaniciAd ?? '',
      tarih: new Date().toISOString(),
    },
  ]

  return servisTalepGuncelle(id, {
    durum: yeniDurum,
    durumGecmisi: yeniGecmis,
  })
}

// Talep başlığını değiştir (web ServisTalepDetay ile aynı davranış).
// Geçmiş kaydı WEB FORMATINDA yazılır ({tip,durum,tarih,kullaniciAd,aciklama}) —
// web'in zaman çizelgesi `kullaniciAd` okuyor, `kullanici` yazarsak isim boş çıkar.
export const baslikGuncelle = async (id, yeniKonu, kullaniciAd) => {
  const temiz = String(yeniKonu || '').trim()
  if (!temiz) return null
  const mevcut = await servisTalepGetir(id)
  if (!mevcut) return null
  if (temiz === (mevcut.konu || '')) return mevcut   // değişmediyse geçmişi kirletme

  const yeniGecmis = [
    ...(mevcut.durumGecmisi ?? []),
    {
      tip: 'baslik',
      durum: mevcut.durum,
      tarih: new Date().toISOString(),
      kullaniciAd: kullaniciAd ?? 'Sistem',
      aciklama: `Başlık değişti: "${mevcut.konu || '—'}" → "${temiz}"`,
    },
  ]
  return servisTalepGuncelle(id, { konu: temiz, durumGecmisi: yeniGecmis })
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
    q.eq('durum', 'bekliyor').order('olusturma_tarihi', { ascending: false }),
    LISTE_KOLONLARI
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
    q.eq('durum', 'tamamlandi').order('guncelleme_tarihi', { ascending: false }),
    LISTE_KOLONLARI
  )
  return arrayToCamel(data)
}

export const servisTalepSil = async (id) => {
  await supabase.from('servis_talepleri').delete().eq('id', id)
}

// Servis konu başlıkları — SABİT LİSTE (web mig 285 ile aynı tablo).
// Konu artık serbest metin değil; detay Açıklama alanına yazılır.
export const aktifKonulariGetir = async () => {
  const { data, error } = await supabase
    .from('servis_konulari')
    .select('id, ad, sira')
    .eq('aktif', true)
    .order('sira')
    .order('ad')
  if (error) { console.error('[aktifKonulariGetir]', error.message); return [] }
  return arrayToCamel(data)
}
