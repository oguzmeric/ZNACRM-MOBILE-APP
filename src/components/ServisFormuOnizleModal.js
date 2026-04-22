import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import {
  pdfOlustur,
  pdfOnizle,
  paylasPdf,
  emailGonder,
  onizlemeHtmlGetir,
} from '../services/servisFormuService'
import { formProfiliBelirle } from '../templates/servisFormuHtml'

export default function ServisFormuOnizleModal({ visible, onClose, talep }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [html, setHtml] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [aksiyonCalisiyor, setAksiyonCalisiyor] = useState(false)

  useEffect(() => {
    if (!visible || !talep) {
      setHtml(null)
      return
    }
    setYukleniyor(true)
    onizlemeHtmlGetir(talep)
      .then(setHtml)
      .catch((e) => Alert.alert('Hata', e.message ?? 'Önizleme oluşturulamadı.'))
      .finally(() => setYukleniyor(false))
  }, [visible, talep])

  const aksiyon = async (tip) => {
    if (!talep) return
    setAksiyonCalisiyor(true)
    try {
      if (tip === 'print') {
        await pdfOnizle(talep)
      } else {
        const uri = await pdfOlustur(talep)
        if (tip === 'email') {
          await emailGonder(uri, {
            subject: `Servis Formu · ${talep.talepNo ?? ''}`,
            body: `${talep.firmaAdi ?? ''} için servis formu ektedir.`,
          })
        } else {
          await paylasPdf(uri)
        }
      }
    } catch (e) {
      Alert.alert('Hata', e.message ?? 'İşlem tamamlanamadı.')
    } finally {
      setAksiyonCalisiyor(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.baslik, { color: colors.textPrimary }]}>
              {talep ? formProfiliBelirle(talep).baslik : 'Form'} Önizleme
            </Text>
            <Text style={[styles.altBaslik, { color: colors.textMuted }]}>
              {talep?.talepNo ?? (talep?.id ? `#${talep.id}` : '')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.kapatBtn}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* İçerik */}
        <View style={[styles.icerik, { backgroundColor: '#ffffff' }]}>
          {yukleniyor || !html ? (
            <View style={styles.yukleniyor}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.yukleniyorText, { color: colors.textMuted }]}>
                Önizleme oluşturuluyor…
              </Text>
            </View>
          ) : (
            <WebView
              source={{ html }}
              originWhitelist={['*']}
              style={styles.webview}
              scalesPageToFit
              automaticallyAdjustContentInsets={false}
              showsHorizontalScrollIndicator={false}
              contentMode="mobile"
              injectedJavaScriptBeforeContentLoaded={`
                // Mevcut viewport varsa kaldır, fit-to-screen için temiz ekle
                document.querySelectorAll('meta[name="viewport"]').forEach(m => m.remove());
                const m = document.createElement('meta');
                m.name = 'viewport';
                m.content = 'width=794, user-scalable=yes, maximum-scale=3';
                document.head && document.head.appendChild(m);
                true;
              `}
            />
          )}
        </View>

        {/* Alt toolbar */}
        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          <ToolbarBtn
            ikon="mail"
            label="E-posta"
            onPress={() => aksiyon('email')}
            disabled={aksiyonCalisiyor}
            colors={colors}
          />
          <ToolbarBtn
            ikon="download"
            label="Kaydet"
            onPress={() => aksiyon('paylas')}
            disabled={aksiyonCalisiyor}
            colors={colors}
            primary
          />
          <ToolbarBtn
            ikon="printer"
            label="Yazdır"
            onPress={() => aksiyon('print')}
            disabled={aksiyonCalisiyor}
            colors={colors}
          />
        </View>

        {aksiyonCalisiyor && (
          <View style={styles.overlay}>
            <View style={[styles.overlayKutu, { backgroundColor: colors.surface }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.overlayText, { color: colors.textPrimary }]}>
                Hazırlanıyor…
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

function ToolbarBtn({ ikon, label, onPress, disabled, primary, colors }) {
  const renk = primary ? colors.primary : colors.surfaceDark
  return (
    <TouchableOpacity
      style={[
        styles.tbBtn,
        {
          backgroundColor: primary ? colors.primary : 'transparent',
          borderColor: primary ? colors.primary : colors.borderStrong,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Feather name={ikon} size={16} color={primary ? '#fff' : colors.textPrimary} />
      <Text style={[styles.tbBtnText, { color: primary ? '#fff' : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  baslik: { fontSize: 16, fontWeight: '800' },
  altBaslik: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  kapatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icerik: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  yukleniyor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  yukleniyorText: { fontSize: 13, fontWeight: '600' },

  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  tbBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  tbBtnText: { fontSize: 14, fontWeight: '700' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  overlayText: { fontSize: 14, fontWeight: '700' },
})
