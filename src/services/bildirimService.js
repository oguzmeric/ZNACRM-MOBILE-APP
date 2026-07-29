// Bildirim servisi (mobile) — DB tabanlı, web ile aynı altyapı.
// Realtime ile anlık bildirim, RLS ile her kullanıcı sadece kendine gelenleri görür.

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'

// Yeni bildirim ekle — web ile aynı kontrat
// payload: { aliciId, gonderenId?, baslik, mesaj?, tip?, link?, meta? }
// Bildirim ekle — RPC üzerinden (SECURITY DEFINER), web bildirimService ile AYNI yol.
//
// NEDEN RPC: doğrudan `.insert().select()` BAŞKASINA bildirim yazarken
// RLS'e takılıyordu. INSERT politikası personele izin veriyor, ama `.select()`
// PostgREST'e RETURNING yaptırıyor ve RETURNING satırı SELECT politikasından
// ("sadece kendi bildirimin") geçemiyor → "new row violates row-level security
// policy" → tüm işlem ROLLBACK. Hata catch'lerde console.warn ile yutulduğu
// için kimse fark etmiyordu: mobilden gönderilen destek / görev atama /
// görüşme / İK izin / fatura bildirimlerinin HİÇBİRİ kaydedilmiyordu (29.07).
// Canlı doğrulama: aynı INSERT RETURNING'siz BAŞARILI, RETURNING'li HATA.
//
// gonderen_id'yi RPC caller'ın oturumundan kendisi doldurur — payload.gonderenId
// artık gerekmez (gönderilse de yok sayılır).
export const bildirimEkleDb = async (payload) => {
  if (!payload?.aliciId) return null
  const { data, error } = await supabase.rpc('bildirim_ekle', {
    p_alici_id: Number(payload.aliciId),
    p_baslik: payload.baslik || '',
    p_mesaj: payload.mesaj || '',
    p_tip: payload.tip || 'bilgi',
    p_link: payload.link || '',
    p_meta: payload.meta || null,
  })
  if (error) {
    console.error('[bildirimEkleDb] hata:', error.message)
    return null
  }
  return { id: data }
}

export const bildirimleriGetir = async (kullaniciId, limit = 50) => {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('bildirimler')
    .select('*')
    .eq('alici_id', kullaniciId)
    .order('olusturma_tarih', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[bildirimleriGetir] hata:', error.message)
    return []
  }
  return arrayToCamel(data || [])
}

export const okunmamisBildirimSayisi = async (kullaniciId) => {
  if (!kullaniciId) return 0
  const { count, error } = await supabase
    .from('bildirimler')
    .select('*', { count: 'exact', head: true })
    .eq('alici_id', kullaniciId)
    .eq('okundu', false)
  if (error) return 0
  return count ?? 0
}

export const bildirimOkuDb = async (id) => {
  const { error } = await supabase
    .from('bildirimler')
    .update({ okundu: true, okunma_tarih: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error('[bildirimOkuDb] hata:', error.message)
}

export const tumBildirimleriOkuDb = async (kullaniciId) => {
  const { error } = await supabase
    .from('bildirimler')
    .update({ okundu: true, okunma_tarih: new Date().toISOString() })
    .eq('alici_id', kullaniciId)
    .eq('okundu', false)
  if (error) console.error('[tumBildirimleriOkuDb] hata:', error.message)
}

export const bildirimSilDb = async (id) => {
  const { error } = await supabase.from('bildirimler').delete().eq('id', id)
  if (error) console.error('[bildirimSilDb] hata:', error.message)
}

// Toplu silme — kullanıcının bildirimlerini siler; sadeceOkunan=true ise
// okunmamışlar korunur. RLS kullanıcıyı zaten kendi satırlarıyla sınırlar.
export const tumBildirimleriSilDb = async (kullaniciId, { sadeceOkunan = false } = {}) => {
  if (!kullaniciId) return false
  let q = supabase.from('bildirimler').delete().eq('alici_id', kullaniciId)
  if (sadeceOkunan) q = q.eq('okundu', true)
  const { error } = await q
  if (error) {
    console.error('[tumBildirimleriSilDb] hata:', error.message)
    return false
  }
  return true
}

// Realtime subscribe — yeni bildirim gelince callback
// Kanal adı her abonelik için unique olmalı, aksi halde Supabase aynı kanalı
// reuse eder ve ikinci .on() "cannot add callbacks after subscribe()" fırlatır
// (örn: HomeScreen + BildirimlerScreen aynı kullanıcı için 2 abonelik açıyor).
let _kanalSayac = 0
export const bildirimleriDinle = (kullaniciId, onYeniBildirim) => {
  if (!kullaniciId) return { unsubscribe: () => {} }
  _kanalSayac += 1
  const kanalAdi = `bildirimler:${kullaniciId}:${_kanalSayac}:${Date.now()}`
  const channel = supabase
    .channel(kanalAdi)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bildirimler',
        filter: `alici_id=eq.${kullaniciId}`,
      },
      (payload) => {
        try {
          onYeniBildirim?.(toCamel(payload.new))
        } catch (e) {
          console.error('[bildirim realtime] hata:', e)
        }
      },
    )
    .subscribe()
  return {
    unsubscribe: () => {
      try { supabase.removeChannel(channel) } catch {}
    },
  }
}
