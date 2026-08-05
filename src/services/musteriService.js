import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const musterileriGetir = async () => {
  const data = await tumSayfalariCek('musteriler', (q) =>
    q.order('olusturma_tarih', { ascending: false })
  )
  return arrayToCamel(data)
}

export const musteriGetir = async (id) => {
  const { data } = await supabase.from('musteriler').select('*').eq('id', id).single()
  return toCamel(data)
}

export const musteriAra = async (q) => {
  if (!q?.trim()) return musterileriGetir()
  const term = `%${q.trim()}%`
  const { data } = await supabase
    .from('musteriler')
    .select('*')
    .or(`ad.ilike.${term},soyad.ilike.${term},firma.ilike.${term},telefon.ilike.${term},email.ilike.${term},kod.ilike.${term}`)
    .order('olusturma_tarih', { ascending: false })
    .limit(100)
  return arrayToCamel(data)
}

export const musteriEkle = async (musteri) => {
  const { id, olusturmaTarih, ...rest } = musteri
  let { data, error } = await supabase
    .from('musteriler')
    .insert(toSnake(rest))
    .select()
    .single()
  // Kod çakışması (eş zamanlı iki kayıt ya da sayaç şaştı): taze kod alıp
  // BİR kez daha dene — kayıt "Müşteri kodu çakışmış olabilir" diye kaybolmasın
  if (error?.code === '23505' && rest.kod) {
    const yeniKod = await sonrakiMusteriKodu()
    ;({ data, error } = await supabase
      .from('musteriler')
      .insert(toSnake({ ...rest, kod: yeniKod }))
      .select()
      .single())
  }
  if (error) {
    console.error('musteriEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const musteriGuncelle = async (id, guncellenmis) => {
  const { id: _id, olusturmaTarih, ...rest } = guncellenmis
  const { data, error } = await supabase
    .from('musteriler')
    .update(toSnake(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('musteriGuncelle hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const musteriSil = async (id) => {
  await supabase.from('musteriler').delete().eq('id', id)
}

// Otomatik müşteri kodu üret (M2604-001 gibi)
// ⚠️ count+1 DEĞİL max+1: müşteri silinince global sayaç geriler, aynı gün
// verilmiş bir kod yeniden üretilir → kod UNIQUE olduğundan kayıt patlar
// (aynı hastalık 05.08'de serviste TLP-2026-0069 ile canlıda yaşandı).
// Bugünün prefix'inde kayıt yoksa görsel süreklilik için global sayıdan devam;
// prefix o günü içerdiğinden bu dal çakışma üretemez.
export const sonrakiMusteriKodu = async () => {
  const d = new Date()
  const aygun = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const onek = `M${aygun}-`
  // Sıra hanesi sabit genişlikte değil (count tabanı 3 haneyi aşabiliyor) —
  // string sıralamasına güvenme, günün kodlarını çekip sayısal max al
  const { data } = await supabase
    .from('musteriler')
    .select('kod')
    .like('kod', `${onek}%`)
  const enBuyuk = (data ?? []).reduce((max, r) => {
    const n = Number(String(r.kod).match(/\d+$/)?.[0] ?? 0)
    return n > max ? n : max
  }, 0)
  if (enBuyuk > 0) return `${onek}${String(enBuyuk + 1).padStart(3, '0')}`
  const { count } = await supabase
    .from('musteriler')
    .select('*', { count: 'exact', head: true })
  return `${onek}${String((count ?? 0) + 1).padStart(3, '0')}`
}
