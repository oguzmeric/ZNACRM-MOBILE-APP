// Toplu Bakım ekranı — teknik personel TEK EKRANDAN çalışır (spec 7).
// Üstte ortak bilgiler + saha akış butonları (Yola Çıktım → Ulaştım → Başlat);
// altta YALNIZ saha sorumlusunun seçtiği kalemler. CCTV tam spec (8),
// diğer kalemler v1 genel şablon (9-13). Cevaplar anında kaydedilir,
// sekme geçişinde kaybolmaz. Kalem tamamlanınca sonuç metni OTOMATİK oluşur.
import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import ImzaCizModal from '../components/ImzaCizModal'
import { useTheme } from '../context/ThemeContext'
import {
  bakimGetir, yolaCiktim, lokasyonaUlastim, bakimiBaslat,
  durumGuncelle, kalemKaydet,
} from '../services/topluBakimService'
import {
  kalemBilgi, kalemDurumBilgi, tbDurumBilgi,
  YAPILAMADI_SEBEPLERI, KAYIT_CIHAZI_TURLERI, HDD_KAPASITELERI,
  SAAT_TARIH_SECENEKLERI, cctvDogrula, genelDogrula, arizaVarMi, sonucMetniUret,
} from '../lib/bakimSablon'

const fmtTarih = (t) => t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR') : '—'
const BAKIM_BASLADI_DURUMLAR = ['bakim_basladi', 'devam_ediyor', 'eksik_bakim', 'imza_bekleniyor']

export default function BakimYapScreen({ route }) {
  const { id } = route.params
  const { colors } = useTheme()
  const [tb, setTb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesgul, setMesgul] = useState(false)
  const [acikKalem, setAcikKalem] = useState(null)   // form modalındaki kalem
  // İmza akışı (F4 — spec 21-22): TEK müşteri imzası + en az bir personel imzası
  const [imzaModal, setImzaModal] = useState(null)   // 'musteri' | 'personel' | null
  const [yetkili, setYetkili] = useState(null)       // {ad, gorev, tel} — tb'den doldurulur

  const yukle = useCallback(async () => {
    const t = await bakimGetir(id)
    setTb(t)
    setLoading(false)
  }, [id])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const sahaAksiyon = async (fn) => {
    setMesgul(true)
    const g = await fn(id)
    setMesgul(false)
    if (g) setTb((prev) => ({ ...prev, ...g }))
    else Alert.alert('Hata', 'İşlem kaydedilemedi.')
  }

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }
  if (!tb) {
    return <ScreenContainer><Text style={{ color: colors.textMuted, marginTop: 32, textAlign: 'center' }}>Bakım işi bulunamadı.</Text></ScreenContainer>
  }

  const d = tbDurumBilgi(tb.durum)
  const basladi = BAKIM_BASLADI_DURUMLAR.includes(tb.durum) || tb.durum === 'tamamlandi'
  const sonuclanan = tb.kalemler.filter((k) => ['tamamlandi', 'ariza_tespit', 'yapilamadi'].includes(k.durum)).length
  const oran = tb.kalemler.length ? Math.round((sonuclanan / tb.kalemler.length) * 100) : 0
  const hepsiSonuclandi = sonuclanan === tb.kalemler.length && tb.kalemler.length > 0
  const kilitli = ['imza_bekleniyor', 'tamamlandi', 'iptal', 'yonetici_kontrolunde', 'musteriye_gonderildi'].includes(tb.durum)

  const tumunuTamamla = async () => {
    // Spec 26: seçilen tüm kalemler sonuçlanmadan tamamlanamaz
    if (!hepsiSonuclandi) { Alert.alert('Eksik', 'Tüm bakım kalemleri sonuçlanmadan tamamlanamaz.'); return }
    const g = await durumGuncelle(id, 'imza_bekleniyor', { bitisTarih: new Date().toISOString() })
    if (g) {
      setTb((prev) => ({ ...prev, ...g }))
      Alert.alert('Hazır', 'Bakım kalemleri tamamlandı. İmza ve tamamlama adımı yakında eklenecek (F4) — iş "İmza Bekleniyor" durumuna alındı.')
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Üst bilgi — sabit ortak alanlar (spec 7) */}
        <View style={[styles.ustKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#3b82f6', fontWeight: '800', fontSize: 15 }}>{tb.tbNo}</Text>
            <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
              <Text style={{ color: d.renk, fontSize: 11, fontWeight: '700' }}>{d.isim}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginTop: 6 }}>{tb.musteriFirma || '—'}</Text>
          {!!tb.lokasyonAdi && <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>📍 {tb.lokasyonAdi}</Text>}
          {!!tb.lokasyonAdres && <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 2 }}>{tb.lokasyonAdres}</Text>}
          <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 4 }}>
            🗓 {fmtTarih(tb.planlananTarih)}{tb.planlananSaat ? ` · ${tb.planlananSaat}` : ''}
          </Text>
          {!!tb.musteriYetkiliAd && (
            <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 2 }}>
              👤 {tb.musteriYetkiliAd}{tb.musteriYetkiliTel ? ` · ${tb.musteriYetkiliTel}` : ''}
            </Text>
          )}
          {!!tb.aciklama && (
            <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.08)' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 }}>💬 {tb.aciklama}</Text>
            </View>
          )}
        </View>

        {/* Saha akış butonları */}
        {!kilitli && !basladi && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {tb.durum === 'atandi' || tb.durum === 'planlandi' ? (
              <AkisButon renk="#3b82f6" ikon="navigation" metin="Yola Çıktım" mesgul={mesgul} onPress={() => sahaAksiyon(yolaCiktim)} />
            ) : tb.durum === 'yola_cikildi' ? (
              <AkisButon renk="#f59e0b" ikon="map-pin" metin="Lokasyona Ulaştım" mesgul={mesgul} onPress={() => sahaAksiyon(lokasyonaUlastim)} />
            ) : tb.durum === 'lokasyona_ulasildi' ? (
              <AkisButon renk="#22c55e" ikon="play" metin="Toplu Bakımı Başlat" mesgul={mesgul} onPress={() => sahaAksiyon(bakimiBaslat)} />
            ) : null}
          </View>
        )}

        {/* İlerleme + kalemler */}
        {basladi && (
          <>
            <View style={{ marginTop: 14, marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>BAKIM KALEMLERİ</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{sonuclanan}/{tb.kalemler.length} · %{oran}</Text>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' }}>
                <View style={{ width: `${oran}%`, height: '100%', backgroundColor: oran === 100 ? '#22c55e' : '#3b82f6' }} />
              </View>
            </View>

            {tb.kalemler.map((k) => {
              const kb = kalemBilgi(k.kalemTip)
              const kd = kalemDurumBilgi(k.durum)
              return (
                <TouchableOpacity
                  key={k.id}
                  style={[styles.kalemKart, { backgroundColor: colors.surface, borderLeftColor: kb.renk, borderColor: colors.border }]}
                  onPress={() => !kilitli && setAcikKalem(k)}
                  activeOpacity={kilitli ? 1 : 0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Feather name={kb.ikon} size={17} color={kb.renk} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13.5 }}>{kb.isim}</Text>
                      <Text style={{ color: colors.textFaded, fontSize: 10.5 }}>{k.altNo}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <View style={[styles.chip, { backgroundColor: kd.renk + '22', borderColor: kd.renk }]}>
                      <Text style={{ color: kd.renk, fontSize: 10.5, fontWeight: '700' }}>{kd.isim}</Text>
                    </View>
                    {k.arizaVar && <Text style={{ fontSize: 10 }}>⚠️ Arıza</Text>}
                  </View>
                </TouchableOpacity>
              )
            })}

            {/* Özet — sonuç metinleri (spec 20) */}
            {tb.kalemler.some((k) => k.sonucMetni) && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>BAKIM ÖZETİ</Text>
                {tb.kalemler.filter((k) => k.sonucMetni).map((k) => (
                  <View key={k.id} style={[styles.ozetKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={{ color: kalemBilgi(k.kalemTip).renk, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>
                      {kalemBilgi(k.kalemTip).isim}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 19 }}>{k.sonucMetni}</Text>
                  </View>
                ))}
              </View>
            )}

            {!kilitli && (
              <TouchableOpacity
                style={[styles.tamamlaBtn, { opacity: hepsiSonuclandi ? 1 : 0.45 }]}
                onPress={tumunuTamamla}
                activeOpacity={0.85}
              >
                <Feather name="check-circle" size={17} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Tümünü Tamamla ve İmzaya Geç</Text>
              </TouchableOpacity>
            )}
            {/* ── İMZA VE TAMAMLAMA (F4 — spec 21-22-26) ── */}
            {(tb.durum === 'imza_bekleniyor' || tb.durum === 'tamamlandi') && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>İMZA VE TAMAMLAMA</Text>

                {/* Müşteri yetkilisi bilgileri — imza öncesi zorunlu (spec 26) */}
                {tb.durum === 'imza_bekleniyor' && !tb.musteriImzaUrl && (
                  <View style={{ gap: 8, marginBottom: 10 }}>
                    <TextInput
                      value={(yetkili ?? { ad: tb.musteriYetkiliAd || '' }).ad}
                      onChangeText={(v) => setYetkili((p) => ({ ad: v, gorev: p?.gorev ?? tb.musteriYetkiliGorev ?? '', tel: p?.tel ?? tb.musteriYetkiliTel ?? '' }))}
                      placeholder="Müşteri yetkilisi adı soyadı *"
                      placeholderTextColor={colors.textFaded}
                      style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={(yetkili ?? { gorev: tb.musteriYetkiliGorev || '' }).gorev ?? ''}
                        onChangeText={(v) => setYetkili((p) => ({ ad: p?.ad ?? tb.musteriYetkiliAd ?? '', gorev: v, tel: p?.tel ?? tb.musteriYetkiliTel ?? '' }))}
                        placeholder="Görevi"
                        placeholderTextColor={colors.textFaded}
                        style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      />
                      <TextInput
                        value={(yetkili ?? { tel: tb.musteriYetkiliTel || '' }).tel ?? ''}
                        onChangeText={(v) => setYetkili((p) => ({ ad: p?.ad ?? tb.musteriYetkiliAd ?? '', gorev: p?.gorev ?? tb.musteriYetkiliGorev ?? '', tel: v }))}
                        placeholder="Telefon"
                        placeholderTextColor={colors.textFaded}
                        keyboardType="phone-pad"
                        style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      />
                    </View>
                  </View>
                )}

                {/* İmza kutuları */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <ImzaKutu
                    colors={colors}
                    etiket="Müşteri İmzası"
                    imza={tb.musteriImzaUrl}
                    kilitli={tb.durum === 'tamamlandi'}
                    onPress={() => {
                      const ad = (yetkili?.ad ?? tb.musteriYetkiliAd ?? '').trim()
                      if (!ad) { Alert.alert('Eksik', 'Önce müşteri yetkilisinin adını girin.'); return }
                      setImzaModal('musteri')
                    }}
                  />
                  <ImzaKutu
                    colors={colors}
                    etiket="Teknik Personel"
                    imza={tb.personelImzaUrl}
                    kilitli={tb.durum === 'tamamlandi'}
                    onPress={() => setImzaModal('personel')}
                  />
                </View>

                {tb.durum === 'imza_bekleniyor' && (
                  <TouchableOpacity
                    style={[styles.tamamlaBtn, { opacity: tb.musteriImzaUrl && tb.personelImzaUrl ? 1 : 0.45 }]}
                    onPress={async () => {
                      // Spec 26: iki imza olmadan toplu bakım TAMAMLANAMAZ
                      if (!tb.musteriImzaUrl || !tb.personelImzaUrl) {
                        Alert.alert('Eksik', 'Müşteri ve teknik personel imzaları alınmadan bakım tamamlanamaz.')
                        return
                      }
                      const g = await durumGuncelle(id, 'tamamlandi')
                      if (g) {
                        setTb((prev) => ({ ...prev, ...g }))
                        Alert.alert('Tamamlandı 🎉', `${tb.tbNo} toplu bakımı tamamlandı.`)
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name="award" size={17} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Toplu Bakımı Tamamla</Text>
                  </TouchableOpacity>
                )}
                {tb.durum === 'tamamlandi' && (
                  <Text style={{ color: '#22c55e', fontSize: 12.5, textAlign: 'center', marginTop: 10, fontWeight: '700' }}>
                    ✅ Bakım tamamlandı — formlar merkezden yazdırılabilir.
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* İmza çizimi — mevcut ortak modal (base64 döner) */}
      <ImzaCizModal
        visible={!!imzaModal}
        baslik={imzaModal === 'musteri' ? 'Müşteri Yetkilisi İmzası' : 'Teknik Personel İmzası'}
        onClose={() => setImzaModal(null)}
        onKaydet={async (base64) => {
          const simdi = new Date().toISOString()
          const patch = imzaModal === 'musteri'
            ? {
                musteriImzaUrl: base64,
                musteriImzaTarih: simdi,
                musteriYetkiliAd: (yetkili?.ad ?? tb.musteriYetkiliAd) || null,
                musteriYetkiliGorev: (yetkili?.gorev ?? tb.musteriYetkiliGorev) || null,
                musteriYetkiliTel: (yetkili?.tel ?? tb.musteriYetkiliTel) || null,
              }
            : { personelImzaUrl: base64, personelImzaTarih: simdi }
          const g = await durumGuncelle(id, 'imza_bekleniyor', patch)
          if (g) setTb((prev) => ({ ...prev, ...g }))
          else throw new Error('imza kaydedilemedi')
        }}
      />

      {/* Kalem formu — tam ekran modal */}
      <Modal visible={!!acikKalem} animationType="slide" onRequestClose={() => setAcikKalem(null)}>
        {acikKalem && (
          <KalemForm
            kalem={acikKalem}
            colors={colors}
            onKapat={() => setAcikKalem(null)}
            onKaydedildi={(guncel) => {
              setTb((prev) => ({
                ...prev,
                kalemler: prev.kalemler.map((x) => (x.id === guncel.id ? guncel : x)),
              }))
              setAcikKalem(null)
            }}
          />
        )}
      </Modal>
    </ScreenContainer>
  )
}

function ImzaKutu({ colors, etiket, imza, kilitli, onPress }) {
  return (
    <TouchableOpacity
      style={{
        flex: 1, minHeight: 92, borderRadius: 10, borderWidth: 1.5,
        borderStyle: imza ? 'solid' : 'dashed',
        borderColor: imza ? '#22c55e' : colors.border,
        backgroundColor: imza ? '#ffffff' : colors.surface,
        alignItems: 'center', justifyContent: 'center', padding: 8,
      }}
      onPress={kilitli ? undefined : onPress}
      activeOpacity={kilitli ? 1 : 0.8}
    >
      {imza ? (
        <Image source={{ uri: imza }} style={{ width: '100%', height: 56 }} resizeMode="contain" />
      ) : (
        <Feather name="edit-3" size={20} color={colors.textFaded} />
      )}
      <Text style={{ color: imza ? '#16a34a' : colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
        {etiket}{imza ? ' ✓' : ''}
      </Text>
    </TouchableOpacity>
  )
}

function AkisButon({ renk, ikon, metin, mesgul, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.akisBtn, { backgroundColor: renk, opacity: mesgul ? 0.6 : 1 }]}
      onPress={onPress}
      disabled={mesgul}
      activeOpacity={0.85}
    >
      <Feather name={ikon} size={17} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{metin}</Text>
    </TouchableOpacity>
  )
}

// ─── Kalem Formu ─────────────────────────────────────────────────────────────

function KalemForm({ kalem, colors, onKapat, onKaydedildi }) {
  const kb = kalemBilgi(kalem.kalemTip)
  const cctvMi = kalem.kalemTip === 'cctv'
  const [c, setC] = useState(() => ({
    // CCTV varsayılanları
    kayitCihazlari: [],
    saatTarih: null,
    toplamKamera: '', calisanKamera: '', arizaliKamera: '',
    // Genel şablon varsayılanları
    adet: '', marka: '', boyut: '', sonucDurum: null, arizaliAdet: '', aciklama: '',
    ...(kalem.cevaplar || {}),
  }))
  const [yapilamadi, setYapilamadi] = useState(kalem.durum === 'yapilamadi')
  const [sebep, setSebep] = useState(kalem.yapilamadiSebep || null)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const set = (k, v) => setC((prev) => ({ ...prev, [k]: v }))

  // Ara kaydet — cevaplar kaybolmasın (spec 7); durum devam_ediyor olur.
  const araKaydet = async () => {
    setKaydediliyor(true)
    const g = await kalemKaydet(kalem.id, {
      cevaplar: c,
      durum: kalem.durum === 'baslanmadi' ? 'devam_ediyor' : kalem.durum,
      baslamaTarih: kalem.baslamaTarih || new Date().toISOString(),
    })
    setKaydediliyor(false)
    if (g) onKaydedildi(g)
    else Alert.alert('Hata', 'Kaydedilemedi.')
  }

  const tamamla = async () => {
    if (yapilamadi) {
      // Spec 16: yapılamayan sistem için gerçeğe aykırı sonuç ÜRETİLMEZ
      if (!sebep) { Alert.alert('Eksik', 'Bakım yapılamama sebebini seçin.'); return }
      setKaydediliyor(true)
      const g = await kalemKaydet(kalem.id, {
        durum: 'yapilamadi',
        yapilamadiSebep: sebep,
        cevaplar: c,
        sonucMetni: null,
        arizaVar: false,
        bitisTarih: new Date().toISOString(),
      })
      setKaydediliyor(false)
      if (g) onKaydedildi(g)
      return
    }

    const hata = cctvMi ? cctvDogrula(c) : genelDogrula(c)
    if (hata) { Alert.alert('Eksik bilgi', hata); return }

    const ariza = arizaVarMi(kalem.kalemTip, c)
    const metin = sonucMetniUret(kalem.kalemTip, c)
    setKaydediliyor(true)
    const g = await kalemKaydet(kalem.id, {
      cevaplar: c,
      durum: ariza ? 'ariza_tespit' : 'tamamlandi',
      arizaVar: ariza,
      sonucMetni: metin,
      yapilamadiSebep: null,
      baslamaTarih: kalem.baslamaTarih || new Date().toISOString(),
      bitisTarih: new Date().toISOString(),
    })
    setKaydediliyor(false)
    if (g) onKaydedildi(g)
    else Alert.alert('Hata', 'Kaydedilemedi.')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Başlık */}
      <View style={[styles.formBaslik, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Feather name={kb.ikon} size={18} color={kb.renk} />
          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>{kb.isim}</Text>
          <Text style={{ color: colors.textFaded, fontSize: 11 }}>{kalem.altNo}</Text>
        </View>
        <TouchableOpacity onPress={onKapat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Bakım yapılamadı anahtarı (spec 16) */}
        <TouchableOpacity
          style={[styles.yapilamadiSatir, { backgroundColor: yapilamadi ? 'rgba(245,158,11,0.12)' : colors.surface, borderColor: yapilamadi ? '#f59e0b' : colors.border }]}
          onPress={() => setYapilamadi((v) => !v)}
          activeOpacity={0.8}
        >
          <Feather name={yapilamadi ? 'check-square' : 'square'} size={18} color={yapilamadi ? '#f59e0b' : colors.textMuted} />
          <Text style={{ color: yapilamadi ? '#f59e0b' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
            Bu sistemin bakımı YAPILAMADI
          </Text>
        </TouchableOpacity>

        {yapilamadi ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={[styles.soru, { color: colors.textMuted }]}>Yapılamama sebebi</Text>
            {YAPILAMADI_SEBEPLERI.map((s) => (
              <SecimSatir key={s} colors={colors} secili={sebep === s} metin={s} onPress={() => setSebep(s)} />
            ))}
          </View>
        ) : cctvMi ? (
          <CctvForm c={c} set={set} colors={colors} />
        ) : (
          <GenelForm tip={kalem.kalemTip} c={c} set={set} colors={colors} />
        )}
      </ScrollView>

      {/* Alt butonlar */}
      <View style={[styles.formAlt, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        {!yapilamadi && (
          <TouchableOpacity
            style={[styles.altBtn, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}
            onPress={araKaydet}
            disabled={kaydediliyor}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Ara Kaydet</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.altBtn, { backgroundColor: yapilamadi ? '#f59e0b' : '#22c55e', flex: 1 }]}
          onPress={tamamla}
          disabled={kaydediliyor}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
            {kaydediliyor ? 'Kaydediliyor…' : yapilamadi ? 'Yapılamadı Olarak Kaydet' : 'Bakımı Tamamla'}
          </Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  )
}

// ─── CCTV formu (spec 8 — tam) ───────────────────────────────────────────────

function CctvForm({ c, set, colors }) {
  const cihazEkle = () =>
    set('kayitCihazlari', [...(c.kayitCihazlari || []), { tur: 'NVR', ad: '', kayitGun: '', hddler: {} }])

  const cihazGuncelle = (i, alan, deger) => {
    const yeni = [...c.kayitCihazlari]
    yeni[i] = { ...yeni[i], [alan]: deger }
    set('kayitCihazlari', yeni)
  }

  const cihazSil = (i) => set('kayitCihazlari', c.kayitCihazlari.filter((_, x) => x !== i))

  const hddDegistir = (i, kapasite, delta) => {
    const cihaz = c.kayitCihazlari[i]
    const mevcut = Number(cihaz.hddler?.[kapasite] || 0)
    // Kapasiteye ilk basış adet=1 yapar (spec 8.5)
    const yeni = Math.max(0, mevcut + delta)
    cihazGuncelle(i, 'hddler', { ...(cihaz.hddler || {}), [kapasite]: yeni })
  }

  return (
    <View style={{ marginTop: 14, gap: 16 }}>
      {/* 1) Kayıt cihazları */}
      <View>
        <Text style={[styles.soru, { color: colors.textMuted }]}>1) Kayıt Cihazları</Text>
        {(c.kayitCihazlari || []).map((k, i) => (
          <View key={i} style={[styles.cihazKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12.5 }}>Cihaz {i + 1}</Text>
              <TouchableOpacity onPress={() => cihazSil(i)}>
                <Feather name="trash-2" size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
            {/* Tür çipleri */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {KAYIT_CIHAZI_TURLERI.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.miniChip, { borderColor: k.tur === t ? '#3b82f6' : colors.border, backgroundColor: k.tur === t ? 'rgba(59,130,246,0.15)' : 'transparent' }]}
                  onPress={() => cihazGuncelle(i, 'tur', t)}
                >
                  <Text style={{ color: k.tur === t ? '#3b82f6' : colors.textMuted, fontSize: 11, fontWeight: '700' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput
                value={k.ad}
                onChangeText={(v) => cihazGuncelle(i, 'ad', v)}
                placeholder="Cihaz adı / sıra no (ops.)"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { flex: 1, backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary }]}
              />
              <TextInput
                value={String(k.kayitGun ?? '')}
                onChangeText={(v) => cihazGuncelle(i, 'kayitGun', v.replace(/[^0-9]/g, ''))}
                placeholder="Kayıt (gün)"
                placeholderTextColor={colors.textFaded}
                keyboardType="number-pad"
                style={[styles.input, { width: 100, backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>
            {/* HDD kapasiteleri — bas: 1, −/+ ile değiştir (spec 8.5) */}
            <Text style={{ color: colors.textFaded, fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 }}>HDD KAPASİTE / ADET</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {HDD_KAPASITELERI.map((kap) => {
                const adet = Number(k.hddler?.[kap] || 0)
                const secili = adet > 0
                return (
                  <View
                    key={kap}
                    style={[styles.hddKutu, { borderColor: secili ? '#3b82f6' : colors.border, backgroundColor: secili ? 'rgba(59,130,246,0.12)' : 'transparent' }]}
                  >
                    <TouchableOpacity onPress={() => !secili && hddDegistir(i, kap, 1)}>
                      <Text style={{ color: secili ? '#3b82f6' : colors.textMuted, fontSize: 11.5, fontWeight: '700' }}>{kap}</Text>
                    </TouchableOpacity>
                    {secili && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <TouchableOpacity onPress={() => hddDegistir(i, kap, -1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Feather name="minus-circle" size={15} color={colors.textMuted} />
                        </TouchableOpacity>
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 13 }}>{adet}</Text>
                        <TouchableOpacity onPress={() => hddDegistir(i, kap, 1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Feather name="plus-circle" size={15} color="#3b82f6" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        ))}
        <TouchableOpacity style={[styles.ekleBtn, { borderColor: '#3b82f6' }]} onPress={cihazEkle}>
          <Feather name="plus" size={14} color="#3b82f6" />
          <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 12.5 }}>Kayıt Cihazı / Sunucu Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* 2) Saat / tarih (spec 8.3) */}
      <View>
        <Text style={[styles.soru, { color: colors.textMuted }]}>2) Kamera ve kayıt sistemlerinin saat/tarih ayarları güncel mi?</Text>
        <View style={{ gap: 6, marginTop: 6 }}>
          {SAAT_TARIH_SECENEKLERI.map((s) => (
            <SecimSatir key={s.id} colors={colors} secili={c.saatTarih === s.id} metin={s.isim} onPress={() => set('saatTarih', s.id)} />
          ))}
        </View>
        {(c.saatTarih === 'guncel_degil' || c.saatTarih === 'kontrol_edilemedi') && (
          <Text style={{ color: '#f59e0b', fontSize: 11.5, marginTop: 6 }}>
            ⚠️ Bu seçimde sistem otomatik servis talebi oluşturacak.
          </Text>
        )}
      </View>

      {/* 3) Kamera sayıları (spec 8.4) */}
      <View>
        <Text style={[styles.soru, { color: colors.textMuted }]}>3) Kamera Sayıları</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <SayiKutu colors={colors} etiket="Toplam" deger={c.toplamKamera} onChange={(v) => set('toplamKamera', v)} />
          <SayiKutu colors={colors} etiket="Çalışan" deger={c.calisanKamera} onChange={(v) => set('calisanKamera', v)} />
          <SayiKutu colors={colors} etiket="Arızalı" deger={c.arizaliKamera} onChange={(v) => set('arizaliKamera', v)} vurgu={Number(c.arizaliKamera) > 0} />
        </View>
        {Number(c.toplamKamera) > 0 && Number(c.toplamKamera) !== Number(c.calisanKamera || 0) + Number(c.arizaliKamera || 0) && (
          <Text style={{ color: '#ef4444', fontSize: 11.5, marginTop: 6 }}>
            Toplam = Çalışan + Arızalı olmalı — sayılar eşleşmeden bakım tamamlanamaz.
          </Text>
        )}
        {Number(c.arizaliKamera) > 0 && (
          <Text style={{ color: '#f59e0b', fontSize: 11.5, marginTop: 4 }}>
            ⚠️ Arızalı kamera için otomatik servis talebi oluşturulacak.
          </Text>
        )}
      </View>
    </View>
  )
}

// ─── Genel form (turnike / ekran / alarm / sistem odası / fiber v1) ─────────

function GenelForm({ tip, c, set, colors }) {
  const adetli = tip === 'turnike' || tip === 'ekran_led'
  const markali = tip === 'ekran_led' || tip === 'sistem_odasi'
  return (
    <View style={{ marginTop: 14, gap: 14 }}>
      {adetli && (
        <View>
          <Text style={[styles.soru, { color: colors.textMuted }]}>{tip === 'turnike' ? 'Turnike adedi' : 'Ekran adedi'}</Text>
          <TextInput
            value={String(c.adet ?? '')}
            onChangeText={(v) => set('adet', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="adet"
            placeholderTextColor={colors.textFaded}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 6 }]}
          />
        </View>
      )}
      {markali && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.soru, { color: colors.textMuted }]}>Marka</Text>
            <TextInput
              value={c.marka ?? ''}
              onChangeText={(v) => set('marka', v)}
              placeholder={tip === 'sistem_odasi' ? 'örn. CANOVATE' : 'örn. SAMSUNG'}
              placeholderTextColor={colors.textFaded}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 6 }]}
            />
          </View>
          {tip === 'ekran_led' && (
            <View style={{ width: 110 }}>
              <Text style={[styles.soru, { color: colors.textMuted }]}>Boyut</Text>
              <TextInput
                value={c.boyut ?? ''}
                onChangeText={(v) => set('boyut', v)}
                placeholder="55 inç"
                placeholderTextColor={colors.textFaded}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 6 }]}
              />
            </View>
          )}
        </View>
      )}

      <View>
        <Text style={[styles.soru, { color: colors.textMuted }]}>Bakım sonucu</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TouchableOpacity
            style={[styles.sonucBtn, { borderColor: c.sonucDurum === 'sorunsuz' ? '#22c55e' : colors.border, backgroundColor: c.sonucDurum === 'sorunsuz' ? 'rgba(34,197,94,0.12)' : colors.surface }]}
            onPress={() => set('sonucDurum', 'sorunsuz')}
          >
            <Text style={{ color: c.sonucDurum === 'sorunsuz' ? '#22c55e' : colors.textMuted, fontWeight: '800', fontSize: 13 }}>✅ Sorunsuz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sonucBtn, { borderColor: c.sonucDurum === 'arizali' ? '#ef4444' : colors.border, backgroundColor: c.sonucDurum === 'arizali' ? 'rgba(239,68,68,0.12)' : colors.surface }]}
            onPress={() => set('sonucDurum', 'arizali')}
          >
            <Text style={{ color: c.sonucDurum === 'arizali' ? '#ef4444' : colors.textMuted, fontWeight: '800', fontSize: 13 }}>⚠️ Arızalı</Text>
          </TouchableOpacity>
        </View>
      </View>

      {c.sonucDurum === 'arizali' && (
        <View>
          <Text style={[styles.soru, { color: colors.textMuted }]}>Arızalı adet</Text>
          <TextInput
            value={String(c.arizaliAdet ?? '')}
            onChangeText={(v) => set('arizaliAdet', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="adet"
            placeholderTextColor={colors.textFaded}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 6 }]}
          />
          <Text style={{ color: '#f59e0b', fontSize: 11.5, marginTop: 6 }}>
            ⚠️ Arıza seçiminde otomatik servis talebi oluşturulacak.
          </Text>
        </View>
      )}

      <View>
        <Text style={[styles.soru, { color: colors.textMuted }]}>Ek açıklama (sonuç metnine eklenir)</Text>
        <TextInput
          value={c.aciklama ?? ''}
          onChangeText={(v) => set('aciklama', v)}
          multiline
          textAlignVertical="top"
          placeholder="Opsiyonel…"
          placeholderTextColor={colors.textFaded}
          style={[styles.input, { minHeight: 70, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 6 }]}
        />
      </View>
    </View>
  )
}

function SecimSatir({ colors, secili, metin, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.secimSatir, { borderColor: secili ? '#3b82f6' : colors.border, backgroundColor: secili ? 'rgba(59,130,246,0.10)' : colors.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Feather name={secili ? 'check-circle' : 'circle'} size={16} color={secili ? '#3b82f6' : colors.textFaded} />
      <Text style={{ color: secili ? colors.textPrimary : colors.textSecondary, fontSize: 13, flex: 1 }}>{metin}</Text>
    </TouchableOpacity>
  )
}

function SayiKutu({ colors, etiket, deger, onChange, vurgu }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: vurgu ? '#ef4444' : colors.textFaded, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{etiket}</Text>
      <TextInput
        value={String(deger ?? '')}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.textFaded}
        style={[styles.input, { textAlign: 'center', backgroundColor: colors.surface, borderColor: vurgu ? '#ef4444' : colors.border, color: colors.textPrimary }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ustKart: { padding: 14, borderRadius: 12, borderWidth: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  akisBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  kalemKart: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, borderLeftWidth: 3, marginTop: 8,
  },
  ozetKart: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  tamamlaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#22c55e', marginTop: 16,
  },

  formBaslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, borderBottomWidth: 1,
  },
  formAlt: {
    flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 28, borderTopWidth: 1,
  },
  altBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10,
  },
  yapilamadiSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  soru: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  secimSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 11, borderRadius: 9, borderWidth: 1,
  },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13.5 },
  cihazKart: { padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  miniChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  hddKutu: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', minWidth: 62,
  },
  ekleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 8,
  },
  sonucBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
})
