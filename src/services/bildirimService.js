// Bildirim servisi (mobile) — DB tabanlı, web ile aynı altyapı.
// Realtime ile anlık bildirim, RLS ile her kullanıcı sadece kendine gelenleri görür.

import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'

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
export const bildirimleriDinle = (kullaniciId, onYeniBildirim) => {
  if (!kullaniciId) return { unsubscribe: () => {} }
  const channel = supabase
    .channel(`bildirimler:${kullaniciId}`)
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
