import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

let _supabase

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Supabase env eksik. URL: ${supabaseUrl ? 'var' : 'YOK'}, KEY: ${supabaseAnonKey ? 'var' : 'YOK'}`
    )
  }
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
} catch (e) {
  console.error('[supabase] init hatası:', e?.message || e)
  // Stub: usage anında hata fırlatır, modül yüklemesi patlatmaz
  const handler = {
    get(_target, prop) {
      if (prop === 'auth') {
        return new Proxy({}, handler)
      }
      if (prop === 'from') {
        return () => new Proxy({}, handler)
      }
      if (typeof prop === 'symbol') return undefined
      return (..._args) => {
        return Promise.resolve({ data: null, error: new Error(String(e?.message || e)) })
      }
    },
  }
  _supabase = new Proxy({}, handler)
}

export const supabase = _supabase

// Supabase 1000 satır limitini aşmak için sayfalama yardımcısı
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
