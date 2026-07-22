import { useEffect, useLayoutEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { kullanicilariGetir } from '../services/kullaniciService'
import { musterileriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { gorevEkle, gorevGuncelle } from '../services/gorevService'
import { ekYukle } from '../services/ekYukleService'
import { talepOlusturGorevden } from '../services/servisService'
import { bildirimEkleDb } from '../services/bildirimService'
import { smsGonder } from '../services/smsService'
import { trIcerir } from '../utils/trSearch'
import LokasyonPicker from '../components/LokasyonPicker'
import SecimPicker from '../components/SecimPicker'
import TarihSaatSec from '../components/TarihSaatSec'
import { supabase } from '../lib/supabase'

const ONCELIKLER = [
  { id: 'dusuk', label: 'Düşük' },
  { id: 'normal', label: 'Normal' },
  { id: 'yuksek', label: 'Yüksek' },
]

export default function YeniGorevScreen({ navigation, route }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const baslangic = route?.params || {}
  const duzenle = baslangic.duzenlenecekGorev || null   // varsa edit mode
  const [baslik, setBaslik] = useState(duzenle?.baslik || baslangic.baslangicBaslik || '')
  const [aciklama, setAciklama] = useState(duzenle?.aciklama || baslangic.baslangicAciklama || '')
  const [oncelik, setOncelik] = useState(duzenle?.oncelik || 'normal')
  // Görev ekleri (mig 184 — yalnız YENİ görevde; web'de detayda görünür)
  const [ekler, setEkler] = useState([]) // { uri, name, mimeType, size }

  const ekSec = () => {
    Alert.alert('Ek Ekle', 'Kaynak seç', [
      {
        text: 'Kamera',
        onPress: async () => {
          const izin = await ImagePicker.requestCameraPermissionsAsync()
          if (!izin.granted) { Alert.alert('İzin Gerekli', 'Kamera izni verin.'); return }
          const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
          if (!s.canceled) setEkler(p => [...p, { uri: s.assets[0].uri, name: s.assets[0].fileName || null, mimeType: s.assets[0].mimeType || 'image/jpeg', size: s.assets[0].fileSize ?? null }])
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (!izin.granted) { Alert.alert('İzin Gerekli', 'Galeri izni verin.'); return }
          const s = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7, allowsMultipleSelection: true, selectionLimit: 5,
          })
          if (!s.canceled) setEkler(p => [...p, ...s.assets.map(a => ({ uri: a.uri, name: a.fileName || null, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize ?? null }))])
        },
      },
      {
        text: 'Belge (PDF/Excel...)',
        onPress: async () => {
          const s = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
          if (s.canceled) return
          setEkler(p => [...p, ...(s.assets || []).map(a => ({ uri: a.uri, name: a.name || null, mimeType: a.mimeType || null, size: a.size ?? null }))])
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ])
  }
  // Yeni: saatli ISO datetime (YYYY-MM-DDTHH:mm). Web ile uyumlu (bitis_tarih / baslama_tarih kolonları).
  const [baslamaTarih, setBaslamaTarih] = useState(duzenle?.baslamaTarih || null)
  const [bitisTarih, setBitisTarih] = useState(
    duzenle?.bitisTarih || (duzenle?.bitisTarihi ? `${duzenle.bitisTarihi}T23:59` : null)
  )

  const [atanan, setAtanan] = useState(null)
  const [kullanicilar, setKullanicilar] = useState([])
  const [kullaniciPickerOpen, setKullaniciPickerOpen] = useState(false)
  // Ekip = ek atananlar (birincil hariç)
  const [ekip, setEkip] = useState(() => Array.isArray(duzenle?.ekip) ? duzenle.ekip.map(Number) : [])
  const [ekipPickerOpen, setEkipPickerOpen] = useState(false)

  const [musteri, setMusteri] = useState(null)
  const [musteriler, setMusteriler] = useState([])
  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')

  const [musteriLokasyonlari, setMusteriLokasyonlari] = useState([])
  const [lokasyonSecili, setLokasyonSecili] = useState(null)

  // Bağlı görüşme (web Görevler formuyla aynı) — müşteriye göre filtreli
  const [gorusmeler, setGorusmeler] = useState([])
  const [gorusmeSecili, setGorusmeSecili] = useState(
    duzenle?.gorusmeId ? String(duzenle.gorusmeId)
      : (baslangic?.baslangicGorusmeId ? String(baslangic.baslangicGorusmeId) : null)
  )
  const [servisTalebiOlustur, setServisTalebiOlustur] = useState(false)

  const [kaydediliyor, setKaydediliyor] = useState(false)

  useLayoutEffect(() => {
    if (duzenle) navigation.setOptions({ title: 'Görevi Düzenle' })
  }, [navigation, duzenle])

  useEffect(() => {
    kullanicilariGetir().then((list) => {
      const kl = list ?? []
      setKullanicilar(kl)
      // Edit modda atananı ön-seç
      if (duzenle?.atananId) {
        const u = kl.find((x) => String(x.id) === String(duzenle.atananId))
        if (u) setAtanan(u)
      }
    })
    musterileriGetir().then((list) => {
      const liste = list ?? []
      setMusteriler(liste)
      // Görüşmeden gelinmişse veya edit modunda müşteriyi ön-seç
      const musteriId = duzenle?.musteriId || baslangic.baslangicMusteriId
      if (musteriId) {
        const m = liste.find((x) => String(x.id) === String(musteriId))
        if (m) setMusteri(m)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Müşteri değişince o müşterinin görüşmelerini yükle (bağlı görüşme seçici).
  // Seçili görüşme yeni müşteride yoksa temizlenir; varsa korunur (düzenleme/ön-seçim).
  useEffect(() => {
    if (!musteri?.id) { setGorusmeler([]); setGorusmeSecili(null); return }
    let iptal = false
    supabase.from('gorusmeler')
      .select('id, akt_no, konu, tarih')
      .eq('musteri_id', musteri.id)
      .order('tarih', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (iptal) return
        const liste = data ?? []
        setGorusmeler(liste)
        setGorusmeSecili((onceki) =>
          onceki && liste.some((g) => String(g.id) === String(onceki)) ? onceki : null)
      })
    return () => { iptal = true }
  }, [musteri?.id])

  // Müşteri değişince lokasyonları yükle
  useEffect(() => {
    if (musteri?.id) {
      musteriLokasyonlariniGetir(musteri.id)
        .then((l) => {
          const liste = l ?? []
          setMusteriLokasyonlari(liste)
          // Görüşmeden gelen lokasyonu ön-seç (sadece ilk yükte)
          if (baslangic.baslangicLokasyonId) {
            const lok = liste.find((x) => String(x.id) === String(baslangic.baslangicLokasyonId))
            if (lok) setLokasyonSecili(lok)
          }
        })
        .catch(() => setMusteriLokasyonlari([]))
    } else {
      setMusteriLokasyonlari([])
      setLokasyonSecili(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musteri?.id])

  const filtrelenmisMusteriler = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    return musteriler.filter((m) =>
      trIcerir([m.firma, m.ad, m.soyad, m.telefon, m.kod], musteriArama)
    )
  }, [musteriler, musteriArama])

  const kaydet = async () => {
    if (!baslik.trim()) {
      Alert.alert('Eksik', 'Başlık gerekli.')
      return
    }
    if (!atanan) {
      Alert.alert('Eksik', 'Bir kullanıcıya atayın.')
      return
    }
    if (!bitisTarih) {
      Alert.alert('Eksik', 'Bitiş tarihi gerekli.')
      return
    }

    setKaydediliyor(true)

    // Legacy YYYY-MM-DD (mobile'ın eski bitis_tarihi date kolonu için)
    const bitisTarihiLegacy = bitisTarih ? bitisTarih.slice(0, 10) : null

    // Ekip = birincil hariç unique id'ler
    const ekipIds = Array.from(new Set((ekip || []).map(Number).filter(x => x && String(x) !== String(atanan.id))))

    const payload = {
      baslik: baslik.trim(),
      aciklama: aciklama.trim() || null,
      oncelik,
      atananId: atanan.id,
      atananAd: atanan.ad,
      ekip: ekipIds,                  // yeni: çoklu atama
      bitisTarih,                    // yeni timestamptz (web ile uyumlu)
      bitisTarihi: bitisTarihiLegacy, // legacy date kolonu (geriye uyum)
      baslamaTarih: baslamaTarih || null,
      musteriId: musteri?.id ?? null,
      firmaAdi: musteri ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim()) : null,
      lokasyonId: lokasyonSecili?.id ?? null,
      // Bağlı görüşme — hem yeni görevde hem düzenlemede kaydedilir
      gorusmeId: gorusmeSecili ? Number(gorusmeSecili) : null,
    }

    // Edit modu — güncelle ve geri dön
    if (duzenle?.id) {
      const guncel = await gorevGuncelle(duzenle.id, payload)
      setKaydediliyor(false)
      if (!guncel) {
        Alert.alert('Hata', 'Görev güncellenemedi.')
        return
      }
      navigation.goBack()
      return
    }

    // Yeni görev — önce ekleri yükle (mig 184, web ile aynı {url,name,type,size})
    let dosyalar = []
    for (const ek of ekler) {
      try { dosyalar.push(await ekYukle('gorev-dosyalar', ek)) }
      catch (e) {
        setKaydediliyor(false)
        Alert.alert('Ek Yüklenemedi', e?.message ?? 'Dosya yüklenemedi.')
        return
      }
    }
    const yeni = await gorevEkle({
      ...payload,
      dosyalar,
      durum: 'bekliyor',
      olusturanAd: kullanici?.ad ?? '',
    })

    if (!yeni) {
      setKaydediliyor(false)
      Alert.alert('Hata', 'Görev oluşturulamadı.')
      return
    }

    // Atanan kullanıcıya bildirim — kendi atadıysak gönderme
    const oncelikAd = ONCELIKLER.find((o) => o.id === oncelik)?.label ?? oncelik
    if (atanan?.id && String(atanan.id) !== String(kullanici?.id)) {
      bildirimEkleDb({
        aliciId: atanan.id,
        gonderenId: kullanici?.id,
        baslik: 'Yeni Görev Atandı',
        mesaj: `"${baslik.trim()}" görevi size atandı. Öncelik: ${oncelikAd}`,
        tip: 'gorev',
        link: `/gorevler/${yeni.id}`,
      }).catch((e) => console.warn('[bildirim] yeni görev:', e?.message))
    }
    // SMS — atanan kişinin cep telefonuna kurumsal bildirim (kendine de gönderiyoruz istenirse)
    const trAsciify = (s) => (s || '')
      .replace(/İ/g, 'I').replace(/ı/g, 'i')
      .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
      .replace(/Ş/g, 'S').replace(/ş/g, 's')
      .replace(/Ç/g, 'C').replace(/ç/g, 'c')
      .replace(/Ö/g, 'O').replace(/ö/g, 'o')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    const baslikSMS = trAsciify(baslik.trim()).slice(0, 60)
    const tarihStr = bitisTarih ? new Date(bitisTarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : ''
    const oncStr = oncelik && oncelik !== 'normal' ? ` [${trAsciify(oncelikAd).toUpperCase()}]` : ''
    if (atanan?.cepTelefon) {
      const mesajSMS = `ZNA CRM: Size yeni gorev atandi${oncStr}.\n"${baslikSMS}"\nSon tarih: ${tarihStr}\ntalep.znateknoloji.com`
      smsGonder(atanan.cepTelefon, mesajSMS).catch((e) => console.warn('[sms] yeni görev:', e?.message))
    }

    // Ekip üyelerine bildirim + SMS
    for (const uid of ekipIds) {
      const uye = kullanicilar.find((x) => String(x.id) === String(uid))
      if (!uye) continue
      // Bildirim (kendine gönderme)
      if (String(uye.id) !== String(kullanici?.id)) {
        bildirimEkleDb({
          aliciId: uye.id,
          gonderenId: kullanici?.id,
          baslik: 'Görev Ekibine Eklendiniz',
          mesaj: `"${baslik.trim()}" görevine ekip üyesi olarak eklendiniz. Öncelik: ${oncelikAd}`,
          tip: 'gorev',
          link: `/gorevler/${yeni.id}`,
        }).catch((e) => console.warn('[bildirim] ekip:', e?.message))
      }
      if (uye.cepTelefon) {
        const mesajSMS = `ZNA CRM: Ekip gorevi${oncStr}.\n"${baslikSMS}"\nSon tarih: ${tarihStr}\ntalep.znateknoloji.com`
        smsGonder(uye.cepTelefon, mesajSMS).catch((e) => console.warn('[sms] ekip:', e?.message))
      }
    }

    // Servis talebi de istendiyse oluştur ve oraya yönlendir
    if (servisTalebiOlustur && musteri?.id) {
      try {
        const servisTalebi = await talepOlusturGorevden(yeni, kullanici)
        setKaydediliyor(false)
        if (servisTalebi) {
          navigation.replace('ServisTalebiDetay', { id: servisTalebi.id })
          return
        }
        Alert.alert('Bilgi', 'Görev oluşturuldu fakat servis talebi oluşturulamadı.')
      } catch (err) {
        setKaydediliyor(false)
        console.error('[talepOlusturGorevden]', err)
        Alert.alert('Hata', 'Servis talebi oluşturulamadı: ' + (err?.message || 'bilinmeyen'))
      }
    } else {
      setKaydediliyor(false)
    }
    navigation.goBack()
  }

  const inputStyle = [styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]

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
        <Text style={[styles.label, { color: colors.textMuted }]}>Başlık *</Text>
        <TextInput
          style={inputStyle}
          placeholder="Görev başlığı"
          placeholderTextColor={colors.textFaded}
          value={baslik}
          onChangeText={setBaslik}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Açıklama</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, height: 100, textAlignVertical: 'top' }]}
          placeholder="Detaylar..."
          placeholderTextColor={colors.textFaded}
          multiline
          value={aciklama}
          onChangeText={setAciklama}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Atanacak Kullanıcı (birincil) *</Text>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: colors.surface }]}
          onPress={() => setKullaniciPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: atanan ? colors.textPrimary : colors.textFaded }}>
            {atanan ? atanan.ad : 'Kullanıcı seç...'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.textMuted }]}>Ekip (ek kişiler, opsiyonel)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          {ekip.map((uid) => {
            const uye = kullanicilar.find((x) => String(x.id) === String(uid))
            if (!uye) return null
            return (
              <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primary }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{uye.ad}</Text>
                <TouchableOpacity onPress={() => setEkip((prev) => prev.filter((x) => String(x) !== String(uid)))}>
                  <Text style={{ color: '#fff', fontSize: 16, lineHeight: 16 }}>×</Text>
                </TouchableOpacity>
              </View>
            )
          })}
          <TouchableOpacity
            onPress={() => setEkipPickerOpen(true)}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>+ Ekle</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.textFaded, fontSize: 11, marginBottom: 8 }}>
          Ekip üyeleri de bildirim ve SMS alır. Skor birincil atanana yazılır.
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>Bağlı Müşteri (opsiyonel)</Text>
        <View style={styles.musteriRow}>
          <TouchableOpacity
            style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
            onPress={() => setMusteriPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: musteri ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
              {musteri
                ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim())
                : 'Müşteri seç...'}
            </Text>
          </TouchableOpacity>
          {!!musteri && (
            <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setMusteri(null)}>
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lokasyon — sadece müşteri seçildiyse */}
        {musteri?.id && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>Lokasyon</Text>
            <LokasyonPicker
              musteriId={musteri.id}
              lokasyonlar={musteriLokasyonlari}
              onLokasyonlarChange={setMusteriLokasyonlari}
              secili={lokasyonSecili}
              onSeciliChange={setLokasyonSecili}
            />
          </>
        )}

        {/* Bağlı görüşme — sadece müşteri seçildiyse (web Görevler formuyla aynı) */}
        {musteri?.id && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>Bağlı Görüşme (opsiyonel)</Text>
            {gorusmeler.length > 0 ? (
              <SecimPicker
                deger={gorusmeSecili}
                onSec={(v) => setGorusmeSecili(v || null)}
                secenekler={gorusmeler.map((g) => ({
                  id: String(g.id),
                  isim: `${g.akt_no || `G-${g.id}`} — ${g.konu || '—'}${g.tarih ? ` · ${g.tarih}` : ''}`,
                }))}
                placeholder="Görüşme seç…"
                ekstraSecenek={{ etiket: '✕ Bağlantıyı kaldır', deger: '' }}
              />
            ) : (
              <Text style={{ color: colors.textFaded, fontSize: 12, marginBottom: 8 }}>
                Bu müşteriye ait kayıtlı görüşme yok.
              </Text>
            )}
          </>
        )}

        {/* Servis talebi de oluştur toggle — sadece yeni görev + müşteri seçiliyse */}
        {!duzenle && musteri?.id && (
          <TouchableOpacity
            onPress={() => setServisTalebiOlustur((v) => !v)}
            activeOpacity={0.7}
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: servisTalebiOlustur ? colors.primary : colors.border,
              backgroundColor: servisTalebiOlustur ? `${colors.primary}15` : colors.surface,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6,
              borderWidth: 2, borderColor: servisTalebiOlustur ? colors.primary : colors.border,
              backgroundColor: servisTalebiOlustur ? colors.primary : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {servisTalebiOlustur && <Feather name="check" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                Aynı anda servis talebi de oluştur
              </Text>
              {servisTalebiOlustur && (
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Görev kaydedilince otomatik servis talebi oluşturulacak ve detay sayfası açılacak.
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>Öncelik</Text>
        <View style={styles.row}>
          {ONCELIKLER.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.borderStrong }, oncelik === o.id && styles.chipActive]}
              onPress={() => setOncelik(o.id)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, oncelik === o.id && { color: '#fff' }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TarihSaatSec
          value={baslamaTarih}
          onChange={(iso) => setBaslamaTarih(iso || null)}
          label="Başlama Tarihi"
          placeholder="Tarih ve saat seç (opsiyonel)"
        />

        <TarihSaatSec
          value={bitisTarih}
          onChange={(iso) => setBitisTarih(iso || null)}
          label="Bitiş Tarihi *"
          placeholder="Tarih ve saat seç"
        />

        {/* Ekler — yalnız YENİ görevde (mig 184); web görev detayında görünür */}
        {!duzenle?.id && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              Ekler (dosya / resim, opsiyonel)
            </Text>
            <TouchableOpacity
              onPress={ekSec}
              disabled={kaydediliyor}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 12, borderRadius: 10,
                borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
              activeOpacity={0.8}
            >
              <Feather name="paperclip" size={16} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                Fotoğraf veya Belge Ekle
              </Text>
            </TouchableOpacity>
            {ekler.length > 0 && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {ekler.map((ek, i) => {
                  const resimMi = (ek.mimeType || '').startsWith('image/')
                  return (
                    <View key={ek.uri + i} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
                      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
                    }}>
                      {resimMi
                        ? <Image source={{ uri: ek.uri }} style={{ width: 32, height: 32, borderRadius: 6 }} />
                        : <Feather name="file-text" size={16} color={colors.primary} />}
                      <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }} numberOfLines={1}>
                        {ek.name || 'fotoğraf'}{ek.size ? `  ·  ${Math.round(ek.size / 1024)} KB` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => setEkler(p => p.filter((_, j) => j !== i))} hitSlop={8}>
                        <Feather name="x" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : (duzenle?.id ? 'Değişiklikleri Kaydet' : 'Görevi Oluştur')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Kullanıcı seçici */}
      <Modal visible={kullaniciPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kullanıcı Seç</Text>
              <TouchableOpacity onPress={() => setKullaniciPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={kullanicilar}
              keyExtractor={(k) => String(k.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setAtanan(item)
                    setKullaniciPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{item.ad}</Text>
                  {!!item.rol && (
                    <Text style={{ color: colors.textFaded, fontSize: 12 }}>{item.rol}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Ekip seçici — birden fazla eklenebilir */}
      <Modal visible={ekipPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ekip Üyesi Ekle</Text>
              <TouchableOpacity onPress={() => setEkipPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={kullanicilar
                .filter((k) => String(k.id) !== String(atanan?.id))
                .filter((k) => !ekip.some((x) => String(x) === String(k.id)))}
              keyExtractor={(k) => String(k.id)}
              ListEmptyComponent={
                <Text style={{ color: colors.textFaded, textAlign: 'center', paddingVertical: 20 }}>
                  Eklenebilecek kullanıcı yok.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setEkip((prev) => [...prev, Number(item.id)])
                    setEkipPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{item.ad}</Text>
                  {!!item.rol && (
                    <Text style={{ color: colors.textFaded, fontSize: 12 }}>{item.rol}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Müşteri seçici (aramalı) */}
      <Modal visible={musteriPickerOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteri Seç</Text>
              <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <TextInput
                style={[styles.modalSearch, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                placeholder="Ara: firma, ad, telefon, kod..."
                placeholderTextColor={colors.textFaded}
                value={musteriArama}
                onChangeText={setMusteriArama}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filtrelenmisMusteriler}
              keyExtractor={(m) => String(m.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 24 }}>
                  Eşleşen müşteri yok.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setMusteri(item)
                    setMusteriPickerOpen(false)
                    setMusteriArama('')
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }} numberOfLines={1}>
                    {item.firma || `${item.ad} ${item.soyad}`}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.ad} {item.soyad}
                    {item.telefon ? ` · ${item.telefon}` : ''}
                    {item.kod ? ` · ${item.kod}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  musteriRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    backgroundColor: '#1e293b',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearText: { color: '#ef4444', fontSize: 22, fontWeight: '700' },

  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#cbd5e1', fontWeight: '600' },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSearch: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
})
