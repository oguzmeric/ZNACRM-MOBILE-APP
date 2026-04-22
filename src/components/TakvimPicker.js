import { useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { Calendar, LocaleConfig } from 'react-native-calendars'
import { Feather } from '@expo/vector-icons'

// Türkçe takvim ayarı
LocaleConfig.locales.tr = {
  monthNames: [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ],
  monthNamesShort: [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
  ],
  dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  today: 'Bugün',
}
LocaleConfig.defaultLocale = 'tr'

// Kullanım:
//   <TakvimPicker
//     visible={open}
//     onClose={() => setOpen(false)}
//     secili={'2026-04-25'}          // YYYY-MM-DD
//     onSelect={(tarih) => setTarih(tarih)}
//     title="Planlı Tarih Seç"
//   />

export default function TakvimPicker({ visible, onClose, secili, onSelect, title = 'Tarih Seç' }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Calendar
            onDayPress={(day) => {
              onSelect?.(day.dateString)
              onClose?.()
            }}
            markedDates={
              secili
                ? {
                    [secili]: {
                      selected: true,
                      selectedColor: '#2563eb',
                    },
                  }
                : {}
            }
            theme={{
              backgroundColor: '#0f172a',
              calendarBackground: '#0f172a',
              textSectionTitleColor: '#94a3b8',
              selectedDayBackgroundColor: '#2563eb',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#60a5fa',
              todayBackgroundColor: 'rgba(96, 165, 250, 0.15)',
              dayTextColor: '#e2e8f0',
              textDisabledColor: '#334155',
              monthTextColor: '#ffffff',
              arrowColor: '#60a5fa',
              textMonthFontWeight: '700',
              textMonthFontSize: 18,
              textDayFontWeight: '500',
              textDayFontSize: 15,
              textDayHeaderFontWeight: '600',
              textDayHeaderFontSize: 12,
            }}
            firstDay={1} // Pazartesi
            enableSwipeMonths
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.temizleBtn}
              onPress={() => {
                onSelect?.('')
                onClose?.()
              }}
            >
              <Feather name="trash-2" size={16} color="#ef4444" />
              <Text style={styles.temizleText}>Temizle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bugunBtn}
              onPress={() => {
                const now = new Date()
                const y = now.getFullYear()
                const m = String(now.getMonth() + 1).padStart(2, '0')
                const d = String(now.getDate()).padStart(2, '0')
                onSelect?.(`${y}-${m}-${d}`)
                onClose?.()
              }}
            >
              <Feather name="calendar" size={16} color="#fff" />
              <Text style={styles.bugunText}>Bugün</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  temizleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  temizleText: { color: '#ef4444', fontWeight: '600' },
  bugunBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
  },
  bugunText: { color: '#fff', fontWeight: '700' },
})
