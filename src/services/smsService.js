import { supabase } from '../lib/supabase'

/**
 * NetGSM uzerinden tek alici SMS gonder.
 * @param {string} gsm   - '5XXXXXXXXX' (10 hane); edge function 0/+90/bosluk normalize eder
 * @param {string} mesaj - max 1000 karakter
 * @returns {Promise<object>} { ok: true, jobid, gsm, mesaj }
 */
export async function smsGonder(gsm, mesaj) {
  const { data, error } = await supabase.functions.invoke('sms-gonder', {
    body: { gsm, mesaj },
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.hata ?? 'SMS gönderilemedi.')
  return data
}

/**
 * Bir belgeyi (teklif veya servis raporu) musteriye tokenli link ile gonder.
 * Hem mail hem SMS gonderebilir — tum islem server-side (belge-paylas edge function).
 * @param {object} args
 * @param {'teklif'|'servis_raporu'} args.belge_tipi
 * @param {number} args.belge_id
 * @param {'mail'|'sms'|'her_ikisi'} args.kanal
 * @param {string} [args.email]      - mail/her_ikisi ise zorunlu
 * @param {string} [args.gsm]        - sms/her_ikisi ise zorunlu
 * @param {number} [args.sure_gun=30]
 * @param {string} [args.sablon]     - 'trassir'|'karel' (sadece teklif)
 * @param {string} [args.ozel_mesaj] - mail govdesine ek not
 * @returns {Promise<object>} { ok, token, link, son_kullanma, mail_durumu, sms_durumu, kismi }
 */
export async function belgePaylas(args) {
  const { data, error } = await supabase.functions.invoke('belge-paylas', {
    body: args,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.hata ?? 'Paylaşım başarısız.')
  return data
}
