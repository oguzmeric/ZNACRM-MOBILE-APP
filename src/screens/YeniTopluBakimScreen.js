// Yeni Toplu Bakım — mobil (04.08 kullanıcı isteği: "mobilden de bakım
// açılabilsin, webteki gibi"). Web YeniTopluBakim.jsx ile AYNI alanlar ve
// aynı doğrulama kuralları; sözleşme alanı mobilde YOK (sözleşme servisi
// mobile taşınmadı, alan opsiyonel olduğu için akış bozulmuyor).
//
// Yetki: saha sorumlusu + admin. DB tarafında da zorunlu (tb_saha_insert RLS).
import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import SecimPicker from '../components/SecimPicker'
import CokluSecimPicker from '../components/CokluSecimPicker'
import TakvimPicker from '../components/TakvimPicker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { sahaSorumlusuMu, topluBakimOlustur } from '../services/topluBakimService'
import { musterileriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { kullanicilariGetir } from '../services/kullaniciService'
import { BAKIM_KALEMLERI } from '../lib/bakimSablon'
import { useKaydedilmemisUyari } from '../hooks/useKaydedilmemisUyari'

const ONCELIKLER = [
  { id: 'dusuk', isim: 'Düşük' },
  { id: 'normal', isim: 'Normal' },
  { id: 'yuksek', isim: 'Yüksek' },
  { id: 'acil', isim: 'Acil' },
]

const isoTarih = (d) => {
  // YYYY-MM-DD — toISOString() UTC'ye kaydırıp günü 1 geri atabiliyor
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const trTarih = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR') : ''

export default function YeniTopluBakimScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  // Kaydedilmemiş değişiklik koruması (beforeRemove) — kirlilik ref'te tutulur
  const kirliRef = useKaydedilmemisUyari(navigation)

  const [musteriler, setMusteriler] = useState([])
  const [personel, setPersonel] = useState([])
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [takvimAcik, setTakvimAcik] = useState(false)

  const [form, setForm] = useState({
    musteriId: null,
    lokasyonId: null,
    lokasyonAdres: '',
    bakimDonemi: '',
    planlananTarih: '',
    planlananSaat: '10:00',
    teknikPersonelId: null,
    ekipIds: [],
    musteriYetkiliAd: '',
    musteriYetkiliGorev: '',
    musteriYetkiliTel: '',
    aciklama: '',
    oncelik: 'normal',
  })
  const [secilenKalemler, setSecilenKalemler] = useState([])
  const set = (k, v) => { kirliRef.current = true; setForm((f) => ({ ...f, [k]: v })) }

  useFocusEffect(useCallback(() => {
    let iptal = false
    Promise.all([musterileriGetir(), kullanicilariGetir()])
      .then(([m, k]) => {
        if (iptal) return
        setMusteriler(m || [])
        setPersonel((k || []).filter((u) => u.tip !== 'musteri' && !u.hesapSilindi))
      })
      .catch((e) => console.warn('[yeniBakim] liste:', e?.message))
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, []))

  // Müşteri değişince lokasyonları tazele — eski müşterinin lokasyonu seçili kalmasın
  const musteriSec = async (mid) => {
    kirliRef.current = true
    setForm((f) => ({ ...f, musteriId: mid, lokasyonId: null, lokasyonAdres: '' }))
    setLokasyonlar([])
    if (!mid) return
    try { setLokasyonlar(await musteriLokasyonlariniGetir(mid) || []) }
    catch (e) { console.warn('[yeniBakim] lokasyon:', e?.message) }
  }

  const seciliLokasyon = useMemo(
    () => lokasyonlar.find((l) => String(l.id) === String(form.lokasyonId)),
    [lokasyonlar, form.lokasyonId],
  )

  const lokasyonSec = (lid) => {
    kirliRef.current = true
    const l = lokasyonlar.find((x) => String(x.id) === String(lid))
    setForm((f) => ({ ...f, lokasyonId: lid, lokasyonAdres: l?.adres || '' }))
  }

  const kalemToggle = (tip) => {
    kirliRef.current = true
    setSecilenKalemler((p) => p.includes(tip) ? p.filter((t) => t !== tip) : [...p, tip])
  }

  const kaydet = async () => {
    // Web ile BİREBİR aynı kurallar (lokasyon opsiyonel — 24.07 kararı)
    if (!form.musteriId) { Alert.alert('Eksik', 'Müşteri seçin.'); return }
    if (!form.planlananTarih) { Alert.alert('Eksik', 'Planlanan bakım tarihi seçin.'); return }
    if (!form.teknikPersonelId) { Alert.alert('Eksik', 'Görevli teknik personel seçin.'); return }
    if (secilenKalemler.length === 0) { Alert.alert('Eksik', 'En az bir bakım kalemi seçin.'); return }

    setKaydediliyor(true)
    const sonuc = await topluBakimOlustur({
      musteriId: Number(form.musteriId),
      lokasyonId: form.lokasyonId ? Number(form.lokasyonId) : null,
      lokasyonAdi: seciliLokasyon?.ad || null,
      lokasyonAdres: form.lokasyonAdres || null,
      bakimDonemi: form.bakimDonemi || null,
      planlananTarih: form.planlananTarih,
      planlananSaat: form.planlananSaat || null,
      teknikPersonelId: Number(form.teknikPersonelId),
      ekipIds: form.ekipIds.map(Number),
      musteriYetkiliAd: form.musteriYetkiliAd || null,
      musteriYetkiliGorev: form.musteriYetkiliGorev || null,
      musteriYetkiliTel: form.musteriYetkiliTel || null,
      aciklama: form.aciklama || null,
      oncelik: form.oncelik,
      durum: 'atandi',              // personel seçili → doğrudan atandı (web ile aynı)
      olusturanId: kullanici?.id,
      kalemTipleri: secilenKalemler,
    })
    setKaydediliyor(false)
    if (sonuc?.hata) { Alert.alert('Kaydedilemedi', sonuc.hata); return }
    kirliRef.current = false   // kayıt yazıldı — Alert dışına dokunulup kapatılsa da çıkışta sorma (22.08)
    Alert.alert('Oluşturuldu', `Toplu bakım açıldı: ${sonuc.tbNo}`, [
      { text: 'Tamam', onPress: () => { kirliRef.current = false; navigation.replace('BakimYap', { id: sonuc.id }) } },
    ])
  }

  if (!sahaSorumlusuMu(kullanici)) {
    return (
      <ScreenContainer>
        <View style={styles.ortala}>
          <Feather name="lock" size={30} color={colors.textFaded} />
          <Text style={{ color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>
            Yeni toplu bakım yalnız saha sorumluları tarafından açılabilir.
          </Text>
        </View>
      </ScreenContainer>
    )
  }

  if (yukleniyor) {
    return (
      <ScreenContainer>
        <View style={styles.ortala}><ActivityIndicator color={colors.primary} /></View>
      </ScreenContainer>
    )
  }

  const musteriSecenek = musteriler.map((m) => ({ id: String(m.id), isim: m.firma || m.ad || `#${m.id}` }))
  const lokasyonSecenek = lokasyonlar.map((l) => ({ id: String(l.id), isim: l.ad || `#${l.id}` }))
  const personelSecenek = personel.map((p) => ({ id: String(p.id), isim: p.ad }))
  // Ana görevli yardımcı ekipte tekrar seçilmesin
  const ekipSecenek = personelSecenek.filter((p) => p.id !== String(form.teknikPersonelId ?? ''))

  const Etiket = ({ children, zorunlu }) => (
    <Text style={[styles.etiket, { color: colors.textMuted }]}>
      {children}{zorunlu ? <Text style={{ color: '#ef4444' }}> *</Text> : null}
    </Text>
  )

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          <Text style={[styles.bolum, { color: colors.textPrimary }]}>MÜŞTERİ VE LOKASYON</Text>
          <Etiket zorunlu>Müşteri</Etiket>
          <SecimPicker
            deger={form.musteriId ? String(form.musteriId) : ''}
            onSec={musteriSec}
            secenekler={musteriSecenek}
            placeholder="Müşteri seç…"
          />

          {lokasyonlar.length > 0 && (
            <>
              <Etiket>Lokasyon (opsiyonel)</Etiket>
              <SecimPicker
                deger={form.lokasyonId ? String(form.lokasyonId) : ''}
                onSec={lokasyonSec}
                secenekler={lokasyonSecenek}
                placeholder="Lokasyon seç…"
              />
            </>
          )}

          <Etiket>Adres</Etiket>
          <TextInput
            value={form.lokasyonAdres}
            onChangeText={(v) => set('lokasyonAdres', v)}
            placeholder="Lokasyon seçilince otomatik dolar"
            placeholderTextColor={colors.textFaded}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          />

          <Text style={[styles.bolum, { color: colors.textPrimary }]}>PLANLAMA</Text>
          <Etiket zorunlu>Planlanan tarih</Etiket>
          <TouchableOpacity
            onPress={() => setTakvimAcik(true)}
            style={[styles.input, styles.satir, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: form.planlananTarih ? colors.textPrimary : colors.textFaded, fontSize: 14 }}>
              {form.planlananTarih ? trTarih(form.planlananTarih) : 'Tarih seç…'}
            </Text>
            <Feather name="calendar" size={17} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Etiket>Saat</Etiket>
              <TextInput
                value={form.planlananSaat}
                onChangeText={(v) => set('planlananSaat', v)}
                placeholder="10:00"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Etiket>Bakım dönemi</Etiket>
              <TextInput
                value={form.bakimDonemi}
                onChangeText={(v) => set('bakimDonemi', v)}
                placeholder="örn. 2026-Q3"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>
          </View>

          <Etiket>Öncelik</Etiket>
          <SecimPicker deger={form.oncelik} onSec={(v) => set('oncelik', v)} secenekler={ONCELIKLER} />

          <Text style={[styles.bolum, { color: colors.textPrimary }]}>GÖREVLENDİRME</Text>
          <Etiket zorunlu>Teknik personel</Etiket>
          <SecimPicker
            deger={form.teknikPersonelId ? String(form.teknikPersonelId) : ''}
            onSec={(v) => set('teknikPersonelId', v)}
            secenekler={personelSecenek}
            placeholder="Görevli seç…"
          />

          <Etiket>Yardımcı ekip</Etiket>
          <CokluSecimPicker
            degerler={form.ekipIds.map(String)}
            onChange={(v) => set('ekipIds', v)}
            secenekler={ekipSecenek}
            placeholder="Ekip seç (opsiyonel)…"
          />

          <Text style={[styles.bolum, { color: colors.textPrimary }]}>
            BAKIM KALEMLERİ <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <Text style={{ color: colors.textFaded, fontSize: 11.5, marginBottom: 8 }}>
            Sahada yapılacak sistemleri seçin — her biri ayrı form ve ayrı sonuç metni üretir.
          </Text>
          <View style={styles.kalemGrid}>
            {Object.entries(BAKIM_KALEMLERI).map(([tip, k]) => {
              const secili = secilenKalemler.includes(tip)
              return (
                <TouchableOpacity
                  key={tip}
                  onPress={() => kalemToggle(tip)}
                  activeOpacity={0.8}
                  style={[styles.kalemKart, {
                    backgroundColor: secili ? k.renk + '22' : colors.surface,
                    borderColor: secili ? k.renk : colors.border,
                  }]}
                >
                  <Feather name={k.ikon} size={16} color={secili ? k.renk : colors.textMuted} />
                  <Text style={{ color: secili ? k.renk : colors.textSecondary, fontSize: 12, fontWeight: secili ? '800' : '600', flex: 1 }}>
                    {k.isim}
                  </Text>
                  {secili && <Feather name="check" size={14} color={k.renk} />}
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.bolum, { color: colors.textPrimary }]}>MÜŞTERİ YETKİLİSİ</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Etiket>Ad soyad</Etiket>
              <TextInput
                value={form.musteriYetkiliAd}
                onChangeText={(v) => set('musteriYetkiliAd', v)}
                placeholder="Yetkili"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Etiket>Görevi</Etiket>
              <TextInput
                value={form.musteriYetkiliGorev}
                onChangeText={(v) => set('musteriYetkiliGorev', v)}
                placeholder="örn. Güvenlik amiri"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>
          </View>
          <Etiket>Telefon</Etiket>
          <TextInput
            value={form.musteriYetkiliTel}
            onChangeText={(v) => set('musteriYetkiliTel', v)}
            keyboardType="phone-pad"
            placeholder="05xx…"
            placeholderTextColor={colors.textFaded}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          />

          <Etiket>Açıklama / saha notu</Etiket>
          <TextInput
            value={form.aciklama}
            onChangeText={(v) => set('aciklama', v)}
            multiline
            textAlignVertical="top"
            placeholder="Teknisyene iletilecek not…"
            placeholderTextColor={colors.textFaded}
            style={[styles.input, { minHeight: 80, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          />

          <TouchableOpacity
            onPress={kaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
            style={[styles.kaydetBtn, { opacity: kaydediliyor ? 0.6 : 1 }]}
          >
            {kaydediliyor
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="check-circle" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }}>Toplu Bakımı Oluştur</Text>
                </>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <TakvimPicker
        visible={takvimAcik}
        onClose={() => setTakvimAcik(false)}
        secili={form.planlananTarih}
        onSelect={(d) => {
          // TakvimPicker Date ya da 'YYYY-MM-DD' verebiliyor — ikisini de karşıla
          set('planlananTarih', d instanceof Date ? isoTarih(d) : String(d || ''))
          setTakvimAcik(false)
        }}
        title="Planlanan Bakım Tarihi"
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  ortala: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  bolum: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 },
  etiket: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  satir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kalemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kalemKart: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 11,
  },
  kaydetBtn: {
    marginTop: 22, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
})
