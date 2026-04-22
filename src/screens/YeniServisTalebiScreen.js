import { useEffect, useMemo, useState } from 'react'
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
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import TakvimPicker from '../components/TakvimPicker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { kullanicilariGetir } from '../services/kullaniciService'
import { musterileriGetir } from '../services/musteriService'
import { musteriKisileriniGetir } from '../services/musteriKisiService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { musteriCihazlariniGetir } from '../services/stokKalemiService'
import { servisTalepEkle, sonrakiTalepNo } from '../services/servisService'
import { malzemePlanEkle } from '../services/servisMalzemeService'
import { servisEkiYukle } from '../services/servisEkService'
import MalzemePlanModal from '../components/MalzemePlanModal'
import {
  ANA_TURLER,
  ALT_KATEGORILER,
  ACILIYET_SEVIYELERI,
  turPrefix,
} from '../utils/servisConstants'

export default function YeniServisTalebiScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()

  const [talepNo, setTalepNo] = useState('')
  const [musteri, setMusteri] = useState(null)
  const [kisi, setKisi] = useState(null)
  const [anaTur, setAnaTur] = useState('ariza')
  const [altKategori, setAltKategori] = useState(null)
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [lokasyon, setLokasyon] = useState('') // serbest metin (müşteri lokasyonu yoksa fallback)
  const [lokasyonSecili, setLokasyonSecili] = useState(null) // müşteri lokasyonu objesi
  const [cihazTuru, setCihazTuru] = useState('') // serbest metin fallback
  const [cihazSecili, setCihazSecili] = useState(null) // stok_kalemleri satırı
  const [musteriLokasyonlari, setMusteriLokasyonlari] = useState([])
  const [musteriCihazlari, setMusteriCihazlari] = useState([])
  const [lokasyonPickerOpen, setLokasyonPickerOpen] = useState(false)
  const [cihazPickerOpen, setCihazPickerOpen] = useState(false)
  const [malzemeGerekli, setMalzemeGerekli] = useState(false)
  const [malzemeler, setMalzemeler] = useState([]) // { stokKodu, stokAdi, birim, planliMiktar, notMetni, tip }
  const [malzemeModalOpen, setMalzemeModalOpen] = useState(false)
  const [duzenlenenMalzemeIdx, setDuzenlenenMalzemeIdx] = useState(null)
  const [ekler, setEkler] = useState([]) // local URI'ler (upload save'de yapılır)
  const [periyodikMi, setPeriyodikMi] = useState(false)
  const [periyodikAraligi, setPeriyodikAraligi] = useState('aylik')
  const [aciliyet, setAciliyet] = useState('normal')
  const [uygunZaman, setUygunZaman] = useState('')
  const [planliTarih, setPlanliTarih] = useState('')
  const [atanan, setAtanan] = useState(null)

  const [musteriler, setMusteriler] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])

  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')
  const [kisiPickerOpen, setKisiPickerOpen] = useState(false)
  const [kullaniciPickerOpen, setKullaniciPickerOpen] = useState(false)
  const [altKategoriPickerOpen, setAltKategoriPickerOpen] = useState(false)

  // Date/time picker kontrolleri
  const [tarihPickerOpen, setTarihPickerOpen] = useState(false)
  const [zamanPickerOpen, setZamanPickerOpen] = useState(false)

  const [kaydediliyor, setKaydediliyor] = useState(false)

  // YYYY-MM-DD string'i Date objesine çevir
  const tarihToDate = (s) => {
    if (!s) return new Date()
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  }
  // Date objesini YYYY-MM-DD string'ine çevir
  const dateToTarih = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const g = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${g}`
  }
  // "HH:MM" string'i Date objesine çevir (bugünün tarihi ile)
  const zamanToDate = (s) => {
    const d = new Date()
    if (s && /^\d{2}:\d{2}/.test(s)) {
      const [h, dk] = s.split(':').map(Number)
      d.setHours(h, dk, 0, 0)
    }
    return d
  }
  const dateToZaman = (d) => {
    const s = String(d.getHours()).padStart(2, '0')
    const dk = String(d.getMinutes()).padStart(2, '0')
    return `${s}:${dk}`
  }
  // Gösterim (Türkçe format)
  const tarihGoster = (s) => {
    if (!s) return ''
    const d = tarihToDate(s)
    const gunler = ['Pzr', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    return `${d.getDate()} ${aylar[d.getMonth()]} ${d.getFullYear()} (${gunler[d.getDay()]})`
  }

  useEffect(() => {
    musterileriGetir().then((l) => setMusteriler(l ?? []))
    kullanicilariGetir().then((l) => setKullanicilar(l ?? []))
  }, [])

  // Tür değiştikçe prefix'e göre sıradaki numarayı al
  useEffect(() => {
    sonrakiTalepNo(turPrefix(anaTur)).then(setTalepNo)
  }, [anaTur])

  // Müşteri seçilince o müşterinin ilgili kişilerini, lokasyonlarını ve cihazlarını yükle
  useEffect(() => {
    if (!musteri) {
      setKisiler([])
      setKisi(null)
      setMusteriLokasyonlari([])
      setLokasyonSecili(null)
      setMusteriCihazlari([])
      setCihazSecili(null)
      return
    }
    musteriKisileriniGetir(musteri.id).then((l) => {
      setKisiler(l ?? [])
      const ana = (l ?? []).find((k) => k.anaKisi)
      if (ana) setKisi(ana)
    })
    musteriLokasyonlariniGetir(musteri.id).then((l) => setMusteriLokasyonlari(l ?? []))
    musteriCihazlariniGetir(musteri.id).then((l) => setMusteriCihazlari(l ?? []))
  }, [musteri])

  // Tür değişince alt kategoriyi sıfırla
  useEffect(() => { setAltKategori(null) }, [anaTur])

  const filtrelenmisMusteriler = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    const q = musteriArama.toLowerCase()
    return musteriler.filter((m) =>
      [m.firma, m.ad, m.soyad, m.telefon, m.kod]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [musteriler, musteriArama])

  const altKategoriler = ALT_KATEGORILER[anaTur] ?? []

  const kaydet = async () => {
    if (!musteri) {
      Alert.alert('Eksik', 'Bir müşteri seç.')
      return
    }
    if (!konu.trim()) {
      Alert.alert('Eksik', 'Konu zorunlu.')
      return
    }
    setKaydediliyor(true)

    const ilgiliKisiAd = kisi
      ? `${kisi.ad ?? ''} ${kisi.soyad ?? ''}`.trim()
      : null
    const ilgiliKisiTel = kisi?.telefon ?? null

    // Lokasyon metni: seçili lokasyon varsa ad'ını, yoksa serbest metni kullan
    const lokasyonMetni = lokasyonSecili?.ad ?? lokasyon.trim() ?? null
    // Cihaz metni: seçili cihaz varsa özetini, yoksa serbest metni
    const cihazMetni = cihazSecili
      ? `${cihazSecili.marka ? cihazSecili.marka + ' ' : ''}${cihazSecili.model ?? cihazSecili.stokKodu}${cihazSecili.seriNo ? ' · S/N: ' + cihazSecili.seriNo : ''}`
      : cihazTuru.trim() || null

    const yeni = await servisTalepEkle({
      talepNo,
      musteriId: musteri.id,
      musteriAd: `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim() || musteri.firma,
      firmaAdi: musteri.firma,
      anaTur,
      altKategori,
      konu: konu.trim(),
      lokasyon: lokasyonMetni,
      cihazTuru: cihazMetni,
      aciklama: aciklama.trim() || null,
      aciliyet,
      ilgiliKisi: ilgiliKisiAd,
      telefon: ilgiliKisiTel,
      uygunZaman: uygunZaman.trim() || null,
      durum: atanan ? 'atandi' : 'bekliyor',
      atananKullaniciId: atanan?.id ?? null,
      atananKullaniciAd: atanan?.ad ?? null,
      planliTarih: planliTarih || null,
      notlar: [],
      durumGecmisi: [
        {
          durum: atanan ? 'atandi' : 'bekliyor',
          kullanici: kullanici?.ad ?? '',
          tarih: new Date().toISOString(),
        },
      ],
      musteriOnay: false,
      periyodikMi,
      periyodikAraligi: periyodikMi ? periyodikAraligi : null,
    })

    if (!yeni) {
      setKaydediliyor(false)
      Alert.alert('Hata', 'Talep oluşturulamadı.')
      return
    }

    // Ekleri yükle ve talebin notuna iliştir
    if (ekler.length > 0) {
      const ekUrls = []
      for (const uri of ekler) {
        const res = await servisEkiYukle(yeni.talepNo ?? yeni.id, uri)
        if (res.ok) ekUrls.push(res.url)
      }
      if (ekUrls.length > 0) {
        // İlk not olarak ekleri iliştir — böylece detayda görünür
        await import('../services/servisService').then(({ servisTalepGuncelle }) =>
          servisTalepGuncelle(yeni.id, {
            notlar: [
              {
                metin: `📎 ${ekUrls.length} ek yüklendi`,
                kullanici: kullanici?.ad ?? '',
                tarih: new Date().toISOString(),
                fotoUrls: ekUrls,
              },
            ],
          })
        )
      }
    }

    // Malzeme planlarını ekle
    if (malzemeGerekli && malzemeler.length > 0) {
      for (const m of malzemeler) {
        await malzemePlanEkle({
          servisTalepId: yeni.id,
          stokKodu: m.stokKodu,
          stokAdi: m.stokAdi,
          birim: m.birim ?? 'Adet',
          planliMiktar: m.planliMiktar,
          notMetni: m.notMetni ?? null,
          tip: m.tip ?? 'bulk',
          teslimAlinanMiktar: 0,
          kullanilanMiktar: 0,
        })
      }
    }

    setKaydediliyor(false)
    navigation.goBack()
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
        <Text style={styles.talepNoBadge}>{talepNo || '...'}</Text>

        {/* Müşteri */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Müşteri *</Text>
        <View style={styles.pickerRow}>
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

        {/* İlgili kişi (müşteri seçilince aktif) */}
        {!!musteri && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>İlgili Kişi</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
                onPress={() => setKisiPickerOpen(true)}
                activeOpacity={0.7}
                disabled={kisiler.length === 0}
              >
                <Text style={{ color: kisi ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
                  {kisi
                    ? `${kisi.ad ?? ''} ${kisi.soyad ?? ''}${kisi.unvan ? ` · ${kisi.unvan}` : ''}`.trim()
                    : kisiler.length === 0 ? 'Bu müşteride kayıtlı kişi yok' : 'Kişi seç...'}
                </Text>
              </TouchableOpacity>
              {!!kisi && (
                <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setKisi(null)}>
                  <Text style={styles.clearText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Tür */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Tür *</Text>
        <View style={styles.chipRow}>
          {ANA_TURLER.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                anaTur === t.id && { backgroundColor: t.renk, borderColor: t.renk },
              ]}
              onPress={() => setAnaTur(t.id)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, anaTur === t.id && { color: '#fff' }]}>
                {t.ikon} {t.isim}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alt kategori */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Alt Kategori</Text>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: colors.surface }]}
          onPress={() => setAltKategoriPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: altKategori ? colors.textPrimary : colors.textFaded }}>
            {altKategori
              ? altKategoriler.find((a) => a.id === altKategori)?.isim ?? altKategori
              : 'Seç (opsiyonel)...'}
          </Text>
        </TouchableOpacity>

        {/* Konu */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Konu *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={konu}
          onChangeText={setKonu}
          placeholder="Kısa başlık"
          placeholderTextColor={colors.textFaded}
        />

        {/* Açıklama */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Açıklama</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={aciklama}
          onChangeText={setAciklama}
          multiline
          placeholder="Detaylı açıklama..."
          placeholderTextColor={colors.textFaded}
        />

        {/* Lokasyon (müşteriye bağlı dropdown + serbest metin fallback) */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Lokasyon</Text>
        {musteri && musteriLokasyonlari.length > 0 ? (
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
              onPress={() => setLokasyonPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={{ color: lokasyonSecili ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
                {lokasyonSecili ? lokasyonSecili.ad : 'Lokasyon seç...'}
              </Text>
            </TouchableOpacity>
            {!!lokasyonSecili && (
              <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setLokasyonSecili(null)}>
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={lokasyon}
            onChangeText={setLokasyon}
            placeholder={musteri ? 'Müşteriye lokasyon eklenmemiş, serbest yaz...' : 'Ana bina, oda 3...'}
            placeholderTextColor={colors.textFaded}
          />
        )}

        {/* Cihaz (müşteri envanterinden veya serbest) */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Cihaz</Text>
        {musteri && musteriCihazlari.length > 0 ? (
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
              onPress={() => setCihazPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={{ color: cihazSecili ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
                {cihazSecili
                  ? `${cihazSecili.marka ? cihazSecili.marka + ' ' : ''}${cihazSecili.model ?? cihazSecili.stokKodu}${cihazSecili.seriNo ? ' · ' + cihazSecili.seriNo : ''}`
                  : 'Müşteri cihazlarından seç...'}
              </Text>
            </TouchableOpacity>
            {!!cihazSecili && (
              <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setCihazSecili(null)}>
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
            value={cihazTuru}
            onChangeText={setCihazTuru}
            placeholder={musteri ? 'Müşteride cihaz kaydı yok, serbest yaz...' : 'NVR, kamera...'}
            placeholderTextColor={colors.textFaded}
          />
        )}

        {/* Malzeme Gerekli mi? */}
        <TouchableOpacity
          style={[styles.checkRow, { backgroundColor: colors.surface }]}
          onPress={() => setMalzemeGerekli((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkBox, malzemeGerekli && styles.checkBoxAktif]}>
            {malzemeGerekli && <Feather name="check" size={14} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>Malzeme Gerekli mi?</Text>
        </TouchableOpacity>

        {malzemeGerekli && (
          <View style={[styles.malzemeBlok, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.malzemeBlokHeader}>
              <Text style={[styles.malzemeBlokTitle, { color: colors.textSecondary }]}>📦 Planlanan Malzemeler ({malzemeler.length})</Text>
              <TouchableOpacity
                style={styles.malzemeEkleBtn}
                onPress={() => {
                  setDuzenlenenMalzemeIdx(null)
                  setMalzemeModalOpen(true)
                }}
              >
                <Feather name="plus" size={14} color="#60a5fa" />
                <Text style={styles.malzemeEkleText}>Ekle</Text>
              </TouchableOpacity>
            </View>
            {malzemeler.length === 0 ? (
              <Text style={[styles.malzemeBos, { color: colors.textFaded }]}>Henüz malzeme eklenmemiş.</Text>
            ) : (
              malzemeler.map((m, i) => (
                <TouchableOpacity
                  key={`${m.stokKodu}-${i}`}
                  style={[styles.malzemeItem, { backgroundColor: colors.surfaceDark }]}
                  onPress={() => {
                    setDuzenlenenMalzemeIdx(i)
                    setMalzemeModalOpen(true)
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.malzemeItemAd, { color: colors.textPrimary }]} numberOfLines={1}>{m.stokAdi}</Text>
                    <Text style={[styles.malzemeItemMeta, { color: colors.textMuted }]}>
                      {m.stokKodu} · {m.planliMiktar} {m.birim}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.()
                      setMalzemeler((prev) => prev.filter((_, idx) => idx !== i))
                    }}
                    hitSlop={10}
                  >
                    <Feather name="trash-2" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Periyodik İş */}
        <TouchableOpacity
          style={[styles.checkRow, { backgroundColor: colors.surface }]}
          onPress={() => setPeriyodikMi((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkBox, periyodikMi && styles.checkBoxAktif]}>
            {periyodikMi && <Feather name="check" size={14} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>🔁 Periyodik Bakım</Text>
        </TouchableOpacity>

        {periyodikMi && (
          <View style={styles.chipRow}>
            {[
              { id: 'aylik', isim: 'Aylık' },
              { id: '3aylik', isim: '3 Aylık' },
              { id: '6aylik', isim: '6 Aylık' },
              { id: 'yillik', isim: 'Yıllık' },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  periyodikAraligi === p.id && { backgroundColor: '#2563eb', borderColor: '#2563eb' },
                ]}
                onPress={() => setPeriyodikAraligi(p.id)}
              >
                <Text style={[styles.chipText, { color: colors.textSecondary }, periyodikAraligi === p.id && { color: '#fff' }]}>
                  {p.isim}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Ekler — foto/dosya */}
        <Text style={[styles.label, { color: colors.textMuted }]}>📎 Ekler ({ekler.length})</Text>
        <View style={styles.fotoAksiyonRow}>
          <TouchableOpacity
            style={styles.fotoAksiyonBtn}
            onPress={async () => {
              const izin = await ImagePicker.requestCameraPermissionsAsync()
              if (!izin.granted) return Alert.alert('İzin Gerekli', 'Kameraya erişim izni ver.')
              const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
              if (!s.canceled) setEkler((p) => [...p, s.assets[0].uri].slice(0, 10))
            }}
          >
            <Feather name="camera" size={16} color="#60a5fa" />
            <Text style={styles.fotoAksiyonText}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fotoAksiyonBtn}
            onPress={async () => {
              const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
              if (!izin.granted) return Alert.alert('İzin Gerekli', 'Galeriye erişim izni ver.')
              const s = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsMultipleSelection: true,
                selectionLimit: 5,
              })
              if (!s.canceled) {
                const uris = s.assets.map((a) => a.uri)
                setEkler((p) => [...p, ...uris].slice(0, 10))
              }
            }}
          >
            <Feather name="image" size={16} color="#60a5fa" />
            <Text style={styles.fotoAksiyonText}>Galeri</Text>
          </TouchableOpacity>
        </View>
        {ekler.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {ekler.map((uri) => (
              <View key={uri} style={styles.ekWrap}>
                <Image source={{ uri }} style={styles.ekThumb} />
                <TouchableOpacity
                  style={styles.ekSilBtn}
                  onPress={() => setEkler((p) => p.filter((u) => u !== uri))}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Aciliyet */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Aciliyet</Text>
        <View style={styles.chipRow}>
          {ACILIYET_SEVIYELERI.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                aciliyet === a.id && { backgroundColor: a.renk, borderColor: a.renk },
              ]}
              onPress={() => setAciliyet(a.id)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, aciliyet === a.id && { color: '#fff' }]}>
                {a.ikon} {a.isim}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Uygun zaman - saat picker */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Uygun Zaman (Saat)</Text>
        <TouchableOpacity
          style={[styles.pickerInput, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
          onPress={() => setZamanPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="clock" size={18} color="#60a5fa" />
          <Text style={[styles.pickerInputText, { color: colors.textPrimary }, !uygunZaman && { color: colors.textFaded }]}>
            {uygunZaman || 'Saat seç...'}
          </Text>
          {!!uygunZaman && (
            <TouchableOpacity onPress={() => setUygunZaman('')}>
              <Feather name="x" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Planlı tarih - date picker */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Planlı Tarih</Text>
        <TouchableOpacity
          style={[styles.pickerInput, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
          onPress={() => setTarihPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="calendar" size={18} color="#60a5fa" />
          <Text style={[styles.pickerInputText, { color: colors.textPrimary }, !planliTarih && { color: colors.textFaded }]}>
            {planliTarih ? tarihGoster(planliTarih) : 'Tarih seç...'}
          </Text>
          {!!planliTarih && (
            <TouchableOpacity onPress={() => setPlanliTarih('')}>
              <Feather name="x" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Takvim modal — Planlı Tarih */}
        <TakvimPicker
          visible={tarihPickerOpen}
          onClose={() => setTarihPickerOpen(false)}
          secili={planliTarih}
          onSelect={(d) => setPlanliTarih(d)}
          title="Planlı Tarih Seç"
        />

        {/* Saat picker */}
        {zamanPickerOpen && (
          <DateTimePicker
            value={zamanToDate(uygunZaman)}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, selected) => {
              if (Platform.OS !== 'ios') setZamanPickerOpen(false)
              if (e.type === 'set' && selected) {
                setUygunZaman(dateToZaman(selected))
              }
            }}
          />
        )}

        {Platform.OS === 'ios' && zamanPickerOpen && (
          <TouchableOpacity
            style={styles.iosKapatBtn}
            onPress={() => setZamanPickerOpen(false)}
          >
            <Text style={styles.iosKapatText}>Tamam</Text>
          </TouchableOpacity>
        )}

        {/* Atanan */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Atanacak Teknisyen (opsiyonel)</Text>
        <View style={styles.pickerRow}>
          <TouchableOpacity
            style={[styles.input, { flex: 1, backgroundColor: colors.surface }]}
            onPress={() => setKullaniciPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: atanan ? colors.textPrimary : colors.textFaded }}>
              {atanan ? atanan.ad : 'Atanmadı (bekliyor)'}
            </Text>
          </TouchableOpacity>
          {!!atanan && (
            <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setAtanan(null)}>
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Talebi Oluştur'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Müşteri seçici */}
      <Modal visible={musteriPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
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
                placeholder="Ara..."
                placeholderTextColor={colors.textFaded}
                value={musteriArama}
                onChangeText={setMusteriArama}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filtrelenmisMusteriler}
              keyExtractor={(m) => String(m.id)}
              keyboardShouldPersistTaps="handled"
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
                    {item.kod ? `${item.kod} · ` : ''}{item.sehir ?? ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Kişi seçici */}
      <Modal visible={kisiPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>İlgili Kişi Seç</Text>
              <TouchableOpacity onPress={() => setKisiPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={kisiler}
              keyExtractor={(k) => String(k.id)}
              ListEmptyComponent={
                <Text style={{ color: colors.textFaded, textAlign: 'center', marginTop: 24 }}>
                  Bu müşteride kayıtlı kişi yok.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setKisi(item)
                    setKisiPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                    {item.ad} {item.soyad ?? ''}
                    {item.anaKisi ? ' ⭐' : ''}
                  </Text>
                  {!!item.unvan && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.unvan}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Alt kategori seçici */}
      <Modal visible={altKategoriPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Alt Kategori</Text>
              <TouchableOpacity onPress={() => setAltKategoriPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={altKategoriler}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setAltKategori(item.id)
                    setAltKategoriPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{item.isim}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Kullanıcı seçici */}
      <Modal visible={kullaniciPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Teknisyen Seç</Text>
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

      {/* Lokasyon seçici */}
      <Modal visible={lokasyonPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Lokasyon Seç</Text>
              <TouchableOpacity onPress={() => setLokasyonPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={musteriLokasyonlari}
              keyExtractor={(l) => String(l.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setLokasyonSecili(item)
                    setLokasyonPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }} numberOfLines={1}>
                    {item.ad}
                  </Text>
                  {!!item.adres && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {item.adres}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Cihaz seçici */}
      <Modal visible={cihazPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cihaz Seç</Text>
              <TouchableOpacity onPress={() => setCihazPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={musteriCihazlari}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                  onPress={() => {
                    setCihazSecili(item)
                    setCihazPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 15 }} numberOfLines={1}>
                    {item.marka ? item.marka + ' ' : ''}{item.model ?? item.stokKodu}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.seriNo ? `S/N: ${item.seriNo}` : item.stokKodu}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Malzeme plan modal */}
      <MalzemePlanModal
        visible={malzemeModalOpen}
        onClose={() => {
          setMalzemeModalOpen(false)
          setDuzenlenenMalzemeIdx(null)
        }}
        initial={duzenlenenMalzemeIdx != null ? malzemeler[duzenlenenMalzemeIdx] : null}
        onSave={(yeni) => {
          setMalzemeler((prev) => {
            if (duzenlenenMalzemeIdx != null) {
              const kopya = [...prev]
              kopya[duzenlenenMalzemeIdx] = yeni
              return kopya
            }
            return [...prev, yeni]
          })
        }}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  talepNoBadge: {
    color: '#3b82f6',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 8,
  },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  pickerInput: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerInputText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  iosKapatBtn: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  iosKapatText: { color: '#fff', fontWeight: '700' },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxAktif: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  malzemeBlok: {
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  malzemeBlokHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  malzemeBlokTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  malzemeEkleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  malzemeEkleText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  malzemeBos: { color: '#64748b', fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  malzemeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 6,
  },
  malzemeItemAd: { color: '#fff', fontSize: 14, fontWeight: '700' },
  malzemeItemMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  fotoAksiyonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fotoAksiyonBtn: {
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
  fotoAksiyonText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  ekWrap: { position: 'relative' },
  ekThumb: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#1e293b' },
  ekSilBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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

  row2: { flexDirection: 'row', gap: 12 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipText: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },

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
