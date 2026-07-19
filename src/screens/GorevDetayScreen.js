import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Pressable,
  Linking,
  Switch,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import {
  gorevGetir,
  gorevGuncelle,
  gorevDurumGuncelle,
  gorevEkle,
  gorevNotEkle,
  gorevSil,
  gorevNotFotoCikar,
  gorevNotGuncelle,
  gorevNotSil,
  gorevWebYorumlariGetir,
  gorevAgaciGetir,
  gorevGoruldu,
  gorevKabulEt,
  gorevReddet,
  gorevOnayaGonder,
  gorevOnayla,
  gorevRevizeIste,
  kontrolListesiGetir,
  kontrolMaddeIsaretle,
  gorevHareketleriGetir,
} from '../services/gorevService'
import { gorevFotosuYukle, gorevFotosuSil } from '../services/gorevFotoService'
import { ekYukle } from '../services/ekYukleService'
import { kullanicilariGetir } from '../services/kullaniciService'
import { bildirimEkleDb } from '../services/bildirimService'
import { parseMentions } from '../lib/mention'
import MentionInput, { MentionText } from '../components/MentionInput'
import TarihSec from '../components/TarihSec'
import SecimPicker from '../components/SecimPicker'
import { useTheme } from '../context/ThemeContext'
import { tarihSaatFormat, tarihFormat } from '../utils/format'
import {
  durumBilgi,
  etkinDurum,
  KAPALI_DURUMLAR,
  SEBEP_ZORUNLU_DURUMLAR,
  KABUL_MAP,
  RET_SEBEPLERI,
  ONAY_DURUM_ISIM,
  oncelikBilgi,
  ONCELIK_SECENEKLERI,
  ILERLEME_ADIMLARI,
} from '../lib/gorevSabitleri'

const DURUM_SECENEKLERI = [
  { id: 'bekliyor',         label: 'Atandı' },
  { id: 'devam',            label: 'Devam Ediyor' },
  { id: 'beklemede',        label: 'Beklemede' },
  { id: 'bilgi_bekleniyor', label: 'Bilgi Bekleniyor' },
  { id: 'tamamlandi',       label: 'Tamamlandı' },
  { id: 'iptal',            label: 'İptal' },
]

// Sebep modalı başlıkları (beklemede / bilgi_bekleniyor / iptal)
const SEBEP_MODAL_BASLIK = {
  beklemede: 'Beklemede — Sebep',
  bilgi_bekleniyor: 'Bilgi Bekleniyor — Sebep',
  iptal: 'İptal — Sebep',
}

// DD.MM.YYYY (hareket geçmişindeki tarih alanları için)
const trTarih = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('.') : '—')

// gorev_hareketleri 'guncellendi' detay satırını Türkçe kısa metne çevir
const hareketAlanMetni = (d) => {
  switch (d?.alan) {
    case 'durum':        return `Durum: ${durumBilgi(d.eski).isim} → ${durumBilgi(d.yeni).isim}`
    case 'atanan':       return `Atanan: ${d.eski || '—'} → ${d.yeni || '—'}`
    case 'son_tarih':    return `Bitiş: ${trTarih(d.eski)} → ${trTarih(d.yeni)}`
    case 'oncelik':      return `Öncelik: ${oncelikBilgi(d.eski).isim} → ${oncelikBilgi(d.yeni).isim}`
    case 'ilerleme':     return `İlerleme: %${d.eski ?? 0} → %${d.yeni ?? 0}`
    case 'kabul_durumu': return `Kabul: ${KABUL_MAP[d.yeni]?.isim || d.yeni}${d.sebep ? ` (${d.sebep})` : ''}`
    case 'onay_durumu':  return `Onay: ${ONAY_DURUM_ISIM[d.yeni] || d.yeni || '—'}${d.not ? ` — ${d.not}` : ''}`
    case 'durum_sebebi': return d.yeni ? `Sebep: ${d.yeni}` : null
    default:             return null
  }
}

const hareketMetinleri = (h) => {
  if (h.islem === 'olusturuldu') return [`${h.yapanAd || 'Sistem'} görevi oluşturdu`]
  if (h.islem === 'guncellendi') {
    return (Array.isArray(h.detay) ? h.detay : []).map(hareketAlanMetni).filter(Boolean)
  }
  return []
}

const DEVAM_SEBEPLERI = [
  { id: 'hava_muhalefeti',   isim: 'Hava Muhalefeti',   ikon: '🌧️' },
  { id: 'program_yogunlugu', isim: 'Program Yoğunluğu', ikon: '📅' },
  { id: 'tamir_ariza',       isim: 'Tamir / Arıza',     ikon: '🔧' },
  { id: 'uretici_tedarik',   isim: 'Üretici / Tedarik', ikon: '📦' },
]

export default function GorevDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()
  const { colors } = useTheme()
  const [gorev, setGorev] = useState(null)
  const [webYorumlar, setWebYorumlar] = useState([]) // web'de yazılan yorumlar (gorev_yorumlari)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [yeniNot, setYeniNot] = useState('')
  const [notKaydediliyor, setNotKaydediliyor] = useState(false)
  const [secilenFotolar, setSecilenFotolar] = useState([]) // local URI'ler
  const [secilenBelgeler, setSecilenBelgeler] = useState([]) // belge asset'leri { uri, name, mimeType, size }
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const [tamEkranFoto, setTamEkranFoto] = useState(null) // { url, notIndex }
  const [duzenlenenNotIdx, setDuzenlenenNotIdx] = useState(null)
  const [duzenlenenNotMetin, setDuzenlenenNotMetin] = useState('')
  const [notGuncelleniyor, setNotGuncelleniyor] = useState(false)
  const [devamSebepModal, setDevamSebepModal] = useState(false)
  // ─── v2 state ───
  const [altGorevler, setAltGorevler] = useState([])       // gorev_no ağacı
  const [kontrolListesi, setKontrolListesi] = useState([])
  const [hareketler, setHareketler] = useState([])
  const [hareketGoster, setHareketGoster] = useState(true)
  const [redModal, setRedModal] = useState(false)
  const [redSebep, setRedSebep] = useState(null)
  const [redAciklama, setRedAciklama] = useState('')
  const [durumSebepModal, setDurumSebepModal] = useState(null) // hedef durum id
  const [durumSebepMetin, setDurumSebepMetin] = useState('')
  const [onayIslemModal, setOnayIslemModal] = useState(null)   // 'onayla' | 'revize'
  const [onayNotMetin, setOnayNotMetin] = useState('')
  const [altGorevModal, setAltGorevModal] = useState(false)
  const [agBaslik, setAgBaslik] = useState('')
  const [agAtanan, setAgAtanan] = useState(null)   // kullanıcı id
  const [agBitis, setAgBitis] = useState('')
  const [agOncelik, setAgOncelik] = useState('normal')
  const [agZorunlu, setAgZorunlu] = useState(false)
  const [agKaydediliyor, setAgKaydediliyor] = useState(false)
  const gorulduRef = useRef(false) // otomatik "görüldü" yalnız 1 kez
  // @mention için personel listesi
  const [personeller, setPersoneller] = useState([])
  useEffect(() => {
    kullanicilariGetir()
      .then(l => setPersoneller((l || []).filter(k => k.tip !== 'musteri')))
      .catch(() => {})
  }, [])
  // Sebep seçilirse yeni bitiş tarihi ZORUNLU (ek süre) — iki adım: seç → tarih → Kaydet
  const [secilenSebep, setSecilenSebep] = useState(null)
  const [devamYeniTarih, setDevamYeniTarih] = useState('')

  useEffect(() => {
    if (devamSebepModal) {
      setSecilenSebep(gorev?.devamSebep || null)
      setDevamYeniTarih('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devamSebepModal])

  // Ben görevden sorumlu muyum? (birincil atanan veya ekip üyesi)
  const sorumluMuyum = (g) => {
    if (!g || !kullanici) return false
    const bid = String(kullanici.id)
    return String(g.atananId ?? '') === bid ||
      (Array.isArray(g.ekip) && g.ekip.map(String).includes(bid))
  }

  const yukle = async () => {
    setLoading(true)
    const g = await gorevGetir(id)
    setGorev(g)
    // Web yorumlarını da çek (mobil notlarla birleşik gösterilecek)
    gorevWebYorumlariGetir(id).then(setWebYorumlar).catch(() => {})
    // v2 verileri — paralel, ekranı bloklamaz
    gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
    kontrolListesiGetir(id).then(setKontrolListesi).catch(() => {})
    if (g?.gorevNo) gorevAgaciGetir(g.gorevNo).then(setAltGorevler).catch(() => {})
    else setAltGorevler([])
    setLoading(false)
    // Otomatik "görüldü" — atanan ekranı ilk açtığında (yalnız 1 kez)
    if (g && g.kabulDurumu === 'atandi' && !gorulduRef.current && sorumluMuyum(g)) {
      gorulduRef.current = true
      gorevGoruldu(id).then((guncel) => { if (guncel) setGorev(guncel) }).catch(() => {})
    }
  }

  useEffect(() => {
    yukle()
  }, [id])

  // Ekrana dönüldüğünde (örn. YeniGorev düzenlemeden geri gelinince) yeniden yükle
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { if (!loading) yukle() })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation])

  // Header sağa 'Düzenle' butonu — sadece görev yüklendiyse
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        gorev ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('YeniGörev', { duzenlenecekGorev: gorev })}
            hitSlop={10}
            style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Düzenle</Text>
          </TouchableOpacity>
        ) : null
      ),
    })
  }, [navigation, gorev, colors.primary])

  // Onaylayıcıya (yoksa oluşturana) bildirim gönder
  const onaylayiciyaBildir = (g) => {
    let aliciId = g?.onaylayiciId ? Number(g.onaylayiciId) : null
    if (!aliciId) {
      const olusturanK = (personeller || []).find(p => p.ad === g?.olusturanAd)
      aliciId = olusturanK?.id ? Number(olusturanK.id) : (g?.olusturanId ? Number(g.olusturanId) : null)
    }
    if (!aliciId || String(aliciId) === String(kullanici?.id)) return
    bildirimEkleDb({
      aliciId,
      gonderenId: kullanici?.id,
      tip: 'gorev',
      baslik: 'Görev Onayınızı Bekliyor',
      mesaj: `${kullanici?.ad || 'Bir arkadaşınız'} "${g?.baslik || 'Görev'}" görevini tamamladı, onayınızı bekliyor.`,
      link: `/gorevler/${id}`,
    }).catch(() => {})
  }

  const durumDegistir = async (yeniDurum) => {
    if (yeniDurum === gorev?.durum) return

    // Beklemede / Bilgi Bekleniyor / İptal → sebep ZORUNLU (modal)
    if (SEBEP_ZORUNLU_DURUMLAR.includes(yeniDurum)) {
      setDurumSebepMetin('')
      setDurumSebepModal(yeniDurum)
      return
    }

    if (yeniDurum === 'tamamlandi') {
      // Açık ZORUNLU alt görev varsa ana görev kapatılamaz
      const acikZorunlu = altGorevler.filter(
        (a) => a.zorunlu && !KAPALI_DURUMLAR.includes(a.durum)
      )
      if (acikZorunlu.length > 0) {
        Alert.alert(
          'Alt Görevler Açık',
          `Zorunlu alt görevler tamamlanmadan bu görev kapatılamaz (${acikZorunlu.length} açık):\n\n${acikZorunlu.map(a => `• ${a.gorevNo || ''} ${a.baslik}`).join('\n')}`,
          [{ text: 'Tamam' }]
        )
        return
      }

      // Bağımlılık kapısı (madde 16): bağlı görev bitmeden bu görev kapanamaz
      if (gorev?.bagimliGorevId && gorev?.bagimlilikTuru === 'once_tamamlanmali') {
        const bagimli = await gorevGetir(gorev.bagimliGorevId).catch(() => null)
        if (bagimli && bagimli.durum !== 'tamamlandi') {
          Alert.alert(
            'Bağımlı Görev Açık',
            `Önce bağımlı görev tamamlanmalı: ${bagimli.gorevNo || ''} "${bagimli.baslik}"`,
            [{ text: 'Tamam' }]
          )
          return
        }
      }

      // Tamamlandı için en az 1 not/yorum şart — fotoğraf opsiyonel
      // (mobil not VEYA web yorumu sayılır)
      const toplamNot = (gorev?.notlar?.length ?? 0) + webYorumlar.length
      if (toplamNot === 0) {
        Alert.alert(
          'Not Gerekli',
          'Görevi tamamlamadan önce en az 1 not ekle — ne yaptığını kısaca yaz. Aşağıdaki not alanını kullanabilirsin.',
          [{ text: 'Tamam' }]
        )
        return
      }

      // Onay gerekli ise: tamamlama yerine ONAYA GÖNDER.
      // İstisna: onaylayıcı BENSEM (onaylayici_id benim ya da onaylayıcı boş +
      // görevi ben açtıysam) onay adımı gereksiz — doğrudan kapanır.
      const benOnaylayici = gorev?.onaylayiciId
        ? String(gorev.onaylayiciId) === String(kullanici?.id)
        : (String(gorev?.olusturanId ?? '') === String(kullanici?.id) || gorev?.olusturanAd === kullanici?.ad)
      if (gorev?.onayGerekli && !benOnaylayici) {
        Alert.alert(
          'Onaya Gönder',
          'Bu görev onay gerektiriyor. Tamamlandı olarak işaretlenip onaya gönderilsin mi?',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Onaya Gönder',
              onPress: async () => {
                setUpdating(true)
                const guncel = await gorevOnayaGonder(id)
                setUpdating(false)
                if (guncel) {
                  setGorev(guncel)
                  onaylayiciyaBildir(guncel)
                  gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
                  Alert.alert('Onaya Gönderildi', 'Görev onaya gönderildi. Onaylayıcı bilgilendirildi.')
                } else {
                  Alert.alert('Hata', 'Onaya gönderilemedi.')
                }
              },
            },
          ]
        )
        return
      }

      Alert.alert('Görevi Tamamla', 'Bu görev "Tamamlandı" olarak kapatılsın mı?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kapat',
          onPress: async () => {
            setUpdating(true)
            const guncel = await gorevDurumGuncelle(id, yeniDurum)
            setUpdating(false)
            if (guncel) {
              setGorev(guncel)
              gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
            }
          },
        },
      ])
      return
    }

    setUpdating(true)
    // Devam ediyor değilse mevcut sebep temizlenir; devam'a geçince sonra modal açılır
    const guncelleme = { durum: yeniDurum }
    if (yeniDurum !== 'devam') guncelleme.devamSebep = null
    const guncel = await gorevGuncelle(id, guncelleme)
    setUpdating(false)
    if (guncel) {
      setGorev(guncel)
      gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
      if (yeniDurum === 'devam') setDevamSebepModal(true)
    } else {
      Alert.alert('Hata', 'Durum güncellenemedi.')
    }
  }

  // Sebep zorunlu durum geçişi (beklemede / bilgi_bekleniyor / iptal)
  const durumSebepKaydet = async () => {
    const metin = durumSebepMetin.trim()
    if (!metin) {
      Alert.alert('Sebep Gerekli', 'Bu durum değişikliği için sebep yazman zorunlu.')
      return
    }
    const hedef = durumSebepModal
    setUpdating(true)
    const guncel = await gorevGuncelle(id, { durum: hedef, durumSebebi: metin })
    if (guncel) {
      // Sebebi not olarak da düşür — timeline'da görünsün
      const durumAd = DURUM_SECENEKLERI.find(d => d.id === hedef)?.label || hedef
      const notlu = await gorevNotEkle(id, `Durum "${durumAd}" olarak değişti — Sebep: ${metin}`, kullanici?.ad)
      setGorev(notlu || guncel)
      gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
      setDurumSebepModal(null)
    } else {
      Alert.alert('Hata', 'Durum güncellenemedi.')
    }
    setUpdating(false)
  }

  // ─── Kabul / Ret ───
  const kabulEt = async () => {
    setUpdating(true)
    const guncel = await gorevKabulEt(id)
    setUpdating(false)
    if (guncel) {
      setGorev(guncel)
      gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
    } else {
      Alert.alert('Hata', 'Kabul kaydedilemedi.')
    }
  }

  const reddiKaydet = async () => {
    if (!redSebep) {
      Alert.alert('Sebep Gerekli', 'Ret sebebi seçmen zorunlu.')
      return
    }
    const sebepTam = redAciklama.trim() ? `${redSebep} — ${redAciklama.trim()}` : redSebep
    setUpdating(true)
    const guncel = await gorevReddet(id, sebepTam)
    setUpdating(false)
    if (!guncel) {
      Alert.alert('Hata', 'Ret kaydedilemedi.')
      return
    }
    setGorev(guncel)
    setRedModal(false)
    gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
    // Oluşturana bildirim
    const olusturanK = (personeller || []).find(p => p.ad === guncel.olusturanAd)
    const aliciId = olusturanK?.id ?? guncel.olusturanId
    if (aliciId && String(aliciId) !== String(kullanici?.id)) {
      bildirimEkleDb({
        aliciId: Number(aliciId),
        gonderenId: kullanici?.id,
        tip: 'gorev',
        baslik: 'Görev Reddedildi',
        mesaj: `${kullanici?.ad || 'Atanan kişi'} "${guncel.baslik || 'Görev'}" görevini reddetti. Sebep: ${sebepTam}`,
        link: `/gorevler/${id}`,
      }).catch(() => {})
    }
  }

  // ─── Onay / Revize (onaylayıcı aksiyonları) ───
  const onayIslemKaydet = async () => {
    const not_ = onayNotMetin.trim()
    if (onayIslemModal === 'revize' && !not_) {
      Alert.alert('Not Gerekli', 'Revize isterken ne düzeltilmesi gerektiğini yazmalısın.')
      return
    }
    setUpdating(true)
    const guncel = onayIslemModal === 'onayla'
      ? await gorevOnayla(id, not_)
      : await gorevRevizeIste(id, not_)
    setUpdating(false)
    if (!guncel) {
      Alert.alert('Hata', 'İşlem kaydedilemedi.')
      return
    }
    setGorev(guncel)
    setOnayIslemModal(null)
    setOnayNotMetin('')
    gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
    // Sorumluya bildirim
    const aliciId = guncel.atananId
    if (aliciId && String(aliciId) !== String(kullanici?.id)) {
      bildirimEkleDb({
        aliciId: Number(aliciId),
        gonderenId: kullanici?.id,
        tip: 'gorev',
        baslik: onayIslemModal === 'onayla' ? 'Göreviniz Onaylandı' : 'Görevde Revize İstendi',
        mesaj: onayIslemModal === 'onayla'
          ? `"${guncel.baslik || 'Görev'}" görevi onaylandı ve tamamlandı.${not_ ? ` Not: ${not_}` : ''}`
          : `"${guncel.baslik || 'Görev'}" görevinde revize istendi: ${not_}`,
        link: `/gorevler/${id}`,
      }).catch(() => {})
    }
  }

  // ─── İlerleme ───
  const ilerlemeDegistir = async (deger) => {
    if (Number(gorev?.ilerleme ?? 0) === deger) return
    setUpdating(true)
    const guncel = await gorevGuncelle(id, { ilerleme: deger })
    setUpdating(false)
    if (guncel) {
      setGorev(guncel)
      gorevHareketleriGetir(id).then(setHareketler).catch(() => {})
    }
  }

  // ─── Kontrol listesi ───
  const kontrolToggle = async (madde) => {
    const guncel = await kontrolMaddeIsaretle(madde.id, !madde.tamamlandi, kullanici)
    if (guncel) {
      setKontrolListesi((prev) => prev.map((m) => (m.id === guncel.id ? guncel : m)))
    } else {
      Alert.alert('Hata', 'Madde güncellenemedi.')
    }
  }

  // ─── Alt görev oluştur ───
  const altGorevKaydet = async () => {
    if (!agBaslik.trim()) { Alert.alert('Eksik', 'Alt görev başlığı gerekli.'); return }
    if (!agAtanan) { Alert.alert('Eksik', 'Alt görevi bir kişiye ata.'); return }
    if (!agBitis) { Alert.alert('Eksik', 'Bitiş tarihi gerekli.'); return }
    const atananK = (personeller || []).find(p => String(p.id) === String(agAtanan))
    setAgKaydediliyor(true)
    const yeni = await gorevEkle({
      ustGorevId: gorev.id,           // gorev_no'yu (üstno-01) DB trigger atar
      baslik: agBaslik.trim(),
      atananId: atananK?.id ?? agAtanan,
      atananAd: atananK?.ad ?? '',
      oncelik: agOncelik,
      zorunlu: agZorunlu,
      bitisTarihi: agBitis,
      bitisTarih: `${agBitis}T23:59`,
      durum: 'bekliyor',
      kabulDurumu: 'atandi',
      olusturanAd: kullanici?.ad ?? '',
      olusturanId: kullanici?.id ?? null,
      musteriId: gorev.musteriId ?? null,
      firmaAdi: gorev.firmaAdi ?? null,
    })
    setAgKaydediliyor(false)
    if (!yeni) {
      Alert.alert('Hata', 'Alt görev oluşturulamadı.')
      return
    }
    setAltGorevModal(false)
    setAgBaslik(''); setAgAtanan(null); setAgBitis(''); setAgOncelik('normal'); setAgZorunlu(false)
    if (gorev?.gorevNo) gorevAgaciGetir(gorev.gorevNo).then(setAltGorevler).catch(() => {})
    // Atanana bildirim
    if (atananK?.id && String(atananK.id) !== String(kullanici?.id)) {
      bildirimEkleDb({
        aliciId: Number(atananK.id),
        gonderenId: kullanici?.id,
        tip: 'gorev',
        baslik: 'Yeni Alt Görev Atandı',
        mesaj: `${kullanici?.ad || 'Bir arkadaşınız'}, "${gorev.baslik}" kapsamında size "${yeni.baslik}" alt görevini atadı. Son tarih: ${trTarih(agBitis)}`,
        link: `/gorevler/${yeni.id}`,
      }).catch(() => {})
    }
  }

  const devamSebepSec = async (sebepId) => {
    setUpdating(true)
    const guncel = await gorevGuncelle(id, { devamSebep: sebepId })
    setUpdating(false)
    setDevamSebepModal(false)
    if (guncel) setGorev(guncel)
  }

  // Sebep + zorunlu yeni bitiş tarihi birlikte kaydedilir
  const devamSebepVeTarihKaydet = async () => {
    if (!devamYeniTarih) {
      Alert.alert('Tarih Gerekli', 'Sebep seçtiğinde yeni bitiş tarihi zorunludur.')
      return
    }
    setUpdating(true)
    const guncel = await gorevGuncelle(id, {
      devamSebep: secilenSebep,
      bitisTarihi: devamYeniTarih,
      sonTarih: devamYeniTarih, // panel/listeler gecikmeyi son_tarih'ten okur
    })
    setUpdating(false)
    if (!guncel) {
      Alert.alert('Hata', 'Kaydedilemedi, tekrar deneyin.')
      return
    }
    setGorev(guncel)
    setDevamSebepModal(false)
  }

  const galeridenSec = async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!izin.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni ver.')
      return
    }
    const sonuc = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    })
    if (!sonuc.canceled) {
      const uris = sonuc.assets.map((a) => a.uri)
      setSecilenFotolar((prev) => [...prev, ...uris].slice(0, 8))
    }
  }

  const kameradanCek = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync()
    if (!izin.granted) {
      Alert.alert('İzin Gerekli', 'Kameraya erişim izni ver.')
      return
    }
    const sonuc = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    })
    if (!sonuc.canceled) {
      setSecilenFotolar((prev) => [...prev, sonuc.assets[0].uri].slice(0, 8))
    }
  }

  const fotoCikar = (uri) => {
    setSecilenFotolar((prev) => prev.filter((u) => u !== uri))
  }

  // Belge seç (PDF/Excel/Word...) — nota dosyalar alanı olarak eklenir
  const belgeSec = async () => {
    const s = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (s.canceled) return
    setSecilenBelgeler((prev) => [
      ...prev,
      ...(s.assets || []).map((a) => ({ uri: a.uri, name: a.name || null, mimeType: a.mimeType || null, size: a.size ?? null })),
    ])
  }

  const notKaydet = async () => {
    const metin = yeniNot.trim()
    if (!metin && secilenFotolar.length === 0 && secilenBelgeler.length === 0) return
    setNotKaydediliyor(true)
    let fotoUrls = []
    let hatalar = []
    if (secilenFotolar.length > 0) {
      setFotoYukleniyor(true)
      for (const uri of secilenFotolar) {
        const res = await gorevFotosuYukle(id, uri)
        if (res.ok) fotoUrls.push(res.url)
        else hatalar.push(res.hata ?? 'bilinmeyen')
      }
      setFotoYukleniyor(false)
    }

    // Belge ekleri (PDF/Excel...) — web ile aynı {url,name,type,size} şekli
    let dosyalar = []
    for (const ek of secilenBelgeler) {
      try { dosyalar.push(await ekYukle('gorev-dosyalar', ek)) }
      catch (e) { hatalar.push(e?.message ?? 'belge yüklenemedi') }
    }

    // Eğer ek seçilmişti ama hiçbiri yüklenemediyse, notu kaydetme
    if ((secilenFotolar.length > 0 || secilenBelgeler.length > 0) && fotoUrls.length === 0 && dosyalar.length === 0 && hatalar.length > 0) {
      setNotKaydediliyor(false)
      Alert.alert('Ek Yüklenemedi', `Seçtiğin ekler yüklenemedi:\n\n${hatalar[0]}`)
      return
    }

    const guncel = await gorevNotEkle(id, metin, kullanici?.ad, fotoUrls, dosyalar)
    setNotKaydediliyor(false)
    if (guncel) {
      // @mention edilenlere push bildirimi (kendini etiketleyen hariç)
      const mentionIdler = parseMentions(metin, personeller).filter(mid => mid !== kullanici?.id)
      for (const mid of mentionIdler) {
        bildirimEkleDb({
          aliciId: mid,
          gonderenId: kullanici?.id,
          tip: 'bilgi',
          baslik: `💬 ${kullanici?.ad || 'Bir arkadaşın'} bir notta seni etiketledi`,
          mesaj: `"${metin.slice(0, 90)}" — ${guncel.baslik || 'Görev'}`,
          link: `/gorevler/${id}`,
        }).catch(() => {})
      }
      // Paydaşlara da haber ver (web GorevDetay deseniyle aynı): görevi AÇAN +
      // atanan + ekip — yazan kendisi ve mention'da zaten olanlar atlanır.
      // (Eskiden mobil not yalnız mention'a bildirim atıyordu; görevi açan
      // kişi nottan habersiz kalıyordu.)
      const alanlar = new Set(mentionIdler.map(String))
      const paydasIdler = []
      const olusturanK = (personeller || []).find(p => p.ad === guncel.olusturanAd)
      if (olusturanK?.id) paydasIdler.push(olusturanK.id)
      const atananId = guncel.atananId ?? guncel.atanan
      if (atananId) paydasIdler.push(atananId)
      for (const eid of (guncel.ekip || [])) paydasIdler.push(eid)
      for (const pid of [...new Set(paydasIdler.map(x => String(x)))]) {
        if (!pid || pid === String(kullanici?.id) || alanlar.has(pid)) continue
        alanlar.add(pid)
        bildirimEkleDb({
          aliciId: Number(pid),
          gonderenId: kullanici?.id,
          tip: 'gorev',
          baslik: `💬 ${kullanici?.ad || 'Bir arkadaşın'} göreve not ekledi`,
          mesaj: `"${guncel.baslik || 'Görev'}": ${metin.slice(0, 90)}`,
          link: `/gorevler/${id}`,
        }).catch(() => {})
      }
      setGorev(guncel)
      setYeniNot('')
      setSecilenFotolar([])
      setSecilenBelgeler([])
      if (hatalar.length > 0) {
        Alert.alert(
          'Kısmi Yükleme',
          `${fotoUrls.length} foto yüklendi, ${hatalar.length} tanesi başarısız:\n\n${hatalar[0]}`
        )
      }
    } else {
      Alert.alert('Hata', 'Not eklenemedi.')
    }
  }

  const notSilOnay = (notIndex) => {
    Alert.alert('Notu Sil', 'Bu not silinsin mi? Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const guncel = await gorevNotSil(id, notIndex)
          if (guncel) setGorev(guncel)
          else Alert.alert('Hata', 'Not silinemedi.')
        },
      },
    ])
  }

  const notDuzenleBasla = (notIndex, mevcutMetin) => {
    setDuzenlenenNotIdx(notIndex)
    setDuzenlenenNotMetin(mevcutMetin ?? '')
  }

  const notDuzenleIptal = () => {
    setDuzenlenenNotIdx(null)
    setDuzenlenenNotMetin('')
  }

  const notDuzenleKaydet = async () => {
    if (duzenlenenNotIdx == null) return
    if (!duzenlenenNotMetin.trim()) {
      Alert.alert('Eksik', 'Not boş olamaz.')
      return
    }
    setNotGuncelleniyor(true)
    const guncel = await gorevNotGuncelle(id, duzenlenenNotIdx, duzenlenenNotMetin.trim())
    setNotGuncelleniyor(false)
    if (guncel) {
      setGorev(guncel)
      notDuzenleIptal()
    } else {
      Alert.alert('Hata', 'Not güncellenemedi.')
    }
  }

  const sil = () => {
    Alert.alert('Görevi sil', 'Emin misin? Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await gorevSil(id)
          navigation.goBack()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!gorev) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={{ color: '#94a3b8' }}>Görev bulunamadı.</Text>
      </View>
    )
  }

  const benimMi = gorev.olusturanAd === kullanici?.ad
  const benSorumlu = sorumluMuyum(gorev)
  const acikMi = !KAPALI_DURUMLAR.includes(gorev.durum)
  const benOnaylayici =
    String(gorev.onaylayiciId ?? '') === String(kullanici?.id ?? '') ||
    (!gorev.onaylayiciId && (benimMi || String(gorev.olusturanId ?? '') === String(kullanici?.id ?? '')))
  const kabulBariGoster =
    benSorumlu && acikMi && ['atandi', 'goruldu'].includes(gorev.kabulDurumu)
  const etkin = etkinDurum(gorev)
  const kabulRozet = KABUL_MAP[gorev.kabulDurumu]
  const ilerleme = Math.max(0, Math.min(100, Number(gorev.ilerleme ?? 0)))
  const kontrolTamam = kontrolListesi.filter((m) => m.tamamlandi).length

  // Mobil notlar (gorevler.notlar, fotoğraflı, düzenlenebilir) + web yorumları
  // (gorev_yorumlari, salt-okunur) + SİSTEM HAREKETLERİ (gorev_hareketleri,
  // gri kapsül) birleşik — en yeni üstte. Böylece web'de yazılan yorumlar
  // ve otomatik geçmiş telefonda da görünür.
  const tumNotlar = [
    ...(gorev.notlar ?? []).map((n, origIndex) => ({
      kaynak: 'mobil', origIndex,
      metin: n.metin, kullanici: n.kullanici, tarih: n.tarih,
      fotoUrls: n.fotoUrls ?? [], dosyalar: n.dosyalar ?? [], duzenlendiTarih: n.duzenlendiTarih,
    })),
    ...webYorumlar.map((y) => ({
      kaynak: 'web', origIndex: null,
      metin: y.icerik, kullanici: y.yazarAd, tarih: y.olusturmaTarih,
      fotoUrls: [], dosyalar: y.dosyalar ?? [], duzenlendiTarih: y.duzenlendi ? y.guncellemeTarih : null,
    })),
    ...(hareketGoster
      ? hareketler
          .map((h) => ({
            kaynak: 'hareket', origIndex: null,
            metinler: hareketMetinleri(h),
            kullanici: h.yapanAd, tarih: h.olusturmaTarih,
            fotoUrls: [], dosyalar: [],
          }))
          .filter((h) => h.metinler.length > 0)
      : []),
  ].sort((a, b) => new Date(b.tarih || 0) - new Date(a.tarih || 0))

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
      {!!gorev.gorevNo && (
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
          {gorev.gorevNo}
        </Text>
      )}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{gorev.baslik}</Text>

      <View style={styles.row}>
        <Badge text={etkin.isim} renk={etkin.renk} />
        <Badge text={oncelikBilgi(gorev.oncelik).isim} renk={oncelikBilgi(gorev.oncelik).renk} />
        {kabulRozet && gorev.kabulDurumu !== 'kabul_edildi' && gorev.durum !== 'tamamlandi' && (
          <Badge text={kabulRozet.isim} renk={kabulRozet.renk} />
        )}
      </View>

      {/* Alt görevse üst göreve dön linki */}
      {!!gorev.ustGorevId && (
        <TouchableOpacity
          onPress={() => navigation.push('GörevDetay', { id: gorev.ustGorevId })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
        >
          <Feather name="corner-left-up" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Ana göreve git</Text>
        </TouchableOpacity>
      )}

      {/* İlerleme (madde 15) */}
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceDark, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: `${gorev.durum === 'tamamlandi' ? 100 : ilerleme}%`, height: '100%', backgroundColor: (gorev.durum === 'tamamlandi' || ilerleme >= 100) ? colors.success : colors.primary }} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '800', minWidth: 36, textAlign: 'right' }}>
            %{gorev.durum === 'tamamlandi' ? 100 : ilerleme}
          </Text>
        </View>
        {benSorumlu && acikMi && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ILERLEME_ADIMLARI.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => ilerlemeDegistir(p)}
                  disabled={updating}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                    backgroundColor: ilerleme === p ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: ilerleme === p ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: ilerleme === p ? '#fff' : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* KABUL BARI (madde 11) — atanan, görevi kabul/ret eder */}
      {kabulBariGoster && (
        <View style={{
          marginTop: 14, padding: 14, borderRadius: 12,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary,
        }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>Bu görev sana atandı</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
            Görevi kabul edebilir ya da gerekçesiyle reddedebilirsin.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={kabulEt} disabled={updating}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.success, opacity: updating ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>✓ Görevi Kabul Et</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRedSebep(null); setRedAciklama(''); setRedModal(true) }} disabled={updating}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger }}>
              <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 13 }}>✕ Reddet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ONAY PANELİ (madde 14) — onaylayıcıya karar butonları */}
      {gorev.durum === 'onay_bekliyor' && benOnaylayici && (
        <View style={{
          marginTop: 14, padding: 14, borderRadius: 12,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: '#06b6d4',
        }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>Onayını bekliyor</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            {gorev.atananAd || 'Sorumlu'} görevi tamamladığını bildirdi — kontrol edip karar ver.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={() => { setOnayNotMetin(''); setOnayIslemModal('onayla') }} disabled={updating}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.success }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>✓ Onayla ve Tamamla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setOnayNotMetin(''); setOnayIslemModal('revize') }} disabled={updating}
              style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.warning }}>
              <Text style={{ color: colors.warning, fontWeight: '800', fontSize: 13 }}>↺ Revize İste</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!gorev.aciklama && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Açıklama</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{gorev.aciklama}</Text>
        </View>
      )}

      {/* Görev ekleri (mig 184 — görev oluştururken eklenen dosya/resimler) */}
      {(gorev.dosyalar?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Ekler</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {gorev.dosyalar.filter(d => (d.type || '').startsWith('image/')).map((d, i) => (
              <TouchableOpacity key={`gi${i}`} onPress={() => Linking.openURL(d.url).catch(() => {})}>
                <Image source={{ uri: d.url }} style={{ width: 64, height: 64, borderRadius: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
          {gorev.dosyalar.filter(d => !(d.type || '').startsWith('image/')).map((d, i) => (
            <TouchableOpacity
              key={`gb${i}`}
              onPress={() => Linking.openURL(d.url).catch(() => Alert.alert('Hata', 'Dosya açılamadı.'))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {d.name}{d.size ? `  (${Math.round(d.size / 1024)} KB)` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Atanan</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{gorev.atananAd || '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Oluşturan</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{gorev.olusturanAd || '—'}</Text>
      </View>

      {/* Ekip üyeleri — gösterilmediği için "bu görev neden Bana'da?" karışıklığı oluyordu */}
      {Array.isArray(gorev.ekip) && gorev.ekip.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Ekip</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {gorev.ekip
              .map((uid) => personeller.find((k) => String(k.id) === String(uid))?.ad || `#${uid}`)
              .join(', ')}
          </Text>
        </View>
      )}

      {!!gorev.firmaAdi && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Müşteri</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{gorev.firmaAdi}</Text>
        </View>
      )}

      <View style={styles.row2}>
        {!!gorev.baslamaTarih && (
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Başlama</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {new Date(gorev.baslamaTarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
          </View>
        )}
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Bitiş</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {gorev.bitisTarih
              ? new Date(gorev.bitisTarih).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
              : (gorev.bitisTarihi ?? '—')}
          </Text>
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Oluşturuldu</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{tarihSaatFormat(gorev.olusturmaTarih)}</Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Durumu Değiştir</Text>
      <View style={styles.durumGrid}>
        {DURUM_SECENEKLERI.map((d) => {
          const aktif = gorev.durum === d.id
          return (
            <TouchableOpacity
              key={d.id}
              style={[
                styles.durumBtn,
                aktif && { backgroundColor: durumBilgi(d.id).renk, borderColor: durumBilgi(d.id).renk },
              ]}
              onPress={() => durumDegistir(d.id)}
              disabled={updating}
            >
              <Text style={[styles.durumBtnText, aktif && { color: '#fff' }]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ALT GÖREVLER (madde 3, 6.3) — ağaç + oluşturma */}
      {(altGorevler.length > 0 || ((benSorumlu || benimMi || kullanici?.rol === 'admin') && acikMi)) && (
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.sectionLabel}>
              Alt Görevler{altGorevler.length > 0 ? ` (${altGorevler.filter(a => a.durum === 'tamamlandi').length}/${altGorevler.length})` : ''}
            </Text>
            {(benSorumlu || benimMi || kullanici?.rol === 'admin') && acikMi && (
              <TouchableOpacity
                onPress={() => setAltGorevModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary }}
              >
                <Feather name="plus" size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Alt Görev Oluştur</Text>
              </TouchableOpacity>
            )}
          </View>
          {altGorevler.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>
              Alt görev yok — işi bölmek için alt görev oluşturabilirsin; ana sorumluluk sende kalır.
            </Text>
          ) : (
            <View style={{ gap: 8, marginTop: 8 }}>
              {altGorevler.map((a) => {
                const aEtkin = etkinDurum(a)
                const girinti = Math.max(0, (a.seviye ?? 1) - (gorev.seviye ?? 0) - 1) * 14
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => navigation.push('GörevDetay', { id: a.id })}
                    activeOpacity={0.8}
                    style={{
                      marginLeft: girinti,
                      backgroundColor: colors.surface, borderRadius: 10, padding: 12,
                      borderWidth: 1, borderColor: colors.border,
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                    }}
                  >
                    <Feather name="corner-down-right" size={13} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>{a.gorevNo}</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13.5, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
                        {a.baslik}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {a.atananAd || '—'}{a.sonTarih ? ` · ${String(a.sonTarih).slice(0, 10).split('-').reverse().join('.')}` : ''}
                        {a.zorunlu !== false ? ' · zorunlu' : ''}
                      </Text>
                    </View>
                    <Badge text={aEtkin.isim} renk={aEtkin.renk} />
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      )}

      {/* KONTROL LİSTESİ (madde 18) — işaretleme mobilden */}
      {kontrolListesi.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionLabel}>Kontrol Listesi ({kontrolTamam}/{kontrolListesi.length})</Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            {kontrolListesi.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => kontrolToggle(m)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: colors.surface, borderRadius: 10, padding: 12,
                  borderWidth: 1, borderColor: colors.border,
                }}
              >
                <Feather
                  name={m.tamamlandi ? 'check-square' : 'square'}
                  size={18}
                  color={m.tamamlandi ? colors.success : colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: m.tamamlandi ? colors.textMuted : colors.textPrimary,
                    fontSize: 13.5, fontWeight: '600',
                    textDecorationLine: m.tamamlandi ? 'line-through' : 'none',
                  }}>
                    {m.baslik}{m.zorunlu && !m.tamamlandi ? '  •zorunlu' : ''}
                  </Text>
                  {m.tamamlandi && (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      ✓ {m.tamamlayanAd || ''}{m.tamamlanmaTarih ? ` · ${tarihFormat(m.tamamlanmaTarih)}` : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Devam sebebi göstergesi + değiştir butonu (sadece devam durumunda) */}
      {(gorev.durum === 'devam' || gorev.durum === 'devam_ediyor') && (
        <View style={styles.devamSebepBar}>
          {gorev.devamSebep ? (
            <View style={styles.devamSebepSol}>
              <Text style={styles.devamSebepIkon}>
                {DEVAM_SEBEPLERI.find((s) => s.id === gorev.devamSebep)?.ikon || '❓'}
              </Text>
              <Text style={styles.devamSebepText}>
                Sebep: {DEVAM_SEBEPLERI.find((s) => s.id === gorev.devamSebep)?.isim || gorev.devamSebep}
              </Text>
            </View>
          ) : (
            <Text style={styles.devamSebepBos}>Devam sebebi belirtilmemiş</Text>
          )}
          <TouchableOpacity
            style={styles.devamSebepBtn}
            onPress={() => setDevamSebepModal(true)}
          >
            <Text style={styles.devamSebepBtnText}>
              {gorev.devamSebep ? 'Değiştir' : 'Sebep Seç'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Devam sebep seçim modalı */}
      <Modal
        visible={devamSebepModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDevamSebepModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setDevamSebepModal(false)}
          style={styles.modalArkaPlan}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalKart} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalBaslik}>Devam Ediyor — Sebep</Text>
            <Text style={styles.modalAltBaslik}>
              Sebep seçersen yeni bitiş tarihi zorunludur (ek süre). Atlamak için "Belirtme".
            </Text>
            <View style={styles.sebepGrid}>
              {DEVAM_SEBEPLERI.map((s) => {
                const secili = secilenSebep === s.id
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sebepBtn, secili && styles.sebepBtnAktif]}
                    onPress={() => setSecilenSebep(s.id)}
                    disabled={updating}
                  >
                    <Text style={styles.sebepIkon}>{s.ikon}</Text>
                    <Text style={[styles.sebepIsim, secili && styles.sebepIsimAktif]}>{s.isim}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {/* Sebep seçildiyse yeni bitiş tarihi ZORUNLU */}
            {secilenSebep && (
              <View style={{
                marginTop: 14, padding: 12, borderRadius: 10,
                backgroundColor: 'rgba(245,158,11,0.12)',
                borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)',
              }}>
                {!!gorev.bitisTarihi && (
                  <Text style={{ color: '#b45309', fontSize: 12, marginBottom: 6 }}>
                    Mevcut bitiş: {String(gorev.bitisTarihi).slice(0, 10).split('-').reverse().join('.')}
                  </Text>
                )}
                <TarihSec
                  value={devamYeniTarih}
                  onChange={setDevamYeniTarih}
                  label="Yeni bitiş tarihi (zorunlu)"
                  placeholder="Tarih seçin"
                  gosterTemizle={false}
                />
              </View>
            )}
            <View style={styles.modalButonSira}>
              {gorev.devamSebep && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnKaldir]}
                  onPress={() => devamSebepSec(null)}
                  disabled={updating}
                >
                  <Text style={styles.modalBtnKaldirText}>Sebebi Kaldır</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnAtla]}
                onPress={() => setDevamSebepModal(false)}
              >
                <Text style={styles.modalBtnAtlaText}>Belirtme</Text>
              </TouchableOpacity>
              {secilenSebep && (
                <TouchableOpacity
                  style={[styles.modalBtn, {
                    backgroundColor: devamYeniTarih ? '#2563eb' : 'rgba(37,99,235,0.4)',
                  }]}
                  onPress={devamSebepVeTarihKaydet}
                  disabled={updating || !devamYeniTarih}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {updating ? 'Kaydediliyor…' : 'Kaydet'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* RET modalı (madde 11) — sebep zorunlu */}
      <Modal visible={redModal} transparent animationType="slide" onRequestClose={() => setRedModal(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setRedModal(false)} style={styles.modalArkaPlan}>
          <TouchableOpacity activeOpacity={1} style={styles.modalKart} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalBaslik}>Görevi Reddet</Text>
            <Text style={styles.modalAltBaslik}>Ret sebebini seç — görevi oluşturan bilgilendirilecek.</Text>
            <SecimPicker
              deger={redSebep}
              onSec={setRedSebep}
              secenekler={RET_SEBEPLERI}
              placeholder="Ret sebebi seç…"
            />
            <TextInput
              value={redAciklama}
              onChangeText={setRedAciklama}
              placeholder="Açıklama (Diğer için zorunlu)…"
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                marginTop: 10, minHeight: 60, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a',
                backgroundColor: '#fff', textAlignVertical: 'top',
              }}
            />
            <View style={styles.modalButonSira}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnIptal]} onPress={() => setRedModal(false)}>
                <Text style={styles.modalBtnIptalText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#dc2626' }]}
                onPress={reddiKaydet}
                disabled={updating}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {updating ? 'Kaydediliyor…' : 'Reddet'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sebep zorunlu durum modalı (beklemede / bilgi_bekleniyor / iptal) */}
      <Modal visible={!!durumSebepModal} transparent animationType="slide" onRequestClose={() => setDurumSebepModal(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setDurumSebepModal(null)} style={styles.modalArkaPlan}>
          <TouchableOpacity activeOpacity={1} style={styles.modalKart} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalBaslik}>{durumBilgi(durumSebepModal).isim}</Text>
            <Text style={styles.modalAltBaslik}>
              Bu duruma geçmek için sebep yazmak zorunlu — görev notlarına işlenir.
            </Text>
            <TextInput
              value={durumSebepMetin}
              onChangeText={setDurumSebepMetin}
              placeholder={durumSebepModal === 'bilgi_bekleniyor' ? 'Kimden / hangi bilgi bekleniyor?' : durumSebepModal === 'iptal' ? 'İptal gerekçesi…' : 'Bekleme sebebi…'}
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                minHeight: 70, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a',
                backgroundColor: '#fff', textAlignVertical: 'top',
              }}
            />
            <View style={styles.modalButonSira}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnIptal]} onPress={() => setDurumSebepModal(null)}>
                <Text style={styles.modalBtnIptalText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnKaydet]}
                onPress={durumSebepKaydet}
                disabled={updating}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {updating ? 'Kaydediliyor…' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Onay kararı modalı (onayla / revize) */}
      <Modal visible={!!onayIslemModal} transparent animationType="slide" onRequestClose={() => setOnayIslemModal(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOnayIslemModal(null)} style={styles.modalArkaPlan}>
          <TouchableOpacity activeOpacity={1} style={styles.modalKart} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalBaslik}>
              {onayIslemModal === 'onayla' ? 'Onayla ve Tamamla' : 'Revize İste'}
            </Text>
            <Text style={styles.modalAltBaslik}>
              {onayIslemModal === 'onayla'
                ? 'İsteğe bağlı bir not ekleyebilirsin.'
                : 'Nelerin düzeltilmesi gerektiğini yaz (zorunlu).'}
            </Text>
            <TextInput
              value={onayNotMetin}
              onChangeText={setOnayNotMetin}
              placeholder={onayIslemModal === 'onayla' ? 'Not (isteğe bağlı)…' : 'Revize açıklaması…'}
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                minHeight: 70, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: '#cbd5e1', color: '#0f172a',
                backgroundColor: '#fff', textAlignVertical: 'top',
              }}
            />
            <View style={styles.modalButonSira}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnIptal]} onPress={() => setOnayIslemModal(null)}>
                <Text style={styles.modalBtnIptalText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnKaydet]}
                onPress={onayIslemKaydet}
                disabled={updating}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {updating ? 'Kaydediliyor…' : (onayIslemModal === 'onayla' ? 'Onayla' : 'Gönder')}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ALT GÖREV OLUŞTUR modalı (madde 7) */}
      <Modal visible={altGorevModal} transparent animationType="slide" onRequestClose={() => setAltGorevModal(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setAltGorevModal(false)} style={styles.modalArkaPlan}>
          <TouchableOpacity activeOpacity={1} style={styles.modalKart} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalBaslik}>Alt Görev Oluştur</Text>
            <Text style={styles.modalAltBaslik}>
              Ana görev: {gorev.gorevNo || ''} "{gorev.baslik}" — numara otomatik atanır, ana sorumluluk sende kalır.
            </Text>
            <TextInput
              value={agBaslik}
              onChangeText={setAgBaslik}
              placeholder="Alt görev başlığı…"
              placeholderTextColor="#94a3b8"
              style={{
                borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#cbd5e1',
                color: '#0f172a', backgroundColor: '#fff',
              }}
            />
            <View style={{ marginTop: 10 }}>
              <SecimPicker
                deger={agAtanan}
                onSec={setAgAtanan}
                secenekler={(personeller || []).map((p) => ({ id: p.id, isim: p.ad }))}
                placeholder="Atanacak kişiyi seç…"
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <TarihSec
                value={agBitis}
                onChange={setAgBitis}
                label="Bitiş tarihi (zorunlu)"
                placeholder="Tarih seçin"
                gosterTemizle={false}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <SecimPicker
                deger={agOncelik}
                onSec={setAgOncelik}
                secenekler={ONCELIK_SECENEKLERI.map((o) => ({ id: o.id, isim: o.isim }))}
                placeholder="Öncelik…"
              />
            </View>
            <TouchableOpacity
              onPress={() => setAgZorunlu(!agZorunlu)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
            >
              <Feather name={agZorunlu ? 'check-square' : 'square'} size={18} color={agZorunlu ? '#16a34a' : '#94a3b8'} />
              <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '600' }}>
                Ana görevin tamamlanması için zorunlu
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButonSira}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnIptal]} onPress={() => setAltGorevModal(false)}>
                <Text style={styles.modalBtnIptalText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnKaydet]}
                onPress={altGorevKaydet}
                disabled={agKaydediliyor}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {agKaydediliyor ? 'Oluşturuluyor…' : 'Alt Görevi Oluştur'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Notlar timeline */}
      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
        📝 Notlar ({tumNotlar.length})
      </Text>

      <View style={styles.notInputRow}>
        <MentionInput
          style={[styles.notInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          placeholder="Ne yaptın? @ ile arkadaşını etiketle..."
          value={yeniNot}
          onChangeText={setYeniNot}
          kullanicilar={personeller}
        />
        <TouchableOpacity
          style={[
            styles.notKaydetBtn,
            ((!yeniNot.trim() && secilenFotolar.length === 0) || notKaydediliyor) && { opacity: 0.4 },
          ]}
          onPress={notKaydet}
          disabled={(!yeniNot.trim() && secilenFotolar.length === 0 && secilenBelgeler.length === 0) || notKaydediliyor}
        >
          {fotoYukleniyor ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="plus" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.fotoAksiyonRow}>
        <TouchableOpacity style={styles.fotoAksiyonBtn} onPress={kameradanCek}>
          <Feather name="camera" size={16} color="#60a5fa" />
          <Text style={styles.fotoAksiyonText}>Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fotoAksiyonBtn} onPress={galeridenSec}>
          <Feather name="image" size={16} color="#60a5fa" />
          <Text style={styles.fotoAksiyonText}>Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fotoAksiyonBtn} onPress={belgeSec}>
          <Feather name="paperclip" size={16} color="#60a5fa" />
          <Text style={styles.fotoAksiyonText}>Belge</Text>
        </TouchableOpacity>
        {(secilenFotolar.length > 0 || secilenBelgeler.length > 0) && (
          <Text style={styles.fotoSayac}>{secilenFotolar.length + secilenBelgeler.length} ek seçili</Text>
        )}
      </View>

      {secilenBelgeler.length > 0 && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {secilenBelgeler.map((ek, i) => (
            <View key={ek.uri + i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
              borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
            }}>
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }} numberOfLines={1}>
                {ek.name || 'dosya'}{ek.size ? `  ·  ${Math.round(ek.size / 1024)} KB` : ''}
              </Text>
              <TouchableOpacity onPress={() => setSecilenBelgeler(p => p.filter((_, j) => j !== i))} hitSlop={8}>
                <Feather name="x" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {secilenFotolar.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.secilenFotoStrip}
          contentContainerStyle={{ gap: 8 }}
        >
          {secilenFotolar.map((uri) => (
            <View key={uri} style={styles.secilenFotoWrap}>
              <Image source={{ uri }} style={styles.secilenFotoThumb} />
              <TouchableOpacity style={styles.fotoSilBtn} onPress={() => fotoCikar(uri)}>
                <Feather name="x" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {tumNotlar.length === 0 ? (
        <Text style={[styles.bosNot, { color: colors.textFaded }]}>
          Henüz not yok. Görev bitince en az 1 not ekle (fotoğraf opsiyonel).
        </Text>
      ) : (
        tumNotlar
          .map((item, siraIdx) => {
            const n = item
            const origIndex = item.origIndex

            // SİSTEM HAREKETİ — gri kapsül; not değildir, düzenlenemez/silinemez
            if (item.kaynak === 'hareket') {
              return (
                <View key={`hareket-${siraIdx}`} style={{ alignItems: 'center', marginBottom: 8 }}>
                  <View style={{
                    maxWidth: '94%', paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: 999, backgroundColor: colors.surfaceDark ?? colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                  }}>
                    {(item.metinler || []).map((m, mi) => (
                      <Text key={mi} style={{ color: colors.textMuted, fontSize: 11.5, textAlign: 'center', lineHeight: 16 }}>
                        {m}
                      </Text>
                    ))}
                    <Text style={{ color: colors.textFaded ?? colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                      {n.kullanici || 'Sistem'}{n.tarih ? ` · ${tarihSaatFormat(n.tarih)}` : ''}
                    </Text>
                  </View>
                </View>
              )
            }

            const webMi = item.kaynak === 'web'
            // Düzenle/sil yalnız kendi MOBİL notunda (web yorumları web'den yönetilir).
            // origIndex null kontrolü ŞART — null===null eşleşmesi tüm kartları
            // düzenleme moduna sokuyordu (2026-07-19 ekran görüntüsü bulgusu).
            const benimNotum = !webMi && n.kullanici === kullanici?.ad
            const duzenleniyor = item.kaynak === 'mobil' && origIndex !== null && duzenlenenNotIdx === origIndex
            return (
              <View key={webMi ? `web-${siraIdx}` : `mobil-${origIndex}`} style={[styles.notCard, { backgroundColor: colors.surface }]}>
                {duzenleniyor ? (
                  <>
                    <TextInput
                      style={[styles.notInput, { marginBottom: 8 }]}
                      value={duzenlenenNotMetin}
                      onChangeText={setDuzenlenenNotMetin}
                      multiline
                      autoFocus
                    />
                    <View style={styles.notDuzenleAksiyon}>
                      <TouchableOpacity
                        style={styles.notIptalBtn}
                        onPress={notDuzenleIptal}
                        disabled={notGuncelleniyor}
                      >
                        <Text style={styles.notIptalText}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.notKayitBtn, notGuncelleniyor && { opacity: 0.6 }]}
                        onPress={notDuzenleKaydet}
                        disabled={notGuncelleniyor}
                      >
                        <Feather name="check" size={14} color="#fff" />
                        <Text style={styles.notKayitText}>
                          {notGuncelleniyor ? 'Kaydediliyor...' : 'Kaydet'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {!!n.metin && <MentionText metin={n.metin} kullanicilar={personeller} stil={[styles.notMetin, { color: colors.textPrimary }]} />}
                    {(n.fotoUrls ?? []).length > 0 && (
                      <View style={styles.notFotoGrid}>
                        {n.fotoUrls.map((url) => (
                          <TouchableOpacity
                            key={url}
                            onPress={() => setTamEkranFoto({ url, notIndex: origIndex })}
                          >
                            <Image source={{ uri: url }} style={styles.notFotoThumb} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {/* Belge ekleri — hem mobil not hem web yorum ekleri (mig 184) */}
                    {(n.dosyalar ?? []).map((d, di) => {
                      const resimMi = (d.type || '').startsWith('image/')
                      if (resimMi) {
                        return (
                          <TouchableOpacity key={`d${di}`} onPress={() => Linking.openURL(d.url).catch(() => {})} style={{ marginTop: 6 }}>
                            <Image source={{ uri: d.url }} style={styles.notFotoThumb} />
                          </TouchableOpacity>
                        )
                      }
                      return (
                        <TouchableOpacity
                          key={`d${di}`}
                          onPress={() => Linking.openURL(d.url).catch(() => Alert.alert('Hata', 'Dosya açılamadı.'))}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}
                          activeOpacity={0.7}
                        >
                          <Feather name="file-text" size={13} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                            {d.name}{d.size ? `  (${Math.round(d.size / 1024)} KB)` : ''}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                    <View style={styles.notMetaRow}>
                      <Text style={[styles.notMeta, { color: colors.textFaded }]}>
                        {webMi ? '🖥️ ' : ''}{n.kullanici ?? '—'} · {tarihSaatFormat(n.tarih)}
                        {n.duzenlendiTarih ? ' · düzenlendi' : ''}
                        {webMi ? ' · web' : ''}
                      </Text>
                      {benimNotum && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          {!!n.metin && (
                            <TouchableOpacity
                              onPress={() => notDuzenleBasla(origIndex, n.metin)}
                              hitSlop={8}
                            >
                              <Feather name="edit-2" size={13} color="#60a5fa" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => notSilOnay(origIndex)}
                            hitSlop={8}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            )
          })
      )}

      {benimMi && (
        <TouchableOpacity style={styles.silBtn} onPress={sil}>
          <Text style={styles.silText}>Görevi Sil</Text>
        </TouchableOpacity>
      )}
      </ScrollView>

      <Modal
        visible={!!tamEkranFoto}
        transparent
        animationType="fade"
        onRequestClose={() => setTamEkranFoto(null)}
      >
        <Pressable style={styles.tamEkranBg} onPress={() => setTamEkranFoto(null)}>
          {tamEkranFoto && (
            <Image
              source={{ uri: tamEkranFoto.url }}
              style={styles.tamEkranImg}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity style={styles.tamEkranKapat} onPress={() => setTamEkranFoto(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tamEkranSil}
            onPress={(e) => {
              e.stopPropagation?.()
              const foto = tamEkranFoto
              if (!foto) return
              Alert.alert(
                'Fotoğrafı Sil',
                'Bu fotoğraf nottan kaldırılacak. Emin misin?',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                      setTamEkranFoto(null)
                      const guncel = await gorevNotFotoCikar(id, foto.notIndex, foto.url)
                      if (guncel) {
                        setGorev(guncel)
                        gorevFotosuSil(foto.url) // arka planda storage'dan sil
                      } else {
                        Alert.alert('Hata', 'Fotoğraf silinemedi.')
                      }
                    },
                  },
                ]
              )
            }}
          >
            <Feather name="trash-2" size={20} color="#fff" />
            <Text style={styles.tamEkranSilText}>Sil</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  )
}

function Badge({ text, renk }) {
  return (
    <View style={[styles.badge, { borderColor: renk, backgroundColor: renk + '22' }]}>
      <Text style={[styles.badgeText, { color: renk }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  row2: { flexDirection: 'row', gap: 12 },
  section: { marginTop: 14 },
  sectionLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  body: { color: '#e2e8f0', fontSize: 15 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  durumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  durumBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  durumBtnText: { color: '#cbd5e1', fontWeight: '600' },

  devamSebepBar: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  devamSebepSol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  devamSebepIkon: { fontSize: 22 },
  devamSebepText: { color: '#fff', fontWeight: '600', fontSize: 13, flexShrink: 1 },
  devamSebepBos: { color: '#94a3b8', fontStyle: 'italic', fontSize: 12, flex: 1 },
  devamSebepBtn: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  devamSebepBtnText: { color: '#60a5fa', fontWeight: '600', fontSize: 12 },

  modalArkaPlan: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKart: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  modalBaslik: { color: '#0f172a', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalAltBaslik: { color: '#64748b', fontSize: 12, marginBottom: 18, lineHeight: 18 },
  sebepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  sebepBtn: {
    flexBasis: '48%',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  sebepBtnAktif: {
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  sebepIkon: { fontSize: 28, marginBottom: 8 },
  sebepIsim: { color: '#0f172a', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  sebepIsimAktif: { color: '#0f172a' },
  modalButonSira: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtnAtla: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  modalBtnAtlaText: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  modalBtnKaldir: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  modalBtnKaldirText: { color: '#64748b', fontWeight: '600', fontSize: 13 },

  silBtn: {
    marginTop: 28,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },

  notInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
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
    backgroundColor: '#2563eb',
    width: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  notMetin: { color: '#fff', fontSize: 13, lineHeight: 19 },
  notMeta: { color: '#64748b', fontSize: 10, flex: 1 },
  notMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  notDuzenleAksiyon: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  notIptalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  notIptalText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  notKayitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  notKayitText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bosNot: {
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },

  fotoAksiyonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fotoAksiyonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  fotoAksiyonText: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  fotoSayac: { color: '#64748b', fontSize: 11, marginLeft: 'auto' },

  secilenFotoStrip: { marginBottom: 12 },
  secilenFotoWrap: { position: 'relative' },
  secilenFotoThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  fotoSilBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notFotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  notFotoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },

  tamEkranBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tamEkranImg: { width: '100%', height: '100%' },
  tamEkranKapat: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tamEkranSil: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  tamEkranSilText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
