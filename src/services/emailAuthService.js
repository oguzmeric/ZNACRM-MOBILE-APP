// Email tabanli auth — mobil. Edge function'lari cagiran helper'lar.
// Web'deki services/emailAuthService.js ile ayni davranis.
import { supabase } from '../lib/supabase'

// Edge function hatasini Turkce mesaja cevirir (response body parse + fallback)
async function ftnHataMesaj(error) {
  let mesaj = error?.message ?? 'İşlem başarısız.'
  try {
    const ctx = error?.context
    if (ctx && typeof ctx.text === 'function') {
      const text = await ctx.text()
      if (text) {
        try {
          const body = JSON.parse(text)
          if (body?.hata) {
            mesaj = body.hata
            if (body?.kalanDeneme != null) mesaj += ` (${body.kalanDeneme} deneme hakkınız kaldı)`
          }
        } catch { mesaj = text.slice(0, 300) }
      }
    }
  } catch {}
  return mesaj
}

// Email'e 6 haneli OTP kodu gonder. amac: 'kayit' | 'sifre_sifirla'
export async function kayitKodGonder(email, amac = 'kayit') {
  const { data, error } = await supabase.functions.invoke('kayit-kod-gonder', {
    body: { email: email.trim().toLowerCase(), amac },
  })
  if (error) throw new Error(await ftnHataMesaj(error))
  if (!data?.ok) throw new Error(data?.hata ?? 'Kod gönderilemedi.')
  return data
}

// OTP'yi dogrula + sifre belirle (signup tamamla).
export async function kayitKodDogrula({ email, kod, yeniSifre, amac = 'kayit' }) {
  const { data, error } = await supabase.functions.invoke('kayit-kod-dogrula', {
    body: { email: email.trim().toLowerCase(), kod: kod.trim(), yeniSifre, amac },
  })
  if (error) throw new Error(await ftnHataMesaj(error))
  if (!data?.ok) throw new Error(data?.hata ?? 'Doğrulama başarısız.')
  return data
}
