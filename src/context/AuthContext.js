import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import { supabase } from '../lib/supabase'
import { toCamel } from '../lib/mapper'
import { kullaniciGirisKontrol, kullaniciDurumGuncelle } from '../services/kullaniciService'

const STORAGE_KEY = 'aktifKullanici'
const MODE_KEY = 'aktifMod' // 'teknisyen' | 'admin'

const AuthContext = createContext({
  kullanici: null,
  loading: true,
  mod: 'teknisyen',
  girisYap: async () => false,
  cikisYap: async () => {},
  modDegistir: () => {},
})

export const AuthProvider = ({ children }) => {
  const [kullanici, setKullanici] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mod, setMod] = useState('teknisyen')

  // Uygulama açılışında oturumu yükle
  //
  // ÖNEMLİ: Eski custom auth döneminden kalma AsyncStorage profili olabilir
  // ama Supabase Auth session yok → RLS tüm sorguları reddedeceği için
  // kullanıcıya hiçbir veri gözükmez. Bu durumu tespit edip zorla çıkış
  // yapıyoruz (yeniden giriş → supabase.auth session oluşur).
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        const m = await AsyncStorage.getItem(MODE_KEY)
        if (m === 'admin' || m === 'teknisyen') setMod(m)

        if (raw) {
          // Supabase Auth session gerçekten var mı? Yoksa stale profil
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) {
            console.warn('[Auth] AsyncStorage profili var ama Supabase session yok — yeniden giriş gerekli')
            await AsyncStorage.removeItem(STORAGE_KEY)
            setKullanici(null)
          } else {
            const k = JSON.parse(raw)
            setKullanici(k)
            // Sentry'ye kullanıcı bilgisi ekle (hata raporlarında kim olduğu görünsün)
            try {
              Sentry.setUser({ id: String(k.id), username: k.kullaniciAdi, email: k.email })
            } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('[Auth] AsyncStorage okunamadı', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const modDegistir = async (yeniMod) => {
    if (yeniMod !== 'admin' && yeniMod !== 'teknisyen') return
    setMod(yeniMod)
    try {
      await AsyncStorage.setItem(MODE_KEY, yeniMod)
    } catch (e) {
      console.warn('[Auth] Mod kaydedilemedi', e)
    }
  }

  const girisYap = async (kullaniciAdi, sifre) => {
    const bulunan = await kullaniciGirisKontrol(kullaniciAdi?.trim(), sifre)
    if (!bulunan) return false
    const guncel = { ...bulunan, durum: 'cevrimici' }
    setKullanici(guncel)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guncel))
    kullaniciDurumGuncelle(bulunan.id, 'cevrimici').catch(() => {})
    return true
  }

  const cikisYap = async () => {
    if (kullanici?.id) {
      kullaniciDurumGuncelle(kullanici.id, 'cevrimdisi').catch(() => {})
    }
    // Supabase Auth oturumunu da kapat — yoksa AsyncStorage'da token kalır
    try { await supabase.auth.signOut() } catch (e) { console.warn('[cikisYap]', e) }
    setKullanici(null)
    setMod('teknisyen')
    await AsyncStorage.removeItem(STORAGE_KEY)
    await AsyncStorage.removeItem(MODE_KEY)
  }

  // Veritabanından kullanıcı bilgisini yeniden çek (foto değişmesi, unvan değişmesi vb. durumlarda)
  const kullaniciyiTazele = async () => {
    if (!kullanici?.id) return
    const { data } = await supabase
      .from('kullanicilar')
      .select('*')
      .eq('id', kullanici.id)
      .single()
    if (data) {
      const guncel = toCamel(data)
      setKullanici(guncel)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guncel))
    }
  }

  return (
    <AuthContext.Provider
      value={{ kullanici, loading, mod, modDegistir, girisYap, cikisYap, kullaniciyiTazele }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
