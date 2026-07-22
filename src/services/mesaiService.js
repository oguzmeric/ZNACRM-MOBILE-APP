// Mesai takip — edge fn wrapper'ları + açık kayıt sorgusu + modül kontrolü.
import { supabase } from '../lib/supabase'

async function edgeCagir(yol, body) {
  const { data, error } = await supabase.functions.invoke(yol, { body })
  if (error) return { ok: false, hata: error.message }
  return data
}

export const mesaiyeBasla = ({ qr_payload, lat, lng, zorla = false }) =>
  edgeCagir('mesai-giris', { qr_payload, lat, lng, zorla })

// ARTIK UI'DAN ÇAĞRILMIYOR (2026-07-22): "Bitir" butonu kaldırıldı, mesai 18:30'da
// mesai_otomatik_kapat cron'u ile kapanıyor. Edge fn ve bu sarmalayıcı, ileride
// yönetici tarafı bir düzeltme ekranı gerekirse diye duruyor.
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

// Kendi mesai geçmişimi getir (son N gün).
export async function kendiMesaiGecmisim({ gun = 30 } = {}) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) return []
  const { data: k } = await supabase
    .from('kullanicilar').select('id').eq('auth_id', uid).maybeSingle()
  if (!k) return []
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('mesai_kayitlari')
    .select('id, giris_zamani, cikis_zamani, sure_dakika, giris_mesafe_m, not_')
    .eq('kullanici_id', k.id)
    .gte('giris_zamani', sinir)
    .order('giris_zamani', { ascending: false })
  return data ?? []
}

// Ekip mesai durumu — sadece yönetim görsün (Ali/Oğuz). Bugünkü giriş var mı, aktif mi?
export async function ekipBugunMesai() {
  const bugunBas = new Date()
  bugunBas.setHours(0, 0, 0, 0)
  const { data: kullanicilar } = await supabase
    .from('kullanicilar')
    .select('id, ad, unvan')
    .contains('moduller', ['mesai_takip'])
    .order('ad')
  if (!kullanicilar) return []
  const { data: kayitlar } = await supabase
    .from('mesai_kayitlari')
    .select('kullanici_id, giris_zamani, cikis_zamani, sure_dakika, giris_mesafe_m, not_')
    .gte('giris_zamani', bugunBas.toISOString())
    .order('giris_zamani', { ascending: false })
  const harita = new Map()
  ;(kayitlar ?? []).forEach(k => { if (!harita.has(k.kullanici_id)) harita.set(k.kullanici_id, k) })
  return kullanicilar.map(k => ({
    kullanici_id: k.id, ad: k.ad, unvan: k.unvan,
    kayit: harita.get(k.id) ?? null,
  }))
}
