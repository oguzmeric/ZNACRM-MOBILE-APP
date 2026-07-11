// Çoklu seçim picker — SecimPicker'ın multi-select versiyonu.
// Kullanıcı tercihi: chip yığını yerine dropdown ("sayfada kirlilik yapmasın").
// Buton "N seçili: A, B +2" gösterir; modal içinde checkbox listesi,
// seçim yapınca modal AÇIK kalır, "Tamam" ile kapanır.
//
// props:
//  degerler  -> seçili id array'i
//  onChange  -> (yeniArray) => void
//  secenekler-> [{ id, isim }, ...]
//  placeholder

import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Pressable } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

export default function CokluSecimPicker({ degerler = [], onChange, secenekler = [], placeholder = 'Seç…' }) {
  const { colors } = useTheme()
  const [acik, setAcik] = useState(false)

  const secili = new Set(degerler)
  const seciliAdlar = secenekler.filter(s => secili.has(s.id)).map(s => s.isim)
  const gosterge = seciliAdlar.length === 0
    ? placeholder
    : seciliAdlar.length <= 2
      ? seciliAdlar.join(', ')
      : `${seciliAdlar.slice(0, 2).join(', ')} +${seciliAdlar.length - 2}`

  const toggle = (id) => {
    const yeni = secili.has(id) ? degerler.filter(d => d !== id) : [...degerler, id]
    onChange?.(yeni)
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setAcik(true)}
        activeOpacity={0.7}
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={{ color: seciliAdlar.length ? colors.textPrimary : colors.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
          {gosterge}
        </Text>
        {seciliAdlar.length > 0 && (
          <View style={{
            minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9,
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{seciliAdlar.length}</Text>
          </View>
        )}
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={acik} transparent animationType="fade" onRequestClose={() => setAcik(false)}>
        <Pressable onPress={() => setAcik(false)} style={styles.overlay}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setAcik(false)} activeOpacity={0.7}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={secenekler}
              keyExtractor={(it) => String(it.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isaretli = secili.has(item.id)
                return (
                  <TouchableOpacity
                    onPress={() => toggle(item.id)}
                    activeOpacity={0.7}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 5, marginRight: 10,
                      borderWidth: 1.5, borderColor: isaretli ? colors.primary : colors.border,
                      backgroundColor: isaretli ? colors.primary : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isaretli && <Feather name="check" size={13} color="#fff" />}
                    </View>
                    <Text style={{
                      color: isaretli ? colors.primary : colors.textPrimary,
                      fontSize: 14, fontWeight: isaretli ? '700' : '500', flex: 1,
                    }}>
                      {item.isim}
                    </Text>
                  </TouchableOpacity>
                )
              }}
              style={{ maxHeight: 400 }}
            />
            <TouchableOpacity
              onPress={() => setAcik(false)}
              activeOpacity={0.85}
              style={{
                margin: 12, height: 44, borderRadius: 10,
                backgroundColor: colors.primary,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Tamam{seciliAdlar.length ? ` (${seciliAdlar.length} seçili)` : ''}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center',
  },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', padding: 24,
  },
  sheet: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1,
  },
})
