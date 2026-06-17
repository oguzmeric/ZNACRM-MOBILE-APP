// Servis raporu (form) icin ek bilgileri doldurma karti — web
// ServisFormBilgileriCard.jsx ile ayni alanlar. Kaydet -> servisTalepGuncelle.
// Kaydedilenler servis formu ciktisina (servisFormuHtml) yansir.

import { useEffect, useState, useMemo } from 'react'
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
const bosParca = () => ({ aciklama: '', birim_fiyat: 0, miktar: 1, tutar: 0 })

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
  const [parcalar, setParcalar] = useState(() => (Array.isArray(talep?.yedekParcalar) ? talep.yedekParcalar : []))
  const [acik, setAcik] = useState(false)
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
    setParcalar(Array.isArray(talep?.yedekParcalar) ? talep.yedekParcalar : [])
  }, [talep?.id])

  const parcaGuncelle = (idx, alan, deger) => {
    setParcalar((prev) => prev.map((p, i) => {
      if (i !== idx) return p
      const g = { ...p, [alan]: deger }
      if (alan === 'birim_fiyat' || alan === 'miktar') {
        g.tutar = Number(g.birim_fiyat || 0) * Number(g.miktar || 0)
      }
      return g
    }))
  }

  const genelToplam = useMemo(
    () => parcalar.reduce((s, p) => s + Number(p.tutar || 0), 0),
    [parcalar]
  )

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
        yedekParcalar: parcalar.filter((p) => (p.aciklama || '').trim() || Number(p.birim_fiyat) > 0),
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

          {/* Yedek Parçalar */}
          <View>
            <View style={styles.parcaBaslik}>
              <Text style={[styles.label, { color: colors.textMuted, marginBottom: 0 }]}>Yedek Parçalar / Hizmetler</Text>
              <TouchableOpacity style={styles.satirEkle} onPress={() => setParcalar((p) => [...p, bosParca()])}>
                <Feather name="plus" size={13} color={colors.primary} />
                <Text style={[styles.satirEkleText, { color: colors.primary }]}>Satır</Text>
              </TouchableOpacity>
            </View>
            {parcalar.length === 0 ? (
              <Text style={[styles.bosParca, { color: colors.textFaded, borderColor: colors.border }]}>Parça/hizmet eklenmedi</Text>
            ) : (
              parcalar.map((p, i) => (
                <View key={i} style={[styles.parcaSatir, { borderColor: colors.border }]}>
                  <TextInput
                    style={[inputStil, { flex: 1 }]}
                    value={p.aciklama || ''} onChangeText={(t) => parcaGuncelle(i, 'aciklama', t)}
                    placeholder="Açıklama" placeholderTextColor={colors.textFaded}
                  />
                  <View style={styles.parcaAlt}>
                    <TextInput
                      style={[inputStil, styles.parcaKucuk]}
                      value={String(p.birim_fiyat ?? 0)} onChangeText={(t) => parcaGuncelle(i, 'birim_fiyat', Number(t) || 0)}
                      keyboardType="numeric" placeholder="Birim ₺" placeholderTextColor={colors.textFaded}
                    />
                    <TextInput
                      style={[inputStil, styles.parcaKucuk]}
                      value={String(p.miktar ?? 0)} onChangeText={(t) => parcaGuncelle(i, 'miktar', Number(t) || 0)}
                      keyboardType="numeric" placeholder="Adet" placeholderTextColor={colors.textFaded}
                    />
                    <Text style={[styles.parcaTutar, { color: colors.textPrimary }]}>{Number(p.tutar || 0).toFixed(2)} ₺</Text>
                    <TouchableOpacity onPress={() => setParcalar((prev) => prev.filter((_, idx) => idx !== i))} style={styles.parcaSil}>
                      <Feather name="trash-2" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            {parcalar.length > 0 && (
              <Text style={[styles.toplam, { color: colors.textPrimary }]}>Genel Toplam: {genelToplam.toFixed(2)} ₺</Text>
            )}
          </View>

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
  parcaBaslik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  satirEkle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  satirEkleText: { fontSize: 13, fontWeight: '700' },
  bosParca: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
  parcaSatir: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8, gap: 6 },
  parcaAlt: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  parcaKucuk: { width: 72, paddingVertical: 7, fontSize: 13 },
  parcaTutar: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  parcaSil: { padding: 4 },
  toplam: { textAlign: 'right', fontWeight: '800', fontSize: 14, marginTop: 4 },
  kaydetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 10 },
  kaydetText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
