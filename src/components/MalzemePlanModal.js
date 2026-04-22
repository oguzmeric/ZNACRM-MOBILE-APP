import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { modellerOzetiniGetir } from '../services/stokKalemiService'

// Malzeme planına yeni satır ekleme modalı.
// Stok kataloğundan ürün seç → adet gir → kaydet
//
// Kullanım:
//   <MalzemePlanModal
//     visible={open}
//     onClose={() => setOpen(false)}
//     initial={duzenleniyorsaMevcutPlan}
//     onSave={(plan) => persistPlan(plan)}
//   />

export default function MalzemePlanModal({ visible, onClose, initial, onSave }) {
  const [urunler, setUrunler] = useState([])
  const [secili, setSecili] = useState(null)
  const [miktar, setMiktar] = useState('1')
  const [not, setNot] = useState('')
  const [arama, setArama] = useState('')
  const [urunPickerOpen, setUrunPickerOpen] = useState(false)

  useEffect(() => {
    if (visible) {
      setMiktar(String(initial?.planliMiktar ?? '1'))
      setNot(initial?.notMetni ?? '')
      setArama('')
      if (initial?.stokKodu) {
        setSecili({
          stokKodu: initial.stokKodu,
          stokAdi: initial.stokAdi,
          birim: initial.birim ?? 'Adet',
        })
      } else {
        setSecili(null)
      }
      // Ürün listesi: hem stok_urunler (bulk/katalog) hem stok_kalemleri (scan ile eklenen S/N'liler)
      // Modellerde bu iki kaynak zaten birleştirilmiş — kullanalım
      ;(async () => {
        const modeller = await modellerOzetiniGetir()
        setUrunler(modeller ?? [])
      })()
    }
  }, [visible, initial])

  const filtrelenmis = useMemo(() => {
    // Sadece depoda/stokta olan ürünler — sahada/arızada/teknisyende olanlar hariç
    const depodaOlanlar = urunler.filter((u) => {
      if (u.tip === 'seri') return (u.depoda ?? 0) > 0
      return (u.stokMiktari ?? 0) > 0
    })
    if (!arama.trim()) return depodaOlanlar
    const q = arama.toLowerCase()
    return depodaOlanlar.filter((u) =>
      [u.stokKodu, u.stokAdi, u.marka]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [urunler, arama])

  const kaydet = () => {
    if (!secili) return Alert.alert('Eksik', 'Ürün seç.')
    const sayi = Number(String(miktar).replace(',', '.'))
    if (!sayi || sayi <= 0) return Alert.alert('Eksik', 'Geçerli bir miktar gir.')

    // Tip: modellerOzetiniGetir 'seri' veya 'bulk' döner
    // Eğer initial (düzenleme) varsa onun tipini koru
    const tip =
      initial?.tip ??
      (secili.tip === 'seri' ? 'serialized' : 'bulk')

    onSave({
      stokKodu: secili.stokKodu,
      stokAdi: secili.stokAdi,
      birim: secili.birim ?? 'Adet',
      planliMiktar: sayi,
      notMetni: not.trim() || null,
      tip,
    })
    onClose?.()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.bg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initial ? 'Malzeme Güncelle' : 'Malzeme Planla'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            <Text style={styles.label}>Ürün *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setUrunPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={{ color: secili ? '#fff' : '#64748b' }} numberOfLines={1}>
                {secili
                  ? `${secili.stokAdi ?? secili.stokKodu}`
                  : 'Ürün seç...'}
              </Text>
            </TouchableOpacity>
            {!!secili && (
              <Text style={styles.hint}>
                {secili.stokKodu} · Birim: {secili.birim ?? 'Adet'}
              </Text>
            )}

            <Text style={styles.label}>Planlanan Miktar *</Text>
            <TextInput
              style={styles.input}
              value={miktar}
              onChangeText={setMiktar}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Not (opsiyonel)</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={not}
              onChangeText={setNot}
              multiline
              placeholder="Özel bilgiler..."
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity style={styles.kaydetBtn} onPress={kaydet}>
              <Text style={styles.kaydetText}>{initial ? 'Güncelle' : 'Plana Ekle'}</Text>
            </TouchableOpacity>
          </View>

          {/* Ürün picker (aramalı) */}
          <Modal visible={urunPickerOpen} animationType="slide" transparent>
            <View style={styles.bg}>
              <View style={styles.sheet}>
                <View style={styles.header}>
                  <Text style={styles.title}>Ürün Seç</Text>
                  <TouchableOpacity onPress={() => setUrunPickerOpen(false)}>
                    <Feather name="x" size={24} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ara: ad, kod, marka..."
                    placeholderTextColor="#64748b"
                    value={arama}
                    onChangeText={setArama}
                    autoCapitalize="none"
                  />
                </View>
                <FlatList
                  data={filtrelenmis}
                  keyExtractor={(u) => u.stokKodu}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 400 }}
                  ListEmptyComponent={
                    <Text style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
                      Ürün bulunamadı.
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const isSeri = item.tip === 'seri'
                    // Stok durumu: bulk için tek sayı, seri için dağılım
                    let stokBilgi = ''
                    let stokRenk = '#22c55e'
                    if (isSeri) {
                      const depo = item.depoda ?? 0
                      const tek = item.teknisyende ?? 0
                      const saha = item.sahada ?? 0
                      const ariza = item.arizada ?? 0
                      if (depo > 0) {
                        stokBilgi = `📦 ${depo} depoda`
                        stokRenk = '#22c55e'
                      } else if (tek > 0) {
                        stokBilgi = `🚚 ${tek} teknisyende`
                        stokRenk = '#f59e0b'
                      } else if (saha > 0) {
                        stokBilgi = `✅ ${saha} sahada`
                        stokRenk = '#94a3b8'
                      } else if (ariza > 0) {
                        stokBilgi = `⚠️ ${ariza} arızalı`
                        stokRenk = '#ef4444'
                      } else {
                        stokBilgi = '❌ Stok yok'
                        stokRenk = '#ef4444'
                      }
                    } else {
                      const m = item.stokMiktari ?? 0
                      stokBilgi = m > 0 ? `📦 ${m} ${item.birim ?? ''}` : '❌ Stok yok'
                      stokRenk = m > 0 ? '#22c55e' : '#ef4444'
                    }
                    return (
                      <TouchableOpacity
                        style={styles.urunItem}
                        onPress={() => {
                          setSecili(item)
                          setUrunPickerOpen(false)
                          setArama('')
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.urunAd} numberOfLines={1}>
                            {item.marka ? `${item.marka} ` : ''}{item.stokAdi || item.model || item.stokKodu}
                          </Text>
                          <View style={[styles.tipRozet, isSeri ? styles.tipSeri : styles.tipBulk]}>
                            <Text style={[styles.tipRozetText, isSeri ? { color: '#60a5fa' } : { color: '#22c55e' }]}>
                              {isSeri ? '🔢 Cihaz' : '🧵 Sarf'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                          <Text style={styles.urunKod}>{item.stokKodu}</Text>
                          <Text style={[styles.urunMiktar, { color: stokRenk, fontWeight: '700' }]}>
                            {stokBilgi}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  }}
                />
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 13,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: { color: '#64748b', fontSize: 11, marginTop: 4 },

  urunItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  urunAd: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  urunKod: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  urunMiktar: { color: '#94a3b8', fontSize: 12 },
  tipRozet: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tipSeri: { borderColor: 'rgba(96, 165, 250, 0.4)', backgroundColor: 'rgba(96, 165, 250, 0.15)' },
  tipBulk: { borderColor: 'rgba(34, 197, 94, 0.4)', backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  tipRozetText: { fontSize: 10, fontWeight: '700' },

  kaydetBtn: {
    marginTop: 20,
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
