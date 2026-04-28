import { useCallback, useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { donemIstatistigi } from '../../services/adminStatsService'
import { kullanicilariGetir } from '../../services/kullaniciService'
import { turBul, durumBul } from '../../utils/servisConstants'
import { raporHtml } from '../../templates/raporHtml'

const DONEMLER = [
  { id: 'bugun', label: 'Bugün', gun: 1 },
  { id: 'hafta', label: '7 Gün', gun: 7 },
  { id: 'ay', label: '30 Gün', gun: 30 },
  { id: 'tum', label: 'Tümü', gun: null },
]

function donemTarihi(gun) {
  if (!gun) return null
  const d = new Date()
  d.setDate(d.getDate() - gun)
  d.setHours(0, 0, 0, 0)
  return d
}

let logoCache = null
async function logoBase64Getir() {
  if (logoCache) return logoCache
  try {
    const asset = Asset.fromModule(require('../../../assets/logo.jpeg'))
    await asset.downloadAsync()
    const uri = asset.localUri ?? asset.uri
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    logoCache = `data:image/jpeg;base64,${b64}`
    return logoCache
  } catch {
    return null
  }
}

export default function AdminRaporlarScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [donem, setDonem] = useState('hafta')
  const [istatistik, setIstatistik] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pdfYapiliyor, setPdfYapiliyor] = useState(false)

  // Personel filtresi
  const [personeller, setPersoneller] = useState([])
  const [seciliPersonelAd, setSeciliPersonelAd] = useState(null)  // null = tümü
  const [personelModalAcik, setPersonelModalAcik] = useState(false)

  // PDF preview modal
  const [previewAcik, setPreviewAcik] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewUri, setPreviewUri] = useState(null)

  useEffect(() => {
    kullanicilariGetir().then((tum) => {
      const liste = (tum ?? []).filter((k) => k.tip !== 'musteri' && !k.musteriId && !k.hesapSilindi)
      setPersoneller(liste)
    })
  }, [])

  const pdfOnizle = async () => {
    if (!istatistik) return
    setPdfYapiliyor(true)
    try {
      const logoBase64 = await logoBase64Getir()
      const filtreEtiketi = seciliPersonelAd ? `Personel: ${seciliPersonelAd}` : null
      const html = raporHtml({ istatistik, donem, logoBase64, filtreEtiketi })
      const { uri } = await Print.printToFileAsync({ html })
      setPreviewHtml(html)
      setPreviewUri(uri)
      setPreviewAcik(true)
    } catch (e) {
      Alert.alert('Hata', e.message ?? 'PDF oluşturulamadı.')
    } finally {
      setPdfYapiliyor(false)
    }
  }

  const pdfPaylas = async () => {
    if (!previewUri) return
    try {
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(previewUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Yönetim Raporunu Paylaş',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('PDF Hazır', `Dosya konumu: ${previewUri}`)
      }
    } catch (e) {
      Alert.alert('Hata', e.message ?? 'Paylaşılamadı.')
    }
  }

  const yukle = useCallback(async () => {
    const secili = DONEMLER.find((d) => d.id === donem)
    const tarih = donemTarihi(secili?.gun)
    const sonuc = await donemIstatistigi(tarih, seciliPersonelAd)
    setIstatistik(sonuc)
    setLoading(false)
  }, [donem, seciliPersonelAd])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
      >
        {/* Dönem seçici */}
        <View style={styles.tabWrap}>
          <View style={[styles.tabs, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
            {DONEMLER.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.tab, donem === d.id && { backgroundColor: colors.primary }]}
                onPress={() => setDonem(d.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, { color: colors.textMuted }, donem === d.id && { color: '#fff' }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Personel filtresi */}
        <TouchableOpacity
          onPress={() => setPersonelModalAcik(true)}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginBottom: 16,
          }}
        >
          <Feather name="user" size={16} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>Personel Filtresi</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
              {seciliPersonelAd ?? 'Tüm personel'}
            </Text>
          </View>
          {seciliPersonelAd && (
            <TouchableOpacity onPress={() => setSeciliPersonelAd(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {loading || !istatistik ? (
          <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Toplam + PDF */}
            <View style={[styles.toplamKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="bar-chart-2" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.toplamLabel, { color: colors.textMuted }]}>Toplam Servis Talebi</Text>
                <Text style={[styles.toplamSayi, { color: colors.textPrimary }]}>{istatistik.toplam}</Text>
              </View>
              <TouchableOpacity
                style={[styles.pdfBtn, { backgroundColor: colors.primary }, pdfYapiliyor && { opacity: 0.5 }]}
                onPress={pdfOnizle}
                disabled={pdfYapiliyor}
                activeOpacity={0.85}
              >
                {pdfYapiliyor ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="eye" size={14} color="#fff" />
                    <Text style={styles.pdfBtnText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Durum dağılımı */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Durum Dağılımı</Text>
            {Object.keys(istatistik.durumSay).length === 0 ? (
              <Text style={[styles.bos, { color: colors.textFaded }]}>Kayıt yok.</Text>
            ) : (
              Object.entries(istatistik.durumSay)
                .sort(([, a], [, b]) => b - a)
                .map(([durumId, sayi]) => {
                  const d = durumBul(durumId)
                  const oran = (sayi / istatistik.toplam) * 100
                  return (
                    <View key={durumId} style={[styles.satirKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.satirHeader}>
                        <Text style={[styles.satirLabel, { color: colors.textPrimary }]}>
                          {d?.ikon} {d?.isim ?? durumId}
                        </Text>
                        <Text style={[styles.satirSayi, { color: d?.renk ?? colors.primary }]}>
                          {sayi} <Text style={styles.oran}>%{oran.toFixed(0)}</Text>
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${oran}%`, backgroundColor: d?.renk ?? colors.primary }]} />
                      </View>
                    </View>
                  )
                })
            )}

            {/* Tür dağılımı */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 20 }]}>Tür Dağılımı</Text>
            {Object.entries(istatistik.turSay)
              .sort(([, a], [, b]) => b - a)
              .map(([turId, sayi]) => {
                const t = turBul(turId)
                const oran = (sayi / istatistik.toplam) * 100
                return (
                  <View key={turId} style={[styles.satirKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.satirHeader}>
                      <Text style={[styles.satirLabel, { color: colors.textPrimary }]}>
                        {t?.ikon} {t?.isim ?? turId}
                      </Text>
                      <Text style={[styles.satirSayi, { color: t?.renk ?? colors.primary }]}>
                        {sayi} <Text style={styles.oran}>%{oran.toFixed(0)}</Text>
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${oran}%`, backgroundColor: t?.renk ?? colors.primary }]} />
                    </View>
                  </View>
                )
              })}

            {/* En çok iş yapan 5 personel */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 20 }]}>🏆 En Çok İş Alan Personel</Text>
            {istatistik.topPersonel.length === 0 ? (
              <Text style={[styles.bos, { color: colors.textFaded }]}>Atanmış iş yok.</Text>
            ) : (
              istatistik.topPersonel.map((p, i) => (
                <View key={p.ad} style={[styles.satirKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.satirHeader}>
                    <Text style={[styles.satirLabel, { color: colors.textPrimary }]}>
                      {['🥇', '🥈', '🥉', '4.', '5.'][i]} {p.ad}
                    </Text>
                    <Text style={[styles.satirSayi, { color: colors.warning }]}>{p.sayi}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Personel seçim modal */}
      <Modal visible={personelModalAcik} animationType="slide" transparent onRequestClose={() => setPersonelModalAcik(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Personel Seç</Text>
              <TouchableOpacity onPress={() => setPersonelModalAcik(false)}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => { setSeciliPersonelAd(null); setPersonelModalAcik(false) }}
                activeOpacity={0.7}
                style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: !seciliPersonelAd ? colors.primary : colors.border, backgroundColor: !seciliPersonelAd ? colors.primary + '22' : 'transparent', marginBottom: 6 }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Tüm Personel</Text>
              </TouchableOpacity>
              {personeller.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => { setSeciliPersonelAd(p.ad); setPersonelModalAcik(false) }}
                  activeOpacity={0.7}
                  style={{ padding: 14, borderRadius: 10, borderWidth: 1, borderColor: seciliPersonelAd === p.ad ? colors.primary : colors.border, backgroundColor: seciliPersonelAd === p.ad ? colors.primary + '22' : 'transparent', marginBottom: 6 }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{p.ad}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{p.unvan ?? '—'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PDF Önizleme Modal */}
      <Modal visible={previewAcik} animationType="slide" onRequestClose={() => setPreviewAcik(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: insets.top + 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <TouchableOpacity onPress={() => setPreviewAcik(false)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="x" size={20} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Kapat</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>PDF Önizleme</Text>
            <TouchableOpacity onPress={pdfPaylas} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary }}>
              <Feather name="share-2" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Paylaş</Text>
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            scalesPageToFit
          />
          <View style={{ height: insets.bottom, backgroundColor: colors.surface }} />
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: { marginBottom: 16 },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabText: { fontWeight: '600', fontSize: 13 },

  toplamKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  toplamLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  toplamSayi: { fontSize: 28, fontWeight: '800', marginTop: 2 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pdfBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },

  satirKart: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  satirHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  satirLabel: { fontSize: 13, fontWeight: '600' },
  satirSayi: { fontSize: 15, fontWeight: '800' },
  oran: { fontSize: 10, fontWeight: '600' },
  progressBar: { height: 4, backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  bos: { fontSize: 12, fontStyle: 'italic' },
})
