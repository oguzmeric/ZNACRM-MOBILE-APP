import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'
import { cihazKayitBaslat, aktifKaydiSok } from './cihazKayitService'

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
    tumSayfalariCek('stok_kalemleri', (q) =>
      q.or('silindi.is.null,silindi.eq.false').order('guncelleme_tarih', { ascending: false })),
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
    } else if (u.seriTakipli) {
      // Seri-takipli ama henüz kalemi yok → boş seri modeli
      sonuc.push({
        tip: 'seri',
        stokKodu: u.stokKodu,
        stokAdi: u.stokAdi,
        marka: u.marka ?? null,
        model: u.stokAdi,
        birim: u.birim ?? 'Adet',
        stokMiktari: u.stokMiktari ?? 0,
        beklenenAdet: u.beklenenAdet ?? null,
        toplam: 0, depoda: 0, teknisyende: 0, sahada: 0, arizada: 0, hurda: 0,
        mevcut: 0,
      })
    } else {
      // Bulk / toplu (S/N yok, seri-takipli değil)
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
    .or('silindi.is.null,silindi.eq.false')
    .order('guncelleme_tarih', { ascending: false })
  return arrayToCamel(data)
}

// Belirli duruma göre kalemler
export const kalemleriDurumaGoreGetir = async (durum) => {
  const data = await tumSayfalariCek('stok_kalemleri', (q) =>
    q.eq('durum', durum).or('silindi.is.null,silindi.eq.false').order('guncelleme_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

// Müşteride bulunan tüm cihazlar
export const musteriCihazlariniGetir = async (musteriId) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('musteri_id', musteriId)
    .or('silindi.is.null,silindi.eq.false')
    .order('takilma_tarihi', { ascending: false, nullsFirst: false })
  return arrayToCamel(data)
}

// Belirli bir lokasyondaki cihazlar
export const lokasyonCihazlariniGetir = async (musteriLokasyonId) => {
  const { data } = await supabase
    .from('stok_kalemleri')
    .select('*')
    .eq('musteri_lokasyon_id', musteriLokasyonId)
    .or('silindi.is.null,silindi.eq.false')
    .order('takilma_tarihi', { ascending: false, nullsFirst: false })
  return arrayToCamel(data)
}

// Teknisyenin üzerindeki ürünler (zimmetli)
export const teknisyenStoktariniGetir = async (teknisyenId) => {
  const data = await tumSayfalariCek('stok_kalemleri', (q) =>
    q.eq('teknisyen_id', teknisyenId).eq('durum', 'teknisyende')
      .or('silindi.is.null,silindi.eq.false').order('guncelleme_tarih', { ascending: false })
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
    // Soft-delete edilen SN'ler taramada "hayalet Depoda" kaydı gösteriyordu
    .or('silindi.is.null,silindi.eq.false')
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
      .or('silindi.is.null,silindi.eq.false')
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

    // Cihaz tarihçesi snapshot'ı — modal SAVE ile teknik bilgiler eklenecek.
    // Fail-open: snapshot başarısız olsa bile takma işlemi bozulmasın.
    try {
      await cihazKayitBaslat({
        stokKalemiId: kalemId,
        musteriId,
        servisTalepId,
        kuranKullaniciId: kullaniciId,
        kurulumNotu: not,
      })
    } catch (e) {
      console.warn('cihazKayitBaslat (fail-open):', e?.message ?? e)
    }
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

    // Aktif snapshot'ı 'sokuldu'/'ariza' olarak kapat.
    // Fail-open: eski kayıtları olmayan cihazlar için de sökme akışı çalışsın.
    try {
      await aktifKaydiSok(kalemId, {
        sokumKullaniciId: kullaniciId,
        sokumServisTalepId: servisTalepId,
        sokumNotu: not,
        arizali: yeniDurum === 'arizada' || yeniDurum === 'arizali_depoda' || yeniDurum === 'tamirde',
      })
    } catch (e) {
      console.warn('aktifKaydiSok (fail-open):', e?.message ?? e)
    }
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

// Bir seri stringini normalize et (trim + görünmez/zero-width karakter temizliği)
const seriNormalize = (s) =>
  String(s ?? '').replace(/[​-‍﻿ ]/g, '').trim()

// Toplu seri ekle. seriler: string[] (ham). Dönüş: { eklenen, zatenVar[], bos }
// Aktif tüm SN'leri set olarak getir — duplicate anlık kontrol için (SeriTaraScreen)
export const tumSeriNumaralarıSet = async () => {
  const set = new Set()
  const rows = await tumSayfalariCek((off, size) =>
    supabase.from('stok_kalemleri')
      .select('seri_no')
      .eq('silindi', false)
      .not('seri_no', 'is', null)
      .range(off, off + size - 1)
  )
  for (const r of rows || []) {
    if (r.seri_no) set.add(String(r.seri_no).toLocaleLowerCase('tr'))
  }
  return set
}

export const serileriTopluEkle = async (stokKodu, seriler, meta = {}) => {
  // 1) Temizle + uygulama içi dedupe
  const temiz = []
  const gorulen = new Set()
  let bos = 0
  for (const ham of seriler ?? []) {
    const s = seriNormalize(ham)
    if (!s) { bos += 1; continue }
    const key = s.toLocaleLowerCase('tr')
    if (gorulen.has(key)) continue
    gorulen.add(key)
    temiz.push(s)
  }
  if (temiz.length === 0) return { eklenen: 0, zatenVar: [], bos }

  // 2) DB'de zaten var olanları ayıkla
  const { data: varOlan } = await supabase
    .from('stok_kalemleri')
    .select('seri_no')
    .in('seri_no', temiz)
  const varSet = new Set((varOlan ?? []).map((r) => (r.seri_no ?? '').toLocaleLowerCase('tr')))
  const zatenVar = temiz.filter((s) => varSet.has(s.toLocaleLowerCase('tr')))
  const eklenecek = temiz.filter((s) => !varSet.has(s.toLocaleLowerCase('tr')))
  if (eklenecek.length === 0) return { eklenen: 0, zatenVar, bos }

  // 3) Katalog satırını garanti et (trigger doğru stok_kodu görsün)
  const { data: urun } = await supabase
    .from('stok_urunler').select('stok_kodu, stok_adi, marka').eq('stok_kodu', stokKodu).maybeSingle()
  if (!urun) {
    await supabase.from('stok_urunler').insert({
      stok_kodu: stokKodu,
      stok_adi: [meta.marka, meta.model].filter(Boolean).join(' ').trim() || stokKodu,
      birim: 'Adet', stok_miktari: 0, seri_takipli: true,
    })
  }

  // 4) Batch insert (durum='depoda'). DB unique index yarış koşulunu korur;
  //    ignoreDuplicates ile çakışan satırlar sessizce atlanır.
  const rows = eklenecek.map((seri_no) => ({
    stok_kodu: stokKodu,
    seri_no,
    marka: meta.marka ?? urun?.marka ?? null,
    model: meta.model ?? null,
    durum: 'depoda',
  }))
  const { data, error } = await supabase
    .from('stok_kalemleri')
    .upsert(rows, { onConflict: 'seri_no', ignoreDuplicates: true })
    .select('id')
  if (error) {
    console.error('serileriTopluEkle hata:', error.message)
    return { eklenen: 0, zatenVar, bos, hata: error.message }
  }
  return { eklenen: (data ?? []).length, zatenVar, bos }
}

// Ürünün seri durumu: { beklenenAdet, kayitliSeri, eksik, depoda }
export const urunSeriDurumu = async (stokKodu) => {
  const [{ data: urun }, toplam, depoda] = await Promise.all([
    supabase.from('stok_urunler').select('beklenen_adet').eq('stok_kodu', stokKodu).maybeSingle(),
    supabase.from('stok_kalemleri').select('*', { count: 'exact', head: true }).eq('stok_kodu', stokKodu),
    supabase.from('stok_kalemleri').select('*', { count: 'exact', head: true }).eq('stok_kodu', stokKodu).eq('durum', 'depoda'),
  ])
  const beklenenAdet = urun?.beklenen_adet ?? null
  const kayitliSeri = toplam.count ?? 0
  const eksik = beklenenAdet != null ? Math.max(0, beklenenAdet - kayitliSeri) : null
  return { beklenenAdet, kayitliSeri, eksik, depoda: depoda.count ?? 0 }
}
