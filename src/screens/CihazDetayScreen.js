import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as Location from 'expo-location'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import {
  stokKalemGetir,
  kalemHareketleriniGetir,
  cihazTak,
  cihazSok,
  teknisyeneZimmetle,
  personeldenIade,
  arizaliDepoyaTeslim,
  tamireGonder,
  tamirdenDon,
  durumBul,
  DURUMLAR,
  stokKalemSil,
} from '../services/stokKalemiService'
import { musterileriGetir, musteriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { kullanicilariGetir } from '../services/kullaniciService'
import { tarihFormat, tarihSaatFormat } from '../utils/format'
import { useTheme } from '../context/ThemeContext'
import CihazTeknikBilgiModal from '../components/CihazTeknikBilgiModal'

export default function CihazDetayScreen({ route, navigation }) {
  const { id, taradigimKod } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [kalem, setKalem] = useState(null)
  const [hareketler, setHareketler] = useState([])
  const [musteri, setMusteri] = useState(null)
  const [lokasyon, setLokasyon] = useState(null)
  const [loading, setLoading] = useState(true)

  // Modaller
  const [takModalOpen, setTakModalOpen] = useState(false)
  const [sokModalOpen, setSokModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [teknikBilgiOpen, setTeknikBilgiOpen] = useState(false)

  const yukle = useCallback(async () => {
    const k = await stokKalemGetir(id)
    setKalem(k)
    if (k) {
      const h = await kalemHareketleriniGetir(id)
      setHareketler(h ?? [])
      if (k.musteriId) {
        const [m, lokasyonlar] = await Promise.all([
          musteriGetir(k.musteriId),
          k.musteriLokasyonId ? musteriLokasyonlariniGetir(k.musteriId) : Promise.resolve([]),
        ])
        setMusteri(m)
        setLokasyon((lokasyonlar ?? []).find((l) => l.id === k.musteriLokasyonId) ?? null)
      } else {
        setMusteri(null)
        setLokasyon(null)
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Kronik arıza: 3 veya daha fazla arıza hareketi
  const arizaSayisi = useMemo(() => {
    return (hareketler ?? []).filter((h) => {
      if (h.hareket === 'ariza_bildirildi') return true
      if (h.hareket === 'sokuldu' && (h.hedefAciklama ?? '').toLowerCase().includes('arıza')) return true
      return false
    }).length
  }, [hareketler])
  const kronikArizali = arizaSayisi >= 3

  // "Tamirden Döndü" rozeti: son hareket 'tamir_edildi' ise ve cihaz hâlâ depoda/teknisyendeyse göster
  const tamirdenDondu = useMemo(() => {
    if (!kalem) return false
    if (kalem.durum !== 'depoda' && kalem.durum !== 'teknisyende') return false
    const son = (hareketler ?? [])[0] // kalemHareketleriniGetir desc order ile dönüyor
    return son?.hareket === 'tamir_edildi'
  }, [kalem, hareketler])

  // Personelden iade / arızadan depoya dönüş / hurdadan geri kazanım
  const iadeEt = (sebep) => {
    const baslik = sebep === 'tamir'
      ? 'Tamir edildi → depoya'
      : sebep === 'geri_kazan'
      ? 'Hurdadan geri kazan'
      : 'Personelden iade'
    Alert.alert(baslik, 'Onaylıyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: async () => {
          const sonuc = await personeldenIade({
            kalemId: id,
            kullaniciId: kullanici?.id,
            kullaniciAd: kullanici?.ad,
            not: sebep === 'tamir' ? 'Tamir edildi' : sebep === 'geri_kazan' ? 'Hurdadan geri kazanıldı' : null,
          })
          if (sonuc) yukle()
          else Alert.alert('Hata', 'İşlem başarısız.')
        },
      },
    ])
  }

  const arizaliTeslimEt = () => {
    const yeniSayi = arizaSayisi + 1
    const uyari = yeniSayi >= 3
      ? `\n\n⚠️ KRONİK ARIZA: Bu cihaz bununla ${yeniSayi}. kez arızalanıyor. Değişim düşünülmeli.`
      : ''
    Alert.alert(
      'Arızalı Depoya Teslim',
      `Bu cihaz arızalı olarak merkez arızalı depoya teslim edilsin mi?${uyari}`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Teslim Et',
          onPress: async () => {
            const sonuc = await arizaliDepoyaTeslim({
              kalemId: id,
              kullaniciId: kullanici?.id,
              kullaniciAd: kullanici?.ad,
              not: 'Teknisyen arızalı cihazı merkez depoya teslim etti',
            })
            if (sonuc) yukle()
            else Alert.alert('Hata', 'İşlem başarısız.')
          },
        },
      ]
    )
  }

  const tamireGondermeAc = () => {
    Alert.prompt ? (
      Alert.prompt(
        'Tamire Gönder',
        'Üretici / tamir firması adı:',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Gönder',
            onPress: async (ureticiFirma) => {
              const sonuc = await tamireGonder({
                kalemId: id,
                ureticiFirma: ureticiFirma?.trim() || null,
                kullaniciId: kullanici?.id,
                kullaniciAd: kullanici?.ad,
                not: `${ureticiFirma ?? 'Üretici'} firmasına tamir için gönderildi`,
              })
              if (sonuc) yukle()
            },
          },
        ]
      )
    ) : (
      // Android Alert.prompt olmayabilir, basit onay göster
      Alert.alert(
        'Tamire Gönder',
        'Bu cihaz tamire gönderilsin mi?',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Gönder',
            onPress: async () => {
              const sonuc = await tamireGonder({
                kalemId: id,
                kullaniciId: kullanici?.id,
                kullaniciAd: kullanici?.ad,
                not: 'Üretici / servise gönderildi',
              })
              if (sonuc) yukle()
            },
          },
        ]
      )
    )
  }

  const tamirdenDonmekIcin = () => {
    Alert.alert(
      'Tamir Edildi',
      'Cihaz tamir edilmiş, depoya alınsın mı?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Depoya Al',
          onPress: async () => {
            const sonuc = await tamirdenDon({
              kalemId: id,
              kullaniciId: kullanici?.id,
              kullaniciAd: kullanici?.ad,
            })
            if (sonuc) yukle()
          },
        },
      ]
    )
  }

  const sil = () => {
    Alert.alert('Cihazı sil', 'Tüm hareket geçmişiyle birlikte silinir. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await stokKalemSil(id)
          navigation.goBack()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    )
  }

  if (!kalem) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Cihaz bulunamadı.</Text>
      </View>
    )
  }

  const durum = durumBul(kalem.durum)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {!!taradigimKod && (
          <View style={styles.taraInfo}>
            <Text style={styles.taraInfoText}>📷 Az önce taradığın: {taradigimKod}</Text>
          </View>
        )}

        {kronikArizali && (
          <View style={styles.kronikBanner}>
            <Text style={styles.kronikBannerText}>
              ⚠️ KRONİK ARIZA — Bu cihaz {arizaSayisi} kez arızalanmış. Değişim önerilir.
            </Text>
          </View>
        )}

        {tamirdenDondu && (
          <View style={styles.tamirBanner}>
            <Text style={styles.tamirBannerText}>
              🔄 TAMİRDEN DÖNDÜ — Cihaz tamir edildi, tekrar kullanılabilir.
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {kalem.marka || ''} {kalem.model || kalem.stokKodu}
        </Text>

        {durum && (
          <View style={[styles.durumBadge, { backgroundColor: durum.renk + '22', borderColor: durum.renk }]}>
            <Text style={[styles.durumText, { color: durum.renk }]}>
              {durum.ikon} {durum.isim}
            </Text>
          </View>
        )}

        {/* Tanımlayıcılar */}
        <Field label="Seri No" deger={kalem.seriNo} mono />
        <Field label="Barkod" deger={kalem.barkod} mono />
        <Field label="Stok Kodu" deger={kalem.stokKodu} />

        {/* Mevcut konum */}
        {kalem.durum === 'sahada' && (
          <View style={[styles.konumBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.konumLabel, { color: colors.textMuted }]}>📍 Mevcut Konum</Text>
            {!!musteri && (
              <Text style={[styles.konumDeger, { color: colors.textPrimary }]}>
                {musteri.firma || `${musteri.ad} ${musteri.soyad}`}
              </Text>
            )}
            {!!lokasyon && <Text style={[styles.konumLokasyon, { color: colors.textSecondary }]}>{lokasyon.ad}</Text>}
            {!!kalem.takilmaTarihi && (
              <Text style={[styles.konumTarih, { color: colors.textMuted }]}>Takıldı: {tarihFormat(kalem.takilmaTarihi)}</Text>
            )}
          </View>
        )}

        {!!kalem.notlar && <Field label="Notlar" deger={kalem.notlar} multi />}

        {/* Teknik bilgiler */}
        <View style={styles.teknikHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>🔧 Teknik Bilgiler</Text>
          <TouchableOpacity
            style={styles.teknikDuzenleBtn}
            onPress={() => setTeknikBilgiOpen(true)}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={14} color="#60a5fa" />
            <Text style={styles.teknikDuzenleText}>Düzenle</Text>
          </TouchableOpacity>
        </View>
        {(!kalem.ipAdresi && !kalem.macAdresi && !kalem.nvrBilgisi && !kalem.altLokasyon) ? (
          <Text style={[styles.teknikBos, { color: colors.textFaded }]}>Henüz teknik bilgi girilmemiş.</Text>
        ) : (
          <View style={[styles.teknikKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {!!kalem.ipAdresi && <TeknikRow ikon="wifi" label="IP Adresi" deger={kalem.ipAdresi} mono />}
            {!!kalem.macAdresi && <TeknikRow ikon="hash" label="MAC Adresi" deger={kalem.macAdresi} mono />}
            {!!kalem.cihazKullanici && <TeknikRow ikon="user" label="Kullanıcı" deger={kalem.cihazKullanici} />}
            {!!kalem.cihazSifre && <TeknikRow ikon="lock" label="Şifre" deger={kalem.cihazSifre} mono />}
            {!!kalem.nvrBilgisi && <TeknikRow ikon="server" label="NVR" deger={kalem.nvrBilgisi + (kalem.kanalNo ? ` / Kanal ${kalem.kanalNo}` : '')} />}
            {!!kalem.altLokasyon && <TeknikRow ikon="map-pin" label="Alt-Lokasyon" deger={kalem.altLokasyon} />}
          </View>
        )}

        {/* Aksiyonlar — duruma göre akıllı butonlar */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>İşlemler</Text>
        <View style={styles.actionGrid}>
          {kalem.durum === 'depoda' && (
            <>
              <ActionBtn
                ikon={<Feather name="user" size={18} color="#fff" />}
                label="Personele Transfer"
                renk="#a855f7"
                onPress={() => setTransferModalOpen(true)}
              />
              <ActionBtn
                ikon={<Feather name="briefcase" size={18} color="#fff" />}
                label="Müşteri Çıkışı"
                renk="#10b981"
                onPress={() => setTakModalOpen(true)}
              />
            </>
          )}
          {kalem.durum === 'teknisyende' && (
            <>
              <ActionBtn
                ikon={<Feather name="corner-up-left" size={18} color="#fff" />}
                label="Personelden İade"
                renk="#3b82f6"
                onPress={() => iadeEt()}
              />
              <ActionBtn
                ikon={<Feather name="briefcase" size={18} color="#fff" />}
                label="Müşteri Çıkışı"
                renk="#10b981"
                onPress={() => setTakModalOpen(true)}
              />
            </>
          )}
          {kalem.durum === 'sahada' && (
            <ActionBtn
              ikon={<Feather name="alert-triangle" size={18} color="#fff" />}
              label="Söküldü"
              renk="#f59e0b"
              onPress={() => setSokModalOpen(true)}
              full
            />
          )}
          {kalem.durum === 'arizada' && (
            <>
              <ActionBtn
                ikon={<Feather name="package" size={18} color="#fff" />}
                label="Arızalı Depoya Teslim"
                renk="#dc2626"
                onPress={() => arizaliTeslimEt()}
              />
              <ActionBtn
                ikon={<Feather name="check-circle" size={18} color="#fff" />}
                label="Tamir - Depoya"
                renk="#22c55e"
                onPress={() => iadeEt('tamir')}
              />
            </>
          )}
          {kalem.durum === 'arizali_depoda' && (
            <>
              <ActionBtn
                ikon={<Feather name="tool" size={18} color="#fff" />}
                label="Tamire Gönder"
                renk="#ec4899"
                onPress={() => tamireGondermeAc()}
              />
              <ActionBtn
                ikon={<Feather name="refresh-cw" size={18} color="#fff" />}
                label="Tamir Edildi - Depoya"
                renk="#22c55e"
                onPress={() => tamirdenDonmekIcin()}
              />
            </>
          )}
          {kalem.durum === 'tamirde' && (
            <ActionBtn
              ikon={<Feather name="check-circle" size={18} color="#fff" />}
              label="Tamir Tamam - Depoya"
              renk="#22c55e"
              onPress={() => tamirdenDonmekIcin()}
              full
            />
          )}
          {kalem.durum === 'hurda' && (
            <ActionBtn
              ikon={<Feather name="refresh-cw" size={18} color="#fff" />}
              label="Geri Kazan - Depoya"
              renk="#3b82f6"
              onPress={() => iadeEt('geri_kazan')}
              full
            />
          )}
        </View>

        {/* Yaşam döngüsü özeti */}
        {hareketler.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20, color: colors.textMuted }]}>📊 Yaşam Döngüsü</Text>
            {(() => {
              const takilmaSayisi = hareketler.filter((h) => h.hareket === 'takildi').length
              const arizaSayisi = hareketler.filter((h) => h.hareket === 'ariza_bildirildi').length
              const tamirSayisi = hareketler.filter((h) => h.hareket === 'tamir_edildi').length
              const transferSayisi = hareketler.filter((h) => h.hareket === 'teknisyene_zimmet').length
              const farkliMusteriler = new Set(
                hareketler.filter((h) => h.musteriId).map((h) => h.musteriId)
              ).size

              return (
                <View style={styles.yasamGrid}>
                  <YasamKart ikon="activity" renk="#10b981" sayi={takilmaSayisi} label="Takılma" />
                  <YasamKart ikon="alert-triangle" renk="#f59e0b" sayi={arizaSayisi} label="Arıza" />
                  <YasamKart ikon="tool" renk="#ec4899" sayi={tamirSayisi} label="Tamir" />
                  <YasamKart ikon="users" renk="#06b6d4" sayi={farkliMusteriler} label="Müşteri" />
                </View>
              )
            })()}
          </>
        )}

        {/* Hareket geçmişi */}
        <Text style={[styles.sectionLabel, { marginTop: 24, color: colors.textMuted }]}>
          📜 Tam Geçmiş ({hareketler.length})
        </Text>
        {hareketler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Hareket kaydı yok.</Text>
        ) : (
          hareketler.map((h, i) => (
            <View key={i} style={[styles.hareketCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.hareketTip, { color: colors.textPrimary }]}>
                {hareketEtiket(h.hareket)}
              </Text>
              <Text style={[styles.hareketAciklama, { color: colors.textSecondary }]}>
                {h.kaynakAciklama && h.hedefAciklama
                  ? `${h.kaynakAciklama} → ${h.hedefAciklama}`
                  : h.kaynakAciklama || h.hedefAciklama || '—'}
              </Text>
              {!!h.notMetni && <Text style={[styles.hareketNot, { color: colors.textMuted }]}>{h.notMetni}</Text>}
              <Text style={[styles.hareketMeta, { color: colors.textFaded }]}>
                {h.kullaniciAd ?? '—'} · {tarihSaatFormat(h.tarih)}
              </Text>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.silBtn} onPress={sil}>
          <Text style={styles.silText}>Cihazı Sil</Text>
        </TouchableOpacity>
      </ScrollView>

      <TakModal
        visible={takModalOpen}
        onClose={() => setTakModalOpen(false)}
        kalem={kalem}
        kullanici={kullanici}
        onDone={() => {
          setTakModalOpen(false)
          yukle()
        }}
      />

      <SokModal
        visible={sokModalOpen}
        onClose={() => setSokModalOpen(false)}
        kalem={kalem}
        kullanici={kullanici}
        onDone={() => {
          setSokModalOpen(false)
          yukle()
        }}
      />

      <TransferModal
        visible={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        kalem={kalem}
        kullanici={kullanici}
        onDone={() => {
          setTransferModalOpen(false)
          yukle()
        }}
      />

      <CihazTeknikBilgiModal
        visible={teknikBilgiOpen}
        onClose={() => setTeknikBilgiOpen(false)}
        kalem={kalem}
        onSave={() => {
          setTeknikBilgiOpen(false)
          yukle()
        }}
      />
    </View>
  )
}

function YasamKart({ ikon, renk, sayi, label }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.yasamKart, { borderColor: renk + '55', backgroundColor: colors.surface }]}>
      <Feather name={ikon} size={20} color={renk} />
      <Text style={[styles.yasamSayi, { color: renk }]}>{sayi}</Text>
      <Text style={[styles.yasamLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

function TeknikRow({ ikon, label, deger, mono }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.teknikRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.teknikRowIkon, { backgroundColor: colors.primary + '26' }]}>
        <Feather name={ikon} size={14} color={colors.primaryLight} />
      </View>
      <Text style={[styles.teknikRowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[styles.teknikRowDeger, { color: colors.textPrimary }, mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
        selectable
      >
        {deger}
      </Text>
    </View>
  )
}

function ActionBtn({ ikon, label, renk, onPress, full }) {
  return (
    <TouchableOpacity
      style={[
        styles.smartActionBtn,
        { backgroundColor: renk },
        full && { width: '100%' },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {ikon}
      <Text style={styles.smartActionText}>{label}</Text>
    </TouchableOpacity>
  )
}

function hareketEtiket(h) {
  const m = {
    takildi: '✅ Takıldı',
    sokuldu: '⬆️ Söküldü',
    ariza_bildirildi: '⚠️ Arıza Bildirildi',
    tamir_edildi: '🔧 Tamir Edildi',
    hurda: '🗑️ Hurdaya Çıktı',
    depoya_donus: '📦 Depoya Döndü',
    teknisyene_zimmet: '🚚 Teknisyene Zimmetlendi',
  }
  return m[h] ?? h
}

// === Müşteriye Tak Modal ===
function TakModal({ visible, onClose, kalem, kullanici, onDone }) {
  const { colors } = useTheme()
  const [musteriler, setMusteriler] = useState([])
  const [musteri, setMusteri] = useState(null)
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [lokasyon, setLokasyon] = useState(null)
  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [lokasyonPickerOpen, setLokasyonPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')
  const [not, setNot] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [konumKullan, setKonumKullan] = useState(true)

  useEffect(() => {
    if (visible) {
      musterileriGetir().then((l) => setMusteriler(l ?? []))
      setMusteri(null)
      setLokasyon(null)
      setNot('')
      setMusteriArama('')
    }
  }, [visible])

  useEffect(() => {
    if (!musteri) {
      setLokasyonlar([])
      setLokasyon(null)
      return
    }
    musteriLokasyonlariniGetir(musteri.id).then((l) => {
      setLokasyonlar((l ?? []).filter((x) => x.aktif))
      // Tek lokasyon varsa otomatik seç
      const aktifler = (l ?? []).filter((x) => x.aktif)
      if (aktifler.length === 1) setLokasyon(aktifler[0])
      else setLokasyon(null)
    })
  }, [musteri])

  const filtrelenmis = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    const q = musteriArama.toLowerCase()
    return musteriler.filter((m) =>
      [m.firma, m.ad, m.soyad, m.telefon, m.kod]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [musteriler, musteriArama])

  const onayla = async () => {
    if (!musteri) return Alert.alert('Eksik', 'Müşteri seç.')
    if (lokasyonlar.length > 0 && !lokasyon) return Alert.alert('Eksik', 'Lokasyon seç.')

    setKaydediliyor(true)

    let enlem = null, boylam = null
    if (konumKullan) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          enlem = loc.coords.latitude
          boylam = loc.coords.longitude
        }
      } catch {}
    }

    const sonuc = await cihazTak({
      kalemId: kalem.id,
      musteriId: musteri.id,
      musteriLokasyonId: lokasyon?.id ?? null,
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
      not: not.trim() || null,
      enlem,
      boylam,
    })
    setKaydediliyor(false)

    if (sonuc) {
      Alert.alert('Tamam', 'Cihaz başarıyla takıldı.')
      onDone()
    } else {
      Alert.alert('Hata', 'İşlem başarısız.')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalBg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheetBig, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteriye Tak</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Müşteri *</Text>
            <TouchableOpacity
              style={[styles.modalInput, { backgroundColor: colors.surface }]}
              onPress={() => setMusteriPickerOpen(true)}
            >
              <Text style={{ color: musteri ? colors.textPrimary : colors.textFaded }}>
                {musteri ? (musteri.firma || `${musteri.ad} ${musteri.soyad}`) : 'Müşteri seç...'}
              </Text>
            </TouchableOpacity>

            {!!musteri && (
              <>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Lokasyon</Text>
                {lokasyonlar.length === 0 ? (
                  <Text style={[styles.modalHint, { color: colors.textFaded }]}>
                    Bu müşteride aktif lokasyon yok. Önce müşteri detayından lokasyon ekleyin.
                  </Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.modalInput, { backgroundColor: colors.surface }]}
                    onPress={() => setLokasyonPickerOpen(true)}
                  >
                    <Text style={{ color: lokasyon ? colors.textPrimary : colors.textFaded }}>
                      {lokasyon ? lokasyon.ad : 'Lokasyon seç...'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Not</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={not}
              onChangeText={setNot}
              multiline
              placeholder="Bağlantı, ayar, garanti notu..."
              placeholderTextColor={colors.textFaded}
            />

            <TouchableOpacity
              style={styles.modalCheckRow}
              onPress={() => setKonumKullan(!konumKullan)}
            >
              <Text style={styles.modalCheckBox}>{konumKullan ? '✅' : '⬜'}</Text>
              <Text style={styles.modalCheckText}>GPS konumumu da kaydet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.onayBtn, kaydediliyor && { opacity: 0.6 }]}
              onPress={onayla}
              disabled={kaydediliyor}
            >
              <Text style={styles.onayText}>
                {kaydediliyor ? 'Kaydediliyor...' : '✅ Onayla — Takıldı'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* İç müşteri picker */}
          <Modal visible={musteriPickerOpen} transparent animationType="fade">
            <View style={styles.modalBg}>
              <View style={[styles.modalSheetBig, { backgroundColor: colors.bg }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteri Seç</Text>
                  <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                    placeholder="Ara..."
                    placeholderTextColor={colors.textFaded}
                    value={musteriArama}
                    onChangeText={setMusteriArama}
                  />
                </View>
                <FlatList
                  data={filtrelenmis}
                  keyExtractor={(m) => String(m.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                      onPress={() => {
                        setMusteri(item)
                        setMusteriPickerOpen(false)
                        setMusteriArama('')
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                        {item.firma || `${item.ad} ${item.soyad}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          {/* İç lokasyon picker */}
          <Modal visible={lokasyonPickerOpen} transparent animationType="fade">
            <View style={styles.modalBg}>
              <View style={[styles.modalSheetBig, { backgroundColor: colors.bg }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Lokasyon Seç</Text>
                  <TouchableOpacity onPress={() => setLokasyonPickerOpen(false)}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={lokasyonlar}
                  keyExtractor={(l) => String(l.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                      onPress={() => {
                        setLokasyon(item)
                        setLokasyonPickerOpen(false)
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16 }}>📍 {item.ad}</Text>
                      {!!item.adres && (
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.adres}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// === Personele Transfer Modal ===
function TransferModal({ visible, onClose, kalem, kullanici, onDone }) {
  const { colors } = useTheme()
  const [kullanicilar, setKullanicilar] = useState([])
  const [secili, setSecili] = useState(null)
  const [arama, setArama] = useState('')
  const [not, setNot] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (visible) {
      setSecili(null)
      setArama('')
      setNot('')
      kullanicilariGetir().then((l) => setKullanicilar(l ?? []))
    }
  }, [visible])

  const filtrelenmis = useMemo(() => {
    if (!arama.trim()) return kullanicilar
    const q = arama.toLowerCase()
    return kullanicilar.filter((k) =>
      [k.ad, k.kullaniciAdi, k.unvan].filter(Boolean).some((s) =>
        String(s).toLowerCase().includes(q)
      )
    )
  }, [kullanicilar, arama])

  const onayla = async () => {
    if (!secili) {
      Alert.alert('Eksik', 'Bir personel seç.')
      return
    }
    setKaydediliyor(true)
    const sonuc = await teknisyeneZimmetle({
      kalemId: kalem.id,
      teknisyenId: secili.id,
      teknisyenAd: secili.ad,
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
      not: not.trim() || null,
    })
    setKaydediliyor(false)
    if (sonuc) {
      Alert.alert('Tamam', `Cihaz ${secili.ad}'a zimmetlendi.`)
      onDone()
    } else {
      Alert.alert('Hata', 'İşlem başarısız.')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalBg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheetBig, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Personele Transfer</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Personel *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              placeholder="Ara: ad veya kullanıcı adı..."
              placeholderTextColor={colors.textFaded}
              value={arama}
              onChangeText={setArama}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filtrelenmis}
            keyExtractor={(k) => String(k.id)}
            style={{ maxHeight: 280 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const aktif = secili?.id === item.id
              return (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.surface },
                    aktif && { backgroundColor: 'rgba(168,85,247,0.15)' },
                  ]}
                  onPress={() => setSecili(item)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, flex: 1 }}>
                      {item.ad}
                    </Text>
                    {aktif && <Feather name="check" size={20} color="#a855f7" />}
                  </View>
                  {!!item.unvan && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.unvan}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
          <View style={{ padding: 16 }}>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Not</Text>
            <TextInput
              style={[styles.modalInput, { height: 60, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={not}
              onChangeText={setNot}
              multiline
              placeholder="Ek bilgi..."
              placeholderTextColor={colors.textFaded}
            />
            <TouchableOpacity
              style={[styles.onayBtn, { backgroundColor: '#a855f7' }, (kaydediliyor || !secili) && { opacity: 0.5 }]}
              onPress={onayla}
              disabled={kaydediliyor || !secili}
            >
              <Text style={styles.onayText}>
                {kaydediliyor ? 'Kaydediliyor...' : 'Onayla — Transfer Et'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// === Sök Modal ===
function SokModal({ visible, onClose, kalem, kullanici, onDone }) {
  const { colors } = useTheme()
  const [yeniDurum, setYeniDurum] = useState('arizada')
  const [not, setNot] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (visible) {
      setYeniDurum('arizada')
      setNot('')
    }
  }, [visible])

  const onayla = async () => {
    setKaydediliyor(true)
    const sonuc = await cihazSok({
      kalemId: kalem.id,
      yeniDurum,
      kullaniciId: kullanici?.id,
      kullaniciAd: kullanici?.ad,
      not: not.trim() || null,
    })
    setKaydediliyor(false)
    if (sonuc) {
      Alert.alert('Tamam', 'Cihaz söküldü.')
      onDone()
    } else {
      Alert.alert('Hata', 'İşlem başarısız.')
    }
  }

  const SECENEKLER = [
    { id: 'arizada', label: 'Arızalı (sökülüp tamire alındı)', renk: '#f59e0b' },
    { id: 'depoda', label: 'Sağlam (depoya döndü)', renk: '#3b82f6' },
    { id: 'hurda', label: 'Hurda (atılacak)', renk: '#6b7280' },
  ]

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={[styles.modalSheetBig, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cihazı Sök</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Söküldükten sonra ne olacak?</Text>
            {SECENEKLER.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sokSecenek,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  yeniDurum === s.id && { backgroundColor: s.renk + '22', borderColor: s.renk },
                ]}
                onPress={() => setYeniDurum(s.id)}
              >
                <Text style={[styles.sokSecenekText, { color: colors.textSecondary }, yeniDurum === s.id && { color: s.renk, fontWeight: '700' }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Not</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={not}
              onChangeText={setNot}
              multiline
              placeholder="Sebep, yapılan iş, vs."
              placeholderTextColor={colors.textFaded}
            />

            <TouchableOpacity
              style={[styles.onayBtn, kaydediliyor && { opacity: 0.6 }]}
              onPress={onayla}
              disabled={kaydediliyor}
            >
              <Text style={styles.onayText}>
                {kaydediliyor ? 'Kaydediliyor...' : 'Onayla — Söküldü'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function Field({ label, deger, multi, mono }) {
  const { colors } = useTheme()
  if (!deger) return null
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.fieldDeger, { color: colors.textSecondary }, multi && { lineHeight: 22 }, mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
        {String(deger)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  taraInfo: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  taraInfoText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },

  kronikBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  kronikBannerText: { color: '#fca5a5', fontSize: 13, fontWeight: '700', lineHeight: 18 },

  tamirBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  tamirBannerText: { color: '#86efac', fontSize: 13, fontWeight: '700', lineHeight: 18 },

  title: { color: '#fff', fontSize: 22, fontWeight: '800' },

  durumBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  durumText: { fontSize: 13, fontWeight: '700' },

  field: { marginTop: 14 },
  fieldLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  fieldDeger: { color: '#e2e8f0', fontSize: 15 },

  konumBox: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  konumLabel: { color: '#10b981', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  konumDeger: { color: '#fff', fontSize: 16, fontWeight: '700' },
  konumLokasyon: { color: '#cbd5e1', fontSize: 14, marginTop: 2 },
  konumTarih: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },

  teknikHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  teknikDuzenleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  teknikDuzenleText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  teknikBos: {
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: 13,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 10,
  },
  teknikKart: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    overflow: 'hidden',
  },
  teknikRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  teknikRowIkon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teknikRowLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    width: 90,
  },
  teknikRowDeger: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  yasamGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  yasamKart: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    alignItems: 'center',
    gap: 4,
  },
  yasamSayi: {
    fontSize: 22,
    fontWeight: '800',
  },
  yasamLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flex: 1,
    minWidth: 140,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  smartActionBtn: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  smartActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  hareketCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  hareketTip: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hareketAciklama: { color: '#cbd5e1', fontSize: 13, marginTop: 4 },
  hareketNot: { color: '#94a3b8', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  hareketMeta: { color: '#64748b', fontSize: 11, marginTop: 6 },

  bos: { color: '#64748b', fontStyle: 'italic' },

  silBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },

  // Modal styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheetBig: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  modalHint: { color: '#94a3b8', fontStyle: 'italic', marginTop: 8 },

  modalCheckRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  modalCheckBox: { fontSize: 18, marginRight: 8 },
  modalCheckText: { color: '#fff', fontSize: 14 },

  onayBtn: {
    marginTop: 20,
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  onayText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },

  sokSecenek: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sokSecenekText: { color: '#cbd5e1', fontSize: 14 },
})
