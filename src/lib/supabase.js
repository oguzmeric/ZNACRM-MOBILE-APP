import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
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

// ── Oturum ömrü: arka planda token yenileme (04.08 şikayeti: "1 saat sonra
// oturum düşüyor") ─────────────────────────────────────────────────────────
// Supabase erişim jetonu 1 SAAT geçerlidir; autoRefreshToken bunu süresi
// dolmadan yeniler AMA yenileyici bir JS zamanlayıcısıdır ve uygulama arka
// plana atıldığında React Native zamanlayıcıları dondurur. Telefon cebe
// girip 1 saat geçince jeton sessizce ölüyor, kullanıcı uygulamayı açtığında
// oturumu düşmüş buluyordu.
//
// Supabase'in React Native için önerdiği çözüm: uygulama öne gelince
// yenileyiciyi BAŞLAT, arka plana geçince DURDUR. Öne gelişte ayrıca bir kez
// elle yenileme tetiklenir — donmuş zamanlayıcı yüzünden kaçırılan yenileme
// telafi edilir, kullanıcı beklemeden içeride kalır.
if (typeof AppState?.addEventListener === 'function') {
  const uygula = (durum) => {
    try {
      if (durum === 'active') {
        _supabase.auth.startAutoRefresh?.()
        // Jeton arka planda süresi dolmuş olabilir — hemen tazele (best-effort)
        _supabase.auth.getSession?.().then(({ data }) => {
          if (data?.session) _supabase.auth.refreshSession?.().catch(() => {})
        }).catch(() => {})
      } else {
        _supabase.auth.stopAutoRefresh?.()
      }
    } catch (e) {
      console.warn('[supabase] autoRefresh durum:', e?.message)
    }
  }
  AppState.addEventListener('change', uygula)
  uygula(AppState.currentState || 'active')   // ilk açılışta da başlat
}

// Supabase 1000 satır limitini aşmak için sayfalama yardımcısı
export const tumSayfalariCek = async (tablo, sorguKur = (q) => q) => {
  const SAYFA = 1000
  let tumKayitlar = []
  let baslangic = 0
  while (true) {
    // id tiebreaker: benzersiz olmayan kolona göre sıralamada (örn. toplu import
    // kayıtlarında aynı olusturma_tarih) .range() sayfaları arasında satır
    // tekrarı/atlaması olur — son sıralama anahtarı olarak id determinizmi sağlar.
    const query = sorguKur(supabase.from(tablo).select('*'))
      .order('id', { ascending: false })
      .range(baslangic, baslangic + SAYFA - 1)
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
