// Müşteri lokasyon seçici + ekle/sil modal'ı.
// Görüşme, görev, servis talebi formlarında kullanılır.
//
// props:
//   musteriId: number | null  — seçili müşterinin id'si (yoksa picker disabled)
//   lokasyonlar: array        — mevcut lokasyon listesi (caller yükler)
//   onLokasyonlarChange: fn   — listede değişiklik (ekle/sil) bildirimi
//   secili: object | null     — şu an seçili lokasyon
//   onSeciliChange: fn        — kullanıcı yeni lokasyon seçti

import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import {
  musteriLokasyonEkle,
  musteriLokasyonSil,
} from '../services/musteriLokasyonService'

export default function LokasyonPicker({
  musteriId,
  lokasyonlar = [],
  onLokasyonlarChange,
  secili,
  onSeciliChange,
}) {
  const { colors } = useTheme()
  const [pickerAcik, setPickerAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)

  const ekle = async () => {
    const ad = yeniAd.trim()
    if (!ad) return
    if (!musteriId) {
      Alert.alert('Eksik', 'Önce müşteri seçin.')
      return
    }
    if (lokasyonlar.some((l) => (l.ad || '').toLowerCase() === ad.toLowerCase())) {
      Alert.alert('Uyarı', 'Bu lokasyon zaten ekli.')
      return
    }
    setEkleniyor(true)
    try {
      const yeni = await musteriLokasyonEkle({ musteriId, ad, aktif: true })
      if (yeni) {
        onLokasyonlarChange?.([...lokasyonlar, yeni])
        setYeniAd('')
      } else {
        Alert.alert('Hata', 'Eklenemedi.')
      }
    } catch (err) {
      Alert.alert('Hata', err?.message || 'Eklenemedi.')
    } finally {
      setEkleniyor(false)
    }
  }

  const sil = (l) => {
    Alert.alert(
      'Sil',
      `"${l.ad}" lokasyonu silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive', onPress: async () => {
            await musteriLokasyonSil(l.id)
            onLokasyonlarChange?.(lokasyonlar.filter((x) => x.id !== l.id))
            if (secili?.id === l.id) onSeciliChange?.(null)
          },
        },
      ],
    )
  }

  const sec = (l) => {
    onSeciliChange?.(l)
    setPickerAcik(false)
  }

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerAcik(true)}
          activeOpacity={0.7}
          disabled={!musteriId}
        >
          <Text style={{ color: secili ? colors.textPrimary : colors.textMuted }} numberOfLines={1}>
            {!musteriId ? 'Önce müşteri seçin' : secili ? secili.ad : 'Lokasyon seç / ekle…'}
          </Text>
        </TouchableOpacity>
        {!!secili && (
          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onSeciliChange?.(null)}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600' }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={pickerAcik} animationType="slide" transparent onRequestClose={() => setPickerAcik(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Lokasyon Yönetimi</Text>
              <TouchableOpacity onPress={() => setPickerAcik(false)}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Yeni ekle */}
            <View style={[styles.row, { padding: 12 }]}>
              <TextInput
                value={yeniAd}
                onChangeText={setYeniAd}
                placeholder="Yeni lokasyon adı…"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
                editable={!ekleniyor}
                onSubmitEditing={ekle}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={ekle}
                disabled={ekleniyor || !yeniAd.trim() || !musteriId}
                style={[styles.addBtn, { backgroundColor: colors.primary, opacity: (ekleniyor || !yeniAd.trim() || !musteriId) ? 0.5 : 1 }]}
              >
                {ekleniyor ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="plus" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            {/* Liste */}
            {lokasyonlar.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Henüz lokasyon eklenmemiş.</Text>
              </View>
            ) : (
              <FlatList
                data={lokasyonlar}
                keyExtractor={(l) => String(l.id)}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => (
                  <View style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={{ flex: 1, paddingVertical: 4 }} onPress={() => sec(item)} activeOpacity={0.7}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="map-pin" size={14} color={colors.primary} />
                        <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{item.ad}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => sil(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={() => setPickerAcik(false)}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14,
  },
  clearBtn: {
    width: 40, height: 40, borderWidth: 1, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  addBtn: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    margin: 16, marginBottom: 0,
    paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
  },
})
