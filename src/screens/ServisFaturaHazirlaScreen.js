// Servis Faturası Hazırla — teknisyen fiyatları GİRER, sonra muhasebeye gönderir.
//
// Neden var (12.08.2026 kullanıcı isteği): Eskiden "Fatura Kesilecek" tek bir
// onay kutusuydu; proforma FİYATSIZ açılıyordu ve faturayı kesen Abdullah
// bomboş bir belge görüyordu — ne yapıldığını, hangi malzemenin kullanıldığını
// bilmeden tutar giriyordu. Artık işi yapan kişi kalem kalem fiyatlıyor,
// muhasebe hazır ve dökümlü bir proforma alıyor.
//
// ⚠️ Fiyatlar MANUEL girilir (kullanıcı kararı) — stok kartından otomatik
// çekilmez; saha fiyatı işe/müşteriye göre değişiyor.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { servisTalepGetir } from '../services/servisService'
import { formEnvanterKalemleri } from '../services/servisMalzemeService'
import { servistenFaturaTalebiAc, bakimKapsamiMi } from '../services/faturaService'
import { faturaHesapla, paraMetni, sayi } from '../lib/faturaHesap'

const KDV_SECENEK = [20, 18, 10, 1, 0]

export default function ServisFaturaHazirlaScreen({ route, navigation }) {
  const { servisTalepId } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const [talep, setTalep] = useState(null)
  const [kalemler, setKalemler] = useState([])
  const [not, setNot] = useState('')
  const [loading, setLoading] = useState(true)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  // ⚠️ useState tek başına yetmez: hızlı çift dokunmada state henüz
  // güncellenmemiş olur ve ikinci dokunuş kapıdan geçip İKİNCİ proforma açar.
  const gonderKilidi = useRef(false)

  useEffect(() => { navigation.setOptions({ title: 'Servis Faturası' }) }, [navigation])

  const yukle = useCallback(async () => {
    setLoading(true)
    try {
      const [t, malzemeler] = await Promise.all([
        servisTalepGetir(servisTalepId),
        formEnvanterKalemleri(servisTalepId).catch(() => []),
      ])
      setTalep(t)
      setKalemler((malzemeler || []).map((m, i) => ({
        anahtar: `m-${m.id ?? i}`,
        stokKodu: m.stokKodu || '',
        urunAdi: m.seriNo ? `${m.urunAdi || ''} (S/N: ${m.seriNo})` : (m.urunAdi || ''),
        miktar: String(m.miktar ?? 1),
        birim: m.birim || 'Adet',
        birimFiyat: '',
        kdvOran: 20,
        malzeme: true,
      })))
    } finally {
      setLoading(false)
    }
  }, [servisTalepId])

  useEffect(() => { yukle() }, [yukle])

  const hesap = useMemo(() => faturaHesapla(kalemler), [kalemler])
  // Bakım anlaşması kapsamındaki işte bedel alınmaz (mig 282) — teknisyen
  // boşuna fiyat girmesin, muhasebe de tutar beklemesin.
  const bakimKapsami = bakimKapsamiMi(talep)

  const satirGuncelle = (anahtar, alan, deger) =>
    setKalemler(k => k.map(s => (s.anahtar === anahtar ? { ...s, [alan]: deger } : s)))

  const satirSil = (anahtar) =>
    setKalemler(k => k.filter(s => s.anahtar !== anahtar))

  const isciligiEkle = () =>
    setKalemler(k => [...k, {
      anahtar: `e-${Date.now()}-${k.length}`,
      stokKodu: '', urunAdi: '', miktar: '1', birim: 'Adet',
      birimFiyat: '', kdvOran: 20, malzeme: false,
    }])

  const gonder = async () => {
    if (gonderKilidi.current) return

    const adsiz = kalemler.filter(k => !String(k.urunAdi || '').trim()).length
    if (adsiz > 0) {
      Alert.alert('Eksik satır', `${adsiz} satırda açıklama yazılmamış. Faturada ne görüneceğini yazın.`)
      return
    }
    // ⚠️ Bakım kapsamında tutar ARANMAZ — bedel zaten alınmıyor.
    if (!bakimKapsami && kalemler.length === 0) {
      Alert.alert('Kalem yok', 'En az bir kalem girin — işçilik satırı da ekleyebilirsiniz.')
      return
    }
    if (!bakimKapsami && hesap.genelToplam <= 0) {
      Alert.alert('Tutar girilmemiş', 'Fatura tutarı sıfır görünüyor. En az bir kaleme fiyat girin.')
      return
    }

    const devam = await new Promise(cevap => {
      const fiyatsiz = hesap.fiyatsizSatir
      Alert.alert(
        bakimKapsami ? 'Bakım Kapsamında Gönder' : 'Muhasebeye Gönder',
        (bakimKapsami
          ? 'Bu iş bakım anlaşması kapsamında — bedel alınmıyor.\n\nKullanılan malzemeler kayıt için gönderilecek, tutar istenmeyecek.'
          : `Genel toplam ${paraMetni(hesap.genelToplam)} (KDV dahil).`
            + (fiyatsiz > 0 ? `\n\n⚠️ ${fiyatsiz} satırın fiyatı boş — bu satırlar 0 TL gidecek.` : ''))
        + '\n\nProforma açılıp fatura kesecek kişiye gönderilsin mi?',
        [
          { text: 'Vazgeç', style: 'cancel', onPress: () => cevap(false) },
          { text: 'Gönder', onPress: () => cevap(true) },
        ],
        { cancelable: true, onDismiss: () => cevap(false) },
      )
    })
    if (!devam) return

    gonderKilidi.current = true
    setGonderiliyor(true)
    try {
      const sonuc = await servistenFaturaTalebiAc({
        servis: talep, kullanici, not, kalemler,
      })
      if (sonuc?._hata) { Alert.alert('Gönderilemedi', sonuc._hata); return }
      Alert.alert(
        'Gönderildi',
        `${sonuc.talepNo} oluşturuldu — fatura kuyruğuna eklendi.`,
        [{ text: 'Tamam', onPress: () => navigation.goBack() }],
      )
    } catch (e) {
      Alert.alert('Gönderilemedi', e?.message || 'Bilinmeyen hata')
    } finally {
      gonderKilidi.current = false
      setGonderiliyor(false)
    }
  }

  const s = stiller(colors)

  if (loading) {
    return (
      <ScreenContainer>
        <View style={s.ortala}><ActivityIndicator size="large" color={colors.primary} /></View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          {/* Yapılan iş — muhasebe bunu görecek, teknisyen doğruluğunu teyit etsin */}
          <View style={s.kart}>
            <Text style={s.kartBaslik}>YAPILAN İŞ</Text>
            <Text style={s.konu}>{talep?.konu || '—'}</Text>
            {!!talep?.firmaAdi && <Text style={s.altMetin}>{talep.firmaAdi}</Text>}
            {!!talep?.cozumAciklamasi && (
              <>
                <Text style={s.etiket}>Çözüm açıklaması</Text>
                <Text style={s.govde}>{talep.cozumAciklamasi}</Text>
              </>
            )}
            {!talep?.cozumAciklamasi && (
              <Text style={s.uyariMetin}>
                Çözüm açıklaması boş. Faturayı kesen kişi ne yapıldığını göremez —
                servis detayından doldurmanız önerilir.
              </Text>
            )}
          </View>

          {/* Bakım kapsamı bandı — fiyat girmesi gerekmediğini net söyler */}
          {bakimKapsami && (
            <View style={[s.kart, { borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.10)' }]}>
              <Text style={[s.kartBaslik, { color: '#0ea5e9' }]}>BAKIM ANLAŞMASI KAPSAMINDA</Text>
              <Text style={s.govde}>
                Bu iş bakım anlaşması kapsamında — müşteriden bedel alınmıyor.
                Fiyat girmenize gerek yok; kullanılan malzemeler kayıt için gönderilir.
              </Text>
            </View>
          )}

          {/* Kalemler */}
          <View style={s.kart}>
            <View style={s.satirArasi}>
              <Text style={s.kartBaslik}>
                {bakimKapsami ? 'KULLANILAN MALZEMELER' : 'FATURA KALEMLERİ'}
              </Text>
              <Text style={s.altMetin}>{kalemler.length} satır</Text>
            </View>

            {kalemler.length === 0 && (
              <Text style={s.uyariMetin}>
                Serviste kullanılmış malzeme bulunamadı. İşçilik veya serbest kalem ekleyin.
              </Text>
            )}

            {kalemler.map(k => {
              const satirNet = sayi(k.miktar) * sayi(k.birimFiyat)
              return (
                <View key={k.anahtar} style={s.kalem}>
                  <View style={s.kalemBaslikSatir}>
                    {k.malzeme ? (
                      <Text style={s.kalemAd} numberOfLines={2}>{k.urunAdi}</Text>
                    ) : (
                      <TextInput
                        style={[s.girdi, s.adGirdi]}
                        value={k.urunAdi}
                        onChangeText={v => satirGuncelle(k.anahtar, 'urunAdi', v)}
                        placeholder="İşçilik / açıklama"
                        placeholderTextColor={colors.textMuted}
                      />
                    )}
                    <TouchableOpacity onPress={() => satirSil(k.anahtar)} style={s.silDugme} hitSlop={8}>
                      <Feather name="x" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {!!k.stokKodu && <Text style={s.stokKod}>{k.stokKodu}</Text>}

                  <View style={s.girdiSatir}>
                    <View style={s.girdiKutu}>
                      <Text style={s.girdiEtiket}>Miktar</Text>
                      <TextInput
                        style={s.girdi}
                        value={k.miktar}
                        onChangeText={v => satirGuncelle(k.anahtar, 'miktar', v)}
                        keyboardType="decimal-pad"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={[s.girdiKutu, { flex: 1.4 }]}>
                      <Text style={s.girdiEtiket}>Birim fiyat (₺)</Text>
                      <TextInput
                        style={s.girdi}
                        value={k.birimFiyat}
                        onChangeText={v => satirGuncelle(k.anahtar, 'birimFiyat', v)}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={s.kdvSatir}>
                    <Text style={s.girdiEtiket}>KDV</Text>
                    <View style={s.kdvGrup}>
                      {KDV_SECENEK.map(o => (
                        <TouchableOpacity
                          key={o}
                          onPress={() => satirGuncelle(k.anahtar, 'kdvOran', o)}
                          style={[s.kdvDugme, k.kdvOran === o && s.kdvDugmeSecili]}
                        >
                          <Text style={[s.kdvMetin, k.kdvOran === o && s.kdvMetinSecili]}>%{o}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.satirToplam}>{paraMetni(satirNet)}</Text>
                  </View>
                </View>
              )
            })}

            <TouchableOpacity onPress={isciligiEkle} style={s.ekleDugme}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={s.ekleMetin}>İşçilik / kalem ekle</Text>
            </TouchableOpacity>
          </View>

          {/* Toplam — bakim kapsaminda gosterilmez (bedel yok) */}
          {!bakimKapsami && (
          <View style={s.kart}>
            <Text style={s.kartBaslik}>TOPLAM</Text>
            <View style={s.toplamSatir}>
              <Text style={s.toplamEtiket}>Ara toplam</Text>
              <Text style={s.toplamDeger}>{paraMetni(hesap.araToplam)}</Text>
            </View>
            {Object.entries(hesap.kdvKirilimi)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([oran, tutar]) => (
                <View key={oran} style={s.toplamSatir}>
                  <Text style={s.toplamEtiket}>KDV %{oran}</Text>
                  <Text style={s.toplamDeger}>{paraMetni(tutar)}</Text>
                </View>
              ))}
            <View style={[s.toplamSatir, s.genelSatir]}>
              <Text style={s.genelEtiket}>Genel toplam</Text>
              <Text style={s.genelDeger}>{paraMetni(hesap.genelToplam)}</Text>
            </View>
            {hesap.fiyatsizSatir > 0 && (
              <Text style={s.uyariMetin}>
                {hesap.fiyatsizSatir} satırın fiyatı boş — bu satırlar faturaya 0 TL olarak gider.
              </Text>
            )}
          </View>
          )}

          {/* Muhasebeye not */}
          <View style={s.kart}>
            <Text style={s.kartBaslik}>MUHASEBEYE NOT (opsiyonel)</Text>
            <TextInput
              style={[s.girdi, s.notGirdi]}
              value={not}
              onChangeText={setNot}
              placeholder="Faturayı kesecek kişiye iletmek istediğiniz not…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={gonder}
            disabled={gonderiliyor}
            style={[s.gonderDugme, gonderiliyor && s.gonderPasif]}
          >
            {gonderiliyor
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Feather name="send" size={17} color="#fff" />
                  <Text style={s.gonderMetin}>{bakimKapsami ? 'Bakım Kapsamında Gönder' : 'Muhasebeye Gönder'}</Text>
                </>
              )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const stiller = (c) => StyleSheet.create({
  ortala: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kart: {
    backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: c.border,
  },
  kartBaslik: {
    fontSize: 11, fontWeight: '700', color: c.textMuted,
    letterSpacing: 0.6, marginBottom: 8,
  },
  satirArasi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  konu: { fontSize: 15, fontWeight: '600', color: c.textPrimary, marginBottom: 2 },
  altMetin: { fontSize: 12, color: c.textSecondary },
  etiket: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginTop: 10, marginBottom: 3 },
  govde: { fontSize: 13, color: c.textPrimary, lineHeight: 19 },
  uyariMetin: { fontSize: 12, color: '#B77516', lineHeight: 18, marginTop: 8 },

  kalem: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, marginTop: 10 },
  kalemBaslikSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  kalemAd: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textPrimary },
  silDugme: { padding: 4 },
  stokKod: { fontSize: 11, color: c.textMuted, marginTop: 2 },

  girdiSatir: { flexDirection: 'row', gap: 10, marginTop: 8 },
  girdiKutu: { flex: 1 },
  girdiEtiket: { fontSize: 11, color: c.textMuted, marginBottom: 4 },
  girdi: {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: c.textPrimary,
    backgroundColor: c.background,
  },
  adGirdi: { flex: 1, fontWeight: '600' },
  notGirdi: { minHeight: 70, textAlignVertical: 'top' },

  kdvSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  kdvGrup: { flexDirection: 'row', gap: 4, flex: 1 },
  kdvDugme: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, borderColor: c.border,
  },
  kdvDugmeSecili: { backgroundColor: c.primary, borderColor: c.primary },
  kdvMetin: { fontSize: 11, color: c.textSecondary },
  kdvMetinSecili: { color: '#fff', fontWeight: '700' },
  satirToplam: { fontSize: 14, fontWeight: '700', color: c.textPrimary },

  toplamSatir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  toplamEtiket: { fontSize: 13, color: c.textSecondary },
  toplamDeger: { fontSize: 13, color: c.textPrimary, fontWeight: '600' },
  genelSatir: { borderTopWidth: 1, borderTopColor: c.border, marginTop: 6, paddingTop: 8 },
  genelEtiket: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  genelDeger: { fontSize: 17, fontWeight: '800', color: c.primary },

  ekleDugme: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: c.primary, borderStyle: 'dashed',
  },
  ekleMetin: { fontSize: 13, fontWeight: '600', color: c.primary },

  gonderDugme: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.primary, borderRadius: 12, paddingVertical: 15, marginTop: 4,
  },
  gonderPasif: { opacity: 0.6 },
  gonderMetin: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
