// Keşif raporu önizleme — WebView'de HTML göster, onaylayınca PDF üret + paylaş.
// HTML bir kez üretilir (görseller base64 indirilir), hem önizleme hem PDF aynı HTML'i kullanır.
import { useEffect, useState } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { kesifRaporHtml, htmlPdfPaylas } from '../lib/kesifPdf'

export default function KesifOnizleModal({ visible, onClose, kesif, kalemler, krokiler, fotolar, fotoUrls }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [html, setHtml] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [paylasiliyor, setPaylasiliyor] = useState(false)

  useEffect(() => {
    if (!visible || !kesif) { setHtml(null); return }
    setYukleniyor(true)
    kesifRaporHtml({ kesif, kalemler, krokiler, fotolar, fotoUrls })
      .then(setHtml)
      .catch(e => Alert.alert('Hata', e?.message ?? 'Önizleme oluşturulamadı.'))
      .finally(() => setYukleniyor(false))
  }, [visible, kesif, kalemler, krokiler, fotolar, fotoUrls])

  const paylas = async () => {
    if (!html) return
    setPaylasiliyor(true)
    try { await htmlPdfPaylas(html, kesif) } finally { setPaylasiliyor(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.baslik, { color: colors.textPrimary }]}>Keşif Raporu Önizleme</Text>
            <Text style={[styles.alt, { color: colors.textMuted }]}>{kesif?.kesifNo ?? ''}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.kapat}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {yukleniyor || !html ? (
            <View style={styles.yuk}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Rapor hazırlanıyor…</Text>
            </View>
          ) : (
            <WebView
              source={{ html }}
              originWhitelist={['*']}
              style={{ flex: 1, backgroundColor: '#fff' }}
              scalesPageToFit
              automaticallyAdjustContentInsets={false}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </View>

        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary, opacity: (paylasiliyor || !html) ? 0.5 : 1 }]}
            onPress={paylas}
            disabled={paylasiliyor || !html}
            activeOpacity={0.85}
          >
            {paylasiliyor
              ? <ActivityIndicator color="#fff" />
              : <><Feather name="share-2" size={16} color="#fff" /><Text style={styles.btnText}>PDF Olarak Paylaş / Gönder</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  baslik: { fontSize: 16, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  kapat: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  yuk: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
