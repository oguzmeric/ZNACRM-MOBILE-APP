// Toplantı hatırlatıcıları için lokal notification yönetimi.
// harici_etkinlikler tablosundan yaklaşan toplantıları çeker,
// her biri için "10 dk kala" ve "başlarken" olmak üzere 2 bildirim zamanlar.
// Uygulama arka planda olsa bile telefon bildirim gönderir (expo-notifications).

import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

const TAG_PREFIX = 'toplanti-'

// Bir toplantı için eski zamanlı bildirimleri iptal et
async function eskileriIptal(etkinlikId) {
  try {
    const liste = await Notifications.getAllScheduledNotificationsAsync()
    const idStr = String(etkinlikId)
    const benim = (liste || []).filter((n) => {
      const data = n?.content?.data
      return data?.tip === 'toplanti' && String(data?.etkinlikId) === idStr
    })
    for (const n of benim) {
      try { await Notifications.cancelScheduledNotificationAsync(n.identifier) } catch {}
    }
  } catch (e) {
    console.warn('[toplanti hatirlatici iptal]', e?.message)
  }
}

// Bir toplantı için "10 dk kala" + "başlarken" bildirim zamanla
async function toplantiIcinZamanla(etkinlik) {
  if (!etkinlik?.id || !etkinlik?.baslangic) return
  const bt = new Date(etkinlik.baslangic).getTime()
  if (isNaN(bt)) return
  const simdi = Date.now()

  // Eski zamanlı bildirimleri iptal et (idempotent)
  await eskileriIptal(etkinlik.id)

  // 10 dk kala — geçmişteyse atla
  const on = new Date(bt - 10 * 60 * 1000)
  if (on.getTime() > simdi) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Toplantı yaklaşıyor',
          body: `"${etkinlik.baslik}" — 10 dk sonra başlıyor`,
          sound: 'default',
          data: { tip: 'toplanti', etkinlikId: String(etkinlik.id), asama: '10dk', link: etkinlik.toplanti_linki ?? null },
        },
        trigger: { date: on },
      })
    } catch (e) { console.warn('[toplanti 10dk]', e?.message) }
  }

  // Başlarken — geçmişteyse atla
  if (bt > simdi) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Toplantı başlıyor',
          body: `"${etkinlik.baslik}" şu an başlıyor` + (etkinlik.toplanti_linki ? ' · Meet linkini aç' : ''),
          sound: 'default',
          data: { tip: 'toplanti', etkinlikId: String(etkinlik.id), asama: 'basladi', link: etkinlik.toplanti_linki ?? null },
        },
        trigger: { date: new Date(bt) },
      })
    } catch (e) { console.warn('[toplanti basladi]', e?.message) }
  }
}

// Ana giriş noktası: kullanıcı için tüm yaklaşan toplantı bildirimlerini yenile
// - Sonraki 24 saatteki etkinlikleri çeker
// - Her biri için 2'şer zamanlanmış bildirim koyar (eski varsa günceller)
export async function toplantiHatirlaticilariniYenile(kullaniciId) {
  if (!kullaniciId) return { yazildi: 0 }
  const simdi = new Date()
  const sonrasi = new Date(simdi.getTime() + 24 * 60 * 60 * 1000)
  try {
    const { data, error } = await supabase
      .from('harici_etkinlikler')
      .select('id, baslik, baslangic, toplanti_linki')
      .eq('kullanici_id', kullaniciId)
      .eq('silindi', false)
      .gte('baslangic', simdi.toISOString())
      .lte('baslangic', sonrasi.toISOString())
    if (error) {
      console.warn('[toplantiHatirlaticilariniYenile] fetch:', error.message)
      return { yazildi: 0 }
    }
    let sayac = 0
    for (const e of data || []) {
      await toplantiIcinZamanla(e)
      sayac++
    }
    return { yazildi: sayac }
  } catch (e) {
    console.warn('[toplantiHatirlaticilariniYenile] hata:', e?.message)
    return { yazildi: 0 }
  }
}
