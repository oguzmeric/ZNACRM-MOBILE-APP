import { supabase, tumSayfalariCek } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'
import { bildirimEkleDb } from './bildirimService'

export const kullaniciDestekTalepleriniGetir = async (kullaniciId) => {
  const data = await tumSayfalariCek('destek_talepleri', (q) =>
    q.eq('kullanici_id', kullaniciId).order('olusturma_tarih', { ascending: false })
  )
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
  // Destek yöneticisine (Oğuz Meriç, id 2) haber ver — web ile aynı davranış.
  // bildirimler INSERT → DB trigger'ı push'u da gönderir (webden eksikti,
  // mobilden açılan talepler sessiz kalıyordu — 2026-07-17).
  try {
    const DESTEK_YONETICISI_ID = 2
    if (String(rest.kullaniciId) !== String(DESTEK_YONETICISI_ID)) {
      await bildirimEkleDb({
        aliciId: DESTEK_YONETICISI_ID,
        gonderenId: rest.kullaniciId || null,
        baslik: `🆘 Yeni destek talebi — ${rest.kullaniciAd || ''}`,
        mesaj: (rest.mesaj || '').slice(0, 90),
        tip: 'destek',
        link: '/destek',
      })
    }
  } catch (e) { console.warn('[destek] yönetici bildirimi:', e?.message) }
  return toCamel(data)
}

// Admin panelinde tüm destek talepleri
export const tumDestekTalepleriGetir = async () => {
  const data = await tumSayfalariCek('destek_talepleri', (q) =>
    q.order('olusturma_tarih', { ascending: false })
  )
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

// Silme — RLS gereği yalnız Oğuz Meriç (kullanicilar.id=2) başarılı olur (mig 190)
export const destekTalepSil = async (id) => {
  const { error } = await supabase.from('destek_talepleri').delete().eq('id', id)
  if (error) {
    console.error('destekTalepSil hata:', error.message)
    return false
  }
  return true
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

// ─── Sohbet (mig 222) ────────────────────────────────────────────────────────
// Tek 'cevap' kolonu her yanıtta öncekini eziyordu; mesajlar artık burada birikir.
export const DESTEK_YONETICISI_ID = 2

export const destekMesajlariGetir = async (talepId) => {
  if (!talepId) return []
  const { data, error } = await supabase
    .from('destek_mesajlari')
    .select('*')
    .eq('talep_id', talepId)
    .order('olusturma_tarih', { ascending: true })
  if (error) { console.warn('[destek] mesajlar:', error.message); return [] }
  return arrayToCamel(data ?? [])
}

// Talep satırını (cevap/durum) YALNIZ destek yöneticisi günceller — RLS'te
// destek_talepleri UPDATE yalnız id 2'ye açık (mig 189).
export const destekMesajEkle = async ({ talep, mesaj, yazarId, yazarAd }) => {
  const metin = (mesaj ?? '').trim()
  if (!metin || !talep?.id) return null
  const { data, error } = await supabase
    .from('destek_mesajlari')
    .insert({ talep_id: talep.id, yazar_id: yazarId ?? null, yazar_ad: yazarAd ?? '', mesaj: metin })
    .select()
    .single()
  if (error) { console.warn('[destek] mesaj ekle:', error.message); return { hata: error.message } }
  if (String(yazarId) === String(DESTEK_YONETICISI_ID)) {
    await supabase.from('destek_talepleri')
      .update({ cevap: metin, cevap_tarihi: new Date().toISOString(), durum: 'cevaplandi' })
      .eq('id', talep.id)
  }
  return arrayToCamel([data])[0]
}
