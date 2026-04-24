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
  const { data, error } = await supabase
    .from('musteriler')
    .insert(toSnake(rest))
    .select()
    .single()
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
export const sonrakiMusteriKodu = async () => {
  const { count } = await supabase
    .from('musteriler')
    .select('*', { count: 'exact', head: true })
  const sira = String((count ?? 0) + 1).padStart(3, '0')
  const d = new Date()
  const aygun = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `M${aygun}-${sira}`
}
