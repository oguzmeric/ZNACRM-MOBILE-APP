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

export const araclariGetir     = () => cagir('vehicles')
export const kameralariGetir   = (aracId) => cagir(`cameras/${aracId}`)
export const konumLoglariGetir = (aracId, start, end) => cagir(`vehicles/location-logs/${aracId}`, { start, end })
export const motorDurumu       = (aracId) => cagir(`vehicles/engine-status/${aracId}`)
export const geocoding         = (lat, lng) => cagir('geocoding', { lat, lng })
