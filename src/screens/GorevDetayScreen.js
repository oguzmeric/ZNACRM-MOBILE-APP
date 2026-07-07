import { useEffect, useLayoutEffect, useState } from 'react'
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
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useHeaderHeight } from '@react-navigation/elements'
import { useAuth } from '../context/AuthContext'
import {
  gorevGetir,
  gorevGuncelle,
  gorevDurumGuncelle,
  gorevNotEkle,
  gorevSil,
  gorevNotFotoCikar,
  gorevNotGuncelle,
  gorevNotSil,
} from '../services/gorevService'
import { gorevFotosuYukle, gorevFotosuSil } from '../services/gorevFotoService'
import { useTheme } from '../context/ThemeContext'
import {
  tarihSaatFormat,
  renkDurum,
  etiketDurum,
  etiketOncelik,
  renkOncelik,
} from '../utils/format'

const DURUM_SECENEKLERI = [
  { id: 'bekliyor', label: 'Açık' },
  { id: 'devam_ediyor', label: 'Devam Ediyor' },
  { id: 'tamamlandi', label: 'Tamamlandı' },
  { id: 'iptal', label: 'İptal' },
]

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
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [yeniNot, setYeniNot] = useState('')
  const [notKaydediliyor, setNotKaydediliyor] = useState(false)
  const [secilenFotolar, setSecilenFotolar] = useState([]) // local URI'ler
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const [tamEkranFoto, setTamEkranFoto] = useState(null) // { url, notIndex }
  const [duzenlenenNotIdx, setDuzenlenenNotIdx] = useState(null)
  const [duzenlenenNotMetin, setDuzenlenenNotMetin] = useState('')
  const [notGuncelleniyor, setNotGuncelleniyor] = useState(false)
  const [devamSebepModal, setDevamSebepModal] = useState(false)

  const yukle = async () => {
    setLoading(true)
    const g = await gorevGetir(id)
    setGorev(g)
    setLoading(false)
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
            onPress={() => navigation.navigate('YeniGorev', { duzenlenecekGorev: gorev })}
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

  const durumDegistir = async (yeniDurum) => {
    if (yeniDurum === gorev?.durum) return

    // Tamamlandı için en az 1 not şart — fotoğraf opsiyonel
    if (yeniDurum === 'tamamlandi') {
      const notlar = gorev?.notlar ?? []
      if (notlar.length === 0) {
        Alert.alert(
          'Not Gerekli',
          'Görevi tamamlamadan önce en az 1 not ekle — ne yaptığını kısaca yaz. Aşağıdaki not alanını kullanabilirsin.',
          [{ text: 'Tamam' }]
        )
        return
      }
    }

    if (yeniDurum === 'tamamlandi') {
      Alert.alert('Görevi Tamamla', 'Bu görev "Tamamlandı" olarak kapatılsın mı?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kapat',
          onPress: async () => {
            setUpdating(true)
            const guncel = await gorevDurumGuncelle(id, yeniDurum)
            setUpdating(false)
            if (guncel) setGorev(guncel)
          },
        },
      ])
      return
    }

    setUpdating(true)
    // Devam ediyor değilse mevcut sebep temizlenir; devam ediyor'a geçince sonra modal açılır
    const guncelleme = { durum: yeniDurum }
    if (yeniDurum !== 'devam_ediyor') guncelleme.devamSebep = null
    const guncel = await gorevGuncelle(id, guncelleme)
    setUpdating(false)
    if (guncel) {
      setGorev(guncel)
      if (yeniDurum === 'devam_ediyor') setDevamSebepModal(true)
    } else {
      Alert.alert('Hata', 'Durum güncellenemedi.')
    }
  }

  const devamSebepSec = async (sebepId) => {
    setUpdating(true)
    const guncel = await gorevGuncelle(id, { devamSebep: sebepId })
    setUpdating(false)
    setDevamSebepModal(false)
    if (guncel) setGorev(guncel)
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

  const notKaydet = async () => {
    const metin = yeniNot.trim()
    if (!metin && secilenFotolar.length === 0) return
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

    // Eğer foto seçilmişti ama hiçbiri yüklenemediyse, notu kaydetme
    if (secilenFotolar.length > 0 && fotoUrls.length === 0) {
      setNotKaydediliyor(false)
      Alert.alert(
        'Foto Yüklenemedi',
        `Seçtiğin ${secilenFotolar.length} fotoğraf yüklenemedi:\n\n${hatalar[0]}`
      )
      return
    }

    const guncel = await gorevNotEkle(id, metin, kullanici?.ad, fotoUrls)
    setNotKaydediliyor(false)
    if (guncel) {
      setGorev(guncel)
      setYeniNot('')
      setSecilenFotolar([])
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
      <Text style={[styles.title, { color: colors.textPrimary }]}>{gorev.baslik}</Text>

      <View style={styles.row}>
        <Badge text={etiketDurum(gorev.durum)} renk={renkDurum(gorev.durum)} />
        <Badge text={etiketOncelik(gorev.oncelik)} renk={renkOncelik(gorev.oncelik)} />
      </View>

      {!!gorev.aciklama && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Açıklama</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{gorev.aciklama}</Text>
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

      {!!gorev.firmaAdi && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Firma</Text>
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
                aktif && { backgroundColor: renkDurum(d.id), borderColor: renkDurum(d.id) },
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

      {/* Devam sebebi göstergesi + değiştir butonu (sadece devam_ediyor durumunda) */}
      {gorev.durum === 'devam_ediyor' && (
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
              Seçim zorunlu değil, atlamak için "Belirtme" butonuna basabilirsin.
            </Text>
            <View style={styles.sebepGrid}>
              {DEVAM_SEBEPLERI.map((s) => {
                const secili = gorev.devamSebep === s.id
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sebepBtn, secili && styles.sebepBtnAktif]}
                    onPress={() => devamSebepSec(s.id)}
                    disabled={updating}
                  >
                    <Text style={styles.sebepIkon}>{s.ikon}</Text>
                    <Text style={[styles.sebepIsim, secili && styles.sebepIsimAktif]}>{s.isim}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
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
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Notlar timeline */}
      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
        📝 Notlar ({(gorev.notlar ?? []).length})
      </Text>

      <View style={styles.notInputRow}>
        <TextInput
          style={[styles.notInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
          placeholder="Ne yaptın? Kısa not ekle..."
          placeholderTextColor={colors.textFaded}
          value={yeniNot}
          onChangeText={setYeniNot}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.notKaydetBtn,
            ((!yeniNot.trim() && secilenFotolar.length === 0) || notKaydediliyor) && { opacity: 0.4 },
          ]}
          onPress={notKaydet}
          disabled={(!yeniNot.trim() && secilenFotolar.length === 0) || notKaydediliyor}
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
        {secilenFotolar.length > 0 && (
          <Text style={styles.fotoSayac}>{secilenFotolar.length} foto seçili</Text>
        )}
      </View>

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

      {(gorev.notlar ?? []).length === 0 ? (
        <Text style={[styles.bosNot, { color: colors.textFaded }]}>
          Henüz not yok. Görev bitince en az 1 not ekle (fotoğraf opsiyonel).
        </Text>
      ) : (
        (gorev.notlar ?? [])
          .map((n, origIndex) => ({ n, origIndex }))
          .reverse()
          .map(({ n, origIndex }) => {
            const benimNotum = n.kullanici === kullanici?.ad
            const duzenleniyor = duzenlenenNotIdx === origIndex
            return (
              <View key={origIndex} style={[styles.notCard, { backgroundColor: colors.surface }]}>
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
                    {!!n.metin && <Text style={[styles.notMetin, { color: colors.textPrimary }]}>{n.metin}</Text>}
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
                    <View style={styles.notMetaRow}>
                      <Text style={[styles.notMeta, { color: colors.textFaded }]}>
                        {n.kullanici ?? '—'} · {tarihSaatFormat(n.tarih)}
                        {n.duzenlendiTarih ? ' · düzenlendi' : ''}
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
