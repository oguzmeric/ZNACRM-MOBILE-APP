// Yeni/Mevcut not düzenleme ekranı.
// Başlık + içerik (textarea) + kategori + müşteri picker + çizim ekleri.

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, Image, Modal, FlatList, Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import Markdown from 'react-native-markdown-display'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { trIcerir } from '../utils/trSearch'
import { htmlToDuzMetin, duzMetinToHtml } from '../utils/notIcerik'
import {
  KATEGORILER, notuGetir, notEkle, notGuncelle, notSil,
  notCizimleriGuncelle, notEkleriGuncelle, cizimSignedUrl, cizimSil,
  ekYukle, ekSignedUrl, ekSil,
} from '../services/notService'
import { musterileriGetir } from '../services/musteriService'
import CizimYapModal from '../components/CizimYapModal'
import TarihSaatSec from '../components/TarihSaatSec'
import { hatirlaticiZamanla, hatirlaticiKaldir } from '../lib/notHatirlatici'

export default function NotDuzenleScreen({ route, navigation }) {
  const { id } = route.params ?? {}
  const editMode = !!id
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const headerHeight = useHeaderHeight()
  const [cizimViewerUrl, setCizimViewerUrl] = useState(null)  // tam ekran çizim önizleme
  const [cizimModalAcik, setCizimModalAcik] = useState(false)  // çizim yapma modal

  const [baslik, setBaslik] = useState('')
  const [icerik, setIcerik] = useState('')
  const [kategori, setKategori] = useState('diger')
  const [musteriId, setMusteriId] = useState(null)
  const [musteri, setMusteri] = useState(null)
  const [cizimler, setCizimler] = useState([])
  const [ekler, setEkler] = useState([])  // foto/belge ekleri
  const [hatirlatmaTarihi, setHatirlatmaTarihi] = useState(null)
  const [onizleMod, setOnizleMod] = useState(false)  // markdown önizle
  const [ekYukleniyor, setEkYukleniyor] = useState(false)

  const [yukleniyor, setYukleniyor] = useState(editMode)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [musteriPickerAcik, setMusteriPickerAcik] = useState(false)
  const [musteriler, setMusteriler] = useState([])
  const [musteriArama, setMusteriArama] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: editMode ? 'Notu Düzenle' : 'Yeni Not' })
  }, [navigation, editMode])

  useEffect(() => {
    musterileriGetir().then(setMusteriler).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editMode) return
    ;(async () => {
      const not = await notuGetir(id)
      if (not) {
        setBaslik(not.baslik || '')
        // Web (ReactQuill) HTML kaydeder — mobilde okunur düz metne çevir
        setIcerik(htmlToDuzMetin(not.icerik || ''))
        setKategori(not.kategori || 'diger')
        setMusteriId(not.musteriId || null)
        setMusteri(not.musteri || null)
        setCizimler(not.cizimler || [])
        setEkler(not.ekler || [])
        setHatirlatmaTarihi(not.hatirlatmaTarihi || null)
      }
      setYukleniyor(false)
    })()
  }, [editMode, id])

  // Modal'dan çizim kaydedilince çağrılır — state'e ekle + DB'ye yansıt
  const cizimEklendi = (yeniCizim) => {
    if (!yeniCizim?.path) return
    setCizimler((prev) => {
      if (prev.some((c) => c.path === yeniCizim.path)) return prev
      const yeniListe = [...prev, yeniCizim]
      if (editMode && id) {
        notCizimleriGuncelle(id, yeniListe).catch((e) =>
          console.warn('[cizim auto-save]', e?.message),
        )
      }
      return yeniListe
    })
  }

  const kaydet = async () => {
    if (!baslik.trim() && !icerik.trim()) {
      Alert.alert('Eksik', 'Başlık veya içerik gerekli.')
      return
    }
    // Modal açıksa kapat — kaydet sırasında üst üste binmesin
    if (cizimModalAcik) setCizimModalAcik(false)

    setKaydediliyor(true)
    const payload = {
      baslik: baslik.trim() || null,
      // Web Quill'de satırlar kaybolmasın diye basit HTML olarak sakla
      icerik: icerik.trim() ? duzMetinToHtml(icerik.trim()) : null,
      kategori,
      musteriId,
      cizimler,
      ekler,
      hatirlatmaTarihi,
    }
    try {
      let sonuc
      if (editMode) {
        sonuc = await notGuncelle(id, payload)
      } else {
        sonuc = await notEkle(kullanici.id, payload)
      }
      if (!sonuc) {
        Alert.alert('Hata', 'Not kaydedilemedi.')
        return
      }
      // Hatırlatma varsa local notification zamanla, yoksa eskiyi kaldır
      const notId = sonuc.id ?? id
      if (notId) {
        if (hatirlatmaTarihi) {
          await hatirlaticiZamanla({
            notId,
            hatirlatmaTarihi,
            baslik: baslik.trim() || 'Hatırlatma',
            mesaj: icerik.trim()?.slice(0, 100) || 'Notunuza dönmenin zamanı.',
          })
        } else {
          await hatirlaticiKaldir(notId)
        }
      }
      // Başarılı — listeye dön
      navigation.goBack()
    } catch (e) {
      Alert.alert('Hata', 'Kayıt sırasında bir şey ters gitti: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setKaydediliyor(false)
    }
  }

  const sil = () => {
    Alert.alert('Notu Sil', 'Bu not ve içindeki çizimler/ekler silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await notSil(id)
            await hatirlaticiKaldir(id)
            navigation.goBack()
          } catch (e) {
            Alert.alert('Hata', 'Silinemedi: ' + (e?.message ?? 'bilinmeyen'))
          }
        },
      },
    ])
  }

  // Ek (foto/belge) ekle akışları
  const ekleEklendi = (yeniEk) => {
    if (!yeniEk) return
    setEkler((prev) => {
      const yeniListe = [...prev, yeniEk]
      if (editMode && id) {
        notEkleriGuncelle(id, yeniListe).catch(() => {})
      }
      return yeniListe
    })
  }

  const fotoKamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Kameraya erişim gerekli.')
      return
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    if (r.canceled || !r.assets?.[0]) return
    setEkYukleniyor(true)
    try {
      const a = r.assets[0]
      const sonuc = await ekYukle({
        lokalUri: a.uri,
        kullaniciId: kullanici.id,
        notId: id ?? null,
        ad: a.fileName || `foto_${Date.now()}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
        tip: 'foto',
      })
      if (sonuc) ekleEklendi(sonuc)
      else Alert.alert('Hata', 'Foto yüklenemedi.')
    } finally {
      setEkYukleniyor(false)
    }
  }

  const fotoGaleri = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Galeri erişimi gerekli.')
      return
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    })
    if (r.canceled || !r.assets?.length) return
    setEkYukleniyor(true)
    try {
      for (const a of r.assets) {
        const sonuc = await ekYukle({
          lokalUri: a.uri,
          kullaniciId: kullanici.id,
          notId: id ?? null,
          ad: a.fileName || `foto_${Date.now()}.jpg`,
          mimeType: a.mimeType || 'image/jpeg',
          tip: 'foto',
        })
        if (sonuc) ekleEklendi(sonuc)
      }
    } finally {
      setEkYukleniyor(false)
    }
  }

  const belgeSec = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'],
    })
    if (r.canceled || !r.assets?.[0]) return
    setEkYukleniyor(true)
    try {
      const a = r.assets[0]
      const sonuc = await ekYukle({
        lokalUri: a.uri,
        kullaniciId: kullanici.id,
        notId: id ?? null,
        ad: a.name,
        mimeType: a.mimeType,
        tip: 'belge',
      })
      if (sonuc) ekleEklendi(sonuc)
      else Alert.alert('Hata', 'Belge yüklenemedi.')
    } finally {
      setEkYukleniyor(false)
    }
  }

  const ekKaldir = (ek) => {
    Alert.alert('Eki Sil', `"${ek.ad}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          await ekSil(ek.path)
          setEkler((prev) => {
            const yeniListe = prev.filter((e) => e.path !== ek.path)
            if (editMode && id) {
              notEkleriGuncelle(id, yeniListe).catch(() => {})
            }
            return yeniListe
          })
        },
      },
    ])
  }

  const ekAc = async (ek) => {
    try {
      const url = await ekSignedUrl(ek.path)
      if (!url) {
        Alert.alert('Hata', 'Dosya açılamadı.')
        return
      }
      // Foto: paylaş/aç. Belge: indir ve aç.
      const lokalUri = `${FileSystem.cacheDirectory}ek_${Date.now()}_${ek.ad.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const indirme = await FileSystem.downloadAsync(url, lokalUri)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(indirme.uri, { mimeType: ek.mimeType, dialogTitle: ek.ad })
      } else {
        Linking.openURL(url)
      }
    } catch (e) {
      Alert.alert('Hata', e?.message ?? 'Dosya açılamadı.')
    }
  }

  const cizimEkle = () => {
    setCizimModalAcik(true)
  }

  const cizimKaldir = (cizim, index) => {
    Alert.alert('Çizimi Sil', 'Bu çizim notdan kaldırılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          await cizimSil(cizim.path)
          setCizimler((prev) => {
            const yeniListe = prev.filter((_, i) => i !== index)
            // Mevcut not düzenleniyor ise DB'yi anında güncelle
            if (editMode && id) {
              notCizimleriGuncelle(id, yeniListe).catch((e) =>
                console.warn('[cizim sil DB]', e?.message),
              )
            }
            return yeniListe
          })
        },
      },
    ])
  }

  const filtreliMusteriler = musteriArama
    ? musteriler.filter((m) => trIcerir([m.firma, m.ad, m.soyad], musteriArama))
    : musteriler

  if (yukleniyor) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.textMuted }]}>BAŞLIK</Text>
        <TextInput
          value={baslik}
          onChangeText={setBaslik}
          placeholder="Notun başlığı…"
          placeholderTextColor={colors.textFaded}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>KATEGORİ</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {KATEGORILER.map((k) => {
            const aktif = kategori === k.id
            return (
              <TouchableOpacity
                key={k.id}
                onPress={() => setKategori(k.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: aktif ? `${k.renk}25` : colors.surface,
                  borderWidth: 1, borderColor: aktif ? k.renk : colors.border,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.renk }} />
                <Text style={{ color: aktif ? k.renk : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {k.isim}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>MÜŞTERİ (opsiyonel)</Text>
        <TouchableOpacity
          onPress={() => setMusteriPickerAcik(true)}
          style={[styles.input, { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Feather name="briefcase" size={14} color={colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, color: musteri ? colors.textPrimary : colors.textFaded, fontSize: 14 }}>
            {musteri?.firma || (musteri ? `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim() : 'Müşteri seç…')}
          </Text>
          {musteri && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setMusteriId(null); setMusteri(null) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            İÇERİK · <Text style={{ fontSize: 9, color: colors.textFaded }}>Markdown: **kalın** _italik_ # Başlık</Text>
          </Text>
          {icerik?.trim().length > 0 && (
            <TouchableOpacity onPress={() => setOnizleMod((m) => !m)} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                {onizleMod ? '✏️ Düzenle' : '👁 Önizle'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {onizleMod ? (
          <View style={[styles.input, { minHeight: 200, padding: 12, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Markdown style={{
              body: { color: colors.textPrimary, fontSize: 14 },
              heading1: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
              heading2: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
              heading3: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
              strong: { fontWeight: '700' },
              em: { fontStyle: 'italic' },
              link: { color: colors.primary },
              list_item: { color: colors.textPrimary },
              code_inline: { backgroundColor: colors.surfaceDark, color: colors.textPrimary, paddingHorizontal: 4, borderRadius: 4 },
              code_block: { backgroundColor: colors.surfaceDark, color: colors.textPrimary, padding: 8, borderRadius: 6 },
              fence: { backgroundColor: colors.surfaceDark, color: colors.textPrimary, padding: 8, borderRadius: 6 },
              blockquote: { backgroundColor: colors.surfaceDark, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8, marginVertical: 4 },
            }}>
              {icerik}
            </Markdown>
          </View>
        ) : (
          <TextInput
            value={icerik}
            onChangeText={setIcerik}
            placeholder="Notunu buraya yaz… Markdown destekli."
            placeholderTextColor={colors.textFaded}
            multiline
            textAlignVertical="top"
            style={[styles.input, { height: 200, backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          />
        )}

        {/* Hatırlatıcı */}
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 0, marginBottom: 6 }]}>
            <Feather name="bell" size={10} color={colors.textMuted} /> HATIRLATICI (opsiyonel)
          </Text>
          <TarihSaatSec
            value={hatirlatmaTarihi}
            onChange={setHatirlatmaTarihi}
            placeholder="Hatırlatma zamanı seç"
            minDate={new Date()}
          />
        </View>

        {/* Ekler (foto + belge) */}
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 0 }]}>
            EKLER {ekler.length > 0 ? `(${ekler.length})` : ''}
          </Text>
          {ekYukleniyor && (
            <Text style={{ color: colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>Yükleniyor…</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <TouchableOpacity onPress={fotoKamera} disabled={ekYukleniyor} style={[styles.ekBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="camera" size={14} color={colors.textSecondary} />
            <Text style={[styles.ekBtnText, { color: colors.textSecondary }]}>Kamera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={fotoGaleri} disabled={ekYukleniyor} style={[styles.ekBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="image" size={14} color={colors.textSecondary} />
            <Text style={[styles.ekBtnText, { color: colors.textSecondary }]}>Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={belgeSec} disabled={ekYukleniyor} style={[styles.ekBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="file" size={14} color={colors.textSecondary} />
            <Text style={[styles.ekBtnText, { color: colors.textSecondary }]}>Belge</Text>
          </TouchableOpacity>
        </View>

        {ekler.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {ekler.map((e, i) => (
              <EkKart key={`${e.path}-${i}`} ek={e} onAc={() => ekAc(e)} onSil={() => ekKaldir(e)} colors={colors} />
            ))}
          </View>
        )}

        {/* Çizimler */}
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 0 }]}>
            ÇİZİMLER {cizimler.length > 0 ? `(${cizimler.length})` : ''}
          </Text>
          <TouchableOpacity
            onPress={cizimEkle}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6,
              borderRadius: 8, backgroundColor: colors.primary,
            }}
          >
            <Feather name="edit-2" size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Çizim Ekle</Text>
          </TouchableOpacity>
        </View>


        {cizimler.length === 0 ? (
          <Text style={{ color: colors.textFaded, fontSize: 12, fontStyle: 'italic', marginTop: 8 }}>
            Henüz çizim yok. Kalem veya parmakla çizim ekleyebilirsin.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {cizimler.map((c, i) => (
              <CizimThumbnail
                key={`${c.path}-${i}`}
                cizim={c}
                onAcildi={(url) => setCizimViewerUrl(url)}
                onSilTikla={() => cizimKaldir(c, i)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={kaydet}
          disabled={kaydediliyor}
          style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.5 }]}
        >
          <Feather name="save" size={16} color="#fff" />
          <Text style={styles.kaydetText}>
            {kaydediliyor ? 'Kaydediliyor…' : (editMode ? 'Güncelle' : 'Notu Kaydet')}
          </Text>
        </TouchableOpacity>

        {editMode && (
          <TouchableOpacity onPress={sil} style={styles.silBtn}>
            <Feather name="trash-2" size={14} color="#ef4444" />
            <Text style={styles.silText}>Notu Sil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Tam ekran çizim viewer */}
      <Modal visible={!!cizimViewerUrl} transparent animationType="fade" onRequestClose={() => setCizimViewerUrl(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setCizimViewerUrl(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
        >
          <TouchableOpacity
            onPress={() => setCizimViewerUrl(null)}
            style={{ position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          {cizimViewerUrl && (
            <Image
              source={{ uri: cizimViewerUrl }}
              style={{ width: '95%', height: '85%', backgroundColor: '#fff' }}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Müşteri picker modal */}
      <Modal visible={musteriPickerAcik} animationType="slide" transparent onRequestClose={() => setMusteriPickerAcik(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg, padding: 16, paddingBottom: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Müşteri Seç</Text>
              <TouchableOpacity onPress={() => setMusteriPickerAcik(false)}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                value={musteriArama}
                onChangeText={setMusteriArama}
                placeholder="Müşteride ara…"
                placeholderTextColor={colors.textFaded}
                style={{ flex: 1, color: colors.textPrimary, paddingVertical: 6 }}
              />
            </View>
            <FlatList
              data={filtreliMusteriler}
              keyExtractor={(m) => String(m.id)}
              style={{ marginTop: 10 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setMusteriId(item.id)
                    setMusteri(item)
                    setMusteriPickerAcik(false)
                    setMusteriArama('')
                  }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>
                    {item.firma || `${item.ad ?? ''} ${item.soyad ?? ''}`.trim()}
                  </Text>
                  {item.firma && (item.ad || item.soyad) && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {`${item.ad ?? ''} ${item.soyad ?? ''}`.trim()}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Çizim yapma modal — Skia + ham touch */}
      <CizimYapModal
        visible={cizimModalAcik}
        kullaniciId={kullanici?.id}
        notId={id ?? null}
        onKapat={() => setCizimModalAcik(false)}
        onKaydedildi={cizimEklendi}
      />
    </KeyboardAvoidingView>
  )
}

function EkKart({ ek, onAc, onSil, colors }) {
  const [fotoUrl, setFotoUrl] = useState(null)
  const isFoto = ek?.tip === 'foto' || ek?.mimeType?.startsWith('image/')

  useEffect(() => {
    if (!isFoto || !ek?.path) return
    ekSignedUrl(ek.path).then(setFotoUrl)
  }, [ek?.path, isFoto])

  const ikon = isFoto
    ? 'image'
    : (ek?.mimeType?.includes('pdf') ? 'file-text' : 'file')

  return (
    <View style={{
      position: 'relative',
      width: 110,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 6,
    }}>
      <TouchableOpacity onPress={onAc} activeOpacity={0.7}>
        <View style={{
          width: '100%', height: 70,
          backgroundColor: isFoto ? '#fff' : colors.surfaceDark,
          borderRadius: 6,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {isFoto && fotoUrl ? (
            <Image source={{ uri: fotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Feather name={ikon} size={22} color={colors.textMuted} />
          )}
        </View>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 10, fontWeight: '600', marginTop: 4 }}>
          {ek?.ad ?? 'Dosya'}
        </Text>
        <Text style={{ color: colors.textFaded, fontSize: 9, marginTop: 1 }}>
          {ek?.boyut ? `${(ek.boyut / 1024).toFixed(0)} KB` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSil}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={{
          position: 'absolute', top: -6, right: -6,
          width: 20, height: 20, borderRadius: 10,
          backgroundColor: '#ef4444',
          borderWidth: 2, borderColor: colors.bg,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Feather name="x" size={11} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

function CizimThumbnail({ cizim, onAcildi, onSilTikla }) {
  const [url, setUrl] = useState(null)
  const [hata, setHata] = useState(null)
  const { colors } = useTheme()

  useEffect(() => {
    if (!cizim?.path) {
      setHata('Çizim yolu yok')
      return
    }
    cizimSignedUrl(cizim.path)
      .then((u) => {
        if (u) setUrl(u)
        else setHata('URL alınamadı')
      })
      .catch((e) => setHata(e?.message ?? 'hata'))
  }, [cizim?.path])

  const tikla = async () => {
    // Önce cache'li URL'i kullan, yoksa yeniden iste
    if (url) {
      onAcildi(url)
      return
    }
    const yeniUrl = await cizimSignedUrl(cizim.path)
    if (yeniUrl) {
      setUrl(yeniUrl)
      onAcildi(yeniUrl)
    } else {
      Alert.alert('Açılamadı', `Çizim sunucudan alınamadı.\nPath: ${cizim?.path ?? 'yok'}`)
    }
  }

  return (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={tikla}
        activeOpacity={0.7}
        style={{
          width: 96, height: 96,
          borderRadius: 10,
          borderWidth: 1, borderColor: colors.border,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
      >
        {url ? (
          <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : hata ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
            <Feather name="alert-circle" size={18} color="#ef4444" />
            <Text style={{ fontSize: 9, color: '#ef4444', marginTop: 2, textAlign: 'center' }}>
              {hata}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="image" size={20} color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
      {/* Silme butonu — sağ üst */}
      <TouchableOpacity
        onPress={onSilTikla}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: 'absolute',
          top: -6, right: -6,
          width: 22, height: 22,
          borderRadius: 11,
          backgroundColor: '#ef4444',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: colors.bg,
        }}
      >
        <Feather name="x" size={12} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: {
    padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 14,
  },
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
  ekBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  ekBtnText: { fontSize: 12, fontWeight: '600' },
  kaydetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24,
    backgroundColor: '#22c55e',
    paddingVertical: 14, borderRadius: 12,
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  silBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10,
    paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  silText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
})
