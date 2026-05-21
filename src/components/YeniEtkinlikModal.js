// Yeni etkinlik + Google Meet oluşturma modal'ı (mobile).
// Web tarafındaki YeniEtkinlikModal'ın React Native versiyonu.
// Edge function 'google-takvim-etkinlik-olustur' ile Google Calendar'a yazar.

import { useState, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import TarihSaatSec from './TarihSaatSec'
import { etkinlikOlustur } from '../services/takvimService'

const pad = (n) => String(n).padStart(2, '0')

// varsayilanTarih: 'YYYY-MM-DD' ya da null. Verilirse o gün 09:00-10:00 default.
function varsayilanZamanlar(varsayilanTarih) {
  if (varsayilanTarih && /^\d{4}-\d{2}-\d{2}$/.test(varsayilanTarih)) {
    const [y, m, d] = varsayilanTarih.split('-').map(Number)
    const bas = new Date(y, m - 1, d, 9, 0, 0, 0)
    const bit = new Date(y, m - 1, d, 10, 0, 0, 0)
    return { bas: bas.toISOString(), bit: bit.toISOString() }
  }
  // Şimdiden 15 dk sonra, 30 dk sürsün — 15dk'lık yuvarlama
  const simdi = new Date()
  const bas = new Date(simdi.getTime() + 15 * 60 * 1000)
  bas.setSeconds(0, 0)
  bas.setMinutes(Math.ceil(bas.getMinutes() / 15) * 15)
  const bit = new Date(bas.getTime() + 30 * 60 * 1000)
  return { bas: bas.toISOString(), bit: bit.toISOString() }
}

export default function YeniEtkinlikModal({ visible, baglantilar, varsayilanTarih, onKapat, onBasarili }) {
  const { colors } = useTheme()

  const [baslik, setBaslik] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [lokasyon, setLokasyon] = useState('')
  const [baslangic, setBaslangic] = useState(null)
  const [bitis, setBitis] = useState(null)
  const [davetliEmail, setDavetliEmail] = useState('')
  const [davetliler, setDavetliler] = useState([])
  const [meetEkle, setMeetEkle] = useState(true)
  const [secilenBaglantiId, setSecilenBaglantiId] = useState(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!visible) return
    const { bas, bit } = varsayilanZamanlar(varsayilanTarih)
    setBaslik('')
    setAciklama('')
    setLokasyon('')
    setBaslangic(bas)
    setBitis(bit)
    setDavetliEmail('')
    setDavetliler([])
    setMeetEkle(true)
    setKaydediliyor(false)
    // İlk aktif bağlantıyı default seç
    setSecilenBaglantiId(baglantilar?.[0]?.id ?? null)
  }, [visible, varsayilanTarih])

  const davetliEkle = () => {
    const e = davetliEmail.trim().toLowerCase()
    if (!e) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      Alert.alert('Hatalı e-posta', 'Geçerli bir e-posta gir.')
      return
    }
    if (davetliler.includes(e)) {
      setDavetliEmail('')
      return
    }
    setDavetliler((p) => [...p, e])
    setDavetliEmail('')
  }

  const davetliKaldir = (e) => {
    setDavetliler((p) => p.filter((x) => x !== e))
  }

  const olustur = async () => {
    if (!baslik.trim()) { Alert.alert('Eksik', 'Başlık gerekli.'); return }
    if (!baslangic || !bitis) { Alert.alert('Eksik', 'Başlangıç ve bitiş zamanı gerekli.'); return }
    if (new Date(bitis).getTime() <= new Date(baslangic).getTime()) {
      Alert.alert('Hatalı', 'Bitiş zamanı başlangıçtan sonra olmalı.')
      return
    }
    if (!secilenBaglantiId) {
      Alert.alert('Bağlantı yok', 'Aktif Google Takvim bağlantısı bulunamadı. Web tarafından bir hesap bağlayın.')
      return
    }

    setKaydediliyor(true)
    try {
      const sonuc = await etkinlikOlustur(secilenBaglantiId, {
        baslik: baslik.trim(),
        aciklama: aciklama.trim() || null,
        lokasyon: lokasyon.trim() || null,
        baslangic,
        bitis,
        davetliler,
        meetEkle,
      })
      onBasarili?.(sonuc)
      Alert.alert(
        'Etkinlik oluşturuldu',
        meetEkle && sonuc?.meetLinki
          ? `Google Meet linki:\n${sonuc.meetLinki}\n\nDavetlilere e-posta gönderildi.`
          : 'Etkinlik Google Takvim\'e eklendi.',
      )
    } catch (e) {
      Alert.alert('Hata', e?.message ?? 'Etkinlik oluşturulamadı.')
    } finally {
      setKaydediliyor(false)
    }
  }

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ maxHeight: '92%' }}
        >
          <View style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            paddingTop: 12, paddingBottom: 24,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
                Yeni Etkinlik {meetEkle ? '+ Meet' : ''}
              </Text>
              <TouchableOpacity onPress={onKapat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* Başlık */}
              <Text style={[styles.label, { color: colors.textMuted }]}>BAŞLIK</Text>
              <TextInput
                value={baslik}
                onChangeText={setBaslik}
                placeholder="Toplantı başlığı"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
              />

              {/* Bağlantı seç (birden fazla varsa) */}
              {baglantilar && baglantilar.length > 1 && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>HESAP</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {baglantilar.map((b) => {
                      const aktif = secilenBaglantiId === b.id
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => setSecilenBaglantiId(b.id)}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                            backgroundColor: aktif ? colors.primary + '25' : colors.surface,
                            borderWidth: 1, borderColor: aktif ? colors.primary : colors.border,
                          }}
                        >
                          <Text style={{ color: aktif ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {b.hesap_email}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}

              {/* Başlangıç */}
              <Text style={[styles.label, { color: colors.textMuted }]}>BAŞLANGIÇ</Text>
              <TarihSaatSec value={baslangic} onChange={setBaslangic} placeholder="Başlangıç zamanı" />

              {/* Bitiş */}
              <Text style={[styles.label, { color: colors.textMuted }]}>BİTİŞ</Text>
              <TarihSaatSec value={bitis} onChange={setBitis} placeholder="Bitiş zamanı" />

              {/* Açıklama */}
              <Text style={[styles.label, { color: colors.textMuted }]}>AÇIKLAMA (opsiyonel)</Text>
              <TextInput
                value={aciklama}
                onChangeText={setAciklama}
                placeholder="Toplantı gündemi, notlar…"
                placeholderTextColor={colors.textFaded}
                multiline
                style={[styles.input, { height: 80, backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border, textAlignVertical: 'top' }]}
              />

              {/* Lokasyon */}
              <Text style={[styles.label, { color: colors.textMuted }]}>LOKASYON (opsiyonel)</Text>
              <TextInput
                value={lokasyon}
                onChangeText={setLokasyon}
                placeholder="Adres veya 'Online'"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
              />

              {/* Davetliler */}
              <Text style={[styles.label, { color: colors.textMuted }]}>
                DAVETLİLER ({davetliler.length})
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  value={davetliEmail}
                  onChangeText={setDavetliEmail}
                  onSubmitEditing={davetliEkle}
                  placeholder="ornek@firma.com"
                  placeholderTextColor={colors.textFaded}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                />
                <TouchableOpacity
                  onPress={davetliEkle}
                  style={{
                    paddingHorizontal: 14, justifyContent: 'center',
                    backgroundColor: colors.primary, borderRadius: 10,
                  }}
                >
                  <Feather name="plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              {davetliler.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {davetliler.map((e) => (
                    <View key={e} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 10, paddingVertical: 6,
                      backgroundColor: colors.primary + '15',
                      borderRadius: 14,
                    }}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{e}</Text>
                      <TouchableOpacity onPress={() => davetliKaldir(e)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Feather name="x" size={12} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Meet ekle switch */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 16, padding: 12, borderRadius: 10,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Feather name="video" size={18} color="#1a73e8" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Google Meet ekle</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                      Otomatik video toplantı linki üretilir
                    </Text>
                  </View>
                </View>
                <Switch
                  value={meetEkle}
                  onValueChange={setMeetEkle}
                  trackColor={{ false: colors.border, true: '#1a73e8' }}
                />
              </View>

              {/* Oluştur butonu */}
              <TouchableOpacity
                onPress={olustur}
                disabled={kaydediliyor}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 20,
                  backgroundColor: kaydediliyor ? colors.textMuted : '#1a73e8',
                  paddingVertical: 14, borderRadius: 12,
                  opacity: kaydediliyor ? 0.6 : 1,
                }}
              >
                <Feather name={meetEkle ? 'video' : 'calendar'} size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {kaydediliyor ? 'Oluşturuluyor…' : (meetEkle ? 'Etkinlik + Meet Oluştur' : 'Etkinlik Oluştur')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 14 },
})
