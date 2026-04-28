import { supabase } from './../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

// Sayfalı görüşme listesi (mobile için infinite scroll)
export const gorusmeleriGetir = async ({ baslangic = 0, limit = 30, hazirlayan = null, q = null } = {}) => {
  let query = supabase
    .from('gorusmeler')
    .select('*')
    .order('olusturma_tarih', { ascending: false })

  if (hazirlayan) {
    query = query.eq('hazirlayan', hazirlayan)
  }
  if (q && q.trim()) {
    const aranan = `%${q.trim()}%`
    query = query.or(`firma_adi.ilike.${aranan},musteri_adi.ilike.${aranan},konu.ilike.${aranan},notlar.ilike.${aranan}`)
  }

  const { data, error } = await query.range(baslangic, baslangic + limit - 1)
  if (error) {
    console.warn('[gorusme] liste hatası:', error.message)
    return []
  }
  return arrayToCamel(data ?? [])
}

export const gorusmeGetir = async (id) => {
  const { data, error } = await supabase.from('gorusmeler').select('*').eq('id', id).single()
  if (error) {
    console.warn('[gorusme] tek getir hatası:', error.message)
    return null
  }
  return toCamel(data)
}

export const gorusmeEkle = async (gorusme) => {
  const { id, olusturmaTarih, ...rest } = gorusme
  const { data, error } = await supabase
    .from('gorusmeler')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('[gorusme] ekle hatası:', error.message)
    return null
  }
  return toCamel(data)
}
