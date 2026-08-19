import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sentry from '@sentry/react-native'
import { supabase } from '../lib/supabase'
import { toCamel } from '../lib/mapper'
import { kullaniciGirisKontrol, kullaniciDurumGuncelle } from '../services/kullaniciService'
import { pushTokenKaydet, pushTokenSil } from '../lib/pushBildirimKayit'

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
  const kullaniciIdRef = useRef(null)
  useEffect(() => {
    kullaniciIdRef.current = kullanici?.id ?? null
  }, [kullanici?.id])

  // Profili DB'den sessizce tazele — webden ad/kullanıcı adı/foto değişirse
  // çıkış-giriş gerekmeden mobile yansısın (best-effort, hata yutar)
  const profilTazele = async (id) => {
    if (!id) return
    try {
      const { data } = await supabase
        .from('kullanicilar')
        .select('*')
        .eq('id', id)
        .single()
      if (data && kullaniciIdRef.current === id) {
        const guncel = toCamel(data)
        // ⚠️ REFERANSI GEREKSİZ YERE DEĞİŞTİRME (19.08 performans denetimi).
        // Bu fonksiyon uygulama her öne geldiğinde çalışıyor. Eskiden koşulsuz
        // yeni nesne üretiyordu; `kullanici` bağımlılığı taşıyan tüm ekranların
        // `yukle` fonksiyonu yeniden oluşuyor, useFocusEffect ateşleniyor ve
        // birkaç ekran birden spinner'a düşüp yeniden sorgulanıyordu. Telefonu
        // cebinden çıkarmak tam bir yeniden yükleme fırtınası başlatıyordu.
        setKullanici((onceki) => {
          const yeni = { ...onceki, ...guncel }
          if (onceki && JSON.stringify(onceki) === JSON.stringify(yeni)) return onceki
          return yeni
        })
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guncel))
      }
    } catch (e) {
      console.warn('[Auth] Profil tazelenemedi', e?.message)
    }
  }

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
            // Push token kaydı (best-effort, simülatörde no-op)
            pushTokenKaydet(k.id).catch((e) => console.warn('[push token]', e?.message))
            // Cihazdaki profil bayat olabilir — DB'den güncelini çek
            kullaniciIdRef.current = k.id
            profilTazele(k.id)
          }
        }
      } catch (e) {
        console.warn('[Auth] AsyncStorage okunamadı', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Uygulama arka plandan öne gelince profili tazele
  useEffect(() => {
    const abone = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') profilTazele(kullaniciIdRef.current)
    })
    return () => abone.remove()
  }, [])

  // ⚠️ Bu üç fonksiyon useCallback ile sarılı: aksi halde her render'da yeni
  // referans üretir, aşağıdaki useMemo hiç tutmaz ve 49 tüketici yine her
  // seferinde yeniden çizilir.
  const modDegistir = useCallback(async (yeniMod) => {
    if (yeniMod !== 'admin' && yeniMod !== 'teknisyen') return
    setMod(yeniMod)
    try {
      await AsyncStorage.setItem(MODE_KEY, yeniMod)
    } catch (e) {
      console.warn('[Auth] Mod kaydedilemedi', e)
    }
  }, [])

  const girisYap = useCallback(async (kullaniciAdi, sifre) => {
    const bulunan = await kullaniciGirisKontrol(kullaniciAdi?.trim(), sifre)
    if (!bulunan) return false
    const guncel = { ...bulunan, durum: 'cevrimici' }
    setKullanici(guncel)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(guncel))
    kullaniciDurumGuncelle(bulunan.id, 'cevrimici').catch(() => {})
    // Push token kaydı (best-effort)
    pushTokenKaydet(bulunan.id).catch((e) => console.warn('[push token]', e?.message))
    return true
  }, [])

  const cikisYap = useCallback(async () => {
    if (kullanici?.id) {
      kullaniciDurumGuncelle(kullanici.id, 'cevrimdisi').catch(() => {})
      // Bu cihazın push token'ını sil (signOut'tan ÖNCE — auth lazım)
      try { await pushTokenSil(kullanici.id) } catch (e) { console.warn('[push sil]', e?.message) }
    }
    // Supabase Auth oturumunu da kapat — yoksa AsyncStorage'da token kalır
    try { await supabase.auth.signOut() } catch (e) { console.warn('[cikisYap]', e) }
    setKullanici(null)
    setMod('teknisyen')
    await AsyncStorage.removeItem(STORAGE_KEY)
    await AsyncStorage.removeItem(MODE_KEY)
  }, [kullanici?.id])

  // Veritabanından kullanıcı bilgisini yeniden çek (foto değişmesi, unvan değişmesi vb. durumlarda)
  const kullaniciyiTazele = useCallback(() => profilTazele(kullanici?.id), [kullanici?.id])

  // ⚠️ useMemo ŞART: useAuth() 49 dosyada kullanılıyor. Inline `value={{...}}`
  // her render'da yeni nesne üretiyordu ve bu 49 tüketicinin TAMAMINI yeniden
  // çizdiriyordu (19.08 performans denetimi).
  const deger = useMemo(
    () => ({ kullanici, loading, mod, modDegistir, girisYap, cikisYap, kullaniciyiTazele }),
    [kullanici, loading, mod, modDegistir, girisYap, cikisYap, kullaniciyiTazele],
  )

  return (
    <AuthContext.Provider value={deger}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
