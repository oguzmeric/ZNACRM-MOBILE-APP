import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../context/AuthContext'
import ScreenContainer from '../components/ScreenContainer'
import Avatar, { initialsAl } from '../components/Avatar'
import {
  sifreDegistir,
  profilFotosuYukle,
  profilFotosuKaldir,
  kullaniciUnvanGuncelle,
} from '../services/kullaniciService'
import { yonetimPaneliErisimi } from '../utils/yetki'
import { useTheme } from '../context/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import * as Sentry from '@sentry/react-native'

// Compat — başka yerlerde de import edilmiş olabilir
export { initialsAl }

export default function ProfilScreen({ navigation }) {
  const { kullanici, cikisYap, kullaniciyiTazele, modDegistir, mod } = useAuth()
  const yetkili = yonetimPaneliErisimi(kullanici)
  const { mod: temaModu, modDegistir: temaDegistir, colors } = useTheme()
  const insets = useSafeAreaInsets()
  let tabBarHeight = 0
  try { tabBarHeight = useBottomTabBarHeight() } catch (_) {}
  const [sifreModalOpen, setSifreModalOpen] = useState(false)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const [unvanModalOpen, setUnvanModalOpen] = useState(false)
  const [unvanInput, setUnvanInput] = useState('')
  const [unvanKaydediliyor, setUnvanKaydediliyor] = useState(false)

  const UNVAN_SECENEK = ['Teknisyen', 'Saha Teknisyeni', 'Mühendis', 'Depo Sorumlusu', 'Müşteri Temsilcisi']

  const unvanModalAc = () => {
    setUnvanInput(kullanici?.unvan ?? '')
    setUnvanModalOpen(true)
  }

  const unvanKaydet = async () => {
    if (!kullanici?.id) return
    setUnvanKaydediliyor(true)
    const ok = await kullaniciUnvanGuncelle(kullanici.id, unvanInput.trim())
    setUnvanKaydediliyor(false)
    if (!ok) {
      Alert.alert('Kaydedilemedi', 'Unvan güncellenemedi. Tekrar deneyin.')
      return
    }
    await kullaniciyiTazele()
    setUnvanModalOpen(false)
  }

  const cikisOnayi = () => {
    Alert.alert('Çıkış yap', 'Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: cikisYap },
    ])
  }

  const fotoSecimi = () => {
    const secenekler = [
      { text: 'Kamera', onPress: () => fotoYukle('kamera') },
      { text: 'Galeri', onPress: () => fotoYukle('galeri') },
    ]
    if (kullanici?.fotoUrl) {
      secenekler.push({ text: 'Fotoğrafı Kaldır', style: 'destructive', onPress: fotoSil })
    }
    secenekler.push({ text: 'Vazgeç', style: 'cancel' })
    Alert.alert('Profil Fotoğrafı', 'Ne yapmak istersin?', secenekler)
  }

  const fotoYukle = async (kaynak) => {
    try {
      // İzin kontrolü
      const izin = kaynak === 'kamera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!izin.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf için izin ver.')
        return
      }

      // Foto seç
      const secici = kaynak === 'kamera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync
      const sonuc = await secici({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      })
      if (sonuc.canceled || !sonuc.assets?.[0]) return

      const uri = sonuc.assets[0].uri
      setFotoYukleniyor(true)
      const r = await profilFotosuYukle(kullanici.id, uri)
      setFotoYukleniyor(false)

      if (!r.ok) {
        Alert.alert('Hata', r.hata ?? 'Fotoğraf yüklenemedi.')
        return
      }
      await kullaniciyiTazele()
    } catch (e) {
      setFotoYukleniyor(false)
      Alert.alert('Hata', e?.message ?? 'Fotoğraf yüklenemedi.')
    }
  }

  const fotoSil = async () => {
    await profilFotosuKaldir(kullanici.id)
    await kullaniciyiTazele()
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: tabBarHeight + 32 }}>
        {/* Avatar + Ad */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={fotoSecimi} activeOpacity={0.8}>
            <View style={styles.avatarWrapBig}>
              <Avatar
                ad={kullanici?.ad}
                fotoUrl={kullanici?.fotoUrl}
                size={110}
              />
              <View style={styles.cameraBadge}>
                {fotoYukleniyor ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="camera" size={16} color="#fff" />
                )}
              </View>
            </View>
          </TouchableOpacity>
          <Text style={[styles.ad, { color: colors.textPrimary }]}>{kullanici?.ad ?? '—'}</Text>
          {!!kullanici?.unvan && (
            <View style={styles.unvanBadge}>
              <Text style={styles.unvanText}>{kullanici.unvan}</Text>
            </View>
          )}
        </View>

        {/* Kişisel bilgiler kartı */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Kişisel Bilgiler</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoRow ikon="user" label="Ad Soyad" deger={kullanici?.ad} />
          <InfoRow ikon="at-sign" label="Kullanıcı Adı" deger={kullanici?.kullaniciAdi} />
          <TouchableOpacity
            onPress={unvanModalAc}
            activeOpacity={0.7}
            style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.rowIkon, { backgroundColor: colors.primary + '26' }]}>
              <Feather name="briefcase" size={16} color={colors.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Unvan</Text>
              <Text style={[styles.rowDeger, { color: kullanici?.unvan ? colors.textSecondary : '#f59e0b' }]}>
                {kullanici?.unvan ?? 'Belirtilmemiş — düzenle'}
              </Text>
            </View>
            <Feather name="edit-2" size={14} color={colors.primary} />
          </TouchableOpacity>
          {!!kullanici?.firmaAdi && (
            <InfoRow ikon="home" label="Firma" deger={kullanici.firmaAdi} son />
          )}
        </View>

        {yetkili && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Yönetim</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {mod === 'admin' ? (
                <ActionRow
                  ikon="log-out"
                  label="Teknisyen Moduna Dön"
                  onPress={() => modDegistir('teknisyen')}
                  son
                />
              ) : (
                <ActionRow
                  ikon="shield"
                  label="Yönetim Paneline Geç"
                  onPress={() => modDegistir('admin')}
                  son
                />
              )}
            </View>
          </>
        )}

        {/* Görünüm */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Görünüm</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActionRow
            ikon={temaModu === 'gunduz' ? 'sun' : 'moon'}
            label={temaModu === 'gunduz' ? 'Gündüz Modu' : 'Gece Modu'}
            onPress={() => temaDegistir()}
            son
          />
        </View>

        {/* Destek */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Destek</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActionRow
            ikon="help-circle"
            label="Destek Taleplerim"
            onPress={() => navigation.navigate('DestekListe')}
            son
          />
        </View>

        {/* Hata izleme test — sadece yönetim yetkisi olanlar */}
        {yetkili && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Sistem</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActionRow
                ikon="activity"
                label="Hata İzleme Testi"
                onPress={() => {
                  try {
                    Sentry.captureException(new Error('Manuel test — hata izleme bağlantısı'))
                    Alert.alert('Test Gönderildi', 'Hata izleme sistemi panelinde 1-2 dakika içinde görünecek.')
                  } catch (e) {
                    Alert.alert('Hata', String(e?.message ?? e))
                  }
                }}
                son
              />
            </View>
          </>
        )}

        {/* Yasal */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Yasal</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActionRow
            ikon="shield"
            label="Gizlilik Politikası"
            onPress={() => navigation.navigate('GizlilikPolitikasi')}
          />
          <ActionRow
            ikon="file-text"
            label="Kullanım Koşulları"
            onPress={() => navigation.navigate('KullanimKosullari')}
            son
          />
        </View>

        {/* Eylemler */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Hesap</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActionRow
            ikon="lock"
            label="Şifre Değiştir"
            onPress={() => setSifreModalOpen(true)}
          />
          <ActionRow
            ikon="log-out"
            label="Çıkış Yap"
            onPress={cikisOnayi}
            tehlikeli
          />
          <ActionRow
            ikon="trash-2"
            label="Hesabı Sil"
            onPress={() => navigation.navigate('HesabiSil')}
            tehlikeli
            son
          />
        </View>

        <Text style={[styles.footer, { color: colors.textFaded }]}>ZNA CRM · v1.0.0</Text>
      </ScrollView>

      <SifreDegistirModal
        visible={sifreModalOpen}
        onClose={() => setSifreModalOpen(false)}
        kullaniciId={kullanici?.id}
      />

      <Modal visible={unvanModalOpen} animationType="slide" transparent onRequestClose={() => setUnvanModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ padding: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>Unvan</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              Hızlı seçeneklerden birini seç veya yaz.
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {UNVAN_SECENEK.map((u) => {
                const aktif = unvanInput === u
                return (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnvanInput(u)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      backgroundColor: aktif ? colors.primary : colors.surfaceDark,
                      borderColor: aktif ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: aktif ? '#fff' : colors.textPrimary }}>{u}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TextInput
              value={unvanInput}
              onChangeText={setUnvanInput}
              placeholder="Veya özel unvan yaz…"
              placeholderTextColor={colors.textMuted}
              style={{
                marginTop: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceDark,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setUnvanModalOpen(false)}
                activeOpacity={0.8}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={unvanKaydet}
                activeOpacity={0.8}
                disabled={unvanKaydediliyor}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, backgroundColor: colors.primary, borderColor: colors.primary, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {unvanKaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

function InfoRow({ ikon, label, deger, son }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.row, !son && [styles.rowBorder, { borderBottomColor: colors.border }]]}>
      <View style={[styles.rowIkon, { backgroundColor: colors.primary + '26' }]}>
        <Feather name={ikon} size={16} color={colors.primaryLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.rowDeger, { color: colors.textSecondary }]}>{deger ?? '—'}</Text>
      </View>
    </View>
  )
}

function ActionRow({ ikon, label, onPress, tehlikeli, son }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.row, !son && [styles.rowBorder, { borderBottomColor: colors.border }]]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIkon, { backgroundColor: colors.primary + '26' }, tehlikeli && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
        <Feather name={ikon} size={16} color={tehlikeli ? colors.danger : colors.primaryLight} />
      </View>
      <Text style={[styles.actionText, { color: colors.textPrimary }, tehlikeli && { color: colors.danger }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.textFaded} />
    </TouchableOpacity>
  )
}

function SifreDegistirModal({ visible, onClose, kullaniciId }) {
  const [mevcut, setMevcut] = useState('')
  const [yeni, setYeni] = useState('')
  const [yeniTekrar, setYeniTekrar] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const kaydet = async () => {
    if (!mevcut || !yeni || !yeniTekrar) {
      Alert.alert('Eksik', 'Tüm alanları doldur.')
      return
    }
    if (yeni !== yeniTekrar) {
      Alert.alert('Uyumsuz', 'Yeni şifreler eşleşmiyor.')
      return
    }
    if (yeni.length < 4) {
      Alert.alert('Çok kısa', 'Şifre en az 4 karakter olmalı.')
      return
    }
    setKaydediliyor(true)
    const sonuc = await sifreDegistir(kullaniciId, mevcut, yeni)
    setKaydediliyor(false)
    if (!sonuc.ok) {
      Alert.alert('Hata', sonuc.hata ?? 'İşlem başarısız.')
      return
    }
    Alert.alert('Tamam', 'Şifren güncellendi.')
    setMevcut('')
    setYeni('')
    setYeniTekrar('')
    onClose()
  }

  const kapat = () => {
    setMevcut('')
    setYeni('')
    setYeniTekrar('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalBg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Şifre Değiştir</Text>
            <TouchableOpacity onPress={kapat}>
              <Text style={{ color: '#94a3b8', fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={styles.modalLabel}>Mevcut Şifre</Text>
            <TextInput
              style={styles.modalInput}
              value={mevcut}
              onChangeText={setMevcut}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.modalLabel}>Yeni Şifre</Text>
            <TextInput
              style={styles.modalInput}
              value={yeni}
              onChangeText={setYeni}
              secureTextEntry
              placeholder="En az 4 karakter"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.modalLabel}>Yeni Şifre (Tekrar)</Text>
            <TextInput
              style={styles.modalInput}
              value={yeniTekrar}
              onChangeText={setYeniTekrar}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#64748b"
            />

            <TouchableOpacity
              style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
              onPress={kaydet}
              disabled={kaydediliyor}
            >
              <Text style={styles.kaydetText}>
                {kaydediliyor ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarWrapBig: {
    position: 'relative',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0a0f1e',
  },
  ad: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
  },
  unvanBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  unvanText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIkon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rowDeger: { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },

  footer: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.5,
  },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
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
    borderWidth: 1,
    borderColor: '#334155',
  },
  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
