// Storage REST upload'ları için OTURUM JWT'si.
//
// Neden: FormData upload'ları eskiden ANON key ile yapılıyordu. Güvenlik
// sıkılaştırması (anon grant'lerinin kesilmesi) sonrası storage.objects
// üzerindeki policy'lerden biri musteriler tablosuna dokunduğu için anon
// upload "permission denied for table musteriler" (403) ile patlıyor.
// Personel JWT'siyle istek atılınca is_staff() ve tablo grant'leri geçer.
// (Canlıda kanıtlandı: anon 403, personel JWT 200 — 2026-07-16)
import { supabase } from './supabase'

export async function oturumTokenAl() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  } catch {
    return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
}
