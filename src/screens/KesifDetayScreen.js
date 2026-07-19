// Keşif Detayı (mobile) — sahada asıl çalışılan ekran:
// notlar, keşif türleri, malzeme listesi (fiyatsız) ve fotoğraf çekimi.
// Dönüşümler (teklif/görev/servis) web panelinden yapılır.

import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import ScreenContainer from '../components/ScreenContainer'
import SecimPicker from '../components/SecimPicker'
import CokluSecimPicker from '../components/CokluSecimPicker'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { confirmSil } from '../lib/confirm'
import {
  kesifGetir, kesifGuncelle,
  kesifKalemleriGetir, kesifKalemEkle, kesifKalemSil,
  kesifFotolariGetir, kesifFotoYukle, kesifFotoSil, kesifFotoUrlleri,
  kesifFotoGuncelle, kesifFotoCizimKaydet, kesifFotoEtiketBilgi,
  KESIF_KATEGORILERI, KESIF_TURLERI, KESIF_DURUMLARI, KESIF_ONCELIKLERI,
  KESIF_FOTO_ETIKETLERI,
} from '../services/kesifService'
import KesifFotoCizimModal from '../components/KesifFotoCizimModal'

const BOS_FOTO_META = { baslik: '', aciklama: '', montajNotu: '', mahal: '', katBolum: '', etiket: '', kalemId: '' }

export default function KesifDetayScreen({ route, navigation }) {
  const { kesifId } = route.params
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()

  const [kesif, setKesif] = useState(null)
  const [kalemler, setKalemler] = useState([])
  const [fotolar, setFotolar] = useState([])
  const [fotoUrls, setFotoUrls] = useState({})
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  // Foto alt bilgi + çizim (KEŞİF DÜZENLEME dokümanı)
  const [metaModal, setMetaModal] = useState(null)     // { mod:'yeni', uri } | { mod:'duzenle', foto }
  const [fotoMeta, setFotoMeta] = useState(BOS_FOTO_META)
  const [metaKaydediliyor, setMetaKaydediliyor] = useState(false)
  const [cizilen, setCizilen] = useState(null)         // çizim yapılan foto
  const [cizimKaydediliyor, setCizimKaydediliyor] = useState(false)
  const [goruntule, setGoruntule] = useState(null)     // { foto, cizimli } — tam ekran görüntüleyici
  const [fotoMenuFoto, setFotoMenuFoto] = useState(null) // alt sayfa seçenek menüsü — HOOK'lar erken dönüşten ÖNCE!

  // Yeni kalem formu
  const [kKategori, setKKategori] = useState('kamera')
  const [kUrunAdi, setKUrunAdi] = useState('')
  const [kMarka, setKMarka] = useState('')
  const [kMiktar, setKMiktar] = useState('1')
  const [kNot, setKNot] = useState('')

  const yukle = useCallback(async () => {
    const [k, kal, fot] = await Promise.all([
      kesifGetir(kesifId),
      kesifKalemleriGetir(kesifId),
      kesifFotolariGetir(kesifId),
    ])
    setKesif(k)
    setKalemler(kal)
    setFotolar(fot)
    // Orijinal + çizimli yollar birlikte imzalanır
    setFotoUrls(await kesifFotoUrlleri(fot.flatMap(f => [f.dosyaYolu, f.cizimYolu]).filter(Boolean)))
    setYukleniyor(false)
    if (k?.kesifNo) navigation.setOptions({ title: k.kesifNo })
  }, [kesifId, navigation])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const inputStil = {
    height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    color: colors.textPrimary, fontSize: 15,
  }
  const labelStil = { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 }
  const bolumBaslik = { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 8 }

  if (yukleniyor || !kesif) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenContainer>
    )
  }

  const durum = KESIF_DURUMLARI.find(d => d.id === kesif.durum)
  const oncelik = KESIF_ONCELIKLERI.find(o => o.id === kesif.oncelik)

  const bilgiKaydet = async () => {
    setKaydediliyor(true)
    const g = await kesifGuncelle(kesifId, {
      lokasyon: kesif.lokasyon,
      genelNot: kesif.genelNot,
      ozelTalepler: kesif.ozelTalepler,
      mevcutSistem: kesif.mevcutSistem,
      icNotlar: kesif.icNotlar,
      turler: kesif.turler || [],
      durum: kesif.durum,
    })
    setKaydediliyor(false)
    if (!g) Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.')
    else Alert.alert('✓', 'Keşif kaydedildi.')
  }

  const kalemKaydet = async () => {
    if (!kUrunAdi.trim()) { Alert.alert('Eksik', 'Ürün adı girin.'); return }
    const eklenen = await kesifKalemEkle({
      kesifId: Number(kesifId),
      kategori: kKategori,
      urunAdi: kUrunAdi.trim(),
      marka: kMarka.trim(),
      miktar: Number(kMiktar) || 1,
      birim: 'Adet',
      notlar: kNot.trim() || null,
      siralama: kalemler.length,
    })
    if (!eklenen) { Alert.alert('Hata', 'Kalem eklenemedi.'); return }
    setKalemler(prev => [...prev, eklenen])
    setKUrunAdi(''); setKMarka(''); setKMiktar('1'); setKNot('')
  }

  const kalemKaldir = async (k) => {
    const onay = await confirmSil(`"${k.urunAdi}" kalemi silinsin mi?`)
    if (!onay) return
    const ok = await kesifKalemSil(k.id)
    if (ok) setKalemler(prev => prev.filter(x => x.id !== k.id))
  }

  const fotoYukleVeEkle = async (uri, meta = {}) => {
    setFotoYukleniyor(true)
    const sonuc = await kesifFotoYukle(kesifId, uri, {
      ...meta, olusturanAd: kullanici?.ad || '', olusturanId: kullanici?.id,
    })
    setFotoYukleniyor(false)
    if (!sonuc.ok) { Alert.alert('Hata', sonuc.hata || 'Fotoğraf yüklenemedi.'); return null }
    setFotolar(prev => [sonuc.foto, ...prev])
    const yeniUrls = await kesifFotoUrlleri([sonuc.foto.dosyaYolu])
    setFotoUrls(prev => ({ ...prev, ...yeniUrls }))
    return sonuc.foto
  }

  // Doküman §4 akışı: çek → önizleme + alt bilgi ekranı → kaydet (→ istenirse çizim)
  const kameradanCek = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (!izin.granted) { Alert.alert('İzin Gerekli', 'Kameraya erişim izni verin.'); return }
    const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (!s.canceled && s.assets?.[0]?.uri) {
      setFotoMeta(BOS_FOTO_META)
      setMetaModal({ mod: 'yeni', uri: s.assets[0].uri })
    }
  }

  const galeridenSec = async () => {
    const s = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    })
    if (s.canceled) return
    const assets = (s.assets || []).filter(a => a?.uri)
    if (assets.length === 1) {
      // Tek foto: önce alt bilgi ekranı
      setFotoMeta(BOS_FOTO_META)
      setMetaModal({ mod: 'yeni', uri: assets[0].uri })
    } else {
      for (const a of assets) await fotoYukleVeEkle(a.uri)
    }
  }

  const metaKaydet = async (cizimeGec = false) => {
    if (!metaModal) return
    setMetaKaydediliyor(true)
    try {
      if (metaModal.mod === 'yeni') {
        const foto = await fotoYukleVeEkle(metaModal.uri, {
          ...fotoMeta,
          etiket: fotoMeta.etiket || null,
          kalemId: fotoMeta.kalemId || null,
        })
        setMetaModal(null)
        if (foto && cizimeGec) setCizilen(foto)
      } else {
        const sonuc = await kesifFotoGuncelle(metaModal.foto.id, {
          ...fotoMeta,
          etiket: fotoMeta.etiket || null,
          kalemId: fotoMeta.kalemId || null,
        })
        if (!sonuc.ok) { Alert.alert('Hata', sonuc.hata); return }
        setFotolar(prev => prev.map(x => x.id === metaModal.foto.id
          ? { ...x, ...fotoMeta, etiket: fotoMeta.etiket || null, kalemId: fotoMeta.kalemId || null }
          : x))
        setMetaModal(null)
      }
    } finally {
      setMetaKaydediliyor(false)
    }
  }

  const cizimKaydetHandler = async (base64Png, cizimVeri) => {
    setCizimKaydediliyor(true)
    const sonuc = await kesifFotoCizimKaydet(cizilen, base64Png, cizimVeri, kullanici)
    setCizimKaydediliyor(false)
    if (!sonuc.ok) { Alert.alert('Hata', sonuc.hata || 'Çizim kaydedilemedi.'); return }
    const guncel = sonuc.foto
    setCizilen(null)
    setFotolar(prev => prev.map(x => x.id === guncel.id ? { ...x, ...guncel } : x))
    const yeniUrls = await kesifFotoUrlleri([guncel.cizimYolu])
    setFotoUrls(prev => ({ ...prev, ...yeniUrls }))
  }

  const duzenleyebilir = (f) =>
    kullanici?.rol === 'admin' || !f.olusturanId || String(f.olusturanId) === String(kullanici?.id)

  const fotoKaldir = async (f) => {
    const onay = await confirmSil('Bu fotoğraf (varsa çizimiyle) silinsin mi?')
    if (!onay) return
    const ok = await kesifFotoSil(f)
    if (ok) { setFotolar(prev => prev.filter(x => x.id !== f.id)); setGoruntule(null) }
    else Alert.alert('Silinemedi', 'Fotoğrafı yalnız ekleyen kişi veya yönetici silebilir.')
  }

  // Doküman "Önerilen Ekran Mantığı": fotoğrafa dokununca seçenek menüsü.
  // Alert KULLANILMAZ — Android'de Alert en fazla 3 buton gösterir, 5 seçenek kırpılırdı.
  const fotoMenuSecenekleri = (f) => {
    if (!f) return []
    const yetkili = duzenleyebilir(f)
    return [
      { ikon: 'eye', ad: 'Görüntüle', islem: () => setGoruntule({ foto: f, cizimli: !!f.cizimYolu }) },
      ...(yetkili ? [
        {
          ikon: 'edit-2',
          ad: 'Açıklama Ekle / Düzenle',
          islem: () => {
            setFotoMeta({
              baslik: f.baslik || '', aciklama: f.aciklama || '', montajNotu: f.montajNotu || '',
              mahal: f.mahal || '', katBolum: f.katBolum || '', etiket: f.etiket || '', kalemId: f.kalemId || '',
            })
            setMetaModal({ mod: 'duzenle', foto: f })
          },
        },
        { ikon: 'edit-3', ad: f.cizimYolu ? 'Çizimi Düzenle' : 'Çizim Yap', islem: () => setCizilen(f) },
        { ikon: 'trash-2', ad: 'Sil', tehlikeli: true, islem: () => fotoKaldir(f) },
      ] : []),
    ]
  }

  const chip = (aktif, renk) => ({
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    backgroundColor: aktif ? (renk || colors.primary) : colors.surface,
    borderWidth: 1, borderColor: aktif ? (renk || colors.primary) : colors.border,
  })
  const chipText = (aktif) => ({ color: aktif ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600' })

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
          {/* Üst bilgi kartı */}
          <View style={{
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
            borderRadius: 12, padding: 14,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontFamily: 'monospace' }}>{kesif.kesifNo}</Text>
              {durum && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: durum.renk + '22' }}>
                  <Text style={{ color: durum.renk, fontSize: 11, fontWeight: '700' }}>{durum.ad}</Text>
                </View>
              )}
              {oncelik && oncelik.id !== 'normal' && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: oncelik.renk + '22' }}>
                  <Text style={{ color: oncelik.renk, fontSize: 11, fontWeight: '700' }}>{oncelik.ad.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16, marginTop: 6 }}>
              {kesif.firmaAdi || '—'}
            </Text>
            {!!kesif.kesifBasligi && (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{kesif.kesifBasligi}</Text>
            )}
            {!!kesif.gorusmeNo && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: 'monospace' }}>
                Görüşme: {kesif.gorusmeNo}
              </Text>
            )}
          </View>

          {/* Fotoğraflar */}
          <Text style={bolumBaslik}>📷 Fotoğraflar ({fotolar.length})</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity onPress={kameradanCek} disabled={fotoYukleniyor} activeOpacity={0.8}
              style={{
                flex: 1, height: 46, borderRadius: 10, backgroundColor: colors.primary,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: fotoYukleniyor ? 0.6 : 1,
              }}>
              {fotoYukleniyor ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="camera" size={17} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '700' }}>Fotoğraf Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={galeridenSec} disabled={fotoYukleniyor} activeOpacity={0.8}
              style={{
                width: 100, height: 46, borderRadius: 10,
                borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Feather name="image" size={16} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 13 }}>Galeri</Text>
            </TouchableOpacity>
          </View>
          {fotolar.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {fotolar.map(f => {
                const url = fotoUrls[f.cizimYolu] || fotoUrls[f.dosyaYolu]
                const etiket = kesifFotoEtiketBilgi(f.etiket)
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFotoMenuFoto(f)}
                    activeOpacity={0.8}
                    style={{
                      width: '48%', borderRadius: 10, overflow: 'hidden',
                      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    }}>
                    <View style={{ aspectRatio: 4 / 3 }}>
                      {url && <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                      {!!f.cizimYolu && (
                        <View style={{
                          position: 'absolute', top: 5, left: 5, flexDirection: 'row', alignItems: 'center', gap: 3,
                          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(22,163,74,0.92)',
                        }}>
                          <Feather name="edit-3" size={9} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>Çizim</Text>
                        </View>
                      )}
                      {etiket && (
                        <View style={{
                          position: 'absolute', bottom: 5, left: 5,
                          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: etiket.renk,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{etiket.ad}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 8, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                        {f.baslik || 'Başlık yok'}
                      </Text>
                      {!!f.aciklama && (
                        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 11 }}>{f.aciklama}</Text>
                      )}
                      <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 10 }}>
                        {f.olusturanAd || '—'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Keşif türleri — çoklu seçim dropdown */}
          <Text style={bolumBaslik}>Keşif Türleri</Text>
          <CokluSecimPicker
            degerler={kesif.turler || []}
            onChange={(arr) => setKesif(k => ({ ...k, turler: arr }))}
            secenekler={KESIF_TURLERI.map(t => ({ id: t.id, isim: t.ad }))}
            placeholder="Keşif türü seç…"
          />

          {/* Malzeme listesi */}
          <Text style={bolumBaslik}>🧰 Malzeme Listesi ({kalemler.length})</Text>
          <View style={{ marginBottom: 8 }}>
            <SecimPicker
              deger={kKategori}
              onSec={setKKategori}
              secenekler={KESIF_KATEGORILERI.map(kat => ({ id: kat.id, isim: `${kat.ikon} ${kat.ad}` }))}
              placeholder="Kategori seç…"
            />
          </View>
          <TextInput value={kUrunAdi} onChangeText={setKUrunAdi} placeholder="Ürün adı — örn. 4MP IP Dome kamera"
            placeholderTextColor={colors.textMuted} style={inputStil} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput value={kMarka} onChangeText={setKMarka} placeholder="Marka/Model"
              placeholderTextColor={colors.textMuted} style={[inputStil, { flex: 1 }]} />
            <TextInput value={kMiktar} onChangeText={setKMiktar} keyboardType="numeric" placeholder="Adet"
              placeholderTextColor={colors.textMuted} style={[inputStil, { width: 80, textAlign: 'center' }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput value={kNot} onChangeText={setKNot} placeholder="Not (montaj yeri vb.)"
              placeholderTextColor={colors.textMuted} style={[inputStil, { flex: 1 }]} />
            <TouchableOpacity onPress={kalemKaydet} activeOpacity={0.8}
              style={{
                width: 80, height: 46, borderRadius: 10, backgroundColor: colors.success || '#22c55e',
                alignItems: 'center', justifyContent: 'center',
              }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Ekle</Text>
            </TouchableOpacity>
          </View>
          {kalemler.map(k => {
            const kat = KESIF_KATEGORILERI.find(x => x.id === k.kategori)
            return (
              <View key={k.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                borderRadius: 10, padding: 12, marginTop: 8,
              }}>
                <Text style={{ fontSize: 18 }}>{kat?.ikon || '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                    {k.urunAdi}{k.marka ? ` — ${k.marka}` : ''}
                  </Text>
                  {!!k.notlar && <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{k.notlar}</Text>}
                </View>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
                  {Number(k.miktar)} {k.birim}
                </Text>
                <TouchableOpacity onPress={() => kalemKaldir(k)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={colors.danger || '#ef4444'} />
                </TouchableOpacity>
              </View>
            )
          })}

          {/* Notlar */}
          <Text style={bolumBaslik}>📝 Notlar</Text>
          <Text style={labelStil}>Keşif Adresi</Text>
          <TextInput value={kesif.lokasyon || ''} onChangeText={v => setKesif(k => ({ ...k, lokasyon: v }))}
            placeholder="Saha adresi" placeholderTextColor={colors.textMuted} style={inputStil} />
          <Text style={labelStil}>Keşif Açıklaması</Text>
          <TextInput value={kesif.genelNot || ''} onChangeText={v => setKesif(k => ({ ...k, genelNot: v }))}
            placeholder="Saha gözlemleri…" placeholderTextColor={colors.textMuted}
            multiline numberOfLines={4} textAlignVertical="top" style={[inputStil, { height: 96, paddingTop: 10 }]} />
          <Text style={labelStil}>Müşteri Özel Talepleri</Text>
          <TextInput value={kesif.ozelTalepler || ''} onChangeText={v => setKesif(k => ({ ...k, ozelTalepler: v }))}
            placeholder="Müşterinin özellikle istedikleri…" placeholderTextColor={colors.textMuted}
            multiline numberOfLines={3} textAlignVertical="top" style={[inputStil, { height: 76, paddingTop: 10 }]} />
          <Text style={labelStil}>Mevcut Sistem Bilgisi</Text>
          <TextInput value={kesif.mevcutSistem || ''} onChangeText={v => setKesif(k => ({ ...k, mevcutSistem: v }))}
            placeholder="Sahada kurulu sistem…" placeholderTextColor={colors.textMuted}
            multiline numberOfLines={3} textAlignVertical="top" style={[inputStil, { height: 76, paddingTop: 10 }]} />
          <Text style={labelStil}>İç Notlar (müşteri görmez)</Text>
          <TextInput value={kesif.icNotlar || ''} onChangeText={v => setKesif(k => ({ ...k, icNotlar: v }))}
            placeholder="Şirket içi değerlendirme…" placeholderTextColor={colors.textMuted}
            multiline numberOfLines={3} textAlignVertical="top" style={[inputStil, { height: 76, paddingTop: 10 }]} />

          {/* Durum */}
          <Text style={labelStil}>Durum</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {KESIF_DURUMLARI.map(d => {
              const aktif = kesif.durum === d.id
              return (
                <TouchableOpacity key={d.id} onPress={() => setKesif(k => ({ ...k, durum: d.id }))} style={chip(aktif, d.renk)}>
                  <Text style={chipText(aktif)}>{d.ad}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            onPress={bilgiKaydet}
            disabled={kaydediliyor}
            activeOpacity={0.85}
            style={{
              marginTop: 22, height: 50, borderRadius: 12,
              backgroundColor: colors.primary, opacity: kaydediliyor ? 0.7 : 1,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {kaydediliyor
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Keşfi Kaydet</Text>}
          </TouchableOpacity>

          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 14, textAlign: 'center' }}>
            Teklife / göreve / servise dönüştürme web panelindeki keşif detayından yapılır.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOTO SEÇENEK MENÜSÜ — alt sayfa (doküman "Önerilen Ekran Mantığı") */}
      <Modal visible={!!fotoMenuFoto} transparent animationType="fade" onRequestClose={() => setFotoMenuFoto(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setFotoMenuFoto(null)}
          style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, paddingBottom: 28 }}>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {fotoMenuFoto?.baslik || 'Fotoğraf'}
            </Text>
            {fotoMenuSecenekleri(fotoMenuFoto).map((s) => (
              <TouchableOpacity
                key={s.ad}
                onPress={() => { setFotoMenuFoto(null); s.islem() }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Feather name={s.ikon} size={17} color={s.tehlikeli ? '#ef4444' : colors.textMuted} />
                <Text style={{ color: s.tehlikeli ? '#ef4444' : colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{s.ad}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFotoMenuFoto(null)} style={{ paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>Vazgeç</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* FOTO ALT BİLGİ modalı — yeni yükleme öncesi VE sonradan düzenleme (doküman §2, §4) */}
      <Modal visible={!!metaModal} transparent animationType="slide" onRequestClose={() => setMetaModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.75)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 18, maxHeight: '90%' }}>
            <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
              {metaModal?.mod === 'yeni' ? 'Fotoğraf Önizleme' : 'Fotoğraf Bilgileri'}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
              Başlık, açıklama ve etiket girebilirsin — hepsi isteğe bağlı.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {metaModal?.mod === 'yeni' && (
                <Image source={{ uri: metaModal.uri }} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 10 }} resizeMode="contain" />
              )}
              {[
                { k: 'baslik', p: 'Fotoğraf başlığı — örn. Giriş kapısı kamera noktası' },
                { k: 'aciklama', p: 'Açıklama — örn. 2 MP IP dome kamera önerildi', coklu: true },
                { k: 'montajNotu', p: 'Montaj notu — örn. enerji hattı çekilecek' },
                { k: 'mahal', p: 'Bulunduğu alan / mahal' },
                { k: 'katBolum', p: 'Kat / bölüm' },
              ].map(alan => (
                <TextInput
                  key={alan.k}
                  value={fotoMeta[alan.k]}
                  onChangeText={(v) => setFotoMeta(p => ({ ...p, [alan.k]: v }))}
                  placeholder={alan.p}
                  placeholderTextColor="#94a3b8"
                  multiline={!!alan.coklu}
                  style={{
                    marginBottom: 8, borderRadius: 10, padding: 10, borderWidth: 1,
                    borderColor: '#cbd5e1', color: '#0f172a', backgroundColor: '#fff',
                    ...(alan.coklu ? { minHeight: 52, textAlignVertical: 'top' } : {}),
                  }}
                />
              ))}
              <View style={{ marginBottom: 8 }}>
                <SecimPicker
                  deger={fotoMeta.etiket}
                  onSec={(v) => setFotoMeta(p => ({ ...p, etiket: v }))}
                  secenekler={[{ id: '', isim: '— Etiket yok —' }, ...KESIF_FOTO_ETIKETLERI.map(t => ({ id: t.id, isim: t.ad }))]}
                  placeholder="Etiket seç…"
                />
              </View>
              {kalemler.length > 0 && (
                <SecimPicker
                  deger={fotoMeta.kalemId ? String(fotoMeta.kalemId) : ''}
                  onSec={(v) => setFotoMeta(p => ({ ...p, kalemId: v || '' }))}
                  secenekler={[{ id: '', isim: '— Kaleme bağlı değil —' }, ...kalemler.map(k => ({ id: String(k.id), isim: `${k.miktar} ${k.birim} — ${k.urunAdi}` }))]}
                  placeholder="İlgili keşif kalemi…"
                />
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={() => setMetaModal(null)}
                style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' }}>
                <Text style={{ color: '#475569', fontWeight: '600', fontSize: 13 }}>Vazgeç</Text>
              </TouchableOpacity>
              {metaModal?.mod === 'yeni' && (
                <TouchableOpacity onPress={() => metaKaydet(true)} disabled={metaKaydediliyor || fotoYukleniyor}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2563eb', backgroundColor: '#fff' }}>
                  <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13 }}>Kaydet + Çizim</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => metaKaydet(false)} disabled={metaKaydediliyor || fotoYukleniyor}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563eb', opacity: (metaKaydediliyor || fotoYukleniyor) ? 0.6 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {(metaKaydediliyor || fotoYukleniyor) ? 'Kaydediliyor…' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TAM EKRAN GÖRÜNTÜLEYİCİ — orijinal ↔ çizimli geçiş (doküman §8) */}
      <Modal visible={!!goruntule} transparent animationType="fade" onRequestClose={() => setGoruntule(null)}>
        {goruntule && (
          <View style={{ flex: 1, backgroundColor: 'rgba(5,8,18,0.96)', padding: 14, paddingTop: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 }}>
                {goruntule.foto.baslik || 'Keşif fotoğrafı'}{goruntule.foto.cizimYolu ? (goruntule.cizimli ? ' · çizimli' : ' · orijinal') : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {!!goruntule.foto.cizimYolu && (
                  <TouchableOpacity
                    onPress={() => setGoruntule(g => ({ ...g, cizimli: !g.cizimli }))}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {goruntule.cizimli ? 'Orijinal' : 'Çizimli'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setGoruntule(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <Image
              source={{ uri: fotoUrls[goruntule.cizimli && goruntule.foto.cizimYolu ? goruntule.foto.cizimYolu : goruntule.foto.dosyaYolu] }}
              style={{ flex: 1, borderRadius: 10 }}
              resizeMode="contain"
            />
            <View style={{ paddingTop: 8, gap: 2 }}>
              {[
                goruntule.foto.aciklama && `Açıklama: ${goruntule.foto.aciklama}`,
                goruntule.foto.montajNotu && `Montaj: ${goruntule.foto.montajNotu}`,
                [goruntule.foto.mahal, goruntule.foto.katBolum].filter(Boolean).length
                  && `Yer: ${[goruntule.foto.mahal, goruntule.foto.katBolum].filter(Boolean).join(' / ')}`,
                kesifFotoEtiketBilgi(goruntule.foto.etiket) && `Etiket: ${kesifFotoEtiketBilgi(goruntule.foto.etiket).ad}`,
                `${goruntule.foto.olusturanAd || '—'}`,
              ].filter(Boolean).map((t, i) => (
                <Text key={i} style={{ color: '#cbd5e1', fontSize: 12 }}>{t}</Text>
              ))}
            </View>
          </View>
        )}
      </Modal>

      {/* ÇİZİM — her zaman orijinal foto üstüne; önceki vektörler yüklenir (doküman §3, §8) */}
      <KesifFotoCizimModal
        visible={!!cizilen}
        imageUrl={cizilen ? fotoUrls[cizilen.dosyaYolu] : null}
        baslangicSekilleri={cizilen?.cizimVeri?.sekiller || []}
        onKapat={() => setCizilen(null)}
        onKaydet={cizimKaydetHandler}
        kaydediliyor={cizimKaydediliyor}
      />
    </ScreenContainer>
  )
}
