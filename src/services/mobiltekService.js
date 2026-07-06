// Mobiltek proxy istemcisi (mobile). Edge function 'mobiltek-proxy' üzerinden.

import { supabase } from '../lib/supabase'

const cagir = async (yol, params = {}) => {
  const { data, error } = await supabase.functions.invoke('mobiltek-proxy', {
    body: { yol, params },
  })
  if (error) {
    console.error('[mobiltek]', yol, error.message)
    return null
  }
  if (!data?.ok) {
    console.warn('[mobiltek]', yol, data?.hata)
    return null
  }
  return { veri: data.veri, mock: !!data.mock }
}

// .NET Date "/Date(1783358792000+0300)/" → ISO string
const parseNetDate = (s) => {
  if (!s) return null
  const m = String(s).match(/\/Date\((\d+)/)
  if (m) return new Date(parseInt(m[1], 10)).toISOString()
  return s
}

// Mobiltek response → düz format (web ile eşleşir)
export const normalizeArac = (v) => {
  const loc = v['last-location'] || {}
  return {
    ...v,
    plateNo: v.label || v.plateNo || null,
    gpsSpeed: loc.speed ?? v.gpsSpeed ?? 0,
    gpsTime: parseNetDate(loc.logdatetime ?? v.gpsTime),
    lat: loc.latitude ?? v.lat ?? null,
    lng: loc.longitude ?? v.lng ?? null,
    direction: loc.dir ?? v.direction ?? 0,
    ignition: loc.ignition ?? v.ignition ?? false,
    address: loc.address ?? null,
  }
}

export const araclariGetir     = () => cagir('vehicles')
export const kameralariGetir   = (aracId) => cagir(`cameras/${aracId}`)
export const konumLoglariGetir = (aracId, start, end) => cagir(`vehicles/location-logs/${aracId}`, { start, end })
export const motorDurumu       = (aracId) => cagir(`vehicles/engine-status/${aracId}`)
export const geocoding         = (lat, lng) => cagir('geocoding', { lat, lng })

// Yakınlık taraması + aktif uyarıları
export const yakinlikTara = async () => {
  const { data, error } = await supabase.functions.invoke('arac-yakinlik-tara')
  if (error) { console.warn('[yakinlik]', error.message); return null }
  return data
}

export const aktifYakinliklarGetir = async () => {
  const { data, error } = await supabase
    .from('arac_yakinlik_kayitlari')
    .select('id, arac1_plaka, arac2_plaka, ilk_zaman, son_zaman, son_mesafe_m, son_adres, alarm_verildi, alarm_zamani')
    .eq('cozuldu', false)
    .order('ilk_zaman')
  if (error) { console.warn('[yakinlik-liste]', error.message); return [] }
  return data ?? []
}
