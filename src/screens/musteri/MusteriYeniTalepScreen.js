// Müşteri portalı — Yeni Talep (webdeki 3 adımlı YeniTalep formunun mobil
// karşılığı; mobilde tek akışta bölümler halinde).
//
// ⚠️ Yazma sırası RLS'e göre tasarlandı:
//   1) talep INSERT (müşteri insert politikası var; talep_no DB trigger'ından)
//   2) foto/video Storage'a {talepId}/… yoluna yüklenir (müşteri storage
//      politikası yolun ilk klasörünün kendi talebinin id'si olmasını ister)
//   3) meta mig 319 RPC'siyle kayda işlenir (dosyalar UPDATE'i müşteriye kapalı)
// Ek yüklenemezse talep YİNE oluşur — müşteri bilgilendirilir, sessiz kayıp yok.
import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import ScreenContainer from '../../components/ScreenContainer'
import TarihSec from '../../components/TarihSec'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { servisTalepEkle, aktifKonulariGetir } from '../../services/servisService'
import { musteriLokasyonlariniGetir } from '../../services/musteriLokasyonService'
import { PORTAL_TUR_IDLERI, talepEkiYukle, talepDosyaEkle } from '../../services/portalService'
import { ANA_TURLER, ALT_KATEGORILER, ACILIYET_SEVIYELERI } from '../../utils/servisConstants'

const TUR_ACIKLAMA = {
  ariza: 'Mevcut bir sorun ya da kesinti bildirimi',
  talep: 'Yeni bir hizmet veya iş isteği',
  kesif: 'Yerinde inceleme ve durum tespiti',
  egitim: 'Kullanım veya bilgilendirme eğitimi',
}

const SAAT_SECENEKLERI = ['09:00', '11:00', '13:00', '15:00', '17:00']

export default function MusteriYeniTalepScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const portalTurleri = ANA_TURLER.filter((t) => PORTAL_TUR_IDLERI.includes(t.id))

  const [anaTur, setAnaTur] = useState('')
  const [altKategori, setAltKategori] = useState('')
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [lokasyonId, setLokasyonId] = useState(null)
  const [lokasyonMetin, setLokasyonMetin] = useState('')
  const [altLokasyon, setAltLokasyon] = useState('')
  const [cihazTuru, setCihazTuru] = useState('')
  const [aciliyet, setAciliyet] = useState('normal')
  const [ilgiliKisi, setIlgiliKisi] = useState(kullanici?.ad || '')
  const [telefon, setTelefon] = useState('')
  const [ziyaretTarih, setZiyaretTarih] = useState(null)
  const [ziyaretSaat, setZiyaretSaat] = useState('')
  const [dosyalar, setDosyalar] = useState([])   // { uri }
  const [konular, setKonular] = useState([])
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [gonderiliyor, setGonderiliyor] = useState(false)

  useEffect(() => {
    aktifKonulariGetir().then((d) => setKonular(d || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!kullanici?.musteriId) return
    musteriLokasyonlariniGetir(kullanici.musteriId)
      .then((l) => setLokasyonlar((l || []).filter((x) => x.aktif !== false)))
      .catch((e) => console.warn('[portal lokasyon]', e?.message))
  }, [kullanici?.musteriId])

  const altKategoriler = anaTur ? (ALT_KATEGORILER[anaTur] || []) : []

  const fotoEkle = useCallback(async (kameradan) => {
    try {
      let sonuc
      if (kameradan) {
        const izin = await ImagePicker.requestCameraPermissionsAsync()
        if (!izin.granted) { Alert.alert('İzin gerekli', 'Kamera izni verilmedi.'); return }
        sonuc = await ImagePicker.launchCameraAsync({ quality: 0.7 })
      } else {
        const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!izin.granted) { Alert.alert('İzin gerekli', 'Galeri izni verilmedi.'); return }
        sonuc = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.7,
          allowsMultipleSelection: true,
          selectionLimit: 5,
        })
      }
      if (sonuc?.canceled) return
      const yeniler = (sonuc?.assets || []).map((a) => ({ uri: a.uri }))
      if (yeniler.length) setDosyalar((prev) => [...prev, ...yeniler].slice(0, 8))
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Dosya seçilemedi.')
    }
  }, [])

  const gonder = async () => {
    if (gonderiliyor) return
    if (!anaTur) { Alert.alert('Eksik bilgi', 'Talep türü seçiniz.'); return }
    if (altKategoriler.length > 0 && !altKategori) { Alert.alert('Eksik bilgi', 'Alt kategori seçiniz.'); return }
    if (!konu) { Alert.alert('Eksik bilgi', 'Konu başlığı seçiniz.'); return }
    if (!aciklama.trim()) { Alert.alert('Eksik bilgi', 'Açıklama giriniz.'); return }
    if (!kullanici?.musteriId) {
      Alert.alert('Hesap sorunu', 'Hesabınız bir müşteri kartına bağlı değil. Lütfen bizimle iletişime geçin.')
      return
    }
    setGonderiliyor(true)
    try {
      // Lokasyon GÖRÜNTÜ metni: seçilen ad + bina/kat detayı (web ile aynı)
      const secilenLokasyon = lokasyonId
        ? (lokasyonlar.find((l) => String(l.id) === String(lokasyonId))?.ad || '')
        : lokasyonMetin.trim()
      const lokasyonBirlesik = [secilenLokasyon, altLokasyon.trim()].filter(Boolean).join(' · ')

      const tarihIso = ziyaretTarih ? String(ziyaretTarih).slice(0, 10) : ''
      const uygunZaman = tarihIso
        ? (ziyaretSaat ? `${tarihIso}T${ziyaretSaat}` : tarihIso.split('-').reverse().join('.'))
        : ''

      const yeni = await servisTalepEkle({
        talepNo: null,                     // DB trigger üretir (mig 046)
        musteriId: kullanici.musteriId,
        musteriAd: kullanici.ad,
        firmaAdi: kullanici.firmaAdi || '',
        anaTur,
        altKategori,
        konu,
        lokasyon: lokasyonBirlesik,
        lokasyonId: lokasyonId || null,
        cihazTuru: cihazTuru.trim(),
        aciklama: aciklama.trim(),
        aciliyet,
        ilgiliKisi: ilgiliKisi.trim() || kullanici.ad,
        telefon: telefon.trim(),
        uygunZaman,
        durum: 'bekliyor',
        kaynak: 'musteri',                 // mig 056 — portal işareti
        atananKullaniciId: null,
        atananKullaniciAd: null,
        planliTarih: null,
        notlar: [],
        durumGecmisi: [{
          durum: 'bekliyor',
          tarih: new Date().toISOString(),
          kullaniciAd: kullanici.ad,
          aciklama: 'Talep oluşturuldu (mobil)',
        }],
        musteriOnay: null,
      })
      if (!yeni?.id) throw new Error('Talep oluşturulamadı, lütfen tekrar deneyin.')

      // Ekler — talep OLUŞTU; yükleme hatası talebi geri almaz, bilgi verilir
      let ekHata = 0
      for (const d of dosyalar) {
        try {
          const yuklenen = await talepEkiYukle(yeni.id, d.uri)
          await talepDosyaEkle(yeni.id, {
            ad: yuklenen.ad, tip: yuklenen.tip, yol: yuklenen.yol,
          })
        } catch (e) {
          ekHata++
          console.warn('[talep eki]', e?.message)
        }
      }

      const mesaj = ekHata > 0
        ? `Talebiniz alındı (${yeni.talepNo || ''}). ${ekHata} dosya yüklenemedi — detaydan tekrar deneyebilir ya da ekibimize iletebilirsiniz.`
        : `Talebiniz alındı${yeni.talepNo ? ` (${yeni.talepNo})` : ''}. En kısa sürede ekibimiz sizinle iletişime geçecektir.`
      Alert.alert('Talebiniz Alındı ✅', mesaj, [
        { text: 'Tamam', onPress: () => navigation.replace('ServisDetay', { id: yeni.id }) },
      ])
    } catch (e) {
      Alert.alert('Gönderilemedi', e?.message || 'Talep oluşturulamadı, lütfen tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  const cipStil = (secili) => ([
    styles.cip,
    {
      backgroundColor: secili ? `${colors.primary}22` : colors.surface,
      borderColor: secili ? colors.primary : colors.border,
    },
  ])
  const cipYazi = (secili) => ([
    styles.cipYazi,
    { color: secili ? colors.primary : colors.textSecondary },
    secili && { fontWeight: '800' },
  ])

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* Tür */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>TALEP TÜRÜ *</Text>
        <View style={styles.turIzgara}>
          {portalTurleri.map((t) => {
            const secili = anaTur === t.id
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.turKart,
                  {
                    backgroundColor: secili ? `${t.renk}18` : colors.surface,
                    borderColor: secili ? t.renk : colors.border,
                  },
                ]}
                onPress={() => { setAnaTur(t.id); setAltKategori('') }}
                activeOpacity={0.8}
              >
                <Text style={styles.turIkon}>{t.ikon}</Text>
                <Text style={[styles.turAd, { color: secili ? t.renk : colors.textPrimary }]}>{t.isim}</Text>
                <Text style={[styles.turAciklama, { color: colors.textFaded }]} numberOfLines={2}>
                  {TUR_ACIKLAMA[t.id] || ''}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Alt kategori */}
        {altKategoriler.length > 0 && (
          <>
            <Text style={[styles.etiket, { color: colors.textMuted }]}>ALT KATEGORİ *</Text>
            <View style={styles.cipSarma}>
              {altKategoriler.map((k) => (
                <TouchableOpacity key={k.id} style={cipStil(altKategori === k.id)} onPress={() => setAltKategori(k.id)} activeOpacity={0.8}>
                  <Text style={cipYazi(altKategori === k.id)}>{k.isim}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Konu — sabit liste (mig 285) */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>KONU BAŞLIĞI *</Text>
        <View style={styles.cipSarma}>
          {konular.map((k) => (
            <TouchableOpacity key={k.id} style={cipStil(konu === k.ad)} onPress={() => setKonu(k.ad)} activeOpacity={0.8}>
              <Text style={cipYazi(konu === k.ad)}>{k.ad}</Text>
            </TouchableOpacity>
          ))}
          {konular.length === 0 && (
            <Text style={{ color: colors.textFaded, fontSize: 12 }}>Konu listesi yükleniyor…</Text>
          )}
        </View>

        {/* Açıklama */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>AÇIKLAMA *</Text>
        <TextInput
          style={[styles.cokSatir, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Sorunu ya da talebinizi ayrıntılı açıklayınız…"
          placeholderTextColor={colors.textMuted}
          value={aciklama}
          onChangeText={setAciklama}
          multiline
        />

        {/* Lokasyon */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>LOKASYON</Text>
        {lokasyonlar.length > 0 ? (
          <View style={styles.cipSarma}>
            <TouchableOpacity style={cipStil(lokasyonId == null)} onPress={() => setLokasyonId(null)} activeOpacity={0.8}>
              <Text style={cipYazi(lokasyonId == null)}>Belirtmeden gönder</Text>
            </TouchableOpacity>
            {lokasyonlar.map((l) => (
              <TouchableOpacity key={l.id} style={cipStil(String(lokasyonId) === String(l.id))} onPress={() => setLokasyonId(l.id)} activeOpacity={0.8}>
                <Text style={cipYazi(String(lokasyonId) === String(l.id))}>{l.ad}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Bina, kat, oda…"
            placeholderTextColor={colors.textMuted}
            value={lokasyonMetin}
            onChangeText={setLokasyonMetin}
          />
        )}
        <TextInput
          style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 8 }]}
          placeholder="Bina / kat / oda detayı (isteğe bağlı)"
          placeholderTextColor={colors.textMuted}
          value={altLokasyon}
          onChangeText={setAltLokasyon}
        />

        {/* Cihaz türü */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>CİHAZ / SİSTEM TÜRÜ</Text>
        <TextInput
          style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Kamera, NVR, PDKS…"
          placeholderTextColor={colors.textMuted}
          value={cihazTuru}
          onChangeText={setCihazTuru}
        />

        {/* Aciliyet */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>ACİLİYET</Text>
        <View style={styles.cipSarma}>
          {ACILIYET_SEVIYELERI.map((a) => (
            <TouchableOpacity key={a.id} style={cipStil(aciliyet === a.id)} onPress={() => setAciliyet(a.id)} activeOpacity={0.8}>
              <Text style={cipYazi(aciliyet === a.id)}>{a.ikon} {a.isim}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* İletişim */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>İLGİLİ KİŞİ</Text>
        <TextInput
          style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={ilgiliKisi}
          onChangeText={setIlgiliKisi}
          placeholder="Ad Soyad"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.etiket, { color: colors.textMuted }]}>TELEFON</Text>
        <TextInput
          style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={telefon}
          onChangeText={setTelefon}
          placeholder="0xxx xxx xx xx"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />

        {/* Ziyaret tarihi */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>TALEP EDİLEN ZİYARET TARİHİ</Text>
        <TarihSec
          value={ziyaretTarih}
          onChange={(iso) => setZiyaretTarih(iso || null)}
          placeholder="Tarih seçin (isteğe bağlı)"
          title="Ziyaret Tarihi"
        />
        {!!ziyaretTarih && (
          <View style={[styles.cipSarma, { marginTop: 8 }]}>
            {SAAT_SECENEKLERI.map((s) => (
              <TouchableOpacity
                key={s}
                style={cipStil(ziyaretSaat === s)}
                onPress={() => setZiyaretSaat(ziyaretSaat === s ? '' : s)}
                activeOpacity={0.8}
              >
                <Text style={cipYazi(ziyaretSaat === s)}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Foto/video — opsiyonel */}
        <Text style={[styles.etiket, { color: colors.textMuted }]}>FOTOĞRAF / VİDEO (İSTEĞE BAĞLI)</Text>
        <Text style={[styles.ipucu, { color: colors.textFaded }]}>
          Sorunu gösteren bir görsel, ekibin hızlı tanı koymasına yardımcı olur.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TouchableOpacity
            style={[styles.fotoButon, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => fotoEkle(true)}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={16} color={colors.primary} />
            <Text style={[styles.fotoButonText, { color: colors.textPrimary }]}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fotoButon, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => fotoEkle(false)}
            activeOpacity={0.8}
          >
            <Feather name="image" size={16} color={colors.primary} />
            <Text style={[styles.fotoButonText, { color: colors.textPrimary }]}>Galeri</Text>
          </TouchableOpacity>
        </View>
        {dosyalar.length > 0 && (
          <View style={styles.fotoOnizlemeSatir}>
            {dosyalar.map((d, i) => (
              <View key={`${d.uri}-${i}`} style={styles.fotoOnizleme}>
                <Image source={{ uri: d.uri }} style={styles.fotoKucuk} />
                <TouchableOpacity
                  style={[styles.fotoSil, { backgroundColor: colors.danger }]}
                  onPress={() => setDosyalar((prev) => prev.filter((_, x) => x !== i))}
                >
                  <Feather name="x" size={11} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Gönder */}
        <TouchableOpacity
          style={[styles.gonderButon, { backgroundColor: colors.primary, opacity: gonderiliyor ? 0.6 : 1 }]}
          onPress={gonder}
          disabled={gonderiliyor}
          activeOpacity={0.85}
        >
          <Feather name="send" size={16} color="#fff" />
          <Text style={styles.gonderText}>{gonderiliyor ? 'Gönderiliyor…' : 'Talebi Gönder'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  etiket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 16, marginBottom: 7 },
  ipucu: { fontSize: 11.5, marginBottom: 8, lineHeight: 16 },

  turIzgara: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  turKart: { width: '48%', flexGrow: 1, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  turIkon: { fontSize: 20 },
  turAd: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  turAciklama: { fontSize: 11, marginTop: 3, lineHeight: 15 },

  cipSarma: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  cipYazi: { fontSize: 12.5, fontWeight: '600' },

  girdi: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  cokSatir: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, minHeight: 90, textAlignVertical: 'top',
  },

  fotoButon: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
  },
  fotoButonText: { fontSize: 13, fontWeight: '700' },
  fotoOnizlemeSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fotoOnizleme: { position: 'relative' },
  fotoKucuk: { width: 64, height: 64, borderRadius: 8 },
  fotoSil: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  gonderButon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginTop: 22,
  },
  gonderText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
