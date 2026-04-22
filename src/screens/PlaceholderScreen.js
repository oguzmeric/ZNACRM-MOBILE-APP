import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'

export default function PlaceholderScreen({ route }) {
  const { colors } = useTheme()
  const title = route?.params?.title ?? route?.name ?? 'Ekran'
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.textFaded }]}>Bu ekran henüz hazır değil. Yakında.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  hint: { color: '#64748b', marginTop: 8 },
})
