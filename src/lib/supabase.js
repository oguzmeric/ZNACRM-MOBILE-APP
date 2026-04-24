import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. .env dosyasını oluşturun.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Supabase 1000 satır limitini aşmak için sayfalama yardımcısı
// Örn: tumSayfalariCek('musteriler', (q) => q.order('ad', { ascending: true }))
export const tumSayfalariCek = async (tablo, sorguKur = (q) => q) => {
  const SAYFA = 1000
  let tumKayitlar = []
  let baslangic = 0
  while (true) {
    const query = sorguKur(supabase.from(tablo).select('*')).range(baslangic, baslangic + SAYFA - 1)
    const { data, error } = await query
    if (error) {
      console.error(`[${tablo}] sayfa hata:`, error.message)
      break
    }
    if (!data || data.length === 0) break
    tumKayitlar = tumKayitlar.concat(data)
    if (data.length < SAYFA) break
    baslangic += SAYFA
  }
  return tumKayitlar
}
