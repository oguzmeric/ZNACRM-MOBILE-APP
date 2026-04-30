import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import Avatar from '../../components/Avatar'
import { useTheme } from '../../context/ThemeContext'
import {
  MENU_LISTESI,
  yetkiyeUygunKullanicilar,
  kullaniciMenuYetkileri,
  menuYetkisiAyarla,
} from '../../services/menuYetkiService'
import { kullaniciUnvanGuncelle } from '../../services/kullaniciService'

const UNVAN_SECENEKLERI = [
  'Teknisyen',
  'Saha Teknisyeni',
  'Mühendis',
  'Depo Sorumlusu',
  'Müşteri Temsilcisi',
  'Stajyer',
  // Yönetim (admin yetkili) — mobil yönetim paneline erişim verir
  'Teknik Müdür',
  'Genel Müdür',
  'Yazılım Geliştirmeci',
]

export default function AdminMenuYetkileriScreen() {
  const { colors } = useTheme()
  const [kullanicilar, setKullanicilar] = useState([])
  const [seciliKullanici, setSeciliKullanici] = useState(null)
  const [yetki, setYetki] = useState({})
  const [arama, setArama] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [unvanModal, setUnvanModal] = useState({ acik: false, kullanici: null, deger: '' })

  const kullanicilariYukle = useCallback(async () => {
    setYukleniyor(true)
    const liste = await yetkiyeUygunKullanicilar()
    setKullanicilar(liste)
    setYukleniyor(false)
  }, [])

  const yetkiYukle = useCallback(async () => {
    if (!seciliKullanici) return
    const harita = await kullaniciMenuYetkileri(seciliKullanici.id)
    setYetki(harita)
  }, [seciliKullanici])

  useEffect(() => { kullanicilariYukle() }, [kullanicilariYukle])
  useEffect(() => { yetkiYukle() }, [yetkiYukle])

  const filtreliListe = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (!q) return kullanicilar
    return kullanicilar.filter((k) => {
      const ad = (k.ad ?? '').toLocaleLowerCase('tr-TR')
      const unvan = (k.unvan ?? '').toLocaleLowerCase('tr-TR')
      const kAdi = (k.kullaniciAdi ?? '').toLocaleLowerCase('tr-TR')
      return ad.includes(q) || unvan.includes(q) || kAdi.includes(q)
    })
  }, [kullanicilar, arama])

  const goster = (anahtar) => yetki[anahtar] !== false

  const unvanModalAc = (k) => setUnvanModal({ acik: true, kullanici: k, deger: k.unvan ?? '' })
  const unvanModalKapat = () => setUnvanModal({ acik: false, kullanici: null, deger: '' })

  const unvanKaydet = async () => {
    const k = unvanModal.kullanici
    if (!k) return
    const yeniUnvan = unvanModal.deger.trim()
    setKaydediliyor(true)
    const ok = await kullaniciUnvanGuncelle(k.id, yeniUnvan)
    setKaydediliyor(false)
    if (!ok) {
      Alert.alert('Kaydedilemedi', 'Unvan güncellenemedi.')
      return
    }
    // Listeyi güncelle (lokal)
    setKullanicilar((onceki) => onceki.map((x) => x.id === k.id ? { ...x, unvan: yeniUnvan || null } : x))
    if (seciliKullanici?.id === k.id) {
      setSeciliKullanici({ ...seciliKullanici, unvan: yeniUnvan || null })
    }
    unvanModalKapat()
  }

  const toggle = async (anahtar) => {
    if (!seciliKullanici) return
    const yeniDeger = !goster(anahtar)
    setKaydediliyor(true)
    const ok = await menuYetkisiAyarla(seciliKullanici.id, anahtar, yeniDeger)
    setKaydediliyor(false)
    if (!ok) {
      Alert.alert('Kaydedilemedi', 'Yetki güncellenemedi. Tekrar deneyin.')
      return
    }
    setYetki((onceki) => ({ ...onceki, [anahtar]: yeniDeger }))
  }

  if (yukleniyor) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  const UnvanModal = (
    <Modal
      visible={unvanModal.acik}
      animationType="slide"
      transparent
      onRequestClose={unvanModalKapat}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modalBaslik, { color: colors.textPrimary }]}>
            Unvan Ata
          </Text>
          <Text style={[styles.modalAlt, { color: colors.textMuted }]}>
            {unvanModal.kullanici?.ad}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 14 }]}>HIZLI SEÇ</Text>
          <View style={styles.unvanGrid}>
            {UNVAN_SECENEKLERI.map((u) => {
              const aktif = unvanModal.deger === u
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnvanModal((s) => ({ ...s, deger: u }))}
                  activeOpacity={0.8}
                  style={[
                    styles.unvanChip,
                    {
                      backgroundColor: aktif ? colors.primary : colors.surfaceDark,
                      borderColor: aktif ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.unvanChipText, { color: aktif ? '#fff' : colors.textPrimary }]}>{u}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>VEYA YAZ</Text>
          <TextInput
            value={unvanModal.deger}
            onChangeText={(t) => setUnvanModal((s) => ({ ...s, deger: t }))}
            placeholder="Özel unvan…"
            placeholderTextColor={colors.textMuted}
            style={[styles.unvanInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              onPress={unvanModalKapat}
              activeOpacity={0.8}
              style={[styles.modalBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={unvanKaydet}
              activeOpacity={0.8}
              disabled={kaydediliyor}
              style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  )

  // Kullanıcı seçilmediyse listele
  if (!seciliKullanici) {
    return (
      <ScreenContainer>
        {UnvanModal}
        <View style={{ padding: 16, paddingBottom: 32, flex: 1 }}>
          <Text style={[styles.label, { color: colors.textMuted }]}>KULLANICI SEÇ</Text>
          <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.aramaInput, { color: colors.textPrimary }]}
              placeholder="İsim, unvan veya kullanıcı adı"
              placeholderTextColor={colors.textMuted}
              value={arama}
              onChangeText={setArama}
            />
          </View>

          {filtreliListe.length === 0 ? (
            <Text style={[styles.bos, { color: colors.textMuted }]}>
              Eşleşen kullanıcı yok.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {filtreliListe.map((k) => (
                <View
                  key={k.id}
                  style={[styles.kullaniciSatir, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    onPress={() => setSeciliKullanici(k)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  >
                    <Avatar ad={k.ad} fotoUrl={k.fotoUrl} size={36} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.kAd, { color: colors.textPrimary }]}>{k.ad}</Text>
                      <Text style={[styles.kUnvan, { color: k.unvan ? colors.textMuted : '#f59e0b' }]}>
                        {k.unvan || 'Unvan yok — atayın'} · {k.kullaniciAdi}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => unvanModalAc(k)}
                    activeOpacity={0.7}
                    style={[styles.unvanEditBtn, { borderColor: colors.border }]}
                  >
                    <Feather name="edit-2" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScreenContainer>
    )
  }

  // Kullanıcı seçildi → menü yetkilerini düzenle
  return (
    <ScreenContainer>
      {UnvanModal}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={() => { setSeciliKullanici(null); setYetki({}) }}
          activeOpacity={0.7}
          style={styles.geriBtn}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={[styles.geriText, { color: colors.primary }]}>Kullanıcı listesi</Text>
        </TouchableOpacity>

        <View style={[styles.kullaniciOzet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar ad={seciliKullanici.ad} fotoUrl={seciliKullanici.fotoUrl} size={48} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.kAd, { color: colors.textPrimary, fontSize: 16 }]}>
              {seciliKullanici.ad}
            </Text>
            <Text style={[styles.kUnvan, { color: seciliKullanici.unvan ? colors.textMuted : '#f59e0b' }]}>
              {seciliKullanici.unvan || 'Unvan yok — atayın'} · {seciliKullanici.kullaniciAdi}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => unvanModalAc(seciliKullanici)}
            activeOpacity={0.7}
            style={[styles.unvanEditBtn, { borderColor: colors.border }]}
          >
            <Feather name="edit-2" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>MENÜ ERİŞİMİ</Text>
        <Text style={[styles.alt, { color: colors.textFaded }]}>
          Açık olan menüler bu kullanıcının Ana Sayfa'sında görünür.
        </Text>

        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {MENU_LISTESI.map((m, i) => (
            <View
              key={m.anahtar}
              style={[
                styles.satir,
                i < MENU_LISTESI.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuAd, { color: colors.textPrimary }]}>{m.ad}</Text>
                <Text style={[styles.menuAnahtar, { color: colors.textMuted }]}>{m.anahtar}</Text>
              </View>
              <Switch
                value={goster(m.anahtar)}
                onValueChange={() => toggle(m.anahtar)}
                disabled={kaydediliyor}
                trackColor={{ false: '#444', true: colors.primary }}
              />
            </View>
          ))}
        </View>

        <View style={[styles.bilgi, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={[styles.bilgiMetin, { color: colors.textMuted }]}>
            Değişiklikler anında kaydedilir. Kullanıcı sonraki ekran açılışında yeni menüyü görür.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  alt: { fontSize: 11, marginBottom: 10 },
  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  kullaniciSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  kAd: { fontSize: 14, fontWeight: '700' },
  kUnvan: { fontSize: 11, marginTop: 2 },
  geriBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  geriText: { fontSize: 13, fontWeight: '600' },
  kullaniciOzet: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  kart: { borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  satir: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  menuAd: { fontSize: 14, fontWeight: '700' },
  menuAnahtar: { fontSize: 11, marginTop: 2 },
  bilgi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bilgiMetin: { flex: 1, fontSize: 11 },
  bos: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
  unvanEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalKart: {
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  modalBaslik: { fontSize: 18, fontWeight: '800' },
  modalAlt: { fontSize: 12, marginTop: 4 },
  unvanGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  unvanChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  unvanChipText: { fontSize: 13, fontWeight: '600' },
  unvanInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
})
