// Tarih + saat seçimi — randevu/hatırlatma alanları için.
// Kullanım:
//   <TarihSaatSec value={tarihSaat} onChange={setTarihSaat} label="Randevu Zamanı" />

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { useTheme } from '../context/ThemeContext'

export default function TarihSaatSec({ value, onChange, label, minDate, maxDate, placeholder, disabled }) {
  const [acik, setAcik] = useState(false)
  const { colors } = useTheme()

  const goster = value
    ? new Date(value).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : (placeholder ?? 'Tarih ve saat seçin')

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
        <Text style={{ color: value ? colors.textPrimary : colors.textFaded, fontSize: 15 }}>
          {goster}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={acik}
        mode="datetime"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        date={value ? new Date(value) : new Date()}
        minimumDate={minDate}
        maximumDate={maxDate}
        onConfirm={(d) => { setAcik(false); onChange?.(d) }}
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
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
})
