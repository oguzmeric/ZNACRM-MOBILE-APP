// Servis raporu (form) icin ek bilgileri doldurma karti — web
// ServisFormBilgileriCard.jsx ile ayni alanlar. Kaydet -> servisTalepGuncelle.
// Kaydedilenler servis formu ciktisina (servisFormuHtml) yansir.
//
// 🔴 17.08 — "mobilde doldurulanlar webde bos geliyor" VAKASI:
// Depocu, talep 280'in form alanlarini ELLE girmek zorunda kaldi; teknisyen
// mobilde doldurmustu ama veri DB'ye ulasmamisti. Olcum: tamamlanan 128
// talebin %11'inde cozum aciklamasi bos.
//
// Kok neden tek bir hata degil, KORUMASIZLIK: "Kaydet" dugmesi uzun formun
// EN ALTINDA; teknisyen alanlari doldurup kaydirmadan geri cikinca yazdigi
// her sey sessizce ucuyordu. Hicbir uyari yoktu. Bu yuzden kart artik:
//   1) degisiklik varken basligina "KAYDEDILMEDI" rozeti basar (kart katliyken de)
//   2) durumu `onKirliDegisti` ile ekrana bildirir — ekran cikista ve servisi
//      kapatirken uyarir (bkz. ServisTalebiDetayScreen)
//   3) kaydedilecek bir sey yoksa dugmeyi pasif gosterir (yanlis guven vermesin)
// ⚠️ Kayit BASARISIZ olursa yazilanlar state'te KALIR — teknisyen tekrar
//    deneyebilsin diye. Alan temizlemek veri kaybi demek olurdu.

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
  { id: 'kesif', label: 'Keşif' },
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

// Karşılaştırma yardımcıları — "değişti mi" sorusunu yanlış cevaplamamak için:
// çoklu seçimde SIRA önemsiz (chip'e basıp geri basınca sıra değişir),
// metinlerde null ile '' aynı şeydir.
const cokluNorm = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean).sort().join(',')
const metinNorm = (s) => (s ?? '').trim()

export default function ServisFormBilgileriCard({ talep, onKaydet, onKirliDegisti }) {
  const { colors } = useTheme()
  const [servisTipi, setServisTipi] = useState(() => setOlustur(talep?.servisTipi))
  const [yukumluluk, setYukumluluk] = useState(() => setOlustur(talep?.yukumluluk))
  const [servisYeri, setServisYeri] = useState(() => setOlustur(talep?.servisYeri))
  const [seriNo, setSeriNo] = useState(talep?.seriNumarasi || '')
  const [marka, setMarka] = useState(talep?.marka || '')
  const [model, setModel] = useState(talep?.model || '')
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
    setAriza(talep?.aciklama || '')
    setCozum(talep?.cozumAciklamasi || '')
  }, [talep?.id])

  // Kaydedilmemiş değişiklik var mı? Ekrandaki değerler DB'dekiyle karşılaştırılır.
  const kirli =
    cokluNorm(setToStr(servisTipi)) !== cokluNorm(talep?.servisTipi) ||
    cokluNorm(setToStr(yukumluluk)) !== cokluNorm(talep?.yukumluluk) ||
    cokluNorm(setToStr(servisYeri)) !== cokluNorm(talep?.servisYeri) ||
    metinNorm(seriNo) !== metinNorm(talep?.seriNumarasi) ||
    metinNorm(marka) !== metinNorm(talep?.marka) ||
    metinNorm(model) !== metinNorm(talep?.model) ||
    metinNorm(ariza) !== metinNorm(talep?.aciklama) ||
    metinNorm(cozum) !== metinNorm(talep?.cozumAciklamasi)

  // Ekran bu bilgiyi çıkışta ve servisi kapatırken kullanıyor
  useEffect(() => { onKirliDegisti?.(kirli) }, [kirli, onKirliDegisti])

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
        aciklama: ariza.trim() || null,
        cozumAciklamasi: cozum.trim() || null,
        // yedekParcalar BİLEREK yazılmıyor (web ile aynı kural): alan artık
        // servis_malzemeleri'nden DB trigger'ı ile türetiliyor. Buradan yazmak
        // trigger'la yarışır ve Kullanılan Malzemeler'den gelen listeyi ezerdi.
      })
      Alert.alert('Kaydedildi', 'Form bilgileri kaydedildi.')
    } catch (e) {
      // ⚠️ Yazılanlar SİLİNMEZ — teknisyen bağlantı gelince tekrar denesin.
      Alert.alert(
        'KAYDEDİLEMEDİ',
        `${e?.message || 'Kayıt başarısız.'}\n\nYazdıkların ekranda duruyor. İnternet bağlantını kontrol edip "Form Bilgilerini Kaydet"e tekrar bas.\n\n⚠️ Kaydetmeden çıkarsan bu bilgiler kaybolur.`,
      )
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Text style={[styles.baslik, { color: colors.textPrimary }]}>🧾 Form Bilgileri</Text>
          {/* ⚠️ Rozet kart KATLIYKEN de görünür — kaydetmeden çıkışın 1 numaralı sebebi
              formun katlanıp unutulmasıydı. */}
          {kirli && (
            <View style={styles.kirliRozet}>
              <Text style={styles.kirliRozetText}>KAYDEDİLMEDİ</Text>
            </View>
          )}
        </View>
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

          {/* Künye No kaldırıldı (06.08): hiç kullanılmıyordu — web ile senkron */}
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Seri No</Text>
            <TextInput style={inputStil} value={seriNo} onChangeText={setSeriNo} placeholder="—" placeholderTextColor={colors.textFaded} />
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

          {/* Değişiklik varken uyarı şeridi — düğmenin hemen üstünde, gözden kaçmasın */}
          {kirli && !kaydediliyor && (
            <View style={styles.kirliSerit}>
              <Feather name="alert-triangle" size={14} color="#b45309" />
              <Text style={styles.kirliSeritText}>
                Yaptığın değişiklikler HENÜZ KAYDEDİLMEDİ. Kaydetmeden çıkarsan kaybolur.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.kaydetBtn,
              { backgroundColor: kirli ? colors.primary : colors.surfaceDark },
              kaydediliyor && { opacity: 0.7 },
            ]}
            onPress={kaydet} disabled={kaydediliyor} activeOpacity={0.85}
          >
            {kaydediliyor
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name={kirli ? 'save' : 'check'} size={16} color={kirli ? '#fff' : colors.textMuted} />}
            <Text style={[styles.kaydetText, !kirli && !kaydediliyor && { color: colors.textMuted }]}>
              {kaydediliyor ? 'Kaydediliyor…' : kirli ? 'Form Bilgilerini Kaydet' : 'Kaydedildi — değişiklik yok'}
            </Text>
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
  // Kaydedilmemiş değişiklik uyarıları — amber, temadan bağımsız sabit renk
  // (kritik uyarı; koyu/açık temada da aynı okunurlukta kalmalı)
  kirliRozet: { backgroundColor: '#f59e0b', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  kirliRozetText: { color: '#fff', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },
  kirliSerit: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
  },
  kirliSeritText: { color: '#92400e', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
})
