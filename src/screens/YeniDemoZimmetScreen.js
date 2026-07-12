import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { demoZimmetAc, demoCihazGetir } from '../services/demoService'
import { musterileriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { trIcerir } from '../utils/trSearch'
import TarihSec from '../components/TarihSec'
import SecimPicker from '../components/SecimPicker'

const SURELER = [7, 14, 30]

const ekleGun = (g) => {
  const t = new Date()
  t.setDate(t.getDate() + g)
  return t.toISOString().slice(0, 10)
}

export default function YeniDemoZimmetScreen({ route, navigation }) {
  const { cihazId } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()

  const [cihaz, setCihaz] = useState(null)
  const [musteriler, setMusteriler] = useState([])
  const [musteri, setMusteri] = useState(null)
  const [musteriArama, setMusteriArama] = useState('')
  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [lokasyonId, setLokasyonId] = useState(null)
  const [verisTarihi, setVerisTarihi] = useState(new Date().toISOString().slice(0, 10))
  const [iadeTarihi, setIadeTarihi] = useState(ekleGun(14))
  const [notlar, setNotlar] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    demoCihazGetir(cihazId).then(setCihaz)
    musterileriGetir().then(l => setMusteriler(l ?? []))
  }, [cihazId])

  useEffect(() => {
    if (!musteri?.id) { setLokasyonlar([]); setLokasyonId(null); return }
    musteriLokasyonlariniGetir(musteri.id).then(l => setLokasyonlar(l ?? [])).catch(() => setLokasyonlar([]))
    setLokasyonId(null)
  }, [musteri?.id])

  const filtreliMusteriler = musteriArama.trim()
    ? musteriler.filter(m => trIcerir([m.firma, m.ad, m.soyad, m.telefon], musteriArama))
    : musteriler

  const kaydet = async () => {
    if (!musteri) { Alert.alert('Eksik', 'Müşteri seçin.'); return }
    if (!iadeTarihi) { Alert.alert('Eksik', 'Beklenen iade tarihi gerekli.'); return }
    if (cihaz?.aktifZimmetId) { Alert.alert('Hata', 'Bu cihazın aktif zimmeti var.'); return }
    if (cihaz?.bakimda) { Alert.alert('Hata', 'Bu cihaz bakımda.'); return }
    setKaydediliyor(true)
    const sonuc = await demoZimmetAc({
      cihazId,
      musteriId: musteri.id,
      lokasyonId: lokasyonId || null,
      verenKullaniciId: kullanici?.id ? String(kullanici.id) : null,
      verenKullaniciAd: kullanici?.ad ?? null,
      verisTarihi,
      beklenenIadeTarihi: iadeTarihi,
      durumNotu: notlar.trim() || null,
    })
    setKaydediliyor(false)
    if (!sonuc || sonuc._hata) {
      Alert.alert('Hata', `Zimmet açılamadı: ${sonuc?._hata || 'bilinmeyen'}`)
      return
    }
    Alert.alert(
      'Teslim Tutanağı Hazır',
      `Zimmet açıldı.\nTutanak No: ${sonuc.tutanakNo || '—'}\n\nCihaz sayfasından tutanağı müşteriye gönderebilir, imzalatıp fotoğrafını yükleyebilirsin.`,
    )
    navigation.replace('DemoCihazDetay', { id: cihazId })
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 }}>{cihaz?.ad || ''}</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>MÜŞTERİ *</Text>
          <TouchableOpacity onPress={() => setMusteriPickerOpen(true)}
            style={[styles.secici, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: musteri ? colors.textPrimary : colors.textFaded }}>
              {musteri ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim()) : 'Seçiniz'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {lokasyonlar.length > 0 && (
            <>
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>LOKASYON</Text>
              <View style={{ marginTop: 4 }}>
                <SecimPicker
                  deger={lokasyonId ?? 0}
                  onSec={(v) => setLokasyonId(v === 0 ? null : v)}
                  secenekler={[
                    { id: 0, isim: '— Lokasyon yok —' },
                    ...lokasyonlar.map(l => ({ id: l.id, isim: l.ad })),
                  ]}
                  placeholder={`Lokasyon seç (${lokasyonlar.length})`}
                />
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <TarihSec
                value={verisTarihi}
                onChange={(iso) => setVerisTarihi(iso || '')}
                label="VERİLİŞ"
                title="Veriliş Tarihi"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TarihSec
                value={iadeTarihi}
                onChange={(iso) => setIadeTarihi(iso || '')}
                label="BEKLENEN İADE *"
                title="Beklenen İade Tarihi"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {SURELER.map(g => (
              <TouchableOpacity key={g} onPress={() => setIadeTarihi(ekleGun(g))}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{g} gün</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>NOTLAR</Text>
          <TextInput value={notlar} onChangeText={setNotlar}
            style={{ marginTop: 4, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, marginBottom: 16 }} />

          <TouchableOpacity onPress={kaydet} disabled={kaydediliyor}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10, backgroundColor: colors.primary, opacity: kaydediliyor ? 0.5 : 1 }}>
            <Feather name="save" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {kaydediliyor ? 'Kaydediliyor…' : 'Zimmet Aç'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={musteriPickerOpen} animationType="slide" transparent onRequestClose={() => setMusteriPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ marginTop: 80, flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={musteriArama} onChangeText={setMusteriArama} placeholder="Müşteri ara..."
                placeholderTextColor={colors.textFaded}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 8, color: colors.textPrimary }} />
              <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}><Feather name="x" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtreliMusteriler.map(m => (
                <TouchableOpacity key={m.id} onPress={() => { setMusteri(m); setMusteriPickerOpen(false); setMusteriArama('') }}
                  style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {m.firma || `${m.ad ?? ''} ${m.soyad ?? ''}`.trim()}
                  </Text>
                  {m.telefon && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.telefon}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  secici: { marginTop: 4, padding: 10, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
