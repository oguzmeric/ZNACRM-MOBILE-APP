import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const DURUMLAR = [
  { id: 'depoda', isim: 'Depoda', renk: '#3b82f6', ikon: '📦' },
  { id: 'teknisyende', isim: 'Teknisyende', renk: '#a855f7', ikon: '🚚' },
  { id: 'sahada', isim: 'Sahada', renk: '#10b981', ikon: '✅' },
  { id: 'arizada', isim: 'Arızalı (Teknisyende)', renk: '#f59e0b', ikon: '⚠️' },
  { id: 'arizali_depoda', isim: 'Arızalı Depoda', renk: '#dc2626', ikon: '🔧' },
  { id: 'tamirde', isim: 'Tamirde (Üretici)', renk: '#ec4899', ikon: '🛠️' },
  { id: 'hurda', isim: 'Hurda', renk: '#6b7280', ikon: '🗑️' },
]

export const durumBul = (id) => DURUMLAR.find((d) => d.id === id)

// Tüm kalemleri getir (Stok ekranı için)
// S/N'li cihazlar (stok_kalemleri) + sarf malzemeler (stok_urunler'da S/N karşılığı olmayanlar)
export const tumKalemleriGetir = async () => {
  const [kalemlerRaw, urunlerRaw] = await Promise.all([
    tumSayfalariCek('stok_kalemleri', (q) => q.order('guncelleme_tarih', { ascending: false })),
    tumSayfalariCek('stok_urunler'),
  ])

  const kalemler = arrayToCamel(kalemlerRaw) ?? []
  const urunler = arrayToCamel(urunlerRaw) ?? []

  const seriKodlar = new Set(kalemler.map((k) => k.stokKodu).filter(Boolean))
  const sarflar = urunler
    .filter((u) => !seriKodlar.has(u.stokKodu))
    .map((u) => ({ ...u, tip: 'bulk', id: `bulk-${u.stokKodu}` }))

  return [...kalemler.map((k) => ({ ...k, tip: 'seri' })), ...sarflar]
}

// Modeller özet — hem stok_urunler (katalog) hem stok_kalemleri (S/N'li) okur, birleştirir.
// İki tip kayıt çıkar:
//   tip = 'seri'  → S/N takipli, A/B/C kırılımı var
//   tip = 'bulk'  → Toplu (kablo, vida vs.), sadece stok_miktari var
export const modellerOzetiniGetir = async () => {
  const [urunlerRaw, kalemlerRaw] = await Promise.all([
    tumSayfalariCek('stok_urunler'),
    tumSayfalariCek('stok_kalemleri', (q) =>
      q.order('guncelleme_tarih', { ascending: false })
    ),
  ])

  const urunler = arrayToCamel(urunlerRaw) ?? []
  const kalemler = kalemlerRaw ?? []

  // Önce stok_kalemleri'ni stok_kodu bazında grupla
  const kalemMap = new Map()
  for (const k of kalemler) {
    const key = k.stok_kodu ?? '(kodsuz)'
    if (!kalemMap.has(key)) {
      kalemMap.set(key, {
        marka: k.marka ?? null,
        model: k.model ?? null,
        toplam: 0,
        depoda: 0,
        teknisyende: 0,
        sahada: 0,
        arizada: 0,
        hurda: 0,
      })
    }
    const row = kalemMap.get(key)
    row.toplam += 1
    if (k.durum && row[k.durum] !== undefined) row[k.durum] += 1
    if (!row.marka && k.marka) row.marka = k.marka
    if (!row.model && k.model) row.model = k.model
  }

  // urunler ile kalem mapini birleştir
  const sonuc = []
  const islenenKodlar = new Set()

  // Önce katalogdan (stok_urunler) hepsini geç
  for (const u of urunler) {
    const kalemOzet = kalemMap.get(u.stokKodu)
    islenenKodlar.add(u.stokKodu)
    if (kalemOzet && kalemOzet.toplam > 0) {
      // S/N takipli model
      sonuc.push({
        tip: 'seri',
        stokKodu: u.stokKodu,
        stokAdi: u.stokAdi,
        marka: kalemOzet.marka || u.marka || null,
        model: kalemOzet.model || u.stokAdi,
        birim: u.birim ?? 'Adet',
        stokMiktari: u.stokMiktari ?? 0,
        ...kalemOzet,
        mevcut: kalemOzet.depoda + kalemOzet.teknisyende,
      })
    } else {
      // Bulk / toplu (S/N yok, sadece stok_urunler'da)
      sonuc.push({
        tip: 'bulk',
        stokKodu: u.stokKodu,
        stokAdi: u.stokAdi,
        marka: u.marka ?? null,
        model: u.stokAdi,
        birim: u.birim ?? 'Adet',
        stokMiktari: u.stokMiktari ?? 0,
        minStok: u.minStok ?? null,
      })
    }
  }

  // stok_urunler'da olmayıp sadece kalemleri olan modelleri de ekle
  for (const [stokKodu, kalemOzet] of kalemMap.entries()) {
    if (islenenKodlar.has(stokKodu)) continue
    sonuc.push({
      tip: 'seri',
      stokKodu,
      stokAdi: kalemOzet.model || stokKodu,
      marka: kalemOzet.marka,
      model: kalemOzet.model,
      birim: 'Adet',
      stokMiktari: kalemOzet.depoda + kalemOzet.teknisyende,
      ...kalemOzet,
      mevcut: kalemOzet.depoda + kalemOzet.teknisyende,
      katalogdaYok: true, // bilgilendirme
    })
  }

  // S/N'li olanlar üstte (toplama göre), sonra bulk'lar (stok_miktari'na göre)
  sonuc.sort((a, b) => {
    if (a.tip !== b.tip) return a.tip === 'seri' ? -1 : 1
    if (a.tip === 'seri') return (b.toplam ?? 0) - (a.toplam ?? 0)
    return (b.stokMiktari ?? 0) - (a.stokMiktari ?? 0)
  })

  return sonuc
}

// Belirli model (stok_kodu) için tüm kalemleri getir
export const modelKalemleriniGetir = async (stokKodu) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('stok_kodu', stokKodu)
    .order('guncelleme_tarih', { ascending: false })
  return arrayToCamel(data)
}

// Belirli duruma göre kalemler
export const kalemleriDurumaGoreGetir = async (durum) => {
  const data = await tumSayfalariCek('stok_kalemleri', (q) =>
    q.eq('durum', durum).order('guncelleme_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

// Müşteride bulunan tüm cihazlar
export const musteriCihazlariniGetir = async (musteriId) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('musteri_id', musteriId)
    .order('takilma_tarihi', { ascending: false, nullsFirst: false })
  return arrayToCamel(data)
}

// Belirli bir lokasyondaki cihazlar
export const lokasyonCihazlariniGetir = async (musteriLokasyonId) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('musteri_lokasyon_id', musteriLokasyonId)
    .order('takilma_tarihi', { ascending: false, nullsFirst: false })
  return arrayToCamel(data)
}

// Teknisyenin üzerindeki ürünler (zimmetli)
export const teknisyenStoktariniGetir = async (teknisyenId) => {
  const data = await tumSayfalariCek('stok_kalemleri', (q) =>
    q.eq('teknisyen_id', teknisyenId).eq('durum', 'teknisyende').order('guncelleme_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

// S/N veya barkod ile arama (Tara ekranı için)
export const kalemAra = async (kod) => {
  if (!kod?.trim()) return null
  const k = kod.trim()
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .or(`seri_no.eq.${k},barkod.eq.${k}`)
    .limit(1)
    .maybeSingle()
  return data ? toCamel(data) : null
}

// Metin ile arama (model, marka, S/N, barkod) — hem S/N'li cihazlar hem sarf malzemeler
export const kalemMetinAra = async (q) => {
  if (!q?.trim()) return tumKalemleriGetir()
  const term = `%${q.trim()}%`
  const [kalemlerRes, urunlerRes] = await Promise.all([
    supabase
      .from('stok_kalemleri')
      .select('*')
      .or(`seri_no.ilike.${term},barkod.ilike.${term},marka.ilike.${term},model.ilike.${term},stok_kodu.ilike.${term}`)
      .order('guncelleme_tarih', { ascending: false })
      .limit(100),
    supabase
      .from('stok_urunler')
      .select('*')
      .or(`marka.ilike.${term},stok_adi.ilike.${term},stok_kodu.ilike.${term}`)
      .limit(50),
  ])

  const kalemler = arrayToCamel(kalemlerRes.data) ?? []
  const urunler = arrayToCamel(urunlerRes.data) ?? []

  const seriKodlar = new Set(kalemler.map((k) => k.stokKodu).filter(Boolean))
  const sarflar = urunler
    .filter((u) => !seriKodlar.has(u.stokKodu))
    .map((u) => ({ ...u, tip: 'bulk', id: `bulk-${u.stokKodu}` }))

  return [...kalemler.map((k) => ({ ...k, tip: 'seri' })), ...sarflar]
}

export const stokKalemGetir = async (id) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('id', id)
    .single()
  return toCamel(data)
}

export const stokKalemEkle = async (kalem) => {
  const { id, olusturmaTarih, guncellemeTarih, ...rest } = kalem

  // 1) ÖNCE stok_urunler (katalog) satırını garanti altına al
  // Böylece stok_kalemleri insert olduğunda trigger onun stok_miktari'sini doğru günceller
  if (rest.stokKodu) {
    const { data: mevcut } = await supabase
      .from('stok_urunler')
      .select('stok_kodu')
      .eq('stok_kodu', rest.stokKodu)
      .maybeSingle()
    if (!mevcut) {
      const urunAd = [rest.marka, rest.model].filter(Boolean).join(' ').trim() || rest.stokKodu
      await supabase.from('stok_urunler').insert({
        stok_kodu: rest.stokKodu,
        stok_adi: urunAd,
        birim: 'Adet',
        stok_miktari: 0,
        aciklama: rest.notlar ?? null,
      })
    }
  }

  // 2) SONRA stok_kalemleri insert — trigger fire edip stok_miktari'yi +1 yapar
  const { data, error } = await supabase
    .from('stok_kalemleri')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('stokKalemEkle hata:', error.message)
    return null
  }

  return toCamel(data)
}

export const stokKalemGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarih, guncellemeTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('stok_kalemleri')
    .update({
      ...toSnake(rest),
      guncelleme_tarih: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('stokKalemGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const stokKalemSil = async (id) => {
  await supabase.from('stok_kalemleri').delete().eq('id', id)
}

// Hareket kaydı ekle (audit log)
export const hareketEkle = async (hareket) => {
  const { id, tarih, ...rest } = hareket
  const { data, error } = await supabase
    .from('stok_kalemi_hareketleri')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('hareketEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Bir kalemin tüm hareket geçmişi (yeniden eskiye)
export const kalemHareketleriniGetir = async (kalemId) => {
  const { data } = await supabase
    .from('stok_kalemi_hareketleri')
    .select('*')
    .eq('kalem_id', kalemId)
    .order('tarih', { ascending: false })
  return arrayToCamel(data)
}

// === İŞLEMLER ===
export const cihazTak = async ({
  kalemId,
  musteriId,
  musteriLokasyonId,
  kullaniciId,
  kullaniciAd,
  servisTalepId = null,
  not = null,
  enlem = null,
  boylam = null,
}) => {
  const mevcut = await stokKalemGetir(kalemId)
  if (!mevcut) return null

  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'sahada',
    musteriId,
    musteriLokasyonId,
    teknisyenId: null,
    takilmaTarihi: new Date().toISOString(),
    sokulmeTarihi: null,
  })

  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'takildi',
      kaynakAciklama: mevcut.teknisyenId ? 'Teknisyenden' : 'Depodan',
      hedefAciklama: 'Müşteri sahası',
      musteriId,
      musteriLokasyonId,
      servisTalepId,
      kullaniciId,
      kullaniciAd,
      enlem,
      boylam,
      notMetni: not,
    })
  }
  return guncel
}

export const cihazSok = async ({
  kalemId,
  yeniDurum = 'arizada',
  kullaniciId,
  kullaniciAd,
  servisTalepId = null,
  not = null,
  enlem = null,
  boylam = null,
}) => {
  const mevcut = await stokKalemGetir(kalemId)
  if (!mevcut) return null

  const guncel = await stokKalemGuncelle(kalemId, {
    durum: yeniDurum,
    musteriId: yeniDurum === 'hurda' ? mevcut.musteriId : null,
    musteriLokasyonId: null,
    sokulmeTarihi: new Date().toISOString(),
  })

  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'sokuldu',
      kaynakAciklama: mevcut.musteriId ? 'Müşteri sahası' : 'Önceki konum',
      hedefAciklama: yeniDurum === 'depoda' ? 'Depo' : yeniDurum === 'hurda' ? 'Hurda' : 'Arıza',
      musteriId: mevcut.musteriId,
      musteriLokasyonId: mevcut.musteriLokasyonId,
      servisTalepId,
      kullaniciId,
      kullaniciAd,
      enlem,
      boylam,
      notMetni: not,
    })
  }
  return guncel
}

export const teknisyeneZimmetle = async ({
  kalemId,
  teknisyenId,
  teknisyenAd = null,
  kullaniciId,
  kullaniciAd,
  not = null,
}) => {
  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'teknisyende',
    teknisyenId,
    musteriId: null,
    musteriLokasyonId: null,
  })
  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'teknisyene_zimmet',
      kaynakAciklama: 'Depo',
      hedefAciklama: teknisyenAd ? `Personel: ${teknisyenAd}` : 'Personel',
      kullaniciId,
      kullaniciAd,
      notMetni: not,
    })
  }
  return guncel
}

// Arızalı cihazı merkezi arıza depoya teslim et (teknisyende → arizali_depoda)
export const arizaliDepoyaTeslim = async ({
  kalemId,
  kullaniciId,
  kullaniciAd,
  not = null,
}) => {
  const mevcut = await stokKalemGetir(kalemId)
  if (!mevcut) return null

  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'arizali_depoda',
    teknisyenId: null,
    musteriId: null,
    musteriLokasyonId: null,
  })
  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'ariza_bildirildi',
      kaynakAciklama: mevcut.teknisyenId ? 'Teknisyenden (arızalı)' : 'Sahadan (arızalı)',
      hedefAciklama: 'Arızalı Depo',
      kullaniciId,
      kullaniciAd,
      notMetni: not,
    })
  }
  return guncel
}

// Arızalı cihazı üreticiye/tamire gönder (arizali_depoda → tamirde)
export const tamireGonder = async ({
  kalemId,
  ureticiFirma = null,
  kullaniciId,
  kullaniciAd,
  not = null,
}) => {
  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'tamirde',
  })
  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'tamire_gonderildi',
      kaynakAciklama: 'Arızalı Depo',
      hedefAciklama: ureticiFirma ? `Üretici: ${ureticiFirma}` : 'Üretici / Servis',
      kullaniciId,
      kullaniciAd,
      notMetni: not,
    })
  }
  return guncel
}

// Tamir edilmiş cihaz geri geldi (tamirde → depoda)
export const tamirdenDon = async ({
  kalemId,
  kullaniciId,
  kullaniciAd,
  not = null,
}) => {
  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'depoda',
  })
  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'tamir_edildi',
      kaynakAciklama: 'Üretici / Servis',
      hedefAciklama: 'Depo',
      kullaniciId,
      kullaniciAd,
      notMetni: not ?? 'Tamir edildi, tekrar kullanıma hazır',
    })
  }
  return guncel
}

// Personelden iade — teknisyenden depoya geri dönüş
export const personeldenIade = async ({
  kalemId,
  kullaniciId,
  kullaniciAd,
  not = null,
}) => {
  const mevcut = await stokKalemGetir(kalemId)
  if (!mevcut) return null

  const guncel = await stokKalemGuncelle(kalemId, {
    durum: 'depoda',
    teknisyenId: null,
    musteriId: null,
    musteriLokasyonId: null,
  })
  if (guncel) {
    await hareketEkle({
      kalemId,
      hareket: 'depoya_donus',
      kaynakAciklama: 'Personel',
      hedefAciklama: 'Depo',
      kullaniciId,
      kullaniciAd,
      notMetni: not,
    })
  }
  return guncel
}
