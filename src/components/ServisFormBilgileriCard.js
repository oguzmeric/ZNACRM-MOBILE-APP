// Servis raporu (form) icin ek bilgileri doldurma karti — web
// ServisFormBilgileriCard.jsx ile ayni alanlar. Kaydet -> servisTalepGuncelle.
// Kaydedilenler servis formu ciktisina (servisFormuHtml) yansir.

import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

const SERVIS_TIPI = [
  { id: 'ariza', label: 'Arıza Tespiti' },
  { id: 'bakim', label: 'Bakım' },
  { id: 'urun', label: 'Ürün Alımı' },
  { id: 'kurulum', label: 'Kurulum' },
  { id: 'teslimat', label: 'Teslimat' },
]
const YUKUMLULUK = [
  { id: 'garanti', label: 'Garanti Kapsamında' },
  { id: 'servis', label: 'Servis Sözleşmeli' },
  { id: 'bakim', label: 'Bakım Sözleşmeli' },
]
const SERVIS_YERI = [
  { id: 'teknik', label: 'ZNA Teknik Servis' },
  { id: 'yerinde', label: 'Müşteri Yerinde' },
  { id: 'online', label: 'Online' },
  { id: 'diger', label: 'Diğer' },
]

const setOlustur = (s) => new Set((s || '').split(',').map((x) => x.trim()).filter(Boolean))
const setToStr = (set) => Array.from(set).join(',')

export default function ServisFormBilgileriCard({ talep, onKaydet }) {
  const { colors } = useTheme()
  const [servisTipi, setServisTipi] = useState(() => setOlustur(talep?.servisTipi))
  const [yukumluluk, setYukumluluk] = useState(() => setOlustur(talep?.yukumluluk))
  const [servisYeri, setServisYeri] = useState(() => setOlustur(talep?.servisYeri))
  const [seriNo, setSeriNo] = useState(talep?.seriNumarasi || '')
  const [marka, setMarka] = useState(talep?.marka || '')
  const [model, setModel] = useState(talep?.model || '')
  const [kunye, setKunye] = useState(talep?.kunyeNumarasi || '')
  const [ariza, setAriza] = useState(talep?.aciklama || '')
  const [cozum, setCozum] = useState(talep?.cozumAciklamasi || '')
  // Kart VARSAYILAN AÇIK (01.08): personel servise gidince formu her seferinde
  // elle açmak zorunda kalıyordu — en çok kullanılan bölüm, kapalı başlamasın.
  const [acik, setAcik] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    setServisTipi(setOlustur(talep?.servisTipi))
    setYukumluluk(setOlustur(talep?.yukumluluk))
    setServisYeri(setOlustur(talep?.servisYeri))
    setSeriNo(talep?.seriNumarasi || '')
    setMarka(talep?.marka || '')
    setModel(talep?.model || '')
    setKunye(talep?.kunyeNumarasi || '')
    setAriza(talep?.aciklama || '')
    setCozum(talep?.cozumAciklamasi || '')
  }, [talep?.id])

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      await onKaydet({
        servisTipi: setToStr(servisTipi),
        yukumluluk: setToStr(yukumluluk),
        servisYeri: setToStr(servisYeri),
        seriNumarasi: seriNo.trim() || null,
        marka: marka.trim() || null,
        model: model.trim() || null,
        kunyeNumarasi: kunye.trim() || null,
        aciklama: ariza.trim() || null,
        cozumAciklamasi: cozum.trim() || null,
        // yedekParcalar BİLEREK yazılmıyor (web ile aynı kural): alan artık
        // servis_malzemeleri'nden DB trigger'ı ile türetiliyor. Buradan yazmak
        // trigger'la yarışır ve Kullanılan Malzemeler'den gelen listeyi ezerdi.
      })
      Alert.alert('Kaydedildi', 'Form bilgileri kaydedildi.')
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kayıt başarısız.')
    } finally {
      setKaydediliyor(false)
    }
  }

  const toggle = (set, setter, id) => {
    const yeni = new Set(set)
    if (yeni.has(id)) yeni.delete(id); else yeni.add(id)
    setter(yeni)
  }

  const ChipGroup = ({ secenekler, secili, setter }) => (
    <View style={styles.chipWrap}>
      {secenekler.map((s) => {
        const aktif = secili.has(s.id)
        return (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, { borderColor: colors.border }, aktif && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => toggle(secili, setter, s.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, { color: aktif ? '#fff' : colors.textMuted }]}>
              {aktif ? '✓ ' : ''}{s.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const inputStil = [styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]

  return (
    <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.baslikRow} onPress={() => setAcik((v) => !v)} activeOpacity={0.7}>
        <Text style={[styles.baslik, { color: colors.textPrimary }]}>🧾 Form Bilgileri</Text>
        <Feather name={acik ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {acik && (
        <View style={{ gap: 14, marginTop: 8 }}>
          <Text style={[styles.aciklama, { color: colors.textFaded }]}>
            Bu alanlar servis raporu (form çıktısı) için doldurulur — web ile aynı.
          </Text>

          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Servis Tipi</Text>
            <ChipGroup secenekler={SERVIS_TIPI} secili={servisTipi} setter={setServisTipi} />
          </View>
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Yükümlülük</Text>
            <ChipGroup secenekler={YUKUMLULUK} secili={yukumluluk} setter={setYukumluluk} />
          </View>
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Servis Yeri</Text>
            <ChipGroup secenekler={SERVIS_YERI} secili={servisYeri} setter={setServisYeri} />
          </View>

          <View style={styles.grid2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Seri No</Text>
              <TextInput style={inputStil} value={seriNo} onChangeText={setSeriNo} placeholder="—" placeholderTextColor={colors.textFaded} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Künye No</Text>
              <TextInput style={inputStil} value={kunye} onChangeText={setKunye} placeholder="—" placeholderTextColor={colors.textFaded} />
            </View>
          </View>
          <View style={styles.grid2}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Marka</Text>
              <TextInput style={inputStil} value={marka} onChangeText={setMarka} placeholder="—" placeholderTextColor={colors.textFaded} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Model</Text>
              <TextInput style={inputStil} value={model} onChangeText={setModel} placeholder="—" placeholderTextColor={colors.textFaded} />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Arıza Açıklaması</Text>
            <TextInput
              style={[inputStil, { minHeight: 80, textAlignVertical: 'top' }]}
              value={ariza} onChangeText={setAriza} multiline
              placeholder="Müşterinin bildirdiği arıza / talep açıklaması…"
              placeholderTextColor={colors.textFaded}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Yapılan İşlemler (Çözüm)</Text>
            <TextInput
              style={[inputStil, { minHeight: 80, textAlignVertical: 'top' }]}
              value={cozum} onChangeText={setCozum} multiline
              placeholder="Yapılan işlemler, takılan parçalar, test sonuçları…"
              placeholderTextColor={colors.textFaded}
            />
          </View>

          {/* Yedek parça girişi 01.08'de KALDIRILDI (web ile aynı). Burada elle
              satır açıp fiyat yazmak stoktan düşmüyordu ve kaydederken
              Kullanılan Malzemeler'den gelen gerçek listeyi eziyordu. */}
          <Text style={[styles.parcaNot, { color: colors.textFaded, borderColor: colors.border }]}>
            Yedek parça / hizmet satırları yukarıdaki{' '}
            <Text style={{ fontWeight: '700', color: colors.textMuted }}>Kullanılan Malzemeler</Text>
            {' '}bölümünden girilir — oradan eklenenler stoktan düşer ve müşteri formuna aynen basılır.
          </Text>

          <TouchableOpacity
            style={[styles.kaydetBtn, { backgroundColor: colors.primary }, kaydediliyor && { opacity: 0.7 }]}
            onPress={kaydet} disabled={kaydediliyor} activeOpacity={0.85}
          >
            {kaydediliyor ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="save" size={16} color="#fff" />}
            <Text style={styles.kaydetText}>{kaydediliyor ? 'Kaydediliyor…' : 'Form Bilgilerini Kaydet'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  kart: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  baslikRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontSize: 15, fontWeight: '800' },
  aciklama: { fontSize: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  grid2: { flexDirection: 'row', gap: 10 },
  parcaNot: { fontSize: 12, lineHeight: 17, padding: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
  kaydetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 10 },
  kaydetText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
