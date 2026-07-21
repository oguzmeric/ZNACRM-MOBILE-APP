import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
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
  webMalzemeleriGetir,
  formEnvanterKalemleri,
  FATURALANDIRMA_SECENEK,
  malzemeFaturalandirmaIsaretle,
} from '../services/servisMalzemeService'
import {
  cihazGetirSeriNo,
  cihazEkle,
  cihazGuncelle,
  musteriCihazlariGetir,
} from '../services/musteriCihazService'
import {
  bagimsizSnUret,
  bagimsizSnCihazBagla,
  servisBagimsizSnleriGetir,
} from '../services/bagimsizSnService'
import SecimPicker from '../components/SecimPicker'
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
import { servisOnaylayabilir } from '../utils/yetki'
import ServisFormuOnizleModal from '../components/ServisFormuOnizleModal'
import BelgePaylasModal from '../components/BelgePaylasModal'
import { eksikCihazKayitlariGetir } from '../services/cihazKayitService'
import ServisFormBilgileriCard from '../components/ServisFormBilgileriCard'
import { arsivListele, arsivSignedUrl } from '../services/servisFormuArsivService'
import { servistenFaturaTalebiAc, servisFaturaTalebiGetir } from '../services/faturaService'
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
  const [faturaTalebi, setFaturaTalebi] = useState(null)  // servise açılan proforma
  const [faturaMesgul, setFaturaMesgul] = useState(false)
  const [yeniNot, setYeniNot] = useState('')
  const [notKaydediliyor, setNotKaydediliyor] = useState(false)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)


  // Malzeme planı
  const [malzemePlani, setMalzemePlani] = useState([])
  const [webMalzemeler, setWebMalzemeler] = useState([])  // web'den girilen kullanımlar (mig 153)
  const [malzemeModalOpen, setMalzemeModalOpen] = useState(false)
  const [duzenlenenPlan, setDuzenlenenPlan] = useState(null)

  // Cihaz bilgileri (MAC/IP/kullanıcı/şifre) — müşteri cihaz envanterine köprü
  const [kullanilanCihazlar, setKullanilanCihazlar] = useState([])   // seriNo'lu kullanılan kalemler
  const [kayitliSnSet, setKayitliSnSet] = useState(new Set())
  const [cihazRow, setCihazRow] = useState(null)
  const [cihazForm, setCihazForm] = useState(null)
  const [cihazMevcutId, setCihazMevcutId] = useState(null)
  const [cihazModalYukleniyor, setCihazModalYukleniyor] = useState(false)
  const [cihazKaydediliyor, setCihazKaydediliyor] = useState(false)
  const [sifreGoster, setSifreGoster] = useState(false)
  const [yeniSnKaydi, setYeniSnKaydi] = useState(null)  // bağımsız SN üretim kaydı
  const [snUretiliyor, setSnUretiliyor] = useState(false)

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
    const [t, mp, wm] = await Promise.all([
      servisTalepGetir(id),
      malzemePlaniGetir(id),
      webMalzemeleriGetir(id),
    ])
    setTalep(t)
    setMalzemePlani(mp ?? [])
    setWebMalzemeler(wm ?? [])
    servisFaturaTalebiGetir(id).then(setFaturaTalebi).catch(() => {})
    cihazlariYukle(id, t?.musteriId)
    setLoading(false)
  }, [id])

  // Kullanılan S/N cihazları + hangisinin envanterde kayıtlı olduğunu getir
  const cihazlariYukle = useCallback(async (servisId, musteriId) => {
    try {
      const [kalemler, uretilen] = await Promise.all([
        formEnvanterKalemleri(servisId),
        servisBagimsizSnleriGetir(servisId),
      ])
      const snli = (kalemler ?? []).filter((k) => k.seriNo)
      // Sahada üretilen bağımsız SN cihazları da listeye kat (dedup: seriNo)
      const gorulen = new Set(snli.map((k) => (k.seriNo || '').trim().toLocaleLowerCase('tr')))
      const uretilenler = (uretilen ?? [])
        .filter((r) => r.seriNo && !gorulen.has(String(r.seriNo).trim().toLocaleLowerCase('tr')))
        .map((r) => ({ id: `g-${r.id}`, urunAdi: r.urunAdi || r.stokKodu || 'Bağımsız SN cihaz', seriNo: r.seriNo, stokKodu: r.stokKodu || '', __bagimsiz: true }))
      setKullanilanCihazlar([...snli, ...uretilenler])
      if (musteriId) {
        const list = await musteriCihazlariGetir(musteriId)
        const s = new Set((list ?? []).map((c) => (c.seriNo || '').trim().toLocaleLowerCase('tr')).filter(Boolean))
        setKayitliSnSet(s)
      } else {
        setKayitliSnSet(new Set())
      }
    } catch (_) { /* sessiz */ }
  }, [])

  const snKayitli = (sn) => sn && kayitliSnSet.has(String(sn).trim().toLocaleLowerCase('tr'))

  // Cihaz satırına dokun → MAC/IP/kullanıcı/şifre gir (müşteri cihaz envanteri, SN anahtar)
  const cihazAc = async (item) => {
    if (!talep?.musteriId) { Alert.alert('Müşteri yok', 'Bu servise müşteri bağlı değil — cihaz bilgisi kaydedilemez.'); return }
    if (!item.seriNo) { Alert.alert('S/N yok', 'Cihaz bilgisi yalnız seri numaralı ürünlerde girilebilir.'); return }
    setCihazRow(item)
    setSifreGoster(false)
    setCihazMevcutId(null)
    setCihazForm({ cihazAdi: item.urunAdi || '', lokasyon: '', ipAdresi: '', macAdresi: '', kullaniciAdi: '', sifre: '', notlar: '' })
    setCihazModalYukleniyor(true)
    try {
      const mevcut = await cihazGetirSeriNo(item.seriNo)
      if (mevcut) {
        if (mevcut.musteriId && String(mevcut.musteriId) !== String(talep.musteriId)) {
          Alert.alert('Dikkat', 'Bu seri no başka bir müşteride kayıtlı.')
        }
        setCihazMevcutId(mevcut.id)
        setCihazForm({
          cihazAdi: mevcut.cihazAdi || item.urunAdi || '',
          lokasyon: mevcut.lokasyon || '',
          ipAdresi: mevcut.ipAdresi || '',
          macAdresi: mevcut.macAdresi || '',
          kullaniciAdi: mevcut.kullaniciAdi || '',
          sifre: mevcut.sifre || '',
          notlar: mevcut.notlar || '',
        })
      }
    } catch (_) { /* yeni kayıt */ }
    finally { setCihazModalYukleniyor(false) }
  }

  const cihazAlan = (alan, deger) => setCihazForm((f) => ({ ...f, [alan]: deger }))

  const cihazKapat = () => { setCihazRow(null); setCihazForm(null); setCihazMevcutId(null); setYeniSnKaydi(null) }

  // SN'siz ürün → yeni cihaz: önce SN üret, sonra bilgileri gir
  const cihazYeniAc = () => {
    if (!talep?.musteriId) { Alert.alert('Müşteri yok', 'Bu servise müşteri bağlı değil — SN üretilemez.'); return }
    setCihazRow({ __yeni: true, seriNo: null, urunAdi: '' })
    setCihazForm({ cihazAdi: '', lokasyon: '', ipAdresi: '', macAdresi: '', kullaniciAdi: '', sifre: '', notlar: '' })
    setCihazMevcutId(null)
    setYeniSnKaydi(null)
    setSifreGoster(false)
  }

  const snUret = async () => {
    setSnUretiliyor(true)
    try {
      const sonuc = await bagimsizSnUret({
        urunAdi: cihazForm?.cihazAdi || null,
        musteriId: talep.musteriId,
        servisTalepId: talep.id,
        kullanici,
      })
      if (sonuc?.hata) { Alert.alert('Hata', sonuc.hata); return }
      setYeniSnKaydi(sonuc.kayit)
      setCihazRow((r) => ({ ...r, seriNo: sonuc.kayit.seriNo }))
    } finally { setSnUretiliyor(false) }
  }

  const cihazKaydet = async () => {
    if (!cihazRow || !cihazForm) return
    if (cihazRow.__yeni && !cihazRow.seriNo) { Alert.alert('Önce SN üret', 'Kaydetmeden önce SN üretmelisiniz.'); return }
    setCihazKaydediliyor(true)
    try {
      if (cihazMevcutId) {
        const g = await cihazGuncelle(cihazMevcutId, { ...cihazForm }, kullanici, 'Servis sırasında güncellendi')
        if (!g) { Alert.alert('Hata', 'Cihaz güncellenemedi.'); return }
      } else {
        const sonuc = await cihazEkle(
          { ...cihazForm, musteriId: talep.musteriId, seriNo: cihazRow.seriNo, model: cihazRow.urunAdi || cihazForm.cihazAdi || '', durum: 'aktif' },
          kullanici,
        )
        if (sonuc?.hata) { Alert.alert('Hata', sonuc.hata); return }
        if (cihazRow.__yeni && yeniSnKaydi?.id && sonuc?.cihaz?.id) {
          await bagimsizSnCihazBagla(yeniSnKaydi.id, sonuc.cihaz.id)
        }
      }
      setKayitliSnSet((prev) => new Set(prev).add(String(cihazRow.seriNo).trim().toLocaleLowerCase('tr')))
      cihazKapat()
      await cihazlariYukle(talep.id, talep.musteriId)
      Alert.alert('Kaydedildi', 'Cihaz bilgileri müşteri cihaz envanterine kaydedildi.')
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kaydedilemedi.')
    } finally { setCihazKaydediliyor(false) }
  }

  // "Fatura Kesilecek" — proforma açar (muhasebe tutar/PDF/ödemeyi keserken girer)
  const faturaKesilecek = () => {
    if (faturaMesgul) return
    Alert.alert(
      'Fatura Kesilecek',
      'Bu servis için proforma açılıp muhasebenin "Fatura Kesilecek" kuyruğuna eklensin mi? Gerçek faturayı muhasebe kesip tutar/ödeme/PDF girecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, işaretle',
          onPress: async () => {
            setFaturaMesgul(true)
            try {
              const sonuc = await servistenFaturaTalebiAc({ servis: talep, kullanici })
              if (sonuc?._hata) { Alert.alert('Hata', sonuc._hata); return }
              setFaturaTalebi(sonuc)
              Alert.alert('Tamam', 'Fatura kesilecek olarak işaretlendi — proforma kuyruğuna eklendi.')
            } finally {
              setFaturaMesgul(false)
            }
          },
        },
      ],
    )
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

  // Header sağa 'Düzenle' butonu — talep yüklendiyse
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        talep ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('YeniServisTalebi', { duzenlenecekTalep: talep })}
            hitSlop={10}
            style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Düzenle</Text>
          </TouchableOpacity>
        ) : null
      ),
    })
  }, [navigation, talep, colors.primary])

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
        // S/N'lik için: teslim VEYA kullanılan planlı miktarı karşılıyorsa yeterli
        // (teknisyen kendi envanterinden direkt kullanmış olabilir)
        if (p.tip === 'bulk') return planli > 0 && teslim === 0 && kullanilan === 0
        return planli > 0 && teslim < planli && kullanilan < planli
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

      // (1.5) S/N takipli cihazlar için teknik bilgi (IP + alt-lokasyon) dolduruldu mu?
      const eksikCihazlar = await eksikCihazKayitlariGetir(id)
      if (eksikCihazlar.length > 0) {
        const ozet = eksikCihazlar.slice(0, 3).map((c) => {
          const ad = c.stokUrunler?.ad || 'Ürün'
          const sn = c.seriNo ? ` S/N: ${c.seriNo}` : ''
          const eksikAlanlar = []
          if (!c.ipAdresi) eksikAlanlar.push('IP')
          if (!c.altLokasyon) eksikAlanlar.push('alt-lokasyon')
          return `• ${ad}${sn} — eksik: ${eksikAlanlar.join(', ')}`
        }).join('\n')
        const ekstra = eksikCihazlar.length > 3 ? `\n…ve ${eksikCihazlar.length - 3} tane daha` : ''
        Alert.alert(
          'Cihaz Bilgisi Eksik',
          `Aşağıdaki cihazlar için teknik bilgi (IP / alt-lokasyon) doldurulmadı:\n\n${ozet}${ekstra}\n\nCihaz Detay ekranından "Teknik Bilgiler" butonuyla doldurabilirsin.`,
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
      // (3) Formu kapatan kişinin imzası — yoksa uyar ama kapatmaya izin ver
      const kapat = async () => {
        setUpdating(true)
        const guncel = await durumGuncelle(id, 'tamamlandi', kullanici?.ad)
        // Personel imzasını talebe snapshot olarak yaz (varsa)
        if (kullanici?.imza) {
          const g2 = await servisTalepGuncelle(id, {
            personelImza: kullanici.imza,
            personelImzaAd: kullanici.ad ?? null,
          })
          setUpdating(false)
          if (g2) return setTalep(g2)
        } else {
          setUpdating(false)
        }
        if (guncel) setTalep(guncel)
      }

      if (!kullanici?.imza) {
        Alert.alert(
          'İmzan Yok',
          'Profilinde kayıtlı imzan yok; servis formunda imza alanın boş kalacak. Profil > İmzam bölümünden imzanı ekleyebilirsin.\n\nYine de servisi kapatmak istiyor musun?',
          [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Yine de Kapat', onPress: kapat },
          ]
        )
        return
      }

      Alert.alert(
        'Servisi Kapat',
        'Müşteri imzası alındı. Servis "Tamamlandı" olarak kapansın mı? İmzan forma otomatik eklenecek.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Kapat', onPress: kapat },
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
  // Müşteri imzası alındıysa teknisyen forma müdahale edemez (yalnız yönetici düzeltebilir)
  const imzaKilitli = !!talep.musteriImza && !adminModu

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

        {/* Kullanılacak Malzemeler (İç Not) — teknisyen envanter hazırlığı.
            Sarı vurgulu; müşteri servis formunda görünmez. */}
        {!!(talep.kullanilacakMalzemeler && String(talep.kullanilacakMalzemeler).trim()) && (
          <View style={{
            marginTop: 4, marginBottom: 8, padding: 12, borderRadius: 10,
            borderWidth: 1, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Feather name="package" size={14} color="#b45309" />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#b45309' }}>
                🔒 Kullanılacak Malzemeler (İç Not)
              </Text>
            </View>
            <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textPrimary }}>
              {String(talep.kullanilacakMalzemeler)}
            </Text>
            <Text style={{ fontSize: 10.5, fontStyle: 'italic', color: '#b45309', marginTop: 6 }}>
              Envanterine bu malzemeleri al. Müşteri formunda görünmez.
            </Text>
          </View>
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

        {/* Web'den eklenen malzeme kullanımları (Stok v2 Faz 4) — read-only.
            Ofisten web ServisTalepDetay > Kullanılan Malzemeler kartıyla girilir. */}
        {webMalzemeler.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 20 }]}>
              🖥️ Web'den Eklenen Malzemeler ({webMalzemeler.length})
            </Text>
            {webMalzemeler.map((m) => (
              <View
                key={m.id}
                style={{
                  backgroundColor: 'rgba(96, 165, 250, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(96, 165, 250, 0.25)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                  {m.urunAdi}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>
                  {m.miktar} {m.birim || 'Adet'}
                  {m.seriNo ? ` · S/N: ${m.seriNo}` : ''}
                  {m.kullaniciAd ? ` · ${m.kullaniciAd}` : ''}
                </Text>
                {/* Faturalandırma işareti (madde 23.10) — Kullanılan Malzemeler
                    ekranındaki fatura durumu bu seçime göre otomatik atanır */}
                <View style={{ marginTop: 8 }}>
                  <SecimPicker
                    deger={m.faturalandirma || ''}
                    placeholder="Faturalandırma seç…"
                    secenekler={FATURALANDIRMA_SECENEK}
                    ekstraSecenek={{ etiket: '✕ İşareti kaldır', deger: '' }}
                    onSec={async (yeni) => {
                      const deger = yeni || null
                      const g = await malzemeFaturalandirmaIsaretle(m.id, deger)
                      if (g) setWebMalzemeler((prev) => prev.map((x) => x.id === m.id ? { ...x, faturalandirma: deger } : x))
                    }}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {/* Cihaz Bilgileri — kullanılan S/N cihazların MAC/IP/kullanıcı/şifresi.
            SN'siz ürünlere buradan bağımsız SN üretilir (etiket ofiste basılır). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 6 }}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>
            🔧 Cihaz Bilgileri{kullanilanCihazlar.length > 0 ? ` (${kullanilanCihazlar.length})` : ''}
          </Text>
          <TouchableOpacity onPress={cihazYeniAc} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="plus-circle" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>SN'siz Cihaz Ekle</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.textFaded, fontSize: 11, marginBottom: 8 }}>
          Cihaza dokun → MAC / IP / kullanıcı adı / şifre gir. SN'si olmayan ürün için "SN'siz Cihaz Ekle" ile SN üret; etiket ofiste basılır.
        </Text>
        {kullanilanCihazlar.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz cihaz yok. Kullanılan S/N'li cihazlar burada listelenir; SN'siz ürün için yeni SN üretebilirsin.</Text>
        ) : (
          kullanilanCihazlar.map((c) => {
            const kayitli = snKayitli(c.seriNo)
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => cihazAc(c)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: colors.surface, borderWidth: 1,
                  borderColor: kayitli ? 'rgba(34,197,94,0.4)' : colors.border,
                  borderRadius: 12, padding: 12, marginBottom: 8,
                }}
              >
                <Feather name="hard-drive" size={18} color={kayitli ? '#22c55e' : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {c.urunAdi}{c.__bagimsiz ? '  🏷️' : ''}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    S/N: {c.seriNo}{kayitli ? '  ·  ✓ Bilgiler kayıtlı' : '  ·  Bilgi girilmedi'}
                  </Text>
                </View>
                <Feather name={kayitli ? 'edit-2' : 'plus-circle'} size={18} color={colors.primary} />
              </TouchableOpacity>
            )
          })
        )}

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

        {imzaKilitli ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <Feather name="lock" size={15} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
              Müşteri imzası alındı — servis formu kilitli. Değişiklik için yöneticiye başvurun.
            </Text>
          </View>
        ) : (
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
        )}

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

        {/* Form Bilgileri — servis raporu (form çıktısı) alanları, web ile aynı */}
        <ServisFormBilgileriCard
          talep={talep}
          onKaydet={async (alanlar) => {
            const guncel = await servisTalepGuncelle(talep.id, alanlar)
            if (guncel) setTalep(guncel)
            else throw new Error('Kaydedilemedi')
          }}
        />

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

        {['tamamlandi', 'onaylandi', 'kapali'].includes(talep.durum) && (
          <>
            {talep.durum === 'tamamlandi' ? (
              <View style={styles.tamamlandiBox}>
                <Feather name="check-circle" size={18} color="#22c55e" />
                <Text style={styles.tamamlandiText}>
                  Servis Tamamlandı · Onay bekliyor
                </Text>
              </View>
            ) : (
              <View style={[styles.tamamlandiBox, { backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.4)' }]}>
                <Feather name="check-circle" size={18} color="#059669" />
                <Text style={[styles.tamamlandiText, { color: '#059669' }]}>
                  Servis Onaylandı · Kapandı
                </Text>
              </View>
            )}

            {/* Fatura Kesilecek — proforma varsa durum, yoksa işaretle butonu */}
            {faturaTalebi ? (
              <View style={[styles.tamamlandiBox, { marginTop: 8, backgroundColor: 'rgba(37,99,235,0.10)', borderColor: 'rgba(37,99,235,0.35)' }]}>
                <Feather name="file-text" size={18} color="#2563eb" />
                <Text style={[styles.tamamlandiText, { color: '#2563eb' }]}>
                  {faturaTalebi.durum === 'faturalandi'
                    ? `Fatura kesildi · ${faturaTalebi.faturaNo || ''}`
                    : faturaTalebi.durum === 'reddedildi'
                      ? 'Proforma reddedildi'
                      : `Fatura bekliyor · ${faturaTalebi.talepNo}`}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.formuAcBtn, { backgroundColor: '#0ea5e9', marginTop: 8, opacity: faturaMesgul ? 0.6 : 1 }]}
                onPress={faturaKesilecek}
                disabled={faturaMesgul}
                activeOpacity={0.88}
              >
                <Feather name="dollar-sign" size={18} color="#fff" />
                <Text style={styles.formuAcBtnText}>{faturaMesgul ? 'İşaretleniyor…' : 'Fatura Kesilecek'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.formuAcBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
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

        {talep.durum === 'reddedildi' && (
          <View style={[styles.tamamlandiBox, { backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: 'rgba(220, 38, 38, 0.4)' }]}>
            <Feather name="x-circle" size={18} color="#dc2626" />
            <Text style={[styles.tamamlandiText, { color: '#dc2626' }]}>
              Reddedildi · Teknisyene geri döndü
            </Text>
          </View>
        )}

        {/* Onay aksiyonları — admin modu VEYA servis onay yetkilisi (depocular: Salih 34, Mahmut 45) */}
        {(adminModu || servisOnaylayabilir(kullanici)) && talep.durum === 'tamamlandi' && (
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
        kullaniciId={kullanici?.id}
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

      {/* Cihaz Bilgileri modalı — müşteri cihaz envanterine yazar (SN anahtar) */}
      <Modal visible={!!cihazRow} transparent animationType="slide" onRequestClose={cihazKapat}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
                {cihazRow?.__yeni ? 'SN’siz Cihaz — SN Üret' : 'Cihaz Bilgileri'}
              </Text>
              <TouchableOpacity onPress={cihazKapat} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {cihazRow && cihazForm && (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                {!(cihazRow.__yeni && !cihazRow.seriNo) && (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{cihazRow.urunAdi || cihazForm.cihazAdi || 'Cihaz'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      S/N: {cihazRow.seriNo}{cihazRow.__yeni ? '  ·  🏷️ üretildi, etiket ofiste basılacak' : (cihazMevcutId ? '  ·  Envanterde kayıtlı' : '')}
                    </Text>
                  </View>
                )}

                {/* SN'siz ürün — önce SN üret */}
                {cihazRow.__yeni && !cihazRow.seriNo && (
                  <View style={{ backgroundColor: 'rgba(1,118,211,0.08)', borderWidth: 1, borderColor: 'rgba(1,118,211,0.3)', borderRadius: 12, padding: 14, gap: 10 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Bu ürünün seri numarası yok</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Ürün adını yaz, "SN Üret"e bas — sisteme ZNA- ön ekli benzersiz bir SN eklenir. Etiketi ofiste barkod sayfasından basıp cihaza yapıştırırsın.
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Ürün / Cihaz Adı</Text>
                    <TextInput
                      value={cihazForm.cihazAdi}
                      onChangeText={(v) => cihazAlan('cihazAdi', v)}
                      placeholder="Ör. 4 Portlu Switch"
                      placeholderTextColor={colors.textFaded}
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 14 }}
                    />
                    <TouchableOpacity onPress={snUret} disabled={snUretiliyor} activeOpacity={0.85}
                      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, opacity: snUretiliyor ? 0.6 : 1 }}>
                      <Feather name="tag" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{snUretiliyor ? 'Üretiliyor…' : 'SN Üret'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!(cihazRow.__yeni && !cihazRow.seriNo) && (
                  <Text style={{ color: colors.textFaded, fontSize: 11 }}>
                    {(talep?.firmaAdi || talep?.musteriAd || 'Müşteri')} cihaz envanterine kaydedilir — aynı cihaz sonraki servislerde de bu bilgilerle görünür.
                  </Text>
                )}

                {(cihazRow.__yeni && !cihazRow.seriNo) ? null : cihazModalYukleniyor ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    {[
                      { alan: 'cihazAdi', etiket: 'Cihaz Adı', ph: 'Ör. Giriş Kamerası' },
                      { alan: 'lokasyon', etiket: 'Lokasyon', ph: 'Ör. Ana giriş / Depo' },
                      { alan: 'ipAdresi', etiket: 'IP Adresi', ph: '192.168.1.108', kb: 'default' },
                      { alan: 'macAdresi', etiket: 'MAC Adresi', ph: 'AA:BB:CC:DD:EE:FF' },
                      { alan: 'kullaniciAdi', etiket: 'Kullanıcı Adı', ph: 'admin' },
                    ].map((f) => (
                      <View key={f.alan}>
                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{f.etiket}</Text>
                        <TextInput
                          value={cihazForm[f.alan]}
                          onChangeText={(v) => cihazAlan(f.alan, v)}
                          placeholder={f.ph}
                          placeholderTextColor={colors.textFaded}
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 14 }}
                        />
                      </View>
                    ))}

                    {/* Şifre — göster/gizle */}
                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Şifre</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}>
                        <TextInput
                          value={cihazForm.sifre}
                          onChangeText={(v) => cihazAlan('sifre', v)}
                          placeholder="••••••"
                          placeholderTextColor={colors.textFaded}
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry={!sifreGoster}
                          style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 14 }}
                        />
                        <TouchableOpacity onPress={() => setSifreGoster((v) => !v)} hitSlop={10} style={{ paddingHorizontal: 12 }}>
                          <Feather name={sifreGoster ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Notlar</Text>
                      <TextInput
                        value={cihazForm.notlar}
                        onChangeText={(v) => cihazAlan('notlar', v)}
                        placeholder="Ör. RTSP portu 554, web arayüz adresi"
                        placeholderTextColor={colors.textFaded}
                        multiline
                        textAlignVertical="top"
                        style={{ minHeight: 64, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 14 }}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 8 }}>
                      <TouchableOpacity onPress={cihazKapat} activeOpacity={0.85} style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={cihazKaydet} disabled={cihazKaydediliyor} activeOpacity={0.85} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, opacity: cihazKaydediliyor ? 0.6 : 1 }}>
                        <Feather name="check" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '800' }}>{cihazKaydediliyor ? 'Kaydediliyor…' : (cihazMevcutId ? 'Güncelle' : 'Kaydet')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
