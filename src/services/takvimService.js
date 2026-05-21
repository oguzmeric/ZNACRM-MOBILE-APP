// Takvim entegrasyonu — Google Calendar etkinliklerini oku + Meet'li etkinlik oluştur.
// Web'deki takvimBaglantiService.js'in mobile versiyonu.
// OAuth bağlantı yönetimi web'de — mobile sadece okuma/yazma yapar.

import { supabase } from '../lib/supabase'

// Kullanıcının aktif takvim bağlantılarını listele (en az 1 varsa etkinlik oluşturulabilir)
export async function takvimBaglantilariniGetir(kullaniciId) {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('kullanici_takvim_baglantilari')
    .select('id, saglayici, hesap_email, aktif, son_sync_zamani, son_sync_hatasi')
    .eq('kullanici_id', kullaniciId)
    .eq('aktif', true)
    .order('olusturma_tarih', { ascending: false })
  if (error) { console.warn('takvimBaglantilariniGetir', error.message); return [] }
  return data ?? []
}

// Belirli tarih aralığında etkinlikleri çek (web tarafının sync ettiği veriyi okuyoruz)
export async function hariciEtkinlikleriGetir(kullaniciId, baslangic, bitis) {
  if (!kullaniciId) return []
  const { data, error } = await supabase
    .from('harici_etkinlikler')
    .select('id, baglanti_id, saglayici, baslik, aciklama, lokasyon, baslangic, bitis, tum_gun, durum, davetliler, organizator_email, toplanti_linki')
    .eq('kullanici_id', kullaniciId)
    .eq('silindi', false)
    .gte('baslangic', baslangic)
    .lte('baslangic', bitis)
    .order('baslangic', { ascending: true })
  if (error) { console.warn('hariciEtkinlikleriGetir', error.message); return [] }
  return data ?? []
}

// Manuel sync tetikle (kullanıcı en güncel veriyi istiyorsa)
export async function takvimSyncTetikle(baglantiId) {
  const { data, error } = await supabase.functions.invoke('google-takvim-sync', {
    body: { baglantiId },
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.hata ?? 'Senkronizasyon başarısız')
  return data
}

// Etkinlik + Meet oluştur — web'deki ile aynı edge function
// payload: { baslik, aciklama, lokasyon, baslangic (ISO), bitis (ISO), davetliler (email[]), meetEkle (bool) }
export async function etkinlikOlustur(baglantiId, payload) {
  const { data, error } = await supabase.functions.invoke('google-takvim-etkinlik-olustur', {
    body: { baglantiId, ...payload },
  })
  // supabase-js v2 non-2xx'te error.context = Response objesi → gövdeyi Türkçe oku
  if (error) {
    let mesaj = error.message ?? 'Etkinlik oluşturulamadı'
    try {
      const ctx = error.context
      if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        if (text) {
          try {
            const body = JSON.parse(text)
            if (body?.hata) mesaj = body.hata
            if (body?.scopeYok) {
              mesaj += ' (Web tarafından Takvim Bağlantıları sayfasından bağlantıyı yenileyin.)'
            }
          } catch {
            mesaj = text.slice(0, 300)
          }
        }
      }
    } catch (e) {
      console.warn('[etkinlikOlustur error parse]', e)
    }
    throw new Error(mesaj)
  }
  if (!data?.ok) throw new Error(data?.hata ?? 'Etkinlik oluşturulamadı')
  return data
}

// Etkinliği Google Calendar + DB'den sil
export async function etkinlikSil(etkinlikId) {
  const { data, error } = await supabase.functions.invoke('google-takvim-etkinlik-sil', {
    body: { etkinlikId },
  })
  if (error) {
    let mesaj = error.message ?? 'Etkinlik silinemedi'
    try {
      const ctx = error.context
      if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        if (text) {
          try {
            const body = JSON.parse(text)
            if (body?.hata) mesaj = body.hata
            if (body?.scopeYok) mesaj += ' (Web tarafından bağlantıyı yenileyin.)'
          } catch { mesaj = text.slice(0, 300) }
        }
      }
    } catch (e) {
      console.warn('[etkinlikSil error parse]', e)
    }
    throw new Error(mesaj)
  }
  if (!data?.ok) throw new Error(data?.hata ?? 'Etkinlik silinemedi')
  return data
}
