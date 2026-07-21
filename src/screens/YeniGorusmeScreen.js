import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { gorusmeEkle, gorusmeDosyalariEkle } from '../services/gorusmeService'
import { kullanicilariGetir } from '../services/kullaniciService'
import { bildirimEkleDb } from '../services/bildirimService'
import { parseMentions } from '../lib/mention'
import MentionInput from '../components/MentionInput'
import { musterileriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { trIcerir } from '../utils/trSearch'
import LokasyonPicker from '../components/LokasyonPicker'
import SecimPicker from '../components/SecimPicker'

// Web ile aynı listeler
const VARSAYILAN_KONULAR = [
  'CCTV', 'NVR-ANALİZ', 'Network', 'Teklif', 'Keşif', 'Demo',
  'Fuar', 'Access Kontrol', 'Mobiltek', 'Donanım', 'Yazılım', 'Diğer',
]

const IRTIBAT_SEKILLERI = [
  'Telefon', 'WhatsApp', 'Mail', 'Yüz Yüze', 'Merkez',
  'Uzak Bağlantı', 'Bridge', 'Online Toplantı', 'Telegram', 'Diğer',
]

const DURUMLAR = [
  { id: 'acik', isim: 'Açık' },
  { id: 'beklemede', isim: 'Beklemede' },
  { id: 'kapali', isim: 'Kapalı' },
]

export default function YeniGorusmeScreen({ navigation, route }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const baslangicMusteri = route?.params?.musteri

  const [firmaAdi, setFirmaAdi] = useState(baslangicMusteri?.firma ?? '')
  const [musteriId, setMusteriId] = useState(baslangicMusteri?.id ?? null)
  const [muhatapAd, setMuhatapAd] = useState('')
  const [konu, setKonu] = useState('CCTV')
  const [manuelKonu, setManuelKonu] = useState('')
  const [manuelKonuAcik, setManuelKonuAcik] = useState(false)
  const [irtibatSekli, setIrtibatSekli] = useState('Telefon')
  const [notlar, setNotlar] = useState('')
  const [gorusmeSonucu, setGorusmeSonucu] = useState('')
  // @mention için personel listesi
  const [personeller, setPersoneller] = useState([])
  useEffect(() => {
    kullanicilariGetir()
      .then(l => setPersoneller((l || []).filter(k => k.tip !== 'musteri')))
      .catch(() => {})
  }, [])
  const [durum, setDurum] = useState('acik')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  // Eklenecek dosyalar (local, submit'te yüklenir): { uri, name, type, size }
  const [dosyalar, setDosyalar] = useState([])

  const fotoEkle = async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!izin.granted) { Alert.alert('İzin Gerekli', 'Fotoğraf eklemek için galeri izni verin.'); return }
    const s = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, allowsMultipleSelection: true, selectionLimit: 10,
    })
    if (s.canceled) return
    const yeni = (s.assets || []).map((a) => ({
      uri: a.uri,
      name: a.fileName || `foto_${Date.now()}.jpg`,
      type: a.mimeType || 'image/jpeg',
      size: a.fileSize ?? null,
    }))
    setDosyalar((p) => [...p, ...yeni])
  }

  const belgeEkle = async () => {
    const s = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (s.canceled) return
    const yeni = (s.assets || []).map((a) => ({
      uri: a.uri,
      name: a.name || `dosya_${Date.now()}`,
      type: a.mimeType || null,
      size: a.size ?? null,
    }))
    setDosyalar((p) => [...p, ...yeni])
  }

  const dosyaCikar = (idx) => setDosyalar((p) => p.filter((_, i) => i !== idx))

  // Müşteri autocomplete
  const [musteriler, setMusteriler] = useState([])
  const [oneriGoster, setOneriGoster] = useState(false)

  // Lokasyon
  const [musteriLokasyonlari, setMusteriLokasyonlari] = useState([])
  const [lokasyonSecili, setLokasyonSecili] = useState(null)

  useEffect(() => {
    musterileriGetir().then((veri) => setMusteriler(veri ?? []))
  }, [])

  // Müşteri ID değişince lokasyonları yükle
  useEffect(() => {
    if (musteriId) {
      musteriLokasyonlariniGetir(musteriId)
        .then((l) => setMusteriLokasyonlari(l ?? []))
        .catch(() => setMusteriLokasyonlari([]))
    } else {
      setMusteriLokasyonlari([])
    }
    setLokasyonSecili(null)
  }, [musteriId])

  const oneriler = useMemo(() => {
    if (!oneriGoster) return []
    const q = firmaAdi.trim()
    if (!q) return musteriler.slice(0, 20)
    return musteriler
      .filter((m) => trIcerir([m.firma, m.musteriAdi], firmaAdi))
      .slice(0, 20)
  }, [musteriler, firmaAdi, oneriGoster])

  const musteriSec = (m) => {
    setFirmaAdi(m.firma ?? '')
    setMusteriId(m.id)
    if (m.musteriAdi && !muhatapAd.trim()) setMuhatapAd(m.musteriAdi)
    setOneriGoster(false)
  }

  const kaydet = async () => {
    if (!firmaAdi.trim()) {
      Alert.alert('Eksik', 'Müşteri adı gerekli.')
      return
    }
    const sonKonu = manuelKonuAcik ? manuelKonu.trim() : konu
    if (!sonKonu) {
      Alert.alert('Eksik', 'Konu gerekli.')
      return
    }
    setKaydediliyor(true)
    const bugun = new Date()
    const tarihStr = bugun.toISOString().slice(0, 10)
    const saatStr = `${String(bugun.getHours()).padStart(2, '0')}:${String(bugun.getMinutes()).padStart(2, '0')}`

    const sonuc = await gorusmeEkle({
      firmaAdi: firmaAdi.trim(),
      musteriAdi: muhatapAd.trim() || null,
      konu: sonKonu,
      notlar: notlar.trim() || null,
      gorusmeSonucu: gorusmeSonucu.trim() || null,
      tip: irtibatSekli,
      durum,
      tarih: tarihStr,
      saat: saatStr,
      // "Görüşen" web listesinde gösterilen kolon — mobil bunu yazmadığı için
      // liste boş görünüyordu. Web formu gorusen=kullanici.ad set ediyor; eşitliyoruz.
      gorusen: kullanici?.ad ?? null,
      hazirlayan: kullanici?.ad ?? null,
      lokasyonId: lokasyonSecili?.id ?? null,
    })
    if (!sonuc) {
      setKaydediliyor(false)
      Alert.alert('Kaydedilemedi', 'Görüşme eklenemedi. Tekrar deneyin.')
      return
    }

    // Dosyalar — görüşme oluştuktan sonra storage'a yükle (web ile aynı bucket/kolon)
    let dosyaHatalari = []
    if (dosyalar.length) {
      const { hatalar } = await gorusmeDosyalariEkle(sonuc.id, dosyalar, kullanici?.ad ?? null)
      dosyaHatalari = hatalar
    }
    setKaydediliyor(false)

    // @mention edilenlere push bildirimi (kendini etiketleyen hariç)
    const mentionIdler = parseMentions(notlar, personeller).filter(mid => mid !== kullanici?.id)
    for (const mid of mentionIdler) {
      bildirimEkleDb({
        aliciId: mid,
        gonderenId: kullanici?.id,
        tip: 'bilgi',
        baslik: `💬 ${kullanici?.ad || 'Bir arkadaşın'} bir görüşme notunda seni etiketledi`,
        mesaj: `"${notlar.slice(0, 90)}" — ${firmaAdi.trim()}`,
        link: sonuc.id ? `/gorusmeler/${sonuc.id}` : '/gorusmeler',
      }).catch(() => {})
    }

    if (dosyaHatalari.length) {
      Alert.alert(
        'Kısmi yükleme',
        `Görüşme kaydedildi ancak bazı dosyalar yüklenemedi:\n${dosyaHatalari.join('\n')}`,
        [{ text: 'Tamam', onPress: () => navigation.goBack() }],
      )
      return
    }
    navigation.goBack()
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
          {/* Firma seç */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Müşteri Adı *</Text>
          <TextInput
            value={firmaAdi}
            onChangeText={(t) => { setFirmaAdi(t); setOneriGoster(true); setMusteriId(null) }}
            onFocus={() => setOneriGoster(true)}
            placeholder="Müşteri seçmek için dokun veya yaz"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          {oneriGoster && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {musteriler.length === 0 ? 'Yükleniyor…' : `${oneriler.length} müşteri`}
                </Text>
                <TouchableOpacity onPress={() => setOneriGoster(false)} activeOpacity={0.7}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Kapat</Text>
                </TouchableOpacity>
              </View>
              {oneriler.length === 0 && musteriler.length > 0 ? (
                <Text style={{ padding: 14, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                  Eşleşen müşteri yok. Yazılı olarak da kaydedebilirsin.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {oneriler.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => musteriSec(m)}
                      activeOpacity={0.7}
                      style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                        {m.firma || 'Firma yok'}
                      </Text>
                      {!!m.musteriAdi && (
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {m.musteriAdi}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Lokasyon — sadece müşteri seçildiyse */}
          {musteriId && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Lokasyon</Text>
              <LokasyonPicker
                musteriId={musteriId}
                lokasyonlar={musteriLokasyonlari}
                onLokasyonlarChange={setMusteriLokasyonlari}
                secili={lokasyonSecili}
                onSeciliChange={setLokasyonSecili}
              />
            </>
          )}

          {/* Muhatap */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Muhatap (yetkili)</Text>
          <TextInput
            value={muhatapAd}
            onChangeText={setMuhatapAd}
            placeholder="Konuştuğun kişi"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          {/* Konu */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Konu *</Text>
          <SecimPicker
            deger={manuelKonuAcik ? '__manuel__' : konu}
            onSec={(v) => {
              if (v === '__manuel__') { setManuelKonuAcik(true); return }
              setKonu(v); setManuelKonuAcik(false)
            }}
            secenekler={VARSAYILAN_KONULAR}
            placeholder="Konu seç"
            ekstraSecenek={{ etiket: 'Manuel yaz…', deger: '__manuel__', ikon: 'edit-2' }}
          />
          {manuelKonuAcik && (
            <TextInput
              value={manuelKonu}
              onChangeText={setManuelKonu}
              placeholder="Konu yaz…"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 8 }]}
            />
          )}

          {/* İrtibat */}
          <Text style={[styles.label, { color: colors.textMuted }]}>İrtibat Şekli</Text>
          <SecimPicker
            deger={irtibatSekli}
            onSec={setIrtibatSekli}
            secenekler={IRTIBAT_SEKILLERI}
            placeholder="İrtibat şekli seç"
          />

          {/* Durum */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Durum</Text>
          <View style={styles.chipRow}>
            {DURUMLAR.map((d) => {
              const aktif = durum === d.id
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setDurum(d.id)}
                  activeOpacity={0.85}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: aktif ? colors.primary : colors.surface }]}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textPrimary, fontSize: 11, fontWeight: '600' }}>{d.isim}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Görüşme Açıklaması — @ ile personel etiketlenebilir */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Görüşme Açıklaması</Text>
          <MentionInput
            value={notlar}
            onChangeText={setNotlar}
            kullanicilar={personeller}
            placeholder="Görüşme detayları… @ ile arkadaşını etiketle"
            inputProps={{ numberOfLines: 5, textAlignVertical: 'top' }}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 110 }]}
          />

          {/* Görüşme Sonucu — web ile aynı kolon (gorusme_sonucu, mig 187) */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Görüşme Sonucu</Text>
          <TextInput
            value={gorusmeSonucu}
            onChangeText={setGorusmeSonucu}
            placeholder="Görüşme neticesi — varılan karar, anlaşılan adımlar…"
            placeholderTextColor={colors.textFaded}
            multiline
            textAlignVertical="top"
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 70 }]}
          />

          {/* Dosyalar — web ile senkron (bucket: gorusme-dosyalari) */}
          <Text style={[styles.label, { color: colors.textMuted }]}>Dosyalar</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={fotoEkle}
              disabled={kaydediliyor}
              activeOpacity={0.8}
              style={[styles.dosyaBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Feather name="image" size={16} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Fotoğraf</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={belgeEkle}
              disabled={kaydediliyor}
              activeOpacity={0.8}
              style={[styles.dosyaBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Feather name="paperclip" size={16} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Belge / PDF</Text>
            </TouchableOpacity>
          </View>

          {dosyalar.length > 0 && (
            <View style={{ marginTop: 10, gap: 6 }}>
              {dosyalar.map((d, i) => (
                <View
                  key={`${d.uri}-${i}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                >
                  <Feather
                    name={(d.type || '').startsWith('image/') ? 'image' : 'file'}
                    size={15}
                    color={colors.textMuted}
                  />
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}>
                    {d.name}
                    {d.size ? `  ·  ${(d.size / 1024).toFixed(0)} KB` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => dosyaCikar(i)} hitSlop={8} disabled={kaydediliyor}>
                    <Feather name="x" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={kaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
            style={[styles.btn, { backgroundColor: colors.primary, opacity: kaydediliyor ? 0.6 : 1 }]}
          >
            {kaydediliyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.btnText}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dropdown: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dosyaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  btn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
