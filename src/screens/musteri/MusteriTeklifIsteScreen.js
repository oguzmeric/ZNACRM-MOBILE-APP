// Müşteri portalı — Teklif İste (webdeki TeklifIste'nin mobil karşılığı).
// Katalog: portal_katalog GÖRÜNÜMÜ (mig 296 — fiyat/maliyet kolonu YOK).
// Gönderim: musteri_teklif_talepleri INSERT (talep_no DB trigger, mig 269;
// musteri_id kimlik bağı, mig 301). İki aşama: katalog → sepet & gönder.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Image, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  katalogUrunleriniGetir, kategorileriGetir, teklifTalebiGonder,
} from '../../services/portalService'
import { trIcerir } from '../../utils/trSearch'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'

// Kategori düğümü + tüm alt dalları (web dalIdleri ile aynı)
const dalIdleri = (kategoriler, id) => {
  const sonuc = new Set([id])
  let buldu = true
  while (buldu) {
    buldu = false
    for (const k of kategoriler) {
      if (k.ustId != null && sonuc.has(k.ustId) && !sonuc.has(k.id)) {
        sonuc.add(k.id); buldu = true
      }
    }
  }
  return sonuc
}

export default function MusteriTeklifIsteScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const [urunler, setUrunler] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState(null)
  const [arama, setArama] = useState('')
  const [seciliKategori, setSeciliKategori] = useState(null)
  const [sepet, setSepet] = useState([])          // { urun, adet }
  const [asama, setAsama] = useState('katalog')   // katalog | sepet
  const [aciklama, setAciklama] = useState('')
  const [butce, setButce] = useState('')
  const [iletisimKisi, setIletisimKisi] = useState(kullanici?.ad || '')
  const [telefon, setTelefon] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const yukle = useCallback(async () => {
    try {
      const [u, k] = await Promise.all([katalogUrunleriniGetir(), kategorileriGetir()])
      setUrunler(u ?? [])
      setKategoriler(k ?? [])
      setHata(null)
    } catch (e) {
      // ⚠️ Sessiz başarısızlık yasak — sebep ekranda, tekrar denenebilir
      console.warn('[teklif iste katalog]', e?.message)
      setHata(e?.message || 'Ürün kataloğu yüklenemedi')
    }
  }, [])

  const ilkRef = useRef(true)
  useEffect(() => {
    if (!ilkRef.current) return
    ilkRef.current = false
    yukle().finally(() => setLoading(false))
  }, [yukle])

  // Kök kategoriler — alt dallar dahil ürün sayısıyla; boş olanlar gizli
  const kokKategoriler = useMemo(() => {
    const kokler = kategoriler.filter((k) => k.ustId == null)
    return kokler
      .map((k) => {
        const dal = dalIdleri(kategoriler, k.id)
        const adet = urunler.filter((u) => dal.has(u.kategoriId)).length
        return { ...k, dal, adet }
      })
      .filter((k) => k.adet > 0)
      .sort((a, b) => b.adet - a.adet)
  }, [kategoriler, urunler])

  const filtreli = useMemo(() => {
    let liste = urunler
    if (seciliKategori) {
      const kok = kokKategoriler.find((k) => k.id === seciliKategori)
      if (kok) liste = liste.filter((u) => kok.dal.has(u.kategoriId))
    }
    if (!arama.trim()) return liste
    return liste.filter((u) => trIcerir([u.stokAdi, u.marka, u.model, u.stokKodu], arama))
  }, [urunler, seciliKategori, kokKategoriler, arama])

  const sepetteki = (urunId) => sepet.find((s) => s.urun.id === urunId)

  const sepeteEkle = (urun) => {
    setSepet((prev) => {
      const v = prev.find((s) => s.urun.id === urun.id)
      if (v) return prev.map((s) => (s.urun.id === urun.id ? { ...s, adet: s.adet + 1 } : s))
      return [...prev, { urun, adet: 1 }]
    })
  }

  const adetGuncelle = (urunId, adet) => {
    if (adet <= 0) setSepet((prev) => prev.filter((s) => s.urun.id !== urunId))
    else setSepet((prev) => prev.map((s) => (s.urun.id === urunId ? { ...s, adet } : s)))
  }

  const gonder = async () => {
    if (gonderiliyor) return
    if (sepet.length === 0) { Alert.alert('Eksik bilgi', 'En az bir ürün seçiniz.'); return }
    if (!aciklama.trim()) { Alert.alert('Eksik bilgi', 'Açıklama giriniz (kullanım amacı, kurulum yeri…).'); return }
    setGonderiliyor(true)
    try {
      await teklifTalebiGonder({
        musteriId: kullanici?.musteriId ?? null,
        firmaAdi: kullanici?.firmaAdi || '',
        urunler: sepet.map((s) => ({
          isim: s.urun.stokAdi,
          adet: String(s.adet),
          stokKodu: s.urun.stokKodu,
          marka: s.urun.marka || '',
          model: s.urun.model || '',
        })),
        aciklama: aciklama.trim(),
        butce: butce.trim(),
        iletisimKisi: iletisimKisi.trim(),
        telefon: telefon.trim(),
        durum: 'bekliyor',
      })
      Alert.alert(
        'Teklif Talebiniz Alındı ✅',
        'Satış ekibimiz seçtiğiniz ürünleri inceleyip en kısa sürede size teklif hazırlayacaktır.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      )
    } catch (e) {
      Alert.alert('Gönderilemedi', e?.message || 'Talebiniz gönderilemedi, lütfen tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (loading) return <ScreenContainer><LoadingState /></ScreenContainer>

  // ── SEPET & GÖNDER aşaması ────────────────────────────────────────────────
  if (asama === 'sepet') {
    return (
      <ScreenContainer>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.geriSatir} onPress={() => setAsama('katalog')} activeOpacity={0.7}>
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={[styles.geriText, { color: colors.primary }]}>Kataloğa dön</Text>
          </TouchableOpacity>

          <Text style={[styles.etiket, { color: colors.textMuted }]}>SEÇİLEN ÜRÜNLER ({sepet.length})</Text>
          {sepet.length === 0 && (
            <Text style={{ color: colors.textFaded, fontSize: 13 }}>Sepetiniz boş — katalogdan ürün seçin.</Text>
          )}
          {sepet.map(({ urun, adet }) => (
            <View key={urun.id} style={[styles.sepetSatir, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.sepetAd, { color: colors.textPrimary }]} numberOfLines={2}>{urun.stokAdi}</Text>
                {!!(urun.marka || urun.model) && (
                  <Text style={[styles.sepetMarka, { color: colors.textMuted }]} numberOfLines={1}>
                    {[urun.marka, urun.model].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <View style={styles.adetKutu}>
                <TouchableOpacity
                  style={[styles.adetButon, { borderColor: colors.border }]}
                  onPress={() => adetGuncelle(urun.id, adet - 1)}
                >
                  <Feather name="minus" size={13} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.adetText, { color: colors.textPrimary }]}>{adet}</Text>
                <TouchableOpacity
                  style={[styles.adetButon, { borderColor: colors.border }]}
                  onPress={() => adetGuncelle(urun.id, adet + 1)}
                >
                  <Feather name="plus" size={13} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={[styles.etiket, { color: colors.textMuted }]}>AÇIKLAMA *</Text>
          <TextInput
            style={[styles.cokSatir, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Kullanım amacı, kurulum yeri, özel istekler…"
            placeholderTextColor={colors.textMuted}
            value={aciklama}
            onChangeText={setAciklama}
            multiline
          />
          <Text style={[styles.etiket, { color: colors.textMuted }]}>BÜTÇE (İSTEĞE BAĞLI)</Text>
          <TextInput
            style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Örn: 50.000 TL"
            placeholderTextColor={colors.textMuted}
            value={butce}
            onChangeText={setButce}
          />
          <Text style={[styles.etiket, { color: colors.textMuted }]}>İLGİLİ KİŞİ</Text>
          <TextInput
            style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={iletisimKisi}
            onChangeText={setIletisimKisi}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.etiket, { color: colors.textMuted }]}>TELEFON</Text>
          <TextInput
            style={[styles.girdi, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="0xxx xxx xx xx"
            placeholderTextColor={colors.textMuted}
            value={telefon}
            onChangeText={setTelefon}
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={[styles.gonderButon, { backgroundColor: colors.primary, opacity: gonderiliyor || sepet.length === 0 ? 0.6 : 1 }]}
            onPress={gonder}
            disabled={gonderiliyor || sepet.length === 0}
            activeOpacity={0.85}
          >
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.gonderText}>{gonderiliyor ? 'Gönderiliyor…' : 'Teklif talebi gönder'}</Text>
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    )
  }

  // ── KATALOG aşaması ───────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="Ürün adı, marka, model veya kod ara…"
          placeholderTextColor={colors.textMuted}
          value={arama}
          onChangeText={setArama}
          autoCorrect={false}
        />
        {!!arama && (
          <TouchableOpacity onPress={() => setArama('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {kokKategoriler.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.kategoriSatir}
        >
          <TouchableOpacity
            style={[styles.cip, {
              backgroundColor: seciliKategori == null ? `${colors.primary}22` : colors.surface,
              borderColor: seciliKategori == null ? colors.primary : colors.border,
            }]}
            onPress={() => setSeciliKategori(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cipYazi, { color: seciliKategori == null ? colors.primary : colors.textSecondary }]}>
              Tümü ({urunler.length})
            </Text>
          </TouchableOpacity>
          {kokKategoriler.map((k) => {
            const secili = seciliKategori === k.id
            return (
              <TouchableOpacity
                key={k.id}
                style={[styles.cip, {
                  backgroundColor: secili ? `${colors.primary}22` : colors.surface,
                  borderColor: secili ? colors.primary : colors.border,
                }]}
                onPress={() => setSeciliKategori(secili ? null : k.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.cipYazi, { color: secili ? colors.primary : colors.textSecondary }]}>
                  {k.ad} ({k.adet})
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      <FlatList
        data={filtreli}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: sepet.length > 0 ? 90 : 30 }}
        ListEmptyComponent={
          hata ? (
            <EmptyState ikon="alert-triangle" baslik="Ürün kataloğu yüklenemedi" mesaj={hata} buton="Tekrar dene" onPress={() => { setLoading(true); yukle().finally(() => setLoading(false)) }} />
          ) : (
            <EmptyState ikon="package" baslik="Ürün bulunamadı" mesaj="Arama veya kategori seçimini genişletmeyi deneyin." />
          )
        }
        renderItem={({ item }) => {
          const secili = sepetteki(item.id)
          return (
            <TouchableOpacity
              style={[styles.urunKart, {
                backgroundColor: secili ? `${colors.primary}12` : colors.surface,
                borderColor: secili ? colors.primary : colors.border,
              }]}
              onPress={() => sepeteEkle(item)}
              activeOpacity={0.75}
            >
              {item.gorselUrl ? (
                <Image source={{ uri: item.gorselUrl }} style={styles.urunGorsel} resizeMode="contain" />
              ) : (
                <View style={[styles.urunGorsel, styles.gorselYok, { backgroundColor: colors.surfaceDark }]}>
                  <Feather name="package" size={20} color={colors.textFaded} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.urunAd, { color: colors.textPrimary }]} numberOfLines={2}>{item.stokAdi}</Text>
                {!!(item.marka || item.model) && (
                  <Text style={[styles.urunMarka, { color: colors.textMuted }]} numberOfLines={1}>
                    {[item.marka, item.model].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {secili ? (
                <View style={styles.adetKutu}>
                  <TouchableOpacity
                    style={[styles.adetButon, { borderColor: colors.border }]}
                    onPress={(e) => { e.stopPropagation?.(); adetGuncelle(item.id, secili.adet - 1) }}
                  >
                    <Feather name="minus" size={13} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.adetText, { color: colors.primary }]}>{secili.adet}</Text>
                  <TouchableOpacity
                    style={[styles.adetButon, { borderColor: colors.border }]}
                    onPress={(e) => { e.stopPropagation?.(); adetGuncelle(item.id, secili.adet + 1) }}
                  >
                    <Feather name="plus" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Feather name="plus-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          )
        }}
      />

      {/* Alt sepet şeridi */}
      {sepet.length > 0 && (
        <TouchableOpacity
          style={[styles.sepetSerit, { backgroundColor: colors.primary }]}
          onPress={() => setAsama('sepet')}
          activeOpacity={0.9}
        >
          <Feather name="shopping-cart" size={16} color="#fff" />
          <Text style={styles.sepetSeritText}>
            {sepet.length} ürün seçildi — Devam et
          </Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    marginHorizontal: 16, marginBottom: 8,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  kategoriSatir: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  cip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  cipYazi: { fontSize: 12, fontWeight: '600' },

  urunKart: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8,
  },
  urunGorsel: { width: 46, height: 46, borderRadius: 8 },
  gorselYok: { alignItems: 'center', justifyContent: 'center' },
  urunAd: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  urunMarka: { fontSize: 11, marginTop: 2 },

  adetKutu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adetButon: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  adetText: { fontSize: 14, fontWeight: '800', minWidth: 18, textAlign: 'center' },

  sepetSerit: {
    position: 'absolute', left: 16, right: 16, bottom: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  sepetSeritText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  geriSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  geriText: { fontSize: 13, fontWeight: '700' },

  etiket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 16, marginBottom: 7 },
  sepetSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  sepetAd: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  sepetMarka: { fontSize: 11, marginTop: 2 },

  girdi: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  cokSatir: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },

  gonderButon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, marginTop: 22,
  },
  gonderText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
