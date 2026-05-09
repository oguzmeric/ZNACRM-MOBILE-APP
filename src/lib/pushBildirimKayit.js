// Expo push token'ını al ve Supabase'e kaydet/sil.
// Login sonrası `pushTokenKaydet`, logout öncesi `pushTokenSil` çağrılır.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { supabase } from './supabase'

// Foreground'da bildirim nasıl gösterilsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

let _kayitliToken = null

const projectIdGetir = () => {
  // Hem development hem production'da çalışsın
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  )
}

// Login sonrası çağrılır.
export async function pushTokenKaydet(kullaniciId) {
  if (!Device.isDevice) {
    console.log('[push] simulator/emülatör — push devre dışı')
    return null
  }
  if (!kullaniciId) return null

  try {
    // İzin durumunu kontrol et
    const { status: mevcut } = await Notifications.getPermissionsAsync()
    let final = mevcut
    if (mevcut !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      final = status
    }
    if (final !== 'granted') {
      console.log('[push] izin verilmedi')
      return null
    }

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bildirimler',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      })
    }

    // Token al
    const projectId = projectIdGetir()
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    const token = tokenData?.data
    if (!token) {
      console.warn('[push] token boş döndü')
      return null
    }

    _kayitliToken = token

    // Supabase'e upsert
    const { error } = await supabase
      .from('kullanici_push_tokenlari')
      .upsert(
        {
          kullanici_id: kullaniciId,
          token,
          platform: Platform.OS,
          son_gorulen: new Date().toISOString(),
        },
        { onConflict: 'kullanici_id,token' },
      )

    if (error) {
      console.warn('[push] supabase upsert fail:', error.message)
      return null
    }

    console.log('[push] kayıt OK', token.slice(0, 25) + '...')
    return token
  } catch (e) {
    console.warn('[push] kayıt catch:', e?.message)
    return null
  }
}

// Logout sırasında çağrılır.
export async function pushTokenSil(kullaniciId) {
  if (!_kayitliToken || !kullaniciId) return
  try {
    await supabase
      .from('kullanici_push_tokenlari')
      .delete()
      .eq('kullanici_id', kullaniciId)
      .eq('token', _kayitliToken)
    _kayitliToken = null
  } catch (e) {
    console.warn('[push] sil catch:', e?.message)
  }
}

// Badge sayacını ayarla (iOS için kritik, Android'de yok sayılır)
export async function badgeAyarla(sayi) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, sayi || 0))
  } catch {}
}
