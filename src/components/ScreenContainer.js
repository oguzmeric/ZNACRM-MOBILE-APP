import { View, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'

// Tüm ekranlar için tutarlı arka plan + gradient glow efekti.
// Login & HomeScreen ile aynı premium görünüm.
//
// Kullanım:
//   <ScreenContainer>
//     <FlatList ... />
//   </ScreenContainer>

export default function ScreenContainer({ children, withGlow = true, style }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      {withGlow && (
        <>
          <View
            style={[
              styles.topGlow,
              { backgroundColor: colors.glowBlue, opacity: colors.glowOpacity },
            ]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.bottomGlow,
              { backgroundColor: colors.glowPurple, opacity: (colors.glowOpacity ?? 0.08) * 0.8 },
            ]}
            pointerEvents="none"
          />
        </>
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGlow: {
    position: 'absolute',
    top: -180,
    left: -120,
    width: 400,
    height: 400,
    borderRadius: 300,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -180,
    right: -120,
    width: 400,
    height: 400,
    borderRadius: 300,
  },
})
