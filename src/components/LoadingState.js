// Tüm ekranlarda tutarlı yükleme ekranı.
// Kullanım:
//   <LoadingState />                              // varsayılan: ortada spinner
//   <LoadingState mesaj="Yükleniyor..." />        // metinli
//   <LoadingState kompakt />                      // küçük (kart içi yükleme)
//   <LoadingState satir />                        // inline tek satır

import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export default function LoadingState({ mesaj, kompakt = false, satir = false }) {
  const { colors } = useTheme()

  if (satir) {
    return (
      <View style={styles.satir}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        {!!mesaj && (
          <Text style={[styles.satirMesaj, { color: colors.textMuted }]}>{mesaj}</Text>
        )}
      </View>
    )
  }

  return (
    <View style={[styles.kapsayici, kompakt && styles.kompakt]}>
      <ActivityIndicator
        size={kompakt ? 'small' : 'large'}
        color={colors.primary}
      />
      {!!mesaj && (
        <Text style={[styles.mesaj, { color: colors.textMuted }, kompakt && { fontSize: 12 }]}>
          {mesaj}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  kompakt: { minHeight: 80, padding: 16 },
  mesaj: { marginTop: 12, fontSize: 13, fontWeight: '500' },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  satirMesaj: { fontSize: 13, fontWeight: '500' },
})
