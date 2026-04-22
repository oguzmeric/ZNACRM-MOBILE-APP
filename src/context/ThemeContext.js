import { createContext, useContext, useEffect, useState } from 'react'
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
  const [mod, setMod] = useState('gece')
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const kayitli = await AsyncStorage.getItem(STORAGE_KEY)
        if (kayitli === 'gunduz' || kayitli === 'gece') setMod(kayitli)
      } catch (e) {
        console.warn('[Theme] AsyncStorage okunamadı', e)
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

  return (
    <ThemeContext.Provider value={{ mod, colors, modDegistir, yukleniyor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
