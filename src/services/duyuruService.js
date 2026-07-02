// Duyuru servisi (mobile) — sadece okuma, aktif+tarih geçerli olanlar.
// Web'deki aktifDuyurulariGetir ile aynı kontrat.

import { supabase } from '../lib/supabase'
import { arrayToCamel } from '../lib/mapper'

export const aktifDuyurulariGetir = async () => {
  const simdi = new Date().toISOString()
  const { data, error } = await supabase
    .from('duyurular')
    .select('id, baslik, icerik, seviye, baslangic_tarihi')
    .eq('aktif', true)
    .lte('baslangic_tarihi', simdi)
    .or(`bitis_tarihi.is.null,bitis_tarihi.gte.${simdi}`)
    .order('baslangic_tarihi', { ascending: false })
    .limit(10)
  if (error) { console.error('[aktifDuyurular]', error.message); return [] }
  return arrayToCamel(data || [])
}
