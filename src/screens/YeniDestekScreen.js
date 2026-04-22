import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { destekTalepEkle } from '../services/destekService'
import { servisEkiYukle } from '../services/servisEkService'

export default function YeniDestekScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const [mesaj, setMesaj] = useState('')
  const [fotoUri, setFotoUri] = useState(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const fotoEkle = async (kaynak) => {
    const izin = kaynak === 'kamera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!izin.granted) {
      Alert.alert('İzin Gerekli', `${kaynak === 'kamera' ? 'Kameraya' : 'Galeriye'} erişim izni ver.`)
      return
    }
    const sonuc = kaynak === 'kamera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        })
    if (!sonuc.canceled) setFotoUri(sonuc.assets[0].uri)
  }

  const gonder = async () => {
    if (!mesaj.trim()) {
      Alert.alert('Eksik', 'Mesaj yaz.')
      return
    }
    setKaydediliyor(true)
    let fotoUrl = null
    if (fotoUri) {
      const res = await servisEkiYukle(`destek-${kullanici?.id ?? 'anon'}`, fotoUri)
      if (res.ok) fotoUrl = res.url
    }
    const yeni = await destekTalepEkle({
      kullaniciId: kullanici?.id ?? null,
      kullaniciAd: kullanici?.ad ?? null,
      mesaj: mesaj.trim(),
      fotoUrl,
      durum: 'acik',
    })
    setKaydediliyor(false)
    if (!yeni) {
      Alert.alert('Hata', 'Talep gönderilemedi.')
      return
    }
    Alert.alert('Gönderildi', 'Destek talebin alındı. En kısa sürede dönüş yapılacak.', [
      { text: 'Tamam', onPress: () => navigation.goBack() },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={[styles.bilgi, { color: colors.textMuted }]}>
          Uygulamada yaşadığın sorunu ya da önerini detaylıca anlat. Gerekirse ekran görüntüsü ekle.
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Mesaj *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, minHeight: 160, textAlignVertical: 'top' }]}
          value={mesaj}
          onChangeText={setMesaj}
          multiline
          placeholder="Ne oldu? Hangi ekranda? Hata mesajı varsa yaz..."
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Ekran Görüntüsü (opsiyonel)</Text>
        <View style={styles.fotoBtnRow}>
          <TouchableOpacity style={styles.fotoBtn} onPress={() => fotoEkle('kamera')}>
            <Feather name="camera" size={16} color="#60a5fa" />
            <Text style={styles.fotoBtnText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fotoBtn} onPress={() => fotoEkle('galeri')}>
            <Feather name="image" size={16} color="#60a5fa" />
            <Text style={styles.fotoBtnText}>Galeri</Text>
          </TouchableOpacity>
        </View>

        {!!fotoUri && (
          <View style={styles.fotoPreview}>
            <Image source={{ uri: fotoUri }} style={styles.fotoThumb} />
            <TouchableOpacity style={styles.fotoSilBtn} onPress={() => setFotoUri(null)}>
              <Feather name="x" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.gonderBtn, (kaydediliyor || !mesaj.trim()) && { opacity: 0.5 }]}
          onPress={gonder}
          disabled={kaydediliyor || !mesaj.trim()}
        >
          {kaydediliyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.gonderText}>Gönder</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  bilgi: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  fotoBtnRow: { flexDirection: 'row', gap: 8 },
  fotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  fotoBtnText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  fotoPreview: {
    marginTop: 10,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  fotoThumb: { width: 120, height: 120, borderRadius: 10 },
  fotoSilBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gonderBtn: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  gonderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
