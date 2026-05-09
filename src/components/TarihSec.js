// Tarih seçimi (saat YOK) — deadline/sınır alanları için.
// Mevcut TakvimPicker'ı (Türkçe lokalize, react-native-calendars) sarmalar.
// Kullanım:
//   <TarihSec value={tarih} onChange={setTarih} label="Son Tarih" />

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import TakvimPicker from './TakvimPicker'
import { useTheme } from '../context/ThemeContext'

// value: 'YYYY-MM-DD' string veya Date veya null
const toIsoDateString = (v) => {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  return ''
}

const formatTr = (v) => {
  const iso = toIsoDateString(v)
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function TarihSec({ value, onChange, label, placeholder, disabled, gosterTemizle = true, title }) {
  const [acik, setAcik] = useState(false)
  const { colors } = useTheme()

  const iso = toIsoDateString(value)
  const goster = iso ? formatTr(iso) : (placeholder ?? 'Tarih seçin')

  return (
    <View>
      {!!label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border },
          disabled && { opacity: 0.5 },
        ]}
        onPress={() => !disabled && setAcik(true)}
        activeOpacity={0.7}
      >
        <Feather name="calendar" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <Text style={{ flex: 1, color: iso ? colors.textPrimary : colors.textFaded, fontSize: 15 }}>
          {goster}
        </Text>
        {gosterTemizle && !!iso && !disabled && (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onChange?.(null)}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <TakvimPicker
        visible={acik}
        onClose={() => setAcik(false)}
        secili={iso}
        onSelect={(isoString) => {
          setAcik(false)
          onChange?.(isoString)
        }}
        title={title ?? label ?? 'Tarih Seç'}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
})
