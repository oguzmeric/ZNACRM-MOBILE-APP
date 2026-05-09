// Tarih + saat seçimi — randevu/hatırlatma alanları için.
// react-native-modal-datetime-picker (native iOS/Android datetime modal) kullanır.
// Kullanım:
//   <TarihSaatSec value={tarihSaat} onChange={setTarihSaat} label="Randevu Zamanı" />

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

// value: ISO string veya Date veya null. onChange: ISO string verir.
const toDateOrNull = (v) => {
  if (!v) return null
  if (v instanceof Date) return isNaN(v) ? null : v
  const d = new Date(v)
  return isNaN(d) ? null : d
}

const formatTr = (date) =>
  date.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

export default function TarihSaatSec({ value, onChange, label, minDate, maxDate, placeholder, disabled, gosterTemizle = true }) {
  const [acik, setAcik] = useState(false)
  const { colors } = useTheme()

  const tarih = toDateOrNull(value)
  const goster = tarih ? formatTr(tarih) : (placeholder ?? 'Tarih ve saat seçin')

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
        <Feather name="clock" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <Text style={{ flex: 1, color: tarih ? colors.textPrimary : colors.textFaded, fontSize: 15 }}>
          {goster}
        </Text>
        {gosterTemizle && !!tarih && !disabled && (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onChange?.(null)}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={acik}
        mode="datetime"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        date={tarih ?? new Date()}
        minimumDate={minDate}
        maximumDate={maxDate}
        onConfirm={(d) => { setAcik(false); onChange?.(d.toISOString()) }}
        onCancel={() => setAcik(false)}
        locale="tr-TR"
        confirmTextIOS="Seç"
        cancelTextIOS="Vazgeç"
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
