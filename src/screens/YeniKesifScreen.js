// Yeni Keşif (mobile) — sahada hızlı keşif açma formu.
// Detaylı alanlar (yetkili, harita, türler, malzeme, foto) KesifDetay'da.

import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { kesifEkle, KESIF_ONCELIKLERI } from '../services/kesifService'

export default function YeniKesifScreen({ navigation }) {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()

  const [firmaAdi, setFirmaAdi] = useState('')
  const [kesifBasligi, setKesifBasligi] = useState('')
  const [lokasyon, setLokasyon] = useState('')
  const [oncelik, setOncelik] = useState('normal')
  const [genelNot, setGenelNot] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const inputStil = {
    height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    color: colors.textPrimary, fontSize: 15,
  }
  const labelStil = { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 }

  const kaydet = async () => {
    if (!firmaAdi.trim()) { Alert.alert('Eksik Bilgi', 'Firma adı zorunlu.'); return }
    setKaydediliyor(true)
    const yeni = await kesifEkle({
      firmaAdi: firmaAdi.trim(),
      kesifBasligi: kesifBasligi.trim(),
      lokasyon: lokasyon.trim(),
      oncelik,
      genelNot: genelNot.trim() || null,
      kesifTarihi: new Date().toISOString().split('T')[0],
      kesfiYapan: kullanici?.ad || '',
      durum: 'acik',
      olusturanId: kullanici?.id ? Number(kullanici.id) : null,
      olusturanAd: kullanici?.ad || '',
    })
    setKaydediliyor(false)
    if (!yeni) { Alert.alert('Hata', 'Keşif oluşturulamadı, tekrar deneyin.'); return }
    navigation.replace('KesifDetay', { kesifId: yeni.id })
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
          <Text style={labelStil}>Firma Adı *</Text>
          <TextInput value={firmaAdi} onChangeText={setFirmaAdi} placeholder="Firma / saha adı"
            placeholderTextColor={colors.textMuted} style={inputStil} />

          <Text style={labelStil}>Keşif Başlığı</Text>
          <TextInput value={kesifBasligi} onChangeText={setKesifBasligi} placeholder="örn. Fabrika çevre kamera keşfi"
            placeholderTextColor={colors.textMuted} style={inputStil} />

          <Text style={labelStil}>Keşif Adresi</Text>
          <TextInput value={lokasyon} onChangeText={setLokasyon} placeholder="Saha adresi"
            placeholderTextColor={colors.textMuted} style={inputStil} />

          <Text style={labelStil}>Öncelik</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {KESIF_ONCELIKLERI.map(o => {
              const aktif = oncelik === o.id
              return (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => setOncelik(o.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                    backgroundColor: aktif ? o.renk : colors.surface,
                    borderWidth: 1, borderColor: aktif ? o.renk : colors.border,
                  }}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textMuted, fontWeight: '600', fontSize: 13 }}>{o.ad}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={labelStil}>Keşif Açıklaması</Text>
          <TextInput
            value={genelNot} onChangeText={setGenelNot}
            placeholder="Saha gözlemleri, müşteri talepleri…"
            placeholderTextColor={colors.textMuted}
            multiline numberOfLines={5} textAlignVertical="top"
            style={[inputStil, { height: 110, paddingTop: 10 }]}
          />

          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 12 }}>
            📷 Fotoğraf, malzeme listesi ve keşif türleri bir sonraki ekranda eklenir.
          </Text>

          <TouchableOpacity
            onPress={kaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
            style={{
              marginTop: 20, height: 50, borderRadius: 12,
              backgroundColor: colors.primary, opacity: kaydediliyor ? 0.7 : 1,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {kaydediliyor
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Keşfi Oluştur ve Devam Et</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
