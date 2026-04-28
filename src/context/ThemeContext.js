import { createContext, useContext, useEffect, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors } from '../theme'

const STORAGE_KEY = 'temaModu'

const ThemeContext = createContext({
  mod: 'gece',
  colors: darkColors,
  modDegistir: () => {},
  yukleniyor: true,
})

export const ThemeProvider = ({ children }) => {
  const [mod, setMod] = useState(null)  // null = henüz okunmadı
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const kayitli = await AsyncStorage.getItem(STORAGE_KEY)
        if (kayitli === 'gunduz' || kayitli === 'gece') {
          setMod(kayitli)
        } else {
          setMod('gece')  // ilk açılış default
        }
      } catch (e) {
        console.warn('[Theme] AsyncStorage okunamadı', e)
        setMod('gece')
      } finally {
        setYukleniyor(false)
      }
    })()
  }, [])

  const modDegistir = async (yeni) => {
    const hedef = yeni ?? (mod === 'gece' ? 'gunduz' : 'gece')
    setMod(hedef)
    try {
      await AsyncStorage.setItem(STORAGE_KEY, hedef)
    } catch (e) {
      console.warn('[Theme] Mod kaydedilemedi', e)
    }
  }

  const colors = mod === 'gunduz' ? lightColors : darkColors

  // Tema yüklenmediyse ekrana hiçbir şey çizme — flicker önlemi
  if (mod === null) {
    return <View style={{ flex: 1, backgroundColor: '#0a0f1e' }} />
  }

  return (
    <ThemeContext.Provider value={{ mod, colors, modDegistir, yukleniyor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
