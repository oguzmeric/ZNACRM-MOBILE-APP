import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { demoCihazEkle, demoCihazGuncelle, demoCihazGetir } from '../services/demoService'

const KATEGORILER = ['NVR', 'DVR', 'IP Kamera', 'Analog Kamera', 'Switch', 'Server', 'Santral', 'Telefon', 'Diğer']

export default function YeniDemoCihazScreen({ navigation, route }) {
  const editId = route?.params?.editId || null
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const [form, setForm] = useState({ ad: '', marka: '', model: '', seriNo: '', kategori: '', notlar: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(!!editId)

  useEffect(() => {
    if (editId) {
      navigation.setOptions({ title: 'Cihaz Düzenle' })
      demoCihazGetir(editId).then(c => {
        if (c) {
          setForm({
            ad: c.ad || '',
            marka: c.marka || '',
            model: c.model || '',
            seriNo: c.seriNo || '',
            kategori: c.kategori || '',
            notlar: c.notlar || '',
          })
        }
        setYukleniyor(false)
      })
    }
  }, [editId, navigation])

  const setAlan = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const kaydet = async (zimmeteGec = false) => {
    if (!form.ad.trim()) { Alert.alert('Eksik', 'Cihaz adı gerekli.'); return }
    setKaydediliyor(true)
    const payload = {
      ad: form.ad.trim(),
      marka: form.marka.trim() || null,
      model: form.model.trim() || null,
      seriNo: form.seriNo.trim() || null,
      kategori: form.kategori || null,
      notlar: form.notlar.trim() || null,
    }
    const sonuc = editId
      ? await demoCihazGuncelle(editId, payload)
      : await demoCihazEkle(payload)
    setKaydediliyor(false)
    if (!sonuc) { Alert.alert('Hata', 'Cihaz kaydedilemedi.'); return }
    if (zimmeteGec && !editId) {
      navigation.replace('YeniDemoZimmet', { cihazId: sonuc.id })
    } else {
      navigation.replace('DemoCihazDetay', { id: sonuc.id })
    }
  }

  if (yukleniyor) {
    return <ScreenContainer><Text style={{ color: colors.textMuted, padding: 24, textAlign: 'center' }}>Yükleniyor…</Text></ScreenContainer>
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
          {!editId && (
            <View style={{ padding: 12, marginBottom: 14, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.surface }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                ℹ️ Cihaz havuza eklenir. "Kaydet ve Zimmet Aç" ile direkt müşteriye zimmetleyebilirsin.
              </Text>
            </View>
          )}

          <Alan label="Cihaz Adı *" value={form.ad} onChangeText={(v) => setAlan('ad', v)} colors={colors} placeholder="Örn: Trassir NVR-04" />
          <Alan label="Marka" value={form.marka} onChangeText={(v) => setAlan('marka', v)} colors={colors} placeholder="Trassir" />
          <Alan label="Model" value={form.model} onChangeText={(v) => setAlan('model', v)} colors={colors} placeholder="HY-CW3011" />
          <Alan label="Seri No" value={form.seriNo} onChangeText={(v) => setAlan('seriNo', v)} colors={colors} />

          <Text style={[styles.label, { color: colors.textMuted }]}>KATEGORİ</Text>
          <View style={styles.row}>
            {KATEGORILER.map(k => (
              <TouchableOpacity key={k} onPress={() => setAlan('kategori', form.kategori === k ? '' : k)}
                style={[styles.chip, { backgroundColor: form.kategori === k ? colors.primary : colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: form.kategori === k ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Alan label="Notlar" value={form.notlar} onChangeText={(v) => setAlan('notlar', v)} colors={colors} multiline />

          {!editId && (
            <TouchableOpacity onPress={() => kaydet(true)} disabled={kaydediliyor}
              style={[styles.kaydetBtn, { backgroundColor: colors.primary, opacity: kaydediliyor ? 0.5 : 1 }]}>
              <Feather name="arrow-right-circle" size={18} color="#fff" />
              <Text style={styles.kaydetText}>Kaydet ve Zimmet Aç</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => kaydet(false)} disabled={kaydediliyor}
            style={[styles.kaydetBtn, { backgroundColor: editId ? colors.primary : colors.surface, borderWidth: editId ? 0 : 1, borderColor: colors.border, marginTop: 8, opacity: kaydediliyor ? 0.5 : 1 }]}>
            <Feather name="save" size={18} color={editId ? '#fff' : colors.textPrimary} />
            <Text style={[styles.kaydetText, { color: editId ? '#fff' : colors.textPrimary }]}>
              {kaydediliyor ? 'Kaydediliyor…' : (editId ? 'Güncelle' : 'Sadece Kaydet')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

function Alan({ label, value, onChangeText, colors, placeholder, multiline }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textFaded}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
        style={{ marginTop: 4, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, minHeight: multiline ? 70 : 0 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  kaydetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10 },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
