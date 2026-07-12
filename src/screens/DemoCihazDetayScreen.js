import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import {
  demoCihazGetir, demoZimmetGecmisi, demoZimmetIadeAl, demoZimmetUzat,
  demoBakimaAl, demoCihazSil, imzaliTutanakYukle, imzaliTutanakUrl,
  ALMADI_SEBEPLERI,
} from '../services/demoService'
import TarihSec from '../components/TarihSec'
import SecimPicker from '../components/SecimPicker'
import BelgePaylasModal from '../components/BelgePaylasModal'

const fmtTarih = (t) => t ? new Date(t).toLocaleDateString('tr-TR') : '—'

const KARAR_SECENEK = [
  { id: 'aldi', label: '✓ Aldı' },
  { id: 'almadi', label: '✗ Almadı' },
  { id: 'degerlendiriyor', label: '… Değerlendiriyor' },
]

export default function DemoCihazDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const [cihaz, setCihaz] = useState(null)
  const [gecmis, setGecmis] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [iadeModal, setIadeModal] = useState(false)
  const [uzatModal, setUzatModal] = useState(false)
  const [paylasModal, setPaylasModal] = useState(false)
  const [tutanakYukleniyor, setTutanakYukleniyor] = useState(false)

  const yukle = useCallback(async () => {
    const [c, g] = await Promise.all([demoCihazGetir(id), demoZimmetGecmisi(id)])
    setCihaz(c); setGecmis(g)
    setYukleniyor(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  if (yukleniyor) return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  if (!cihaz) return <ScreenContainer><Text style={{ color: colors.textMuted, padding: 24, textAlign: 'center' }}>Cihaz bulunamadı.</Text></ScreenContainer>

  const aktif = gecmis.find(z => !z.gercekIadeTarihi)
  const isAdmin = kullanici?.rol === 'admin'

  const bakimToggle = async () => { await demoBakimaAl(cihaz.id, !cihaz.bakimda); yukle() }

  // ── İmzalı tutanak foto çek/yükle ──
  const tutanakFotoYukle = async (uri) => {
    setTutanakYukleniyor(true)
    const sonuc = await imzaliTutanakYukle(aktif.id, uri)
    setTutanakYukleniyor(false)
    if (sonuc.ok) { Alert.alert('Tamam', 'İmzalı tutanak yüklendi.'); yukle() }
    else Alert.alert('Hata', sonuc.hata || 'Yükleme başarısız.')
  }

  const tutanakFotoSec = () => {
    if (!aktif) return
    Alert.alert('İmzalı Tutanak', 'İmzalı tutanağın fotoğrafını nasıl ekleyelim?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: '📷 Kamera', onPress: async () => {
          const izin = await ImagePicker.requestCameraPermissionsAsync()
          if (!izin.granted) { Alert.alert('İzin Gerekli', 'Kameraya erişim izni verin.'); return }
          const s = await ImagePicker.launchCameraAsync({ quality: 0.7 })
          if (!s.canceled && s.assets?.[0]?.uri) await tutanakFotoYukle(s.assets[0].uri)
        },
      },
      {
        text: '🖼 Galeri', onPress: async () => {
          const s = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
          })
          if (!s.canceled && s.assets?.[0]?.uri) await tutanakFotoYukle(s.assets[0].uri)
        },
      },
    ])
  }

  const imzaliGoster = async (yol) => {
    const url = await imzaliTutanakUrl(yol)
    if (url) Linking.openURL(url)
    else Alert.alert('Hata', 'Dosya açılamadı.')
  }

  const sil = () => {
    if (aktif) {
      Alert.alert('Silinemez', 'Aktif zimmeti olan cihaz silinemez. Önce iade al.')
      return
    }
    const mesaj = gecmis.length > 0
      ? `Bu cihaz silinince ${gecmis.length} zimmet geçmişi de kalıcı olarak silinecek.`
      : 'Bu cihaz havuzdan kalıcı olarak silinsin mi?'
    Alert.alert('Cihazı Sil', mesaj, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          const ok = await demoCihazSil(cihaz.id)
          if (ok) navigation.goBack()
          else Alert.alert('Hata', 'Cihaz silinemedi.')
        },
      },
    ])
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cihazAd, { color: colors.textPrimary }]}>{cihaz.ad}</Text>
          <Text style={[styles.alt, { color: colors.textMuted }]}>
            {[cihaz.marka, cihaz.model, cihaz.kategori].filter(Boolean).join(' · ')}
            {cihaz.seriNo && ` · S.N.: ${cihaz.seriNo}`}
          </Text>
          {!!cihaz.notlar && <Text style={[styles.notlar, { color: colors.textSecondary }]}>{cihaz.notlar}</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('YeniDemoCihaz', { editId: cihaz.id })}
              style={[styles.bakimBtn, { borderColor: colors.border }]}>
              <Feather name="edit-2" size={14} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Düzenle</Text>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity onPress={bakimToggle} style={[styles.bakimBtn, { borderColor: colors.border }]}>
                <Feather name="tool" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                  {cihaz.bakimda ? 'Bakımdan Çıkar' : 'Bakıma Al'}
                </Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity onPress={sil} style={[styles.bakimBtn, { borderColor: '#dc2626' }]}>
                <Feather name="trash-2" size={14} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontWeight: '600' }}>Sil</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {aktif ? (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: '#3b82f6', borderLeftWidth: 4 }]}>
            <Text style={[styles.bolumBaslik, { color: colors.primary }]}>AKTİF ZİMMET</Text>
            <Bilgi label="Müşteri" value={aktif.musteri?.firma || `${aktif.musteri?.ad ?? ''} ${aktif.musteri?.soyad ?? ''}`.trim() || `#${aktif.musteriId}`} colors={colors} />
            <Bilgi label="Lokasyon" value={aktif.lokasyon?.ad || '—'} colors={colors} />
            <Bilgi label="Veriliş" value={fmtTarih(aktif.verisTarihi)} colors={colors} />
            <Bilgi label="Beklenen İade" value={fmtTarih(aktif.beklenenIadeTarihi)} colors={colors} />
            <Bilgi label="Veren" value={aktif.verenKullaniciAd || '—'} colors={colors} />
            {!!aktif.durumNotu && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>{aktif.durumNotu}</Text>}

            {/* ── Teslim tutanağı ── */}
            <View style={{
              marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1,
              borderColor: aktif.imzaliTutanakUrl ? '#22c55e' : '#f59e0b',
              backgroundColor: (aktif.imzaliTutanakUrl ? '#22c55e' : '#f59e0b') + '11',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Feather
                  name={aktif.imzaliTutanakUrl ? 'file-text' : 'alert-triangle'}
                  size={14}
                  color={aktif.imzaliTutanakUrl ? '#22c55e' : '#f59e0b'}
                />
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                  Tutanak {aktif.tutanakNo || ''}
                </Text>
                <Text style={{
                  color: aktif.imzaliTutanakUrl ? '#22c55e' : '#f59e0b',
                  fontSize: 11, fontWeight: '700',
                }}>
                  {aktif.imzaliTutanakUrl ? '· İmzalı yüklendi ✓' : '· İmza bekleniyor'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  onPress={tutanakFotoSec}
                  disabled={tutanakYukleniyor}
                  style={[styles.btn, { backgroundColor: aktif.imzaliTutanakUrl ? colors.surface : colors.primary, borderWidth: aktif.imzaliTutanakUrl ? 1 : 0, borderColor: colors.border, opacity: tutanakYukleniyor ? 0.6 : 1 }]}>
                  {tutanakYukleniyor
                    ? <ActivityIndicator size="small" color={aktif.imzaliTutanakUrl ? colors.textPrimary : '#fff'} />
                    : <Feather name="camera" size={15} color={aktif.imzaliTutanakUrl ? colors.textPrimary : '#fff'} />}
                  <Text style={[styles.btnText, { color: aktif.imzaliTutanakUrl ? colors.textPrimary : '#fff' }]}>
                    {aktif.imzaliTutanakUrl ? 'Yeniden Çek' : 'İmzalıyı Çek/Yükle'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPaylasModal(true)}
                  style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                  <Feather name="send" size={15} color={colors.textPrimary} />
                  <Text style={[styles.btnText, { color: colors.textPrimary }]}>Gönder</Text>
                </TouchableOpacity>
                {!!aktif.imzaliTutanakUrl && (
                  <TouchableOpacity
                    onPress={() => imzaliGoster(aktif.imzaliTutanakUrl)}
                    style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <Feather name="eye" size={15} color={colors.textPrimary} />
                    <Text style={[styles.btnText, { color: colors.textPrimary }]}>Gör</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setIadeModal(true)} style={[styles.btn, { backgroundColor: colors.primary }]}>
                <Feather name="arrow-down-circle" size={16} color="#fff" />
                <Text style={styles.btnText}>İade Al</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setUzatModal(true)} style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="clock" size={16} color={colors.textPrimary} />
                <Text style={[styles.btnText, { color: colors.textPrimary }]}>Süreyi Uzat</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          !cihaz.bakimda && (
            <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: '#22c55e', borderLeftWidth: 4 }]}>
              <Text style={[styles.bolumBaslik, { color: '#22c55e' }]}>📦 CİHAZ DEPODA</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginVertical: 8 }}>
                Bu cihazı bir müşteriye zimmetlemek için aşağıdaki butona tıkla.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('YeniDemoZimmet', { cihazId: cihaz.id })}
                style={[styles.btn, { backgroundColor: colors.primary, marginTop: 4 }]}
              >
                <Feather name="plus-circle" size={16} color="#fff" />
                <Text style={styles.btnText}>Müşteriye Zimmet Aç</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        <Text style={[styles.bolumBaslik, { color: colors.textMuted, marginTop: 20, marginBottom: 8 }]}>
          GEÇMİŞ ({gecmis.length})
        </Text>
        {gecmis.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', padding: 16, textAlign: 'center' }}>
            Henüz hiç zimmet yok.
          </Text>
        ) : (
          gecmis.map((z) => {
            const sure = z.gercekIadeTarihi
              ? Math.floor((new Date(z.gercekIadeTarihi) - new Date(z.verisTarihi)) / 86400000)
              : Math.floor((new Date() - new Date(z.verisTarihi)) / 86400000)
            return (
              <View key={z.id} style={[styles.gecmisKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cihazAd, { color: colors.textPrimary, fontSize: 13 }]}>
                    {z.musteri?.firma || `${z.musteri?.ad ?? ''} ${z.musteri?.soyad ?? ''}`.trim()}
                  </Text>
                  <Text style={[styles.alt, { color: colors.textMuted }]}>
                    {fmtTarih(z.verisTarihi)} → {z.gercekIadeTarihi ? fmtTarih(z.gercekIadeTarihi) : 'aktif'} · {sure}g
                  </Text>
                  {!!z.musteriKarari && (
                    <Text style={{ color: z.musteriKarari === 'aldi' ? '#22c55e' : z.musteriKarari === 'almadi' ? '#dc2626' : '#f59e0b', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                      {KARAR_SECENEK.find(k => k.id === z.musteriKarari)?.label}
                    </Text>
                  )}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      <IadeAlModal
        acik={iadeModal}
        onKapat={() => setIadeModal(false)}
        onKaydet={async ({ tarih, karar, not, almadiSebebi }) => {
          if (!aktif) return
          await demoZimmetIadeAl(aktif.id, {
            gercekIadeTarihi: tarih, musteriKarari: karar || null,
            durumNotu: not || null, almadiSebebi,
          })
          setIadeModal(false); yukle()
        }}
        colors={colors}
      />

      {aktif && (
        <BelgePaylasModal
          visible={paylasModal}
          onClose={() => { setPaylasModal(false); yukle() }}
          belgeTipi="demo_tutanak"
          belgeId={aktif.id}
          prefillGsm={aktif.musteri?.telefon || ''}
          prefillEmail={aktif.musteri?.email || ''}
          baslikMetni={`${aktif.tutanakNo || 'Tutanak'} — ${cihaz.ad}`}
        />
      )}

      <SureyiUzatModal
        acik={uzatModal}
        mevcut={aktif?.beklenenIadeTarihi}
        onKapat={() => setUzatModal(false)}
        onKaydet={async (tarih, neden) => {
          if (!aktif) return
          await demoZimmetUzat(aktif.id, tarih, neden)
          setUzatModal(false); yukle()
        }}
        colors={colors}
      />
    </ScreenContainer>
  )
}

function Bilgi({ label, value, colors }) {
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 2 }}>{value}</Text>
    </View>
  )
}

function IadeAlModal({ acik, onKapat, onKaydet, colors }) {
  const bugun = new Date().toISOString().slice(0, 10)
  const [tarih, setTarih] = useState(bugun)
  const [karar, setKarar] = useState('')
  const [almadiSebebi, setAlmadiSebebi] = useState('')
  const [not, setNot] = useState('')
  useEffect(() => { if (acik) { setTarih(bugun); setKarar(''); setAlmadiSebebi(''); setNot('') } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [acik])
  if (!acik) return null
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 12 }}>İade Al</Text>
          <View style={{ marginBottom: 12 }}>
            <TarihSec
              value={tarih}
              onChange={(iso) => setTarih(iso || '')}
              label="İADE TARİHİ"
              title="İade Tarihi"
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>MÜŞTERİ KARARI</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {KARAR_SECENEK.map(k => (
              <TouchableOpacity key={k.id} onPress={() => setKarar(karar === k.id ? '' : k.id)}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: karar === k.id ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: karar === k.id ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {karar === 'almadi' && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>ALMAMA SEBEBİ</Text>
              <SecimPicker
                deger={almadiSebebi}
                onSec={setAlmadiSebebi}
                secenekler={ALMADI_SEBEPLERI}
                placeholder="Sebep seçin…"
              />
            </View>
          )}
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>NOTLAR</Text>
          <TextInput value={not} onChangeText={setNot} multiline numberOfLines={3}
            style={{ borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 8, color: colors.textPrimary, marginTop: 4, marginBottom: 12, minHeight: 70 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onKapat} style={{ flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onKaydet({ tarih, karar, not, almadiSebebi: almadiSebebi || null })} style={{ flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>İade Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function SureyiUzatModal({ acik, mevcut, onKapat, onKaydet, colors }) {
  const [tarih, setTarih] = useState(mevcut || '')
  const [neden, setNeden] = useState('')
  useEffect(() => { if (acik) { setTarih(mevcut || ''); setNeden('') } }, [acik, mevcut])
  if (!acik) return null
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 12 }}>Süreyi Uzat</Text>
          <View style={{ marginBottom: 12 }}>
            <TarihSec
              value={tarih}
              onChange={(iso) => setTarih(iso || '')}
              label="YENİ İADE TARİHİ"
              title="Yeni İade Tarihi"
            />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>NEDEN (opsiyonel)</Text>
          <TextInput value={neden} onChangeText={setNeden}
            style={{ borderWidth: 1, borderColor: colors.border, padding: 10, borderRadius: 8, color: colors.textPrimary, marginTop: 4, marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onKapat} style={{ flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onKaydet(tarih, neden || null)} disabled={!tarih}
              style={{ flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primary, opacity: tarih ? 1 : 0.5 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  kart: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cihazAd: { fontSize: 18, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 4 },
  notlar: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  bolumBaslik: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  bakimBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  gecmisKart: { flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
})
