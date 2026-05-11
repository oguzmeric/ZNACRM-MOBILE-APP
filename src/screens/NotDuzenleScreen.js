// Yeni/Mevcut not düzenleme ekranı.
// Başlık + içerik (textarea) + kategori + müşteri picker + çizim ekleri.

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, Image, Modal, FlatList,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { trIcerir } from '../utils/trSearch'
import {
  KATEGORILER, notuGetir, notEkle, notGuncelle, notSil,
  notCizimleriGuncelle, cizimSignedUrl, cizimSil,
} from '../services/notService'
import { musterileriGetir } from '../services/musteriService'
import CizimYapModal from '../components/CizimYapModal'

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
        setIcerik(not.icerik || '')
        setKategori(not.kategori || 'diger')
        setMusteriId(not.musteriId || null)
        setMusteri(not.musteri || null)
        setCizimler(not.cizimler || [])
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
    setKaydediliyor(true)
    const payload = {
      baslik: baslik.trim() || null,
      icerik: icerik.trim() || null,
      kategori,
      musteriId,
      cizimler,
    }
    let sonuc
    if (editMode) {
      sonuc = await notGuncelle(id, payload)
    } else {
      sonuc = await notEkle(kullanici.id, payload)
    }
    setKaydediliyor(false)
    if (!sonuc) {
      Alert.alert('Hata', 'Not kaydedilemedi.')
      return
    }
    navigation.goBack()
  }

  const sil = () => {
    Alert.alert('Notu Sil', 'Bu not ve içindeki çizimler silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await notSil(id)
            navigation.goBack()
          } catch (e) {
            Alert.alert('Hata', 'Silinemedi: ' + (e?.message ?? 'bilinmeyen'))
          }
        },
      },
    ])
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

        <Text style={[styles.label, { color: colors.textMuted }]}>İÇERİK</Text>
        <TextInput
          value={icerik}
          onChangeText={setIcerik}
          placeholder="Notunu buraya yaz…"
          placeholderTextColor={colors.textFaded}
          multiline
          textAlignVertical="top"
          style={[styles.input, { height: 200, backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />

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
