// Zorunlu sözleşme onayı kapısı — mobil (mig 264/265).
// Web'deki SozlesmeKapisi.jsx'in karşılığı; aynı kurallar:
//   • onaylamayan PERSONEL uygulamayı kullanamaz (tam ekran modal)
//   • kapsam kapısı SUNUCUDA (sozlesme_durumum) — müşteri/bayi etkilenmez
//   • onay kutusu metnin SONUNA inilmeden etkinleşmez
//   • RPC hatasında KİLİTLEME YOK — teknisyen sahada uygulamadan kilitlenmesin
//
// Metin WebView'de gösterilir: mobilde markdown kütüphanesi yok, yeni paket
// eklemek yerine zaten kurulu olan react-native-webview kullanılıyor.

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  aktifSozlesmeGetir, sozlesmeDurumum, sozlesmeOnayla, markdownToHtml,
} from '../services/kullaniciSozlesmeService'

export default function SozlesmeKapisi({ children }) {
  const { kullanici, cikisYap } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [durum, setDurum] = useState(null)
  const [sozlesme, setSozlesme] = useState(null)
  const [sonaGeldi, setSonaGeldi] = useState(false)
  const [kabul, setKabul] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState(null)

  useEffect(() => {
    if (!kullanici?.id) { setDurum({ gerekli: false }); return }
    let iptal = false
    sozlesmeDurumum().then(d => {
      if (iptal) return
      setDurum(d)
      if (d?.gerekli) aktifSozlesmeGetir().then(s => { if (!iptal) setSozlesme(s) })
    })
    return () => { iptal = true }
  }, [kullanici?.id])

  const onayla = async () => {
    if (!sozlesme?.versiyon) return
    setKaydediliyor(true); setHata(null)
    const cihaz = `${Platform.OS} ${Platform.Version}`
    const sonuc = await sozlesmeOnayla(sozlesme.versiyon, cihaz)
    setKaydediliyor(false)
    if (sonuc?.ok) setDurum({ gerekli: false })
    else setHata(sonuc?.hata || 'Onay kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.')
  }

  const html = sozlesme ? `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:16px 16px 28px; font-family:-apple-system,system-ui,sans-serif;
         font-size:15px; line-height:1.7; color:#1e293b; background:#fff; }
  h1 { font-size:20px; margin:0 0 6px; }
  h2 { font-size:16px; margin:22px 0 8px; padding-top:12px; border-top:1px solid #e2e8f0; }
  h3 { font-size:14px; margin:14px 0 6px; }
  p  { margin:0 0 10px; }
  ul { margin:0 0 12px; padding-left:20px; }
  li { margin-bottom:5px; }
  strong { font-weight:700; }
  hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }
  code { background:#f1f5f9; padding:1px 5px; border-radius:4px; font-size:13px; }
</style></head><body>
${markdownToHtml(sozlesme.icerik)}
<script>
  // Metnin sonuna inildiğini React Native tarafına bildir
  window.addEventListener('scroll', function(){
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 60) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('son');
    }
  });
  // Metin ekrana sığıyorsa kaydırma olmaz — o hâlde de onay açılmalı
  window.addEventListener('load', function(){
    if (document.body.scrollHeight <= window.innerHeight + 40) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('son');
    }
  });
</script>
</body></html>` : ''

  if (!durum || !durum.gerekli) return children

  return (
    <>
      {children}
      <Modal visible animationType="slide" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
          {/* Başlık */}
          <View style={styles.baslikAlan}>
            <View style={styles.ikon}>
              <Feather name="shield" size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.baslik} numberOfLines={2}>
                {sozlesme?.baslik || 'Kullanıcı Sözleşmesi'}
              </Text>
              <Text style={styles.altBaslik}>
                Devam edebilmek için okuyup onaylamanız gerekiyor
                {sozlesme?.versiyon ? ` · Sürüm ${sozlesme.versiyon}` : ''}
              </Text>
            </View>
          </View>

          {/* Metin */}
          <View style={{ flex: 1 }}>
            {sozlesme ? (
              <WebView
                originWhitelist={['*']}
                source={{ html }}
                onMessage={(e) => { if (e.nativeEvent.data === 'son') setSonaGeldi(true) }}
                style={{ flex: 1 }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
                <Text style={{ color: '#64748b', marginTop: 10 }}>Sözleşme yükleniyor…</Text>
              </View>
            )}
          </View>

          {/* Onay */}
          <View style={[styles.altAlan, { paddingBottom: insets.bottom + 14 }]}>
            {!sonaGeldi && (
              <Text style={styles.uyari}>
                <Feather name="alert-triangle" size={12} color="#94a3b8" />  Onay kutusu, metnin sonuna geldiğinizde etkinleşir.
              </Text>
            )}

            <TouchableOpacity
              onPress={() => sonaGeldi && setKabul(!kabul)}
              activeOpacity={sonaGeldi ? 0.7 : 1}
              style={[styles.kabulSatir, { opacity: sonaGeldi ? 1 : 0.45 }]}
            >
              <View style={[styles.kutu, kabul && styles.kutuIsaretli]}>
                {kabul && <Feather name="check" size={13} color="#fff" />}
              </View>
              <Text style={styles.kabulMetin}>
                Sözleşmeyi okudum ve kabul ediyorum. Özellikle <Text style={styles.kalin}>veri gizliliği</Text>,{' '}
                <Text style={styles.kalin}>toplu veri çıkarma yasağı</Text>,{' '}
                <Text style={styles.kalin}>sistem kullanımının kaydedilmesi</Text> ve{' '}
                <Text style={styles.kalin}>araç/mesai konum kayıtları</Text> maddelerini bilerek onaylıyorum.
              </Text>
            </TouchableOpacity>

            {!!hata && <Text style={styles.hata}>{hata}</Text>}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={onayla}
                disabled={!kabul || kaydediliyor}
                style={[styles.onayBtn, (!kabul || kaydediliyor) && { opacity: 0.45 }]}
              >
                <Text style={styles.onayBtnText}>
                  {kaydediliyor ? 'Kaydediliyor…' : 'Onaylıyorum ve Devam Ediyorum'}
                </Text>
              </TouchableOpacity>
              {/* Onaylamak istemeyen kilitli ekranda mahsur kalmasın */}
              <TouchableOpacity onPress={cikisYap} style={styles.cikisBtn}>
                <Feather name="log-out" size={17} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  baslikAlan: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  ikon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  baslik: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  altBaslik: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  altAlan: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff',
  },
  uyari: { fontSize: 11.5, color: '#94a3b8', marginBottom: 10 },
  kabulSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  kutu: {
    width: 21, height: 21, borderRadius: 5, borderWidth: 1.5, borderColor: '#94a3b8',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  kutuIsaretli: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  kabulMetin: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#334155' },
  kalin: { fontWeight: '700', color: '#0f172a' },
  hata: {
    fontSize: 12, color: '#dc2626', marginBottom: 10,
    backgroundColor: 'rgba(220,38,38,0.07)', padding: 8, borderRadius: 8,
  },
  onayBtn: {
    flex: 1, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  onayBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  cikisBtn: {
    width: 50, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center',
  },
})
