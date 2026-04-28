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
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { toCamel } from '../lib/mapper'
import { musterileriGetir } from '../services/musteriService'
import { musteriKisileriniGetir } from '../services/musteriKisiService'
import {
  teklifEkle,
  teklifGetir,
  teklifGuncelle,
  teklifRevize,
  sonrakiTeklifNo,
  satirHesapla,
  teklifToplamHesapla,
} from '../services/teklifService'
import TakvimPicker from '../components/TakvimPicker'
import { tarihFormat } from '../utils/format'
import { paraFormat } from '../utils/paraFormat'
import { trIcerir } from '../utils/trSearch'
import { tumStokUrunleriniGetir } from '../services/stokUrunService'

const PARA_BIRIMLERI = ['TL', 'USD', 'EUR']
const ODEME_SECENEKLERI = ['Peşin', '30 Gün', '60 Gün', 'Havale/EFT', 'Çek', 'Diğer']

export default function YeniTeklifScreen({ route, navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const editId = route?.params?.editId ?? null
  const editMode = !!editId

  const [teklifNo, setTeklifNo] = useState('')
  const [musteri, setMusteri] = useState(null)
  const [kisi, setKisi] = useState(null)
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [tarih, setTarih] = useState('') // YYYY-MM-DD
  const [gecerlilikTarihi, setGecerlilikTarihi] = useState('')
  const [paraBirimi, setParaBirimi] = useState('TL')
  const [odeme, setOdeme] = useState('Peşin')
  const [genelIskonto, setGenelIskonto] = useState('0')
  const [satirlar, setSatirlar] = useState([])

  const [musteriler, setMusteriler] = useState([])
  const [kisiler, setKisiler] = useState([])

  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')
  const [kisiPickerOpen, setKisiPickerOpen] = useState(false)
  const [odemePickerOpen, setOdemePickerOpen] = useState(false)
  const [tarihPickerOpen, setTarihPickerOpen] = useState(false)
  const [gecerlilikPickerOpen, setGecerlilikPickerOpen] = useState(false)

  const [satirEditIndex, setSatirEditIndex] = useState(null)
  const [satirEditOpen, setSatirEditOpen] = useState(false)

  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mevcutRevizyon, setMevcutRevizyon] = useState(0)

  useEffect(() => {
    navigation.setOptions({ title: editMode ? 'Teklifi Revize Et' : 'Yeni Teklif' })
  }, [navigation, editMode])

  useEffect(() => {
    musterileriGetir().then((l) => setMusteriler(l ?? []))
  }, [])

  useEffect(() => {
    if (editMode) {
      // Düzenleme modu — mevcut teklifi yükle
      ;(async () => {
        const t = await teklifGetir(editId)
        if (!t) return
        setTeklifNo(t.teklifNo ?? '')
        setMevcutRevizyon(t.revizyon ?? 0)
        setTarih(t.tarih ?? '')
        setGecerlilikTarihi(t.gecerlilikTarihi ?? '')
        setKonu(t.konu ?? '')
        setAciklama(t.aciklama ?? '')
        setParaBirimi(t.paraBirimi ?? 'TL')
        setOdeme(t.odemeSecenegi ?? 'Peşin')
        setGenelIskonto(String(t.genelIskonto ?? '0'))
        setSatirlar(t.satirlar ?? [])
        // Müşteri ve kişiyi yükle
        if (t.musteriId) {
          const { data } = await supabase
            .from('musteriler')
            .select('*')
            .eq('id', t.musteriId)
            .maybeSingle()
          if (data) setMusteri(toCamel(data))
        }
      })()
    } else {
      // Yeni teklif — bugün + 30 gün sonra
      const bugun = new Date()
      setTarih(
        `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`
      )
      const sonra = new Date()
      sonra.setDate(sonra.getDate() + 30)
      setGecerlilikTarihi(
        `${sonra.getFullYear()}-${String(sonra.getMonth() + 1).padStart(2, '0')}-${String(sonra.getDate()).padStart(2, '0')}`
      )
      sonrakiTeklifNo().then(setTeklifNo)
    }
  }, [editMode, editId])

  useEffect(() => {
    if (!musteri) {
      setKisiler([])
      setKisi(null)
      return
    }
    musteriKisileriniGetir(musteri.id).then((l) => {
      setKisiler(l ?? [])
      const ana = (l ?? []).find((k) => k.anaKisi)
      if (ana) setKisi(ana)
    })
  }, [musteri])

  const filtrelenmisMusteriler = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    return musteriler.filter((m) =>
      trIcerir([m.firma, m.ad, m.soyad, m.telefon, m.kod], musteriArama)
    )
  }, [musteriler, musteriArama])

  const toplam = useMemo(
    () => teklifToplamHesapla(satirlar, Number(genelIskonto) || 0),
    [satirlar, genelIskonto]
  )

  const yeniSatirAc = () => {
    setSatirEditIndex(null)
    setSatirEditOpen(true)
  }

  const satirDuzenle = (index) => {
    setSatirEditIndex(index)
    setSatirEditOpen(true)
  }

  const satirSil = (index) => {
    setSatirlar((prev) => prev.filter((_, i) => i !== index))
  }

  const satirKaydet = (satir) => {
    if (satirEditIndex == null) {
      setSatirlar((prev) => [...prev, satir])
    } else {
      setSatirlar((prev) => prev.map((s, i) => (i === satirEditIndex ? satir : s)))
    }
    setSatirEditOpen(false)
    setSatirEditIndex(null)
  }

  const kaydet = async () => {
    if (!musteri) return Alert.alert('Eksik', 'Müşteri seç.')
    if (!konu.trim()) return Alert.alert('Eksik', 'Konu gir.')
    if (satirlar.length === 0) return Alert.alert('Eksik', 'En az bir satır ekle.')

    setKaydediliyor(true)

    const veri = {
      tarih: tarih || null,
      gecerlilikTarihi: gecerlilikTarihi || null,
      musteriId: musteri.id,
      firmaAdi: musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim(),
      musteriYetkilisi: kisi
        ? `${kisi.ad ?? ''} ${kisi.soyad ?? ''}`.trim()
        : null,
      konu: konu.trim(),
      aciklama: aciklama.trim() || null,
      odemeSecenegi: odeme,
      paraBirimi,
      satirlar,
      genelIskonto: Number(genelIskonto) || 0,
      genelToplam: toplam.genelToplam,
    }

    let sonuc
    if (editMode) {
      // Revize modu — eski hali geçmişe kaydet, yeni revizyon
      sonuc = await teklifRevize(editId, {
        ...veri,
        hazirlayan: kullanici?.ad ?? null,
      })
    } else {
      sonuc = await teklifEkle({
        ...veri,
        teklifNo,
        revizyon: 0,
        hazirlayan: kullanici?.ad ?? '',
        onayDurumu: 'takipte',
      })
    }
    setKaydediliyor(false)

    if (!sonuc) return Alert.alert('Hata', editMode ? 'Revize edilemedi.' : 'Teklif oluşturulamadı.')
    if (editMode) {
      Alert.alert('Revize Edildi', `Revizyon ${mevcutRevizyon + 1} olarak kaydedildi.`)
      navigation.goBack()
    } else {
      navigation.replace('TeklifDetay', { id: sonuc.id })
    }
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
        <Text style={[styles.teklifNoBadge, { color: colors.primaryLight, backgroundColor: colors.surface }]}>
          {teklifNo || '...'}
          {editMode ? `  ·  Revizyon ${mevcutRevizyon + 1}` : ''}
        </Text>

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
              <Feather name="x" size={18} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Kişi */}
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
                  <Feather name="x" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Konu */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Konu *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          value={konu}
          onChangeText={setKonu}
          placeholder="Teklif konusu"
          placeholderTextColor={colors.textFaded}
        />

        {/* Tarih + Geçerlilik */}
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Tarih</Text>
            <TouchableOpacity
              style={[styles.pickerInput, { backgroundColor: colors.surface }]}
              onPress={() => setTarihPickerOpen(true)}
            >
              <Feather name="calendar" size={16} color={colors.primaryLight} />
              <Text style={[styles.pickerInputText, { color: colors.textPrimary }]}>
                {tarih ? tarihFormat(tarih) : 'Seç'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Geçerlilik</Text>
            <TouchableOpacity
              style={[styles.pickerInput, { backgroundColor: colors.surface }]}
              onPress={() => setGecerlilikPickerOpen(true)}
            >
              <Feather name="calendar" size={16} color={colors.primaryLight} />
              <Text style={[styles.pickerInputText, { color: colors.textPrimary }]}>
                {gecerlilikTarihi ? tarihFormat(gecerlilikTarihi) : 'Seç'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Para birimi */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Para Birimi</Text>
        <View style={styles.chipRow}>
          {PARA_BIRIMLERI.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                paraBirimi === p && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setParaBirimi(p)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, paraBirimi === p && { color: '#fff' }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ödeme */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Ödeme Seçeneği</Text>
        <TouchableOpacity
          style={[styles.input, { backgroundColor: colors.surface }]}
          onPress={() => setOdemePickerOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: odeme ? colors.textPrimary : colors.textFaded }}>{odeme}</Text>
        </TouchableOpacity>

        {/* Açıklama */}
        <Text style={[styles.label, { color: colors.textMuted }]}>Açıklama</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, height: 80, textAlignVertical: 'top' }]}
          value={aciklama}
          onChangeText={setAciklama}
          multiline
          placeholder="Ek notlar..."
          placeholderTextColor={colors.textFaded}
        />

        {/* Satırlar */}
        <View style={styles.satirlarHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Satırlar ({satirlar.length})</Text>
          <TouchableOpacity style={[styles.satirEkleBtn, { backgroundColor: colors.primary }]} onPress={yeniSatirAc}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.satirEkleText}>Satır Ekle</Text>
          </TouchableOpacity>
        </View>

        {satirlar.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz satır yok.</Text>
        ) : (
          satirlar.map((s, i) => {
            const h = satirHesapla(s)
            return (
              <TouchableOpacity
                key={i}
                style={[styles.satirCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => satirDuzenle(i)}
                activeOpacity={0.85}
              >
                <View style={styles.satirHeader}>
                  <Text style={[styles.satirAd, { color: colors.textPrimary }]} numberOfLines={2}>
                    {s.stokAdi || s.stokKodu || 'Ürün'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.satirTutar, { color: colors.success }]}>
                      {paraFormat(h.netTutar, paraBirimi)}
                    </Text>
                    <TouchableOpacity onPress={() => satirSil(i)}>
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.satirDetay, { color: colors.textMuted }]}>
                  {Number(s.miktar ?? 0)} {s.birim ?? ''} × {paraFormat(s.birimFiyat, paraBirimi)}
                  {Number(s.iskonto) > 0 && ` · İsk %${s.iskonto}`}
                  {Number(s.kdv) > 0 && ` · KDV %${s.kdv}`}
                </Text>
              </TouchableOpacity>
            )
          })
        )}

        {/* Genel iskonto + Toplam */}
        {satirlar.length > 0 && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>Genel İskonto (%)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={genelIskonto}
              onChangeText={setGenelIskonto}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textFaded}
            />

            <View style={[styles.toplamKart, { backgroundColor: colors.surface, borderColor: colors.success + '55' }]}>
              <View style={styles.toplamSatir}>
                <Text style={[styles.toplamLabel, { color: colors.textMuted }]}>Ara Toplam</Text>
                <Text style={[styles.toplamDeger, { color: colors.textSecondary }]}>{paraFormat(toplam.araToplam, paraBirimi)}</Text>
              </View>
              {toplam.satirIskontoToplam > 0 && (
                <View style={styles.toplamSatir}>
                  <Text style={[styles.toplamLabel, { color: colors.textMuted }]}>Satır İskonto</Text>
                  <Text style={[styles.toplamDeger, { color: colors.danger }]}>
                    -{paraFormat(toplam.satirIskontoToplam, paraBirimi)}
                  </Text>
                </View>
              )}
              {Number(genelIskonto) > 0 && (
                <View style={styles.toplamSatir}>
                  <Text style={[styles.toplamLabel, { color: colors.textMuted }]}>Genel İsk. (%{genelIskonto})</Text>
                  <Text style={[styles.toplamDeger, { color: colors.danger }]}>
                    -{paraFormat(toplam.genelIskontoTutari, paraBirimi)}
                  </Text>
                </View>
              )}
              <View style={styles.toplamSatir}>
                <Text style={[styles.toplamLabel, { color: colors.textMuted }]}>KDV</Text>
                <Text style={[styles.toplamDeger, { color: colors.textSecondary }]}>{paraFormat(toplam.kdvToplam, paraBirimi)}</Text>
              </View>
              <View style={[styles.toplamCizgi, { backgroundColor: colors.border }]} />
              <View style={styles.toplamSatir}>
                <Text style={[styles.toplamLabel, { color: colors.textMuted, fontWeight: '800', fontSize: 15 }]}>GENEL TOPLAM</Text>
                <Text style={[styles.toplamDeger, { color: colors.success, fontWeight: '800', fontSize: 17 }]}>
                  {paraFormat(toplam.genelToplam, paraBirimi)}
                </Text>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.kaydetBtn, { backgroundColor: colors.success }, kaydediliyor && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor}
        >
          <Text style={styles.kaydetText}>
            {kaydediliyor
              ? 'Kaydediliyor...'
              : editMode ? `Revize Kaydet (R${mevcutRevizyon + 1})` : 'Teklifi Oluştur'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Müşteri seçici */}
      <Modal visible={musteriPickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgDark }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteri Seç</Text>
              <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
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
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setMusteri(item)
                    setMusteriPickerOpen(false)
                    setMusteriArama('')
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }} numberOfLines={1}>
                    {item.firma || `${item.ad} ${item.soyad}`}
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
          <View style={[styles.modalSheet, { backgroundColor: colors.bgDark }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>İlgili Kişi Seç</Text>
              <TouchableOpacity onPress={() => setKisiPickerOpen(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={kisiler}
              keyExtractor={(k) => String(k.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setKisi(item)
                    setKisiPickerOpen(false)
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                    {item.ad} {item.soyad ?? ''}{item.anaKisi ? ' ⭐' : ''}
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

      {/* Ödeme seçici */}
      <Modal visible={odemePickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { backgroundColor: colors.bgDark }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Ödeme Seçeneği</Text>
              <TouchableOpacity onPress={() => setOdemePickerOpen(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {ODEME_SECENEKLERI.map((o) => (
              <TouchableOpacity
                key={o}
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setOdeme(o)
                  setOdemePickerOpen(false)
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Takvim pickerlar */}
      <TakvimPicker
        visible={tarihPickerOpen}
        onClose={() => setTarihPickerOpen(false)}
        secili={tarih}
        onSelect={setTarih}
        title="Teklif Tarihi"
      />
      <TakvimPicker
        visible={gecerlilikPickerOpen}
        onClose={() => setGecerlilikPickerOpen(false)}
        secili={gecerlilikTarihi}
        onSelect={setGecerlilikTarihi}
        title="Geçerlilik Tarihi"
      />

      {/* Satır ekleme/düzenleme modal */}
      <SatirModal
        visible={satirEditOpen}
        onClose={() => {
          setSatirEditOpen(false)
          setSatirEditIndex(null)
        }}
        initial={satirEditIndex != null ? satirlar[satirEditIndex] : null}
        onSave={satirKaydet}
        paraBirimi={paraBirimi}
      />
    </KeyboardAvoidingView>
  )
}

// === Satır modal ===
function SatirModal({ visible, onClose, initial, onSave, paraBirimi }) {
  const { colors } = useTheme()
  const [stokAdi, setStokAdi] = useState('')
  const [stokKodu, setStokKodu] = useState('')
  const [birim, setBirim] = useState('Adet')
  const [miktar, setMiktar] = useState('1')
  const [birimFiyat, setBirimFiyat] = useState('0')
  const [iskonto, setIskonto] = useState('0')
  const [kdv, setKdv] = useState('20')

  // Ürün kataloğu (autocomplete için)
  const [katalog, setKatalog] = useState([])
  const [oneriGoster, setOneriGoster] = useState(false)

  useEffect(() => {
    if (visible) {
      setStokAdi(initial?.stokAdi ?? '')
      setStokKodu(initial?.stokKodu ?? '')
      setBirim(initial?.birim ?? 'Adet')
      setMiktar(String(initial?.miktar ?? '1'))
      setBirimFiyat(String(initial?.birimFiyat ?? '0'))
      setIskonto(String(initial?.iskonto ?? '0'))
      setKdv(String(initial?.kdv ?? '20'))
      setOneriGoster(false)
      // Katalog'u bir kez yükle
      if (katalog.length === 0) {
        tumStokUrunleriniGetir().then((urunler) => setKatalog(urunler))
      }
    }
  }, [visible, initial])

  const oneriler = useMemo(() => {
    if (!oneriGoster) return []
    const q = stokAdi.trim()
    if (!q) return katalog.slice(0, 20)
    return katalog
      .filter((u) => trIcerir([u.stokAdi, u.stokKodu], stokAdi))
      .slice(0, 20)
  }, [katalog, stokAdi, oneriGoster])

  const urunSec = (u) => {
    setStokAdi(u.stokAdi ?? '')
    setStokKodu(u.stokKodu ?? '')
    if (u.birim) setBirim(u.birim)
    if (u.satisFiyati != null) setBirimFiyat(String(u.satisFiyati))
    setOneriGoster(false)
  }

  const kaydet = () => {
    if (!stokAdi.trim()) {
      Alert.alert('Eksik', 'Ürün adı gerekli.')
      return
    }
    const satir = {
      stokAdi: stokAdi.trim(),
      stokKodu: stokKodu.trim() || null,
      birim,
      miktar: Number(String(miktar).replace(',', '.')) || 0,
      birimFiyat: Number(String(birimFiyat).replace(',', '.')) || 0,
      iskonto: Number(iskonto) || 0,
      kdv: Number(kdv) || 0,
    }
    onSave(satir)
  }

  const netTutar = satirHesapla({
    miktar: Number(miktar) || 0,
    birimFiyat: Number(birimFiyat) || 0,
    iskonto: Number(iskonto) || 0,
    kdv: Number(kdv) || 0,
  }).netTutar

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalBg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? 'Satır Düzenle' : 'Yeni Satır'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.textMuted }]}>Ürün Adı *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={stokAdi}
              onChangeText={(t) => { setStokAdi(t); setOneriGoster(true) }}
              onFocus={() => setOneriGoster(true)}
              placeholder="Ürün adını yazmaya başla, listeden seç…"
              placeholderTextColor={colors.textFaded}
            />
            {oneriGoster && (
              <View
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  marginTop: -4,
                  marginBottom: 8,
                  overflow: 'hidden',
                  maxHeight: 280,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {katalog.length === 0 ? 'Yükleniyor…' : `${oneriler.length} ürün`}
                  </Text>
                  <TouchableOpacity onPress={() => setOneriGoster(false)} activeOpacity={0.7}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Kapat</Text>
                  </TouchableOpacity>
                </View>
                {oneriler.length === 0 ? (
                  <Text style={{ padding: 14, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                    {katalog.length === 0 ? 'Katalog yükleniyor…' : 'Eşleşen ürün yok. Elle yazmaya devam edebilirsin.'}
                  </Text>
                ) : (
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 240 }}>
                    {oneriler.map((u) => (
                      <TouchableOpacity
                        key={u.stokKodu ?? u.id}
                        onPress={() => urunSec(u)}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                          {u.stokAdi}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {u.stokKodu ? `${u.stokKodu} · ` : ''}{u.birim ?? 'Adet'}
                          {u.satisFiyati != null ? ` · ${u.satisFiyati} ${paraBirimi ?? '₺'}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Stok Kodu</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={stokKodu}
                  onChangeText={setStokKodu}
                  placeholder="Opsiyonel"
                  placeholderTextColor={colors.textFaded}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Birim</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={birim}
                  onChangeText={setBirim}
                  placeholder="Adet, metre..."
                  placeholderTextColor={colors.textFaded}
                />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Miktar</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={miktar}
                  onChangeText={setMiktar}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.textFaded}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Birim Fiyat</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={birimFiyat}
                  onChangeText={setBirimFiyat}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textFaded}
                />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>İskonto %</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={iskonto}
                  onChangeText={setIskonto}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textFaded}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>KDV %</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={kdv}
                  onChangeText={setKdv}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor={colors.textFaded}
                />
              </View>
            </View>

            <View style={[styles.satirOnizleme, { backgroundColor: colors.success + '1f', borderColor: colors.success + '55' }]}>
              <Text style={[styles.satirOnizlemeLabel, { color: colors.textMuted }]}>Satır Toplamı</Text>
              <Text style={[styles.satirOnizlemeDeger, { color: colors.success }]}>{paraFormat(netTutar, paraBirimi)}</Text>
            </View>

            <TouchableOpacity style={[styles.kaydetBtn, { backgroundColor: colors.success }]} onPress={kaydet}>
              <Text style={styles.kaydetText}>
                {initial ? 'Güncelle' : 'Ekle'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  teklifNoBadge: {
    color: '#60a5fa',
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

  pickerInput: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerInputText: { color: '#fff', fontSize: 14, flex: 1 },

  row2: { flexDirection: 'row', gap: 12 },

  chipRow: { flexDirection: 'row', gap: 8 },
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

  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  satirlarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  satirEkleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  satirEkleText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  satirCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  satirHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  satirAd: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  satirTutar: { color: '#22c55e', fontSize: 14, fontWeight: '800' },
  satirDetay: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  toplamKart: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  toplamSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toplamLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  toplamDeger: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  toplamCizgi: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 8,
  },

  bos: { color: '#64748b', fontStyle: 'italic', paddingVertical: 10 },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '90%',
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
  modalInput: {
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

  satirOnizleme: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  satirOnizlemeLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  satirOnizlemeDeger: { color: '#22c55e', fontSize: 22, fontWeight: '800', marginTop: 4 },
})
