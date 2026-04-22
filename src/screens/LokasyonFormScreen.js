import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import * as Location from 'expo-location'
import { useHeaderHeight } from '@react-navigation/elements'
import {
  musteriLokasyonEkle,
  musteriLokasyonGuncelle,
  musteriLokasyonGetir,
  musteriLokasyonSil,
} from '../services/musteriLokasyonService'
import { useTheme } from '../context/ThemeContext'

export default function LokasyonFormScreen({ route, navigation }) {
  const { musteriId, lokasyonId } = route.params ?? {}
  const editMode = !!lokasyonId
  const headerHeight = useHeaderHeight()
  const { colors } = useTheme()

  const [ad, setAd] = useState('')
  const [adres, setAdres] = useState('')
  const [enlem, setEnlem] = useState('')
  const [boylam, setBoylam] = useState('')
  const [notlar, setNotlar] = useState('')
  const [aktif, setAktif] = useState(true)
  const [yukleniyor, setYukleniyor] = useState(editMode)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [konumAliniyor, setKonumAliniyor] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: editMode ? 'Lokasyonu Düzenle' : 'Yeni Lokasyon' })
  }, [navigation, editMode])

  useEffect(() => {
    if (!editMode) return
    ;(async () => {
      const l = await musteriLokasyonGetir(lokasyonId)
      if (l) {
        setAd(l.ad ?? '')
        setAdres(l.adres ?? '')
        setEnlem(l.enlem != null ? String(l.enlem) : '')
        setBoylam(l.boylam != null ? String(l.boylam) : '')
        setNotlar(l.notlar ?? '')
        setAktif(l.aktif ?? true)
      }
      setYukleniyor(false)
    })()
  }, [editMode, lokasyonId])

  const konumuAl = async () => {
    setKonumAliniyor(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('İzin gerekli', 'Konum erişimi reddedildi.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setEnlem(loc.coords.latitude.toFixed(6))
      setBoylam(loc.coords.longitude.toFixed(6))
      Alert.alert('Konum alındı', 'Şu anki konum doğruluk: ' + Math.round(loc.coords.accuracy) + 'm')
    } catch (e) {
      Alert.alert('Hata', 'Konum alınamadı: ' + e.message)
    } finally {
      setKonumAliniyor(false)
    }
  }

  const kaydet = async () => {
    if (!ad.trim()) {
      Alert.alert('Eksik', 'Lokasyon adı gerekli.')
      return
    }
    setKaydediliyor(true)

    const veri = {
      ad: ad.trim(),
      adres: adres.trim() || null,
      enlem: enlem ? parseFloat(enlem) : null,
      boylam: boylam ? parseFloat(boylam) : null,
      notlar: notlar.trim() || null,
      aktif,
    }

    let sonuc
    if (editMode) {
      sonuc = await musteriLokasyonGuncelle(lokasyonId, veri)
    } else {
      sonuc = await musteriLokasyonEkle({ ...veri, musteriId })
    }

    setKaydediliyor(false)

    if (!sonuc) {
      Alert.alert('Hata', 'Lokasyon kaydedilemedi.')
      return
    }
    navigation.goBack()
  }

  const sil = () => {
    Alert.alert('Lokasyonu sil', 'Emin misin? Bu lokasyondaki cihaz kayıtları "konumsuz" hale geçer.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await musteriLokasyonSil(lokasyonId)
          navigation.goBack()
        },
      },
    ])
  }

  if (yukleniyor) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text style={[styles.label, { color: colors.textMuted }]}>Lokasyon Adı *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={ad}
          onChangeText={setAd}
          placeholder="Otopark Doğu, Sistem Odası, Lobi..."
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Adres</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={adres}
          onChangeText={setAdres}
          multiline
          placeholder="Atatürk Cad. No:12, Kat 3..."
          placeholderTextColor={colors.textFaded}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>GPS Koordinatları</Text>
        <View style={styles.row2}>
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={enlem}
            onChangeText={setEnlem}
            placeholder="Enlem"
            placeholderTextColor={colors.textFaded}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={boylam}
            onChangeText={setBoylam}
            placeholder="Boylam"
            placeholderTextColor={colors.textFaded}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity
          style={[styles.gpsBtn, { backgroundColor: colors.surface }, konumAliniyor && { opacity: 0.6 }]}
          onPress={konumuAl}
          disabled={konumAliniyor}
        >
          <Text style={styles.gpsText}>
            {konumAliniyor ? 'Konum alınıyor...' : '📍 Şu anki konumumu al'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.textMuted }]}>Notlar</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={notlar}
          onChangeText={setNotlar}
          multiline
          placeholder="Erişim notları, kontak kişi, anahtarlar vs."
          placeholderTextColor={colors.textFaded}
        />

        <View style={[styles.switchRow, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Aktif</Text>
            <Text style={[styles.switchHint, { color: colors.textFaded }]}>Pasif lokasyonlar listede gri görünür</Text>
          </View>
          <Switch
            value={aktif}
            onValueChange={setAktif}
            trackColor={{ false: '#334155', true: '#2563eb' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : editMode ? 'Değişiklikleri Kaydet' : 'Lokasyonu Ekle'}
          </Text>
        </TouchableOpacity>

        {editMode && (
          <TouchableOpacity style={styles.silBtn} onPress={sil}>
            <Text style={styles.silText}>Lokasyonu Sil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  row2: { flexDirection: 'row', gap: 8 },

  gpsBtn: {
    marginTop: 8,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  gpsText: { color: '#3b82f6', fontWeight: '600' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  switchTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  switchHint: { color: '#64748b', fontSize: 12, marginTop: 2 },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  silBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },
})
