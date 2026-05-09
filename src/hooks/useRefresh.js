// Tek pattern pull-to-refresh.
// Kullanım:
//   const { yenileniyor, refreshControl } = useRefresh(yukle)
//   <FlatList refreshControl={refreshControl} ... />

import { useState, useCallback } from 'react'
import { RefreshControl } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export function useRefresh(yukleFn) {
  const [yenileniyor, setYenileniyor] = useState(false)
  const { colors } = useTheme()

  const onRefresh = useCallback(async () => {
    setYenileniyor(true)
    try { await yukleFn?.() }
    finally { setYenileniyor(false) }
  }, [yukleFn])

  const refreshControl = (
    <RefreshControl
      refreshing={yenileniyor}
      onRefresh={onRefresh}
      tintColor={colors.textPrimary}
      colors={[colors.primary]}
    />
  )

  return { yenileniyor, refreshControl, yenile: onRefresh }
}
