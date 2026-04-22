import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

export const kullaniciDestekTalepleriniGetir = async (kullaniciId) => {
  const { data } = await supabase
    .from('destek_talepleri')
    .select('*')
    .eq('kullanici_id', kullaniciId)
    .order('olusturma_tarih', { ascending: false })
  return arrayToCamel(data)
}

export const destekTalepGetir = async (id) => {
  const { data } = await supabase
    .from('destek_talepleri')
    .select('*')
    .eq('id', id)
    .single()
  return toCamel(data)
}

export const destekTalepEkle = async (talep) => {
  const { id, olusturmaTarih, ...rest } = talep
  const { data, error } = await supabase
    .from('destek_talepleri')
    .insert(toSnake(rest))
    .select()
    .single()
  if (error) {
    console.error('destekTalepEkle hata:', error.message)
    return null
  }
  return toCamel(data)
}

// Admin panelinde tüm destek talepleri
export const tumDestekTalepleriGetir = async () => {
  const { data } = await supabase
    .from('destek_talepleri')
    .select('*')
    .order('olusturma_tarih', { ascending: false })
  return arrayToCamel(data)
}

// Admin cevap yaz + durumu cevaplandi olarak işaretle
export const destekTalepCevapla = async (id, cevap, _cevaplayanAd) => {
  const { data, error } = await supabase
    .from('destek_talepleri')
    .update({
      cevap,
      cevap_tarihi: new Date().toISOString(),
      durum: 'cevaplandi',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('destekTalepCevapla hata:', error.message)
    return null
  }
  return toCamel(data)
}

export const destekTalepKapat = async (id) => {
  const { error } = await supabase
    .from('destek_talepleri')
    .update({ durum: 'kapandi' })
    .eq('id', id)
  return !error
}

export const durumEtiket = (durum) => {
  if (durum === 'acik') return { ikon: '🟡', isim: 'Açık', renk: '#f59e0b' }
  if (durum === 'cevaplandi') return { ikon: '💬', isim: 'Cevaplandı', renk: '#3b82f6' }
  if (durum === 'kapandi') return { ikon: '✅', isim: 'Kapandı', renk: '#22c55e' }
  return { ikon: '⚪', isim: durum, renk: '#94a3b8' }
}
