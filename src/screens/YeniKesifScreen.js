// Yeni Keşif (mobile) — sahada hızlı keşif açma formu.
// Detaylı alanlar (yetkili, harita, türler, malzeme, foto) KesifDetay'da.

import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { kesifEkle, KESIF_ONCELIKLERI } from '../services/kesifService'
import { musterileriGetir } from '../services/musteriService'

export default function YeniKesifScreen({ navigation }) {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()

  // Müşteri DB listesinden seçilir (yazdıkça süzülen arama)
  const [musteriler, setMusteriler] = useState([])
  const [musteriArama, setMusteriArama] = useState('')
  const [seciliMusteri, setSeciliMusteri] = useState(null) // { id, ad }
  const [kesifBasligi, setKesifBasligi] = useState('')
  const [lokasyon, setLokasyon] = useState('')
  const [oncelik, setOncelik] = useState('normal')
  const [genelNot, setGenelNot] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    musterileriGetir().then(setMusteriler).catch(() => {})
  }, [])

  const musteriAdiYap = (m) => m.firma || `${m.ad || ''} ${m.soyad || ''}`.trim() || '—'
  const aramaQ = musteriArama.trim().toLocaleLowerCase('tr')
  const musteriOnerileri = aramaQ.length >= 2
    ? musteriler.filter(m => musteriAdiYap(m).toLocaleLowerCase('tr').includes(aramaQ)).slice(0, 8)
    : []

  const inputStil = {
    height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    color: colors.textPrimary, fontSize: 15,
  }
  const labelStil = { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 }

  const kaydet = async () => {
    if (!seciliMusteri) { Alert.alert('Eksik Bilgi', 'Müşteri seçin.'); return }
    setKaydediliyor(true)
    const yeni = await kesifEkle({
      musteriId: Number(seciliMusteri.id),
      firmaAdi: seciliMusteri.ad,
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
          <Text style={labelStil}>Müşteri *</Text>
          {seciliMusteri ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
              borderColor: colors.primary, backgroundColor: colors.surface,
            }}>
              <Feather name="briefcase" size={16} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                {seciliMusteri.ad}
              </Text>
              <TouchableOpacity onPress={() => { setSeciliMusteri(null); setMusteriArama('') }} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                value={musteriArama}
                onChangeText={setMusteriArama}
                placeholder="Müşteri ara… (en az 2 harf)"
                placeholderTextColor={colors.textMuted}
                style={inputStil}
              />
              {musteriOnerileri.length > 0 && (
                <View style={{
                  marginTop: 4, borderRadius: 10, borderWidth: 1,
                  borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden',
                }}>
                  {musteriOnerileri.map((m, i) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => {
                        setSeciliMusteri({ id: m.id, ad: musteriAdiYap(m) })
                        setMusteriArama('')
                      }}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 12,
                        borderBottomWidth: i < musteriOnerileri.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
                        {musteriAdiYap(m)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {aramaQ.length >= 2 && musteriOnerileri.length === 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                  Eşleşen müşteri bulunamadı.
                </Text>
              )}
            </>
          )}

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
