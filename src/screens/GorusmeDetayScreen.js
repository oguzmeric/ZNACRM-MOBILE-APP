import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { gorusmeGetir, gorusmeGuncelle } from '../services/gorusmeService'
import { gorusmeYorumlariGetir, gorusmeYorumEkle, gorusmeYorumSil, yorumEkiYukle } from '../services/gorusmeYorumService'
import { musterileriGetir } from '../services/musteriService'

const trIcerir = (haystack, q) => {
  if (!q) return true
  const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/i̇/g, 'i')
  return norm(haystack).includes(norm(q))
}

const DURUM_ETIKET = {
  acik: 'Açık',
  beklemede: 'Beklemede',
  kapali: 'Kapalı',
  tamamlandi: 'Tamamlandı',
  planlandi: 'Planlandı',
}
const DURUMLAR = ['acik', 'beklemede', 'kapali']
const IRTIBAT_SEKILLERI = ['Telefon', 'WhatsApp', 'E-posta', 'Yüz yüze', 'Video görüşme', 'Mesaj', 'Link']

export default function GorusmeDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { colors } = useTheme()
  const { kullanici, kullanicilar } = useAuth()
  const [g, setG] = useState(null)
  // Yorumlar (mig 184 — web ile AYNI tablo, tam senkron)
  const [yorumlar, setYorumlar] = useState([])
  const [yeniYorum, setYeniYorum] = useState('')
  const [yorumFotolar, setYorumFotolar] = useState([]) // local uri[]
  const [yorumGonderiliyor, setYorumGonderiliyor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [duzenleAcik, setDuzenleAcik] = useState(false)
  const [form, setForm] = useState(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [musteriler, setMusteriler] = useState([])
  const [firmaOneriGoster, setFirmaOneriGoster] = useState(false)

  useEffect(() => {
    musterileriGetir().then((v) => setMusteriler(v ?? [])).catch(() => setMusteriler([]))
  }, [])

  const firmaOneriler = useMemo(() => {
    if (!form?.firmaAdi) return musteriler.slice(0, 20)
    return musteriler
      .filter((m) => trIcerir(`${m.firma || ''} ${m.ad || ''} ${m.soyad || ''}`, form.firmaAdi))
      .slice(0, 20)
  }, [musteriler, form?.firmaAdi])

  const yukle = useCallback(async () => {
    const veri = await gorusmeGetir(id)
    setG(veri)
    gorusmeYorumlariGetir(id).then(setYorumlar).catch(() => {})
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // --- Yorum işlemleri (web ile aynı gorusme_yorumlari tablosu) ---
  const yorumFotoSec = () => {
    Alert.alert('Fotoğraf Ekle', 'Kaynak seç', [
      {
        text: 'Kamera',
        onPress: async () => {
          const izin = await ImagePicker.requestCameraPermissionsAsync()
          if (!izin.granted) { Alert.alert('İzin Gerekli', 'Kamera izni verin.'); return }
          const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
          if (!s.canceled) setYorumFotolar(p => [...p, s.assets[0].uri])
        },
      },
      {
        text: 'Galeri',
        onPress: async () => {
          const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (!izin.granted) { Alert.alert('İzin Gerekli', 'Galeri izni verin.'); return }
          const s = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7, allowsMultipleSelection: true, selectionLimit: 5,
          })
          if (!s.canceled) setYorumFotolar(p => [...p, ...s.assets.map(a => a.uri)])
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ])
  }

  const yorumGonder = async () => {
    if (!yeniYorum.trim() && yorumFotolar.length === 0) return
    setYorumGonderiliyor(true)
    try {
      const dosyalar = []
      for (const uri of yorumFotolar) dosyalar.push(await yorumEkiYukle(uri))
      const eklenen = await gorusmeYorumEkle({
        gorusmeId: g.id,
        kullaniciId: kullanici?.id,
        yazarAd: kullanici?.ad ?? '',
        icerik: yeniYorum.trim() || '(ek)',
        dosyalar,
      })
      setYorumlar(prev => [...prev, eklenen])
      setYeniYorum('')
      setYorumFotolar([])
    } catch (e) {
      Alert.alert('Hata', 'Yorum eklenemedi: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setYorumGonderiliyor(false)
    }
  }

  const yorumSilOnayli = (yorum) => {
    Alert.alert('Yorumu Sil', 'Bu yorum silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await gorusmeYorumSil(yorum.id)
            setYorumlar(prev => prev.filter(y => y.id !== yorum.id))
          } catch { Alert.alert('Hata', 'Yorum silinemedi.') }
        },
      },
    ])
  }

  const duzenleAc = () => {
    setForm({
      firmaAdi: g.firmaAdi || '',
      musteriId: g.musteriId || null,
      konu: g.konu || '',
      muhatapAd: g.muhatapAd || '',
      gorusen: g.gorusen || '',
      irtibatSekli: g.irtibatSekli || '',
      tarih: g.tarih || '',
      durum: g.durum || 'acik',
      takipNotu: g.takipNotu ?? g.notlar ?? '',
    })
    setFirmaOneriGoster(false)
    setDuzenleAcik(true)
  }

  const firmaSec = (m) => {
    setForm({
      ...form,
      firmaAdi: m.firma || '',
      musteriId: m.id,
      muhatapAd: form.muhatapAd || (m.ad && m.soyad ? `${m.ad} ${m.soyad}` : ''),
    })
    setFirmaOneriGoster(false)
  }

  const duzenleIptal = () => { setDuzenleAcik(false); setForm(null) }

  const duzenleKaydet = async () => {
    if (!form.konu?.trim()) {
      Alert.alert('Eksik bilgi', 'Konu zorunludur.')
      return
    }
    setKaydediliyor(true)
    try {
      const guncellenen = await gorusmeGuncelle(id, {
        firmaAdi: (form.firmaAdi || '').trim() || null,
        musteriId: form.musteriId || null,
        konu: form.konu.trim(),
        muhatapAd: (form.muhatapAd || '').trim(),
        gorusen: form.gorusen || '',
        irtibatSekli: form.irtibatSekli || null,
        tarih: form.tarih || null,
        durum: form.durum,
        takipNotu: form.takipNotu || null,
      })
      if (!guncellenen) {
        Alert.alert('Hata', 'Güncelleme başarısız oldu.')
        return
      }
      setG(guncellenen)
      setDuzenleAcik(false)
      setForm(null)
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Güncellenemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  const toggleGorusen = (ad) => {
    const list = (form.gorusen || '').split(',').map(x => x.trim()).filter(Boolean)
    const yeni = list.includes(ad) ? list.filter(x => x !== ad) : [...list, ad]
    setForm({ ...form, gorusen: yeni.join(', ') })
  }

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }

  if (!g) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textMuted, padding: 24, textAlign: 'center' }}>
          Görüşme bulunamadı.
        </Text>
      </ScreenContainer>
    )
  }

  const gorusenList = (g.gorusen || '').split(',').map(s => s.trim()).filter(Boolean)
  const formGorusenList = form ? (form.gorusen || '').split(',').map(s => s.trim()).filter(Boolean) : []

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Başlık */}
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.firmaAd, { color: colors.textPrimary }]}>{g.firmaAdi || '—'}</Text>
                {!!g.musteriAdi && (
                  <Text style={[styles.alt, { color: colors.textMuted }]}>{g.musteriAdi}</Text>
                )}
              </View>
              {!duzenleAcik && (
                <TouchableOpacity
                  onPress={duzenleAc}
                  style={[styles.duzenleBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={13} color={colors.textPrimary} />
                  <Text style={[styles.duzenleText, { color: colors.textPrimary }]}>Düzenle</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.rozetRow}>
              {!!g.konu && <Rozet renk={colors.primary} text={g.konu} />}
              {!!g.irtibatSekli && <Rozet renk={colors.info ?? '#06b6d4'} text={g.irtibatSekli} />}
              {!!g.durum && <Rozet renk={colors.warning ?? '#f59e0b'} text={DURUM_ETIKET[g.durum] ?? g.durum} />}
              {!!g.aktNo && <Rozet renk={colors.textMuted} text={g.aktNo} />}
            </View>
          </View>

          {duzenleAcik ? (
            /* DÜZENLEME FORMU */
            <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>FİRMA</Text>
              <TextInput
                value={form.firmaAdi}
                onChangeText={(t) => { setForm({ ...form, firmaAdi: t, musteriId: null }); setFirmaOneriGoster(true) }}
                onFocus={() => setFirmaOneriGoster(true)}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Müşteri seçmek için dokun veya yaz"
                placeholderTextColor={colors.textFaded}
              />
              {firmaOneriGoster && (
                <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {musteriler.length === 0 ? 'Yükleniyor…' : `${firmaOneriler.length} müşteri`}
                    </Text>
                    <TouchableOpacity onPress={() => setFirmaOneriGoster(false)} activeOpacity={0.7}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Kapat</Text>
                    </TouchableOpacity>
                  </View>
                  {firmaOneriler.length === 0 && musteriler.length > 0 ? (
                    <Text style={{ padding: 14, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                      Eşleşen müşteri yok. Yazılı olarak da kaydedebilirsin.
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {firmaOneriler.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => firmaSec(m)}
                          activeOpacity={0.7}
                          style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                            {m.firma || 'Firma yok'}
                          </Text>
                          {(m.ad || m.soyad) && (
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                              {[m.ad, m.soyad].filter(Boolean).join(' ')}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>KONU</Text>
              <TextInput
                value={form.konu}
                onChangeText={v => setForm({ ...form, konu: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Görüşme konusu"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>GÖRÜŞÜLEN KİŞİ</Text>
              <TextInput
                value={form.muhatapAd}
                onChangeText={v => setForm({ ...form, muhatapAd: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Karşı taraf"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>GÖRÜŞEN (bizden)</Text>
              {formGorusenList.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {formGorusenList.map(ad => (
                    <TouchableOpacity key={ad} onPress={() => toggleGorusen(ad)} style={styles.chipAktif}>
                      <Text style={styles.chipAktifText}>{ad} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(kullanicilar || []).filter(k => !formGorusenList.includes(k.ad)).map(k => (
                  <TouchableOpacity key={k.id} onPress={() => toggleGorusen(k.ad)} style={[styles.chipPasif, { borderColor: colors.border }]}>
                    <Text style={[styles.chipPasifText, { color: colors.textPrimary }]}>+ {k.ad}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>İRTİBAT ŞEKLİ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {IRTIBAT_SEKILLERI.map(s => {
                  const aktif = form.irtibatSekli === s
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setForm({ ...form, irtibatSekli: aktif ? '' : s })}
                      style={[aktif ? styles.chipAktif : styles.chipPasif, !aktif && { borderColor: colors.border }]}
                    >
                      <Text style={aktif ? styles.chipAktifText : [styles.chipPasifText, { color: colors.textPrimary }]}>{s}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>TARİH (YYYY-MM-DD)</Text>
              <TextInput
                value={form.tarih}
                onChangeText={v => setForm({ ...form, tarih: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="2026-07-01"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>DURUM</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DURUMLAR.map(d => {
                  const aktif = form.durum === d
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setForm({ ...form, durum: d })}
                      style={[aktif ? styles.chipAktif : styles.chipPasif, !aktif && { borderColor: colors.border }]}
                    >
                      <Text style={aktif ? styles.chipAktifText : [styles.chipPasifText, { color: colors.textPrimary }]}>{DURUM_ETIKET[d]}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>TAKİP NOTU</Text>
              <TextInput
                value={form.takipNotu}
                onChangeText={v => setForm({ ...form, takipNotu: v })}
                style={[styles.input, styles.textarea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Takip edilecek konular / notlar..."
                placeholderTextColor={colors.textFaded}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={duzenleKaydet}
                  disabled={kaydediliyor}
                  style={[styles.aksiyonBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0, opacity: kaydediliyor ? 0.6 : 1 }]}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.aksiyonText}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={duzenleIptal}
                  style={[styles.aksiyonBtnSecondary, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.aksiyonText, { color: colors.textPrimary }]}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Bilgiler */}
              <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Satir ikon="calendar" label="Tarih" value={g.tarih ? `${g.tarih}${g.saat ? ` · ${g.saat}` : ''}` : '—'} colors={colors} />
                {!!g.hazirlayan && (
                  <Satir ikon="user-plus" label="Hazırlayan" value={g.hazirlayan} colors={colors} />
                )}
                {gorusenList.length > 0 && (
                  <Satir ikon="users" label={`Görüşen (${gorusenList.length})`} value={gorusenList.join(', ')} colors={colors} />
                )}
                {!!g.muhatapAd && <Satir ikon="user" label="Görüşülen kişi" value={g.muhatapAd} colors={colors} />}
                {!!g.irtibatSekli && <Satir ikon="phone" label="İrtibat şekli" value={g.irtibatSekli} colors={colors} />}
                {!!g.aktNo && <Satir ikon="hash" label="Aktivite No" value={g.aktNo} colors={colors} />}
              </View>

              {/* Takip Notu */}
              {!!(g.takipNotu || g.notlar) && (
                <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>TAKİP NOTU</Text>
                  <Text style={[styles.notlar, { color: colors.textPrimary }]} selectable>
                    {g.takipNotu || g.notlar}
                  </Text>
                </View>
              )}

              {/* Aksiyonlar — bu görüşmeden 3 farklı iş oluştur */}
              {(() => {
                const konu = g.konu ? `Görüşme: ${g.konu}` : ''
                // Teklif/Servis: görüşme bağlamı context olarak açıklamaya girsin
                // (bu kayıtlar görüşmeye link tutmuyor).
                const aciklama = [
                  g.firmaAdi && `Firma: ${g.firmaAdi}`,
                  g.tarih && `Görüşme tarihi: ${g.tarih}${g.saat ? ' ' + g.saat : ''}`,
                  (g.takipNotu || g.notlar) && `\nNotlar:\n${g.takipNotu || g.notlar}`,
                ].filter(Boolean).join('\n')
                // Görev: görüşmeye zaten gorusme_id + müşteri ile bağlı → açıklamaya
                // Firma/tarih blob'u BASMA, yalnız asıl notu koy (web'de ham blob
                // görünüyordu; artık kayıt en baştan temiz).
                const gorevAciklama = (g.takipNotu || g.notlar || '').toString().trim()
                return (
                  <>
                    <TouchableOpacity
                      style={[styles.aksiyonBtn, { backgroundColor: colors.primary }]}
                      onPress={() => navigation.navigate('YeniGörev', {
                        baslangicGorusmeId: g.id,
                        baslangicMusteriId: g.musteriId,
                        baslangicLokasyonId: g.lokasyonId,
                        baslangicBaslik: konu,
                        baslangicAciklama: gorevAciklama,
                      })}
                      activeOpacity={0.85}
                    >
                      <Feather name="check-square" size={18} color="#fff" />
                      <Text style={styles.aksiyonText}>Görev Oluştur</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.aksiyonBtn, { backgroundColor: '#8b5cf6' }]}
                      onPress={() => navigation.navigate('YeniTeklif', {
                        baslangicMusteriId: g.musteriId,
                        baslangicKonu: g.konu || '',
                        baslangicAciklama: aciklama,
                      })}
                      activeOpacity={0.85}
                    >
                      <Feather name="file-text" size={18} color="#fff" />
                      <Text style={styles.aksiyonText}>Teklif Oluştur</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.aksiyonBtn, { backgroundColor: '#f59e0b' }]}
                      onPress={() => navigation.navigate('YeniServisTalebi', {
                        baslangicMusteriId: g.musteriId,
                        baslangicKonu: g.konu || '',
                        baslangicAciklama: aciklama,
                      })}
                      activeOpacity={0.85}
                    >
                      <Feather name="tool" size={18} color="#fff" />
                      <Text style={styles.aksiyonText}>Servis Talebi Oluştur</Text>
                    </TouchableOpacity>
                  </>
                )
              })()}

              {/* Yorumlar — web ile AYNI tablo (gorusme_yorumlari, mig 184) */}
              <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 10 }}>
                  Yorumlar ({yorumlar.length})
                </Text>

                {yorumlar.length === 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>Henüz yorum yok.</Text>
                )}
                {yorumlar.map((y) => {
                  const benimMi = String(y.yazarId ?? '') === String(kullanici?.id ?? '_')
                  const resimler = (y.dosyalar || []).filter(d => (d.type || '').startsWith('image/'))
                  return (
                    <View key={y.id} style={{
                      padding: 10, borderRadius: 10, borderWidth: 1,
                      borderColor: colors.border, backgroundColor: colors.background,
                      marginBottom: 8,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: '700' }}>{y.yazar}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 10.5 }}>{y.tarih}</Text>
                          {benimMi && (
                            <TouchableOpacity onPress={() => yorumSilOnayli(y)} hitSlop={8}>
                              <Feather name="trash-2" size={13} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {!!y.icerik && (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{y.icerik}</Text>
                      )}
                      {resimler.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {resimler.map((d, i) => (
                            <Image key={i} source={{ uri: d.url }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                          ))}
                        </View>
                      )}
                    </View>
                  )
                })}

                {/* Yeni yorum */}
                <View style={{ marginTop: 4 }}>
                  <TextInput
                    value={yeniYorum}
                    onChangeText={setYeniYorum}
                    placeholder="Yorum yaz…"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={{
                      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                      paddingHorizontal: 12, paddingVertical: 10, minHeight: 64,
                      color: colors.textPrimary, backgroundColor: colors.background,
                      textAlignVertical: 'top',
                    }}
                  />
                  {yorumFotolar.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {yorumFotolar.map((uri, i) => (
                        <View key={uri + i}>
                          <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                          <TouchableOpacity
                            onPress={() => setYorumFotolar(p => p.filter((_, j) => j !== i))}
                            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Feather name="x" size={11} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={yorumFotoSec}
                      disabled={yorumGonderiliyor}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
                      }}
                      activeOpacity={0.8}
                    >
                      <Feather name="camera" size={15} color={colors.primary} />
                      <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: '600' }}>Foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={yorumGonder}
                      disabled={yorumGonderiliyor}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        paddingVertical: 10, borderRadius: 10,
                        backgroundColor: colors.primary, opacity: yorumGonderiliyor ? 0.6 : 1,
                      }}
                      activeOpacity={0.85}
                    >
                      {yorumGonderiliyor
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Feather name="send" size={15} color="#fff" />}
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                        {yorumGonderiliyor ? 'Gönderiliyor…' : 'Yorum Ekle'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

function Rozet({ text, renk }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: renk + '22', marginRight: 6, marginBottom: 4 }}>
      <Text style={{ color: renk, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  )
}

function Satir({ ikon, label, value, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={ikon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  kart: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  firmaAd: { fontSize: 18, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 4 },
  rozetRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  notlar: { fontSize: 13, lineHeight: 20 },
  duzenleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  duzenleText: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chipAktif: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  chipAktifText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  chipPasif: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  chipPasifText: { fontSize: 11, fontWeight: '500' },
  dropdown: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  aksiyonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  aksiyonBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  aksiyonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
