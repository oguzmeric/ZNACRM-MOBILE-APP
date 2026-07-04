// Mesai takip — edge fn wrapper'ları + açık kayıt sorgusu + modül kontrolü.
import { supabase } from '../lib/supabase'

async function edgeCagir(yol, body) {
  const { data, error } = await supabase.functions.invoke(yol, { body })
  if (error) return { ok: false, hata: error.message }
  return data
}

export const mesaiyeBasla = ({ qr_payload, lat, lng, zorla = false }) =>
  edgeCagir('mesai-giris', { qr_payload, lat, lng, zorla })

export const mesaiyiBitir = ({ lat = null, lng = null } = {}) =>
  edgeCagir('mesai-cikis', { lat, lng })

export async function acikMesaiGetir() {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) return null
  const { data: k } = await supabase
    .from('kullanicilar').select('id').eq('auth_id', uid).maybeSingle()
  if (!k) return null
  const { data } = await supabase
    .from('mesai_kayitlari')
    .select('id, giris_zamani')
    .eq('kullanici_id', k.id)
    .is('cikis_zamani', null)
    .order('giris_zamani', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export function mesaiTakipVarMi(kullanici) {
  return (kullanici?.moduller ?? []).includes('mesai_takip')
}
