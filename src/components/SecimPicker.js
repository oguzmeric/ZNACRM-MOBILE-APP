// Modal tabanlı seçim picker — button göster, dokununca liste açar.
// Chip yığınına alternatif; ekran çok kalabalık göründüğünde kullanılır.

import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Pressable, TextInput } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

// Türkçe duyarlı arama: büyük/küçük + aksan farkını yutar
const trNormalize = (s = '') =>
  String(s).toLocaleLowerCase('tr')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')

// props:
//  deger     -> mevcut değer (string)
//  onSec     -> (yeniDeger) => void
//  secenekler-> ['CCTV', ...] veya [{ id, isim }, ...]
//  placeholder
//  ekstraSecenek -> opsiyonel: { etiket, deger, ikon } — listenin sonuna eklenir (örn: Manuel)
export default function SecimPicker({
  deger, onSec, secenekler, placeholder = 'Seç…', ekstraSecenek = null,
  aramaEsigi = 8,   // bu sayıdan fazla seçenek varsa arama kutusu çıkar
}) {
  const { colors } = useTheme()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')

  const normalize = (s) => (typeof s === 'string' ? { id: s, isim: s } : s)
  const items = (secenekler || []).map(normalize)

  // Uzun listede kaydırmak yerine yazarak süz (kullanıcı isteği)
  const aramaGoster = items.length > aramaEsigi
  const gorunenItems = useMemo(() => {
    const q = trNormalize(arama.trim())
    if (!q) return items
    return items.filter(i => trNormalize(i.isim).includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secenekler, arama])
  const seciliItem = items.find((i) => i.id === deger || i.isim === deger)
  const ekstraSecili = ekstraSecenek && ekstraSecenek.deger === deger
  const gostergeMetin = seciliItem?.isim ?? (ekstraSecili ? ekstraSecenek.etiket : (deger || placeholder))
  const bosMetin = !seciliItem && !ekstraSecili && !deger

  const kapat = () => setAcik(false)
  const sec = (v) => { onSec(v); kapat() }

  return (
    <>
      <TouchableOpacity
        onPress={() => setAcik(true)}
        activeOpacity={0.7}
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={{ color: bosMetin ? colors.textMuted : colors.textPrimary, fontSize: 14, flex: 1 }}>
          {gostergeMetin}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={acik} transparent animationType="fade" onRequestClose={kapat}>
        <Pressable onPress={kapat} style={styles.overlay}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{placeholder}</Text>
              <TouchableOpacity onPress={kapat} activeOpacity={0.7}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {aramaGoster && (
              <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                <View style={[styles.aramaKutu, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                  <Feather name="search" size={15} color={colors.textMuted} />
                  <TextInput
                    value={arama}
                    onChangeText={setArama}
                    placeholder={`${items.length} kayıtta ara…`}
                    placeholderTextColor={colors.textFaded}
                    autoCorrect={false}
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 8 }}
                  />
                  {!!arama && (
                    <TouchableOpacity onPress={() => setArama('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            <FlatList
              data={gorunenItems}
              keyExtractor={(it) => String(it.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                  Aramaya uyan kayıt yok.
                </Text>
              }
              renderItem={({ item }) => {
                const aktif = item.id === deger || item.isim === deger
                return (
                  <TouchableOpacity
                    onPress={() => sec(item.id)}
                    activeOpacity={0.7}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <Text style={{ color: aktif ? colors.primary : colors.textPrimary, fontSize: 14, fontWeight: aktif ? '700' : '500', flex: 1 }}>
                      {item.isim}
                    </Text>
                    {aktif && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                )
              }}
              ListFooterComponent={ekstraSecenek ? (
                <TouchableOpacity
                  onPress={() => sec(ekstraSecenek.deger)}
                  activeOpacity={0.7}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <Feather name={ekstraSecenek.ikon || 'edit-2'} size={16} color={colors.primary} style={{ marginRight: 10 }} />
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                    {ekstraSecenek.etiket}
                  </Text>
                </TouchableOpacity>
              ) : null}
              style={{ maxHeight: 360 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
})
