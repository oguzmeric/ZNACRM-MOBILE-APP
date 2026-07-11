// Keşif Detayı (mobile) — sahada asıl çalışılan ekran:
// notlar, keşif türleri, malzeme listesi (fiyatsız) ve fotoğraf çekimi.
// Dönüşümler (teklif/görev/servis) web panelinden yapılır.

import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
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
  KESIF_KATEGORILERI, KESIF_TURLERI, KESIF_DURUMLARI, KESIF_ONCELIKLERI,
} from '../services/kesifService'

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
    setFotoUrls(await kesifFotoUrlleri(fot.map(f => f.dosyaYolu)))
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

  const fotoYukleVeEkle = async (uri) => {
    setFotoYukleniyor(true)
    const sonuc = await kesifFotoYukle(kesifId, uri, { olusturanAd: kullanici?.ad || '' })
    setFotoYukleniyor(false)
    if (!sonuc.ok) { Alert.alert('Hata', sonuc.hata || 'Fotoğraf yüklenemedi.'); return }
    setFotolar(prev => [sonuc.foto, ...prev])
    const yeniUrls = await kesifFotoUrlleri([sonuc.foto.dosyaYolu])
    setFotoUrls(prev => ({ ...prev, ...yeniUrls }))
  }

  const kameradanCek = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (!izin.granted) { Alert.alert('İzin Gerekli', 'Kameraya erişim izni verin.'); return }
    const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (!s.canceled && s.assets?.[0]?.uri) await fotoYukleVeEkle(s.assets[0].uri)
  }

  const galeridenSec = async () => {
    const s = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    })
    if (s.canceled) return
    for (const a of (s.assets || [])) {
      if (a?.uri) await fotoYukleVeEkle(a.uri)
    }
  }

  const fotoKaldir = async (f) => {
    const onay = await confirmSil('Bu fotoğraf silinsin mi?')
    if (!onay) return
    const ok = await kesifFotoSil(f)
    if (ok) setFotolar(prev => prev.filter(x => x.id !== f.id))
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
                const url = fotoUrls[f.dosyaYolu]
                return (
                  <View key={f.id} style={{ width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceDark || colors.surface }}>
                    {url && <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                    <TouchableOpacity
                      onPress={() => fotoKaldir(f)}
                      style={{
                        position: 'absolute', top: 4, right: 4, width: 24, height: 24,
                        borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Feather name="x" size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
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
    </ScreenContainer>
  )
}
