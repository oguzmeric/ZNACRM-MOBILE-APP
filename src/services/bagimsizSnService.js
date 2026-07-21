// Bağımsız (dahili) SN üretimi (mig 220) — web kontratı ile birebir.
// Sahada SN'siz ürünlere ZNA- ön ekli benzersiz SN üretir; müşteri cihaz
// envanterine bağlanır; etiket ofiste (web) A4 barkod sayfasıyla basılır.
import { supabase } from '../lib/supabase'
import { toCamel, arrayToCamel } from '../lib/mapper'

export const bagimsizSnUret = async ({ urunAdi, stokKodu, musteriId, servisTalepId, kullanici } = {}) => {
  const { data, error } = await supabase.rpc('bagimsiz_sn_uret', {
    p_urun_adi: urunAdi || null,
    p_stok_kodu: stokKodu || null,
    p_musteri_id: musteriId || null,
    p_servis_talep_id: servisTalepId || null,
    p_olusturan_id: kullanici?.id ?? null,
    p_olusturan_ad: kullanici?.ad ?? null,
  })
  if (error) { console.warn('[bagimsizSnUret]', error.message); return { hata: error.message } }
  return { kayit: toCamel(data) }
}

export const bagimsizSnCihazBagla = async (id, cihazId) => {
  const { error } = await supabase.from('bagimsiz_snler').update({ cihaz_id: cihazId }).eq('id', id)
  if (error) console.warn('[bagimsizSnCihazBagla]', error.message)
}

// Bir servise üretilmiş bağımsız SN'ler (servis detayında cihaz listesi için)
export const servisBagimsizSnleriGetir = async (servisTalepId) => {
  const { data, error } = await supabase
    .from('bagimsiz_snler').select('*')
    .eq('servis_talep_id', servisTalepId)
    .order('olusturma_tarih', { ascending: true })
  if (error) { console.warn('[servisBagimsizSnleriGetir]', error.message); return [] }
  return arrayToCamel(data) ?? []
}
