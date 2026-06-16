import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import { Image } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { servisEkiYukle } from '../services/servisEkService'
import MalzemePlanModal from '../components/MalzemePlanModal'
import ImzaModal from '../components/ImzaModal'
import {
  malzemePlaniGetir,
  malzemePlanEkle,
  malzemePlanGuncelle,
  malzemePlanSil,
} from '../services/servisMalzemeService'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  servisTalepGetir,
  servisTalepGuncelle,
  durumGuncelle,
  notEkle,
  servisTalepSil,
} from '../services/servisService'
import {
  DURUM_LISTESI,
  turBul,
  aciliyetBul,
  durumBul,
} from '../utils/servisConstants'
import { tarihFormat, tarihSaatFormat } from '../utils/format'
import ServisFormuOnizleModal from '../components/ServisFormuOnizleModal'
import BelgePaylasModal from '../components/BelgePaylasModal'
import { arsivListele, arsivSignedUrl } from '../services/servisFormuArsivService'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export default function ServisTalebiDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { kullanici, mod } = useAuth()
  const { colors } = useTheme()
  const adminModu = mod === 'admin'
  const headerHeight = useHeaderHeight()
  const [talep, setTalep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [yeniNot, setYeniNot] = useState('')
  const [notKaydediliyor, setNotKaydediliyor] = useState(false)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)

  // Tespit + Yapılan Müdahale (PDF formundaki ayrı alanlar)
  const [tespit, setTespit] = useState('')
  const [yapilanMudahale, setYapilanMudahale] = useState('')
  const [tespitKaydediliyor, setTespitKaydediliyor] = useState(false)
  const [mudahaleKaydediliyor, setMudahaleKaydediliyor] = useState(false)
  const [tespitDuzenle, setTespitDuzenle] = useState(false)
  const [mudahaleDuzenle, setMudahaleDuzenle] = useState(false)

  // Malzeme planı
  const [malzemePlani, setMalzemePlani] = useState([])
  const [malzemeModalOpen, setMalzemeModalOpen] = useState(false)
  const [duzenlenenPlan, setDuzenlenenPlan] = useState(null)

  // İmza
  const [imzaModalOpen, setImzaModalOpen] = useState(false)

  // Servis formu
  const [formModalOpen, setFormModalOpen] = useState(false)
  const formUretiliyor = false  // uyum için

  // Form arşivi
  const [arsiv, setArsiv] = useState([])
  const [arsivYukleniyor, setArsivYukleniyor] = useState(false)
  const [arsivAcikItemId, setArsivAcikItemId] = useState(null)
  const [gecmisAcik, setGecmisAcik] = useState(false)
  const [fotoOnizleUrl, setFotoOnizleUrl] = useState(null)
  const [paylasAcik, setPaylasAcik] = useState(false)

  const yukleArsiv = useCallback(async () => {
    if (!talep?.id) return
    setArsivYukleniyor(true)
    try {
      const data = await arsivListele(talep.id)
      setArsiv(data)
    } finally {
      setArsivYukleniyor(false)
    }
  }, [talep?.id])

  useEffect(() => { yukleArsiv() }, [yukleArsiv])

  const arsivPaylas = async (item) => {
    try {
      setArsivAcikItemId(item.id)
      const url = await arsivSignedUrl(item.dosyaYolu)
      if (!url) {
        Alert.alert('Hata', 'Dosya bağlantısı oluşturulamadı.')
        return
      }
      const lokal = `${FileSystem.cacheDirectory}arsiv_${item.id}.pdf`
      const indirme = await FileSystem.downloadAsync(url, lokal)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(indirme.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Servis Formu',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Bilgi', 'Cihazda paylaşım yok.')
      }
    } catch (e) {
      Alert.alert('Hata', 'Form açılamadı: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setArsivAcikItemId(null)
    }
  }

  const servisFormuAksiyon = () => {
    if (!talep) return
    setFormModalOpen(true)
  }

  const yukle = useCallback(async () => {
    const [t, mp] = await Promise.all([
      servisTalepGetir(id),
      malzemePlaniGetir(id),
    ])
    setTalep(t)
    setMalzemePlani(mp ?? [])
    setTespit(t?.kokSebep ?? '')
    setYapilanMudahale(t?.yapilanMudahale ?? '')
    setLoading(false)
  }, [id])

  const tespitKaydet = async () => {
    setTespitKaydediliyor(true)
    const guncel = await servisTalepGuncelle(id, { kokSebep: tespit.trim() || null })
    setTespitKaydediliyor(false)
    if (guncel) {
      setTalep(guncel)
      setTespit(guncel.kokSebep ?? '')
      setTespitDuzenle(false)
    } else {
      Alert.alert('Hata', 'Kaydedilemedi.')
    }
  }

  const mudahaleKaydet = async () => {
    setMudahaleKaydediliyor(true)
    const guncel = await servisTalepGuncelle(id, { yapilanMudahale: yapilanMudahale.trim() || null })
    setMudahaleKaydediliyor(false)
    if (guncel) {
      setTalep(guncel)
      setYapilanMudahale(guncel.yapilanMudahale ?? '')
      setMudahaleDuzenle(false)
    } else {
      Alert.alert('Hata', 'Kaydedilemedi.')
    }
  }

  const tespitVazgec = () => {
    setTespit(talep?.kokSebep ?? '')
    setTespitDuzenle(false)
  }
  const mudahaleVazgec = () => {
    setYapilanMudahale(talep?.yapilanMudahale ?? '')
    setMudahaleDuzenle(false)
  }

  const malzemeKaydet = async (plan) => {
    if (duzenlenenPlan) {
      const guncel = await malzemePlanGuncelle(duzenlenenPlan.id, plan)
      if (guncel) {
        setMalzemePlani((prev) => prev.map((p) => (p.id === duzenlenenPlan.id ? guncel : p)))
      }
    } else {
      const yeni = await malzemePlanEkle({ ...plan, servisTalepId: id })
      if (yeni) setMalzemePlani((prev) => [...prev, yeni])
    }
    setDuzenlenenPlan(null)
  }

  const imzaKaydet = async (base64, teslimAlanAd) => {
    try {
      const guncel = await servisTalepGuncelle(id, {
        musteriImza: base64,
        teslimAlanAd: teslimAlanAd ?? null,
      })
      if (!guncel) {
        throw new Error('Veritabanı güncellenemedi')
      }
      setTalep(guncel)
    } catch (e) {
      console.error('[Imza kaydet] Hata:', e)
      throw e
    }
  }

  const imzaSil = () => {
    Alert.alert('İmzayı kaldır', 'Mevcut imza silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const guncel = await servisTalepGuncelle(id, { musteriImza: null })
          if (guncel) setTalep(guncel)
        },
      },
    ])
  }

  const malzemeSil = (planId) => {
    Alert.alert('Malzemeyi kaldır', 'Bu plan satırı silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await malzemePlanSil(planId)
            setMalzemePlani((prev) => prev.filter((p) => p.id !== planId))
          } catch (e) {
            Alert.alert('Hata', 'Malzeme silinemedi: ' + (e?.message ?? 'bilinmeyen'))
          }
        },
      },
    ])
  }

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const durumDegistir = async (yeniDurum) => {
    if (yeniDurum === talep?.durum) return

    // "Tamamlandı" için: (1) tüm planlı malzemeler teslim alınmış olmalı (S/N okutulmuş)
    //                    (2) müşteri imzası alınmış olmalı
    if (yeniDurum === 'tamamlandi') {
      // (1) Plan satırlarından eksik teslim alınanlar var mı?
      const eksikler = (malzemePlani || []).filter((p) => {
        const planli = Number(p.planliMiktar ?? 0)
        const teslim = Number(p.teslimAlinanMiktar ?? 0)
        const kullanilan = Number(p.kullanilanMiktar ?? 0)
        // Bulk (sarf) için: teslim VEYA kullanılan en az 1 olsun yeter
        // S/N'lik için: teslim alınan = planlı miktar olmalı
        if (p.tip === 'bulk') return planli > 0 && teslim === 0 && kullanilan === 0
        return planli > 0 && teslim < planli
      })
      if (eksikler.length > 0) {
        const ozet = eksikler.slice(0, 3).map((p) => `• ${p.stokAdi || p.stokKodu}`).join('\n')
        const ekstra = eksikler.length > 3 ? `\n…ve ${eksikler.length - 3} tane daha` : ''
        Alert.alert(
          'Eksik Teslim Alma',
          `Aşağıdaki malzemeler için seri numarası okutulmadı / teslim alınmadı:\n\n${ozet}${ekstra}\n\n"Teslim Al" ekranından S/N okutmadan servis kapatılamaz.`,
          [{ text: 'Tamam' }]
        )
        return
      }

      // (2) Müşteri imzası
      if (!talep?.musteriImza) {
        Alert.alert(
          'Müşteri İmzası Gerekli',
          'Servisi tamamlamadan önce müşteri imzasını almalısın. Aşağıdaki "İmza Al" butonuyla imzayı aldıktan sonra tekrar dene.',
          [{ text: 'Tamam' }]
        )
        return
      }
      Alert.alert(
        'Servisi Kapat',
        'Müşteri imzası alındı. Servis "Tamamlandı" olarak kapansın mı?',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Kapat',
            onPress: async () => {
              setUpdating(true)
              const guncel = await durumGuncelle(id, 'tamamlandi', kullanici?.ad)
              setUpdating(false)
              if (guncel) setTalep(guncel)
            },
          },
        ]
      )
      return
    }

    setUpdating(true)
    const guncel = await durumGuncelle(id, yeniDurum, kullanici?.ad)
    setUpdating(false)
    if (guncel) setTalep(guncel)
    else Alert.alert('Hata', 'Durum güncellenemedi.')
  }

  const notKaydet = async () => {
    if (!yeniNot.trim()) return
    setNotKaydediliyor(true)
    const guncel = await notEkle(id, yeniNot.trim(), kullanici?.ad)
    setNotKaydediliyor(false)
    if (guncel) {
      setTalep(guncel)
      setYeniNot('')
    } else {
      Alert.alert('Hata', 'Not eklenemedi.')
    }
  }

  // Atanan teknisyen veya admin foto ekleyebilir
  const fotoYetkisi = adminModu || (talep && kullanici && talep.atananKullaniciId === kullanici.id)

  const fotoSec = (kaynak) => {
    if (!fotoYetkisi) return
    const acilis = kaynak === 'kamera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync
    return acilis({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
  }

  const fotoEkle = async (kaynak) => {
    try {
      // İzin
      if (kaynak === 'kamera') {
        const izin = await ImagePicker.requestCameraPermissionsAsync()
        if (!izin.granted) {
          Alert.alert('İzin gerekli', 'Kamera erişimi reddedildi.')
          return
        }
      } else {
        const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!izin.granted) {
          Alert.alert('İzin gerekli', 'Galeri erişimi reddedildi.')
          return
        }
      }

      const sonuc = await fotoSec(kaynak)
      if (!sonuc || sonuc.canceled || !sonuc.assets?.[0]?.uri) return

      setFotoYukleniyor(true)
      const yuklenen = await servisEkiYukle(talep.id, sonuc.assets[0].uri)
      if (!yuklenen.ok) {
        setFotoYukleniyor(false)
        Alert.alert('Yüklenemedi', yuklenen.hata ?? 'Bilinmeyen hata')
        return
      }

      // Mevcut dosyalar dizisine ekle
      const yeniDosya = {
        url: yuklenen.url,
        ad: `Foto-${Date.now()}`,
        tip: 'image',
        ekleyen: kullanici?.ad ?? null,
        eklenme: new Date().toISOString(),
      }
      const yeniDosyalar = [...(talep.dosyalar ?? []), yeniDosya]
      const guncel = await servisTalepGuncelle(talep.id, { dosyalar: yeniDosyalar })
      setFotoYukleniyor(false)
      if (guncel) {
        setTalep(guncel)
      } else {
        Alert.alert('Kaydedilemedi', 'Foto yüklendi ama talep güncellenemedi.')
      }
    } catch (e) {
      setFotoYukleniyor(false)
      Alert.alert('Hata', String(e?.message ?? e))
    }
  }

  const fotoSecimSor = () => {
    Alert.alert('Fotoğraf Ekle', 'Kaynak seç', [
      { text: 'Kamera', onPress: () => fotoEkle('kamera') },
      { text: 'Galeri', onPress: () => fotoEkle('galeri') },
      { text: 'Vazgeç', style: 'cancel' },
    ])
  }

  // talep.dosyalar içindeki görseller (forma da bunlar gidiyor)
  const fotograflar = (talep?.dosyalar ?? []).filter(
    (d) => d?.tip === 'image' || /\.(jpe?g|png|webp)(\?|$)/i.test(d?.url ?? '')
  )

  const fotoSil = (hedef) => {
    if (!fotoYetkisi) return
    Alert.alert('Fotoğrafı sil', 'Bu fotoğraf formdan da kaldırılacak. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const yeniDosyalar = (talep.dosyalar ?? []).filter((d) => d.url !== hedef.url)
          const guncel = await servisTalepGuncelle(talep.id, { dosyalar: yeniDosyalar })
          if (guncel) setTalep(guncel)
          else Alert.alert('Hata', 'Fotoğraf silinemedi.')
        },
      },
    ])
  }

  const sil = () => {
    Alert.alert('Talebi sil', 'Emin misin? Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await servisTalepSil(id)
          navigation.goBack()
        },
      },
    ])
  }

  const ara = (tel) => {
    if (!tel) return
    Linking.openURL(`tel:${tel.replace(/\s/g, '')}`)
  }

  const harita = (lokasyon, firma) => {
    const q = encodeURIComponent([firma, lokasyon].filter(Boolean).join(' '))
    if (!q) return
    const url = Platform.OS === 'ios' ? `maps://?q=${q}` : `geo:0,0?q=${q}`
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`)
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    )
  }

  if (!talep) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted }}>Talep bulunamadı.</Text>
      </View>
    )
  }

  const tur = turBul(talep.anaTur)
  const aciliyet = aciliyetBul(talep.aciliyet)
  const durum = durumBul(talep.durum)

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Text style={[styles.talepNo, { color: colors.primary }]}>{talep.talepNo ?? `#${talep.id}`}</Text>

        <View style={styles.badgeRow}>
          {tur && (
            <View style={[styles.badge, { backgroundColor: tur.renk + '22', borderColor: tur.renk }]}>
              <Text style={[styles.badgeText, { color: tur.renk }]}>{tur.ikon} {tur.isim}</Text>
            </View>
          )}
          {durum && (
            <View style={[styles.badge, { backgroundColor: durum.renk + '22', borderColor: durum.renk }]}>
              <Text style={[styles.badgeText, { color: durum.renk }]}>{durum.ikon} {durum.isim}</Text>
            </View>
          )}
          {aciliyet && (
            <View style={[styles.badge, { backgroundColor: aciliyet.renk + '22', borderColor: aciliyet.renk }]}>
              <Text style={[styles.badgeText, { color: aciliyet.renk }]}>{aciliyet.ikon} {aciliyet.isim}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.firma, { color: colors.textPrimary }]}>{talep.firmaAdi || talep.musteriAd || '—'}</Text>

        {!!talep.konu && (
          <View style={[styles.konuBox, { backgroundColor: colors.surface, borderLeftColor: colors.info }]}>
            <Text style={[styles.konu, { color: colors.textPrimary }]}>{talep.konu}</Text>
          </View>
        )}

        {!!talep.aciklama && (
          <Field label="Açıklama" deger={talep.aciklama} multi />
        )}

        <View style={styles.row2}>
          <Field label="Lokasyon" deger={talep.lokasyon} flex onPress={talep.lokasyon ? () => harita(talep.lokasyon, talep.firmaAdi) : null} ikon="📍" />
          <Field label="Cihaz" deger={talep.cihazTuru} flex />
        </View>

        <View style={styles.row2}>
          <Field label="İlgili Kişi" deger={talep.ilgiliKisi} flex />
          <Field label="Telefon" deger={talep.telefon} flex onPress={talep.telefon ? () => ara(talep.telefon) : null} ikon="📞" />
        </View>

        <View style={styles.row2}>
          <Field label="Atanan" deger={talep.atananKullaniciAd} flex />
          <Field label="Planlı Tarih" deger={tarihFormat(talep.planliTarih)} flex />
        </View>

        <Field label="Uygun Zaman" deger={talep.uygunZaman} />
        <Field label="Oluşturuldu" deger={tarihSaatFormat(talep.olusturmaTarihi)} />

        {/* Malzeme Planı */}
        <View style={styles.malzemeHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>📦 Malzeme Planı ({malzemePlani.length})</Text>
          <TouchableOpacity
            style={[styles.ekleGhost, { borderColor: colors.primaryLight + '55', backgroundColor: colors.primaryLight + '15' }]}
            onPress={() => {
              setDuzenlenenPlan(null)
              setMalzemeModalOpen(true)
            }}
          >
            <Feather name="plus" size={13} color="#60a5fa" />
            <Text style={styles.ekleGhostText}>Ekle</Text>
          </TouchableOpacity>
        </View>

        {malzemePlani.length > 0 && (
          <View style={styles.malzemeToolbar}>
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnPrimary]}
              onPress={() => navigation.navigate('MalzemeTeslimAl', { servisTalepId: id })}
              activeOpacity={0.85}
            >
              <Feather name="package" size={15} color="#fff" />
              <Text style={styles.toolbarBtnText}>Teslim Al</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnSecondary]}
              onPress={() => navigation.navigate('MalzemeKullan', { servisTalepId: id })}
              activeOpacity={0.85}
            >
              <Feather name="tool" size={15} color="#cbd5e1" />
              <Text style={[styles.toolbarBtnText, { color: '#cbd5e1' }]}>Kullan</Text>
            </TouchableOpacity>
          </View>
        )}

        {malzemePlani.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz planlanmış malzeme yok. Operatör olarak iş için ihtiyaç olanları ekleyebilirsin.</Text>
        ) : (
          malzemePlani.map((p) => {
            const teslim = p.teslimAlinanMiktar ?? 0
            const kullanilan = p.kullanilanMiktar ?? 0
            const tamamTeslim = teslim >= p.planliMiktar
            const teslimPct = Math.min(100, Math.round((teslim / Math.max(p.planliMiktar, 1)) * 100))
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.malzemeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setDuzenlenenPlan(p)
                  setMalzemeModalOpen(true)
                }}
                activeOpacity={0.85}
              >
                <View style={styles.malzemeHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.malzemeAd, { color: colors.textPrimary }]} numberOfLines={1}>
                      {p.stokAdi || p.stokKodu}
                    </Text>
                    <Text style={[styles.malzemeKodu, { color: colors.textFaded }]}>{p.stokKodu}</Text>
                  </View>
                  {tamamTeslim && (
                    <View style={styles.tamamChip}>
                      <Feather name="check" size={11} color="#22c55e" />
                      <Text style={styles.tamamChipText}>Tamam</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.()
                      malzemeSil(p.id)
                    }}
                    hitSlop={10}
                    style={styles.silIkonBtn}
                  >
                    <Feather name="trash-2" size={14} color={colors.textFaded} />
                  </TouchableOpacity>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${teslimPct}%`, backgroundColor: tamamTeslim ? '#22c55e' : '#60a5fa' },
                    ]}
                  />
                </View>

                <View style={styles.malzemeFooterRow}>
                  <Text style={[styles.malzemeFooterLabel, { color: colors.textFaded }]}>
                    Planlı <Text style={[styles.malzemeFooterValue, { color: colors.textSecondary }]}>{p.planliMiktar} {p.birim}</Text>
                  </Text>
                  <Text style={[styles.malzemeFooterLabel, { color: colors.textFaded }]}>
                    Teslim <Text style={[styles.malzemeFooterValue, { color: colors.textSecondary }]}>{teslim}</Text>
                    {kullanilan > 0 && (
                      <>
                        {'  ·  Kullanıldı '}
                        <Text style={[styles.malzemeFooterValue, { color: colors.textSecondary }]}>{kullanilan}</Text>
                      </>
                    )}
                  </Text>
                </View>

                {!!p.notMetni && <Text style={[styles.malzemeNot, { color: colors.textMuted }]}>{p.notMetni}</Text>}
              </TouchableOpacity>
            )
          })
        )}

        {/* Tespit (PDF'te "Tespit" başlığı altında görünür) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>
            🔎 Tespit
          </Text>
          {!tespitDuzenle && (
            <TouchableOpacity onPress={() => setTespitDuzenle(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="edit-2" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Düzenle</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          {tespitDuzenle ? (
            <>
              <TextInput
                value={tespit}
                onChangeText={setTespit}
                placeholder="Tespit edilen durum / sorunun sebebi"
                placeholderTextColor={colors.textFaded}
                multiline
                autoFocus
                textAlignVertical="top"
                style={{ minHeight: 80, color: colors.textPrimary, fontSize: 13 }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={tespitVazgec} disabled={tespitKaydediliyor} activeOpacity={0.85} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={tespitKaydet} disabled={tespitKaydediliyor} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, opacity: tespitKaydediliyor ? 0.6 : 1 }}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{tespitKaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={{ color: talep.kokSebep ? colors.textPrimary : colors.textFaded, fontSize: 13, lineHeight: 18, fontStyle: talep.kokSebep ? 'normal' : 'italic' }}>
              {talep.kokSebep || 'Henüz tespit girilmedi. Düzenle ile ekleyebilirsin.'}
            </Text>
          )}
        </View>

        {/* Yapılan Müdahale */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>
            🛠 Yapılan Müdahale
          </Text>
          {!mudahaleDuzenle && (
            <TouchableOpacity onPress={() => setMudahaleDuzenle(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="edit-2" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Düzenle</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          {mudahaleDuzenle ? (
            <>
              <TextInput
                value={yapilanMudahale}
                onChangeText={setYapilanMudahale}
                placeholder="Yapılan işlem / müdahale detayı"
                placeholderTextColor={colors.textFaded}
                multiline
                autoFocus
                textAlignVertical="top"
                style={{ minHeight: 80, color: colors.textPrimary, fontSize: 13 }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={mudahaleVazgec} disabled={mudahaleKaydediliyor} activeOpacity={0.85} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={mudahaleKaydet} disabled={mudahaleKaydediliyor} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, opacity: mudahaleKaydediliyor ? 0.6 : 1 }}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{mudahaleKaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={{ color: talep.yapilanMudahale ? colors.textPrimary : colors.textFaded, fontSize: 13, lineHeight: 18, fontStyle: talep.yapilanMudahale ? 'normal' : 'italic' }}>
              {talep.yapilanMudahale || 'Henüz müdahale girilmedi. Düzenle ile ekleyebilirsin.'}
            </Text>
          )}
        </View>

        {/* Durum değiştir — role göre filtre */}
        <Text style={[styles.sectionLabel, { marginTop: 20, color: colors.textMuted }]}>Durumu Değiştir</Text>
        <View style={styles.durumGrid}>
          {DURUM_LISTESI.filter((d) => {
            // Admin: tüm durumlar + iptal
            if (adminModu) return true
            // Teknisyen: sadece iş akışı durumları (onay/ret/iptal admin'e ait)
            return ['bekliyor', 'inceleniyor', 'atandi', 'devam_ediyor', 'tamamlandi'].includes(d.id)
          }).map((d) => {
            const aktif = talep.durum === d.id
            return (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.durumBtn,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  aktif && { backgroundColor: d.renk, borderColor: d.renk },
                ]}
                onPress={() => durumDegistir(d.id)}
                disabled={updating}
              >
                <Text style={[styles.durumBtnText, { color: colors.textSecondary }, aktif && { color: '#fff' }]}>
                  {d.ikon} {d.isim}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Notlar timeline */}
        <Text style={[styles.sectionLabel, { marginTop: 12, color: colors.textMuted }]}>
          Notlar ({(talep.notlar ?? []).length})
        </Text>

        <View style={styles.notInputRow}>
          <TextInput
            style={[styles.notInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
            placeholder="Yeni not..."
            placeholderTextColor={colors.textFaded}
            value={yeniNot}
            onChangeText={setYeniNot}
            multiline
          />
          <TouchableOpacity
            style={[styles.notKaydetBtn, { backgroundColor: colors.success }, (!yeniNot.trim() || notKaydediliyor) && { opacity: 0.4 }]}
            onPress={notKaydet}
            disabled={!yeniNot.trim() || notKaydediliyor}
          >
            <Text style={styles.notKaydetText}>{notKaydediliyor ? '...' : 'Ekle'}</Text>
          </TouchableOpacity>
        </View>

        {(talep.notlar ?? []).length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz not yok.</Text>
        ) : (
          [...(talep.notlar ?? [])].reverse().map((n, i) => (
            <View key={i} style={[styles.notCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.notMetin, { color: colors.textPrimary }]}>{n.metin}</Text>
              <Text style={[styles.notMeta, { color: colors.textFaded }]}>
                {n.kullanici ?? '—'} · {tarihSaatFormat(n.tarih)}
              </Text>
            </View>
          ))
        )}

        {/* Durum geçmişi — varsayılan son durum, gerisi katlanır */}
        {(talep.durumGecmisi ?? []).length > 0 && (() => {
          const tumGecmis = [...(talep.durumGecmisi ?? [])].reverse()
          const gosterilen = gecmisAcik ? tumGecmis : tumGecmis.slice(0, 1)
          const gizliSayi = tumGecmis.length - gosterilen.length
          return (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24, color: colors.textMuted }]}>Durum Geçmişi</Text>
              {gosterilen.map((g, i) => {
                const d = durumBul(g.durum)
                return (
                  <View key={i} style={[styles.gecmisCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.gecmisDurum, { color: d?.renk ?? colors.textMuted }]}>
                      {d?.ikon} {d?.isim ?? g.durum}
                    </Text>
                    <Text style={[styles.notMeta, { color: colors.textFaded }]}>
                      {g.kullanici ?? '—'} · {tarihSaatFormat(g.tarih)}
                    </Text>
                  </View>
                )
              })}
              {tumGecmis.length > 1 && (
                <TouchableOpacity
                  style={styles.gecmisToggle}
                  onPress={() => setGecmisAcik((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.gecmisToggleText, { color: colors.primary }]}>
                    {gecmisAcik ? 'Daha az göster' : `Tüm geçmişi göster (${gizliSayi})`}
                  </Text>
                  <Feather
                    name={gecmisAcik ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </>
          )
        })()}

        {/* Fotoğraflar — forma 2. sayfa olarak da eklenir */}
        <View style={styles.imzaHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            📷 Fotoğraflar{fotograflar.length > 0 ? ` (${fotograflar.length})` : ''}
          </Text>
          {fotoYetkisi && (
            <TouchableOpacity
              style={styles.fotoEkleBtn}
              onPress={fotoSecimSor}
              disabled={fotoYukleniyor}
              activeOpacity={0.85}
            >
              {fotoYukleniyor ? (
                <ActivityIndicator size="small" color="#60a5fa" />
              ) : (
                <>
                  <Feather name="camera" size={13} color="#60a5fa" />
                  <Text style={styles.fotoEkleText}>Ekle</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        {fotograflar.length > 0 ? (
          <View style={styles.fotoGrid}>
            {fotograflar.map((d, i) => (
              <View key={d.url ?? i} style={styles.fotoThumbWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFotoOnizleUrl(d.url)}
                  style={styles.fotoThumb}
                >
                  <Image source={{ uri: d.url }} style={styles.fotoThumbImg} resizeMode="cover" />
                </TouchableOpacity>
                {fotoYetkisi && (
                  <TouchableOpacity style={styles.fotoSilBtn} onPress={() => fotoSil(d)}>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.bos, { color: colors.textFaded }]}>
            {fotoYetkisi ? 'Henüz fotoğraf yok — "Ekle" ile çek/yükle' : 'Fotoğraf eklenmemiş'}
          </Text>
        )}

        {/* Müşteri imzası */}
        <View style={styles.imzaHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>✍️ Müşteri İmzası</Text>
          {!!talep.musteriImza && (
            <TouchableOpacity style={styles.imzaSilBtn} onPress={imzaSil}>
              <Feather name="trash-2" size={12} color="#ef4444" />
              <Text style={styles.imzaSilText}>Kaldır</Text>
            </TouchableOpacity>
          )}
        </View>
        {talep.musteriImza ? (
          <TouchableOpacity
            onPress={() => setImzaModalOpen(true)}
            activeOpacity={0.85}
            style={styles.imzaKart}
          >
            <Image
              source={{ uri: talep.musteriImza }}
              style={{ width: '100%', height: 120 }}
              resizeMode="contain"
            />
            <Text style={styles.imzaAltYazi}>İmza alındı · Dokunup değiştir</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.imzaAlBtn}
            onPress={() => setImzaModalOpen(true)}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={18} color="#60a5fa" />
            <Text style={styles.imzaAlText}>İmza Al</Text>
          </TouchableOpacity>
        )}

        {/* Hızlı kapatma butonu — imza varsa göster */}
        {['bekliyor', 'inceleniyor', 'atandi', 'devam_ediyor'].includes(talep.durum) && (
          <TouchableOpacity
            style={[styles.akisBtnYesil, !talep.musteriImza && { backgroundColor: '#475569', shadowOpacity: 0 }]}
            onPress={() => durumDegistir('tamamlandi')}
            activeOpacity={0.85}
          >
            <Feather name={talep.musteriImza ? 'check-circle' : 'lock'} size={18} color="#fff" />
            <Text style={styles.akisBtnText}>
              {talep.musteriImza ? 'Servisi Kapat (Tamamlandı)' : 'Önce İmza Al'}
            </Text>
          </TouchableOpacity>
        )}

        {talep.durum === 'tamamlandi' && (
          <>
            <View style={styles.tamamlandiBox}>
              <Feather name="check-circle" size={18} color="#22c55e" />
              <Text style={styles.tamamlandiText}>
                Servis Tamamlandı · Onay bekliyor
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.formuAcBtn, { backgroundColor: colors.primary }]}
              onPress={servisFormuAksiyon}
              activeOpacity={0.88}
            >
              <Feather name="file-text" size={18} color="#fff" />
              <Text style={styles.formuAcBtnText}>Servis Formunu Görüntüle</Text>
              <Feather name="chevron-right" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formuAcBtn, { backgroundColor: '#2563eb', marginTop: 8 }]}
              onPress={() => setPaylasAcik(true)}
              activeOpacity={0.88}
            >
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.formuAcBtnText}>Müşteriye Gönder</Text>
              <Feather name="chevron-right" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Form Arşivi */}
            <View style={[styles.arsivBolum, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.arsivBaslikRow}>
                <Feather name="archive" size={16} color={colors.textMuted} />
                <Text style={[styles.arsivBaslik, { color: colors.textMuted }]}>
                  Form Arşivi {arsiv.length > 0 ? `(${arsiv.length})` : ''}
                </Text>
              </View>

              {arsivYukleniyor ? (
                <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 8 }} />
              ) : arsiv.length === 0 ? (
                <Text style={[styles.arsivBosText, { color: colors.textFaded }]}>
                  Henüz form arşivlenmedi. Formu paylaş veya kaydet — otomatik arşivlenir.
                </Text>
              ) : (
                arsiv.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => arsivPaylas(item)}
                    activeOpacity={0.75}
                    disabled={arsivAcikItemId === item.id}
                    style={[styles.arsivItem, { borderColor: colors.border }]}
                  >
                    <Feather name="file-text" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.arsivItemTarih, { color: colors.textPrimary }]} numberOfLines={1}>
                        {new Date(item.olusturmaTarih).toLocaleString('tr-TR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                      <Text style={[styles.arsivItemAlt, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.olusturanAd || 'Bilinmeyen kullanıcı'}
                        {item.boyut ? ` · ${Math.round(item.boyut / 1024)} KB` : ''}
                      </Text>
                    </View>
                    {arsivAcikItemId === item.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Feather name="share-2" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        {talep.durum === 'onaylandi' && (
          <View style={[styles.tamamlandiBox, { backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.4)' }]}>
            <Feather name="check-circle" size={18} color="#059669" />
            <Text style={[styles.tamamlandiText, { color: '#059669' }]}>
              Servis Onaylandı · Kapandı
            </Text>
          </View>
        )}

        {talep.durum === 'reddedildi' && (
          <View style={[styles.tamamlandiBox, { backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.4)' }]}>
            <Feather name="x-circle" size={18} color="#dc2626" />
            <Text style={[styles.tamamlandiText, { color: '#dc2626' }]}>
              Reddedildi · Teknisyene geri döndü
            </Text>
          </View>
        )}

        {/* Admin onay aksiyonları — sadece admin modda ve tamamlandi durumunda */}
        {adminModu && talep.durum === 'tamamlandi' && (
          <View style={styles.onayRow}>
            <TouchableOpacity
              style={[styles.onayBtn, { backgroundColor: '#059669' }]}
              onPress={() => {
                Alert.alert(
                  'Servisi Onayla',
                  `${talep.talepNo ?? '#' + talep.id} onaylansın mı? Bu işlem servisi kapatır.`,
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Onayla',
                      onPress: async () => {
                        setUpdating(true)
                        const guncel = await durumGuncelle(id, 'onaylandi', kullanici?.ad)
                        setUpdating(false)
                        if (guncel) setTalep(guncel)
                        else Alert.alert('Hata', 'Onaylanamadı.')
                      },
                    },
                  ]
                )
              }}
              disabled={updating}
              activeOpacity={0.85}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.onayBtnText}>Onayla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.onayBtn, { backgroundColor: '#dc2626' }]}
              onPress={() => {
                Alert.prompt
                  ? Alert.prompt(
                      'Reddet',
                      'Reddetme gerekçesini yazın:',
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        {
                          text: 'Reddet',
                          style: 'destructive',
                          onPress: async (gerekce) => {
                            setUpdating(true)
                            try {
                              if (gerekce?.trim()) {
                                await notEkle(id, `🚫 Yönetici reddi: ${gerekce.trim()}`, kullanici?.ad)
                              }
                              const guncel = await durumGuncelle(id, 'reddedildi', kullanici?.ad)
                              if (guncel) setTalep(guncel)
                              else Alert.alert('Hata', 'Reddedilemedi.')
                            } catch (e) {
                              Alert.alert('Hata', 'İşlem tamamlanamadı: ' + (e?.message ?? 'bilinmeyen'))
                            } finally {
                              setUpdating(false)
                            }
                          },
                        },
                      ],
                      'plain-text'
                    )
                  : Alert.alert(
                      'Reddet',
                      'Servis reddedilsin mi? Teknisyen tekrar düzenleyebilir.',
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        {
                          text: 'Reddet',
                          style: 'destructive',
                          onPress: async () => {
                            setUpdating(true)
                            const guncel = await durumGuncelle(id, 'reddedildi', kullanici?.ad)
                            setUpdating(false)
                            if (guncel) setTalep(guncel)
                            else Alert.alert('Hata', 'Reddedilemedi.')
                          },
                        },
                      ]
                    )
              }}
              disabled={updating}
              activeOpacity={0.85}
            >
              <Feather name="x" size={18} color="#fff" />
              <Text style={styles.onayBtnText}>Reddet</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={[styles.silBtn, { borderColor: colors.danger + '66' }]} onPress={sil}>
          <Text style={[styles.silText, { color: colors.danger }]}>Talebi Sil</Text>
        </TouchableOpacity>
      </ScrollView>

      <MalzemePlanModal
        visible={malzemeModalOpen}
        onClose={() => {
          setMalzemeModalOpen(false)
          setDuzenlenenPlan(null)
        }}
        initial={duzenlenenPlan}
        onSave={malzemeKaydet}
      />

      <ImzaModal
        visible={imzaModalOpen}
        onClose={() => setImzaModalOpen(false)}
        onKaydet={imzaKaydet}
        baslangicAd={talep?.teslimAlanAd ?? talep?.ilgiliKisi ?? ''}
      />

      <ServisFormuOnizleModal
        visible={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        talep={talep}
        onArsivlendi={() => yukleArsiv()}
      />

      <BelgePaylasModal
        visible={paylasAcik}
        onClose={() => setPaylasAcik(false)}
        belgeTipi="servis_raporu"
        belgeId={talep.id}
        prefillGsm={talep.telefon ?? ''}
        prefillEmail={talep.eposta ?? talep.email ?? ''}
        baslikMetni={talep.firmaAdi ?? talep.musteriAd ?? talep.talepNo ?? ''}
      />


      {/* Fotoğraf tam ekran önizleme */}
      <Modal visible={!!fotoOnizleUrl} transparent animationType="fade" onRequestClose={() => setFotoOnizleUrl(null)}>
        <TouchableOpacity
          style={styles.fotoOnizleArka}
          activeOpacity={1}
          onPress={() => setFotoOnizleUrl(null)}
        >
          {!!fotoOnizleUrl && (
            <Image source={{ uri: fotoOnizleUrl }} style={styles.fotoOnizleImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.fotoOnizleKapat} onPress={() => setFotoOnizleUrl(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  )
}

function Field({ label, deger, multi, flex, onPress, ikon }) {
  const { colors } = useTheme()
  if (!deger) return null
  const Wrap = onPress ? TouchableOpacity : View
  return (
    <Wrap style={[styles.field, flex && { flex: 1 }]} onPress={onPress} activeOpacity={0.6}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[
        onPress ? styles.fieldDegerTap : styles.fieldDeger,
        !onPress && { color: colors.textPrimary },
        multi && { lineHeight: 22 },
      ]}>
        {ikon ? `${ikon}  ` : ''}{String(deger)}
      </Text>
    </Wrap>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  talepNo: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  formuAcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  arsivBolum: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  arsivBaslikRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  arsivBaslik: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arsivBosText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  arsivItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  arsivItemTarih: { fontSize: 14, fontWeight: '600' },
  arsivItemAlt: { fontSize: 11, marginTop: 2 },
  formuAcBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
  },
  firma: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  konuBox: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  konu: { color: '#fff', fontSize: 15, fontWeight: '600' },

  row2: { flexDirection: 'row', gap: 12 },

  field: { marginTop: 14 },
  fieldLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  fieldDeger: { color: '#e2e8f0', fontSize: 15 },
  fieldDegerTap: { color: '#60a5fa', fontSize: 15, fontWeight: '500' },

  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginBottom: 8 },

  durumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durumBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  durumBtnText: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },

  notInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  notInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    minHeight: 44,
    maxHeight: 120,
  },
  notKaydetBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  notKaydetText: { color: '#fff', fontWeight: '700' },

  notCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  notMetin: { color: '#fff', fontSize: 14, lineHeight: 20 },
  notMeta: { color: '#64748b', fontSize: 11, marginTop: 6 },

  gecmisCard: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  gecmisDurum: { fontWeight: '700', fontSize: 13 },
  gecmisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 6,
  },
  gecmisToggleText: { fontWeight: '600', fontSize: 13 },

  fotoEkleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.4)',
    minWidth: 64,
    justifyContent: 'center',
  },
  fotoEkleText: { color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  fotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  fotoThumbWrap: { position: 'relative' },
  fotoThumb: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  fotoThumbImg: { width: '100%', height: '100%' },
  fotoSilBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoOnizleArka: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoOnizleImg: { width: '100%', height: '80%' },
  fotoOnizleKapat: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bos: { color: '#64748b', fontStyle: 'italic', marginVertical: 8 },

  malzemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  ekleGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  ekleGhostText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },

  malzemeToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
  },
  toolbarBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  toolbarBtnSecondary: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  toolbarBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  malzemeCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  malzemeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  malzemeAd: { color: '#fff', fontSize: 15, fontWeight: '700' },
  malzemeKodu: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },

  tamamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  tamamChipText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  silIkonBtn: { padding: 4 },

  progressBar: {
    height: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  malzemeFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  malzemeFooterLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  malzemeFooterValue: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  malzemeNot: { color: '#94a3b8', fontSize: 11, marginTop: 8, fontStyle: 'italic' },

  imzaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  imzaSilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  imzaSilText: { color: '#ef4444', fontSize: 11, fontWeight: '600' },
  imzaKart: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  imzaAltYazi: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  imzaAlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  imzaAlText: { color: '#60a5fa', fontWeight: '700', fontSize: 15 },

  akisBtnMor: {
    marginTop: 18,
    backgroundColor: '#a855f7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  akisBtnYesil: {
    marginTop: 10,
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  akisBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  onayBekliyor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    marginTop: 18,
  },
  onayBekliyorText: { color: '#a855f7', fontWeight: '700', flex: 1, fontSize: 13 },

  tamamlandiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    marginTop: 18,
  },
  tamamlandiText: { color: '#22c55e', fontWeight: '700', flex: 1, fontSize: 12 },

  onayRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  onayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  onayBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  silBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },
})
