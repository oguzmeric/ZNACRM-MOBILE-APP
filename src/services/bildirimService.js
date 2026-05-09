// Bildirim servisi (mobile) — DB tabanlı, web ile aynı altyapı.
// Realtime ile anlık bildirim, RLS ile her kullanıcı sadece kendine gelenleri görür.

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel, toSnake } from '../lib/mapper'

// Yeni bildirim ekle — web ile aynı kontrat
// payload: { aliciId, gonderenId?, baslik, mesaj?, tip?, link?, meta? }
export const bildirimEkleDb = async (payload) => {
  if (!payload?.aliciId) return null
  const { data, error } = await supabase
    .from('bildirimler')
    .insert(toSnake({
      aliciId: payload.aliciId,
      gonderenId: payload.gonderenId || null,
      baslik: payload.baslik,
      mesaj: payload.mesaj || '',
      tip: payload.tip || 'bilgi',
      link: payload.link || '',
      meta: payload.meta || null,
    }))
    .select()
    .single()
  if (error) {
    console.error('[bildirimEkleDb] hata:', error.message)
    return null
  }
  return toCamel(data)
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
