// Not hatırlatıcıları için local notification yönetimi.
// expo-notifications kullanır — telefon kapalı bile olsa belirtilen saatte uyarı verir.

import * as Notifications from 'expo-notifications'

// Bir notId için zaten zamanlanmış bildirim varsa iptal et
async function eskileriIptal(notId) {
  try {
    const liste = await Notifications.getAllScheduledNotificationsAsync()
    const idStr = String(notId)
    const benimkiler = (liste || []).filter((n) => {
      const data = n?.content?.data
      return data?.notId && String(data.notId) === idStr
    })
    for (const n of benimkiler) {
      try { await Notifications.cancelScheduledNotificationAsync(n.identifier) } catch {}
    }
  } catch (e) {
    console.warn('[hatirlatici iptal]', e?.message)
  }
}

// Bir not için hatırlatıcı zamanla
// hatirlatmaTarihi: ISO string veya Date
// Geçmiş bir tarihse zamanlamaz
export async function hatirlaticiZamanla({ notId, hatirlatmaTarihi, baslik, mesaj }) {
  if (!notId) return null
  // Önce eski zamanlamayı iptal et (idempotent)
  await eskileriIptal(notId)

  if (!hatirlatmaTarihi) return null
  const tarih = new Date(hatirlatmaTarihi)
  if (isNaN(tarih.getTime())) return null
  if (tarih.getTime() <= Date.now()) {
    // Geçmiş — zamanla atlanır
    return null
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: baslik || 'Hatırlatma',
        body: mesaj || 'Notunuza dönmenin zamanı.',
        sound: 'default',
        data: { notId: String(notId), tip: 'not_hatirlatma' },
      },
      trigger: { date: tarih },
    })
    return id
  } catch (e) {
    console.warn('[hatirlaticiZamanla]', e?.message)
    return null
  }
}

// Bir not silindiğinde / hatırlatıcı kaldırıldığında çağrılır
export async function hatirlaticiKaldir(notId) {
  await eskileriIptal(notId)
}
