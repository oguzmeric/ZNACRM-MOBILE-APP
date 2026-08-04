// Kullanıcı Sözleşmesi ekranı (mig 264/265/266).
// İki yoldan açılır:
//   1) Bildirime dokunma (bildirimLink: /kullanici-sozlesmesi)
//   2) İleride profil/ayarlar bağlantısı
//
// SozlesmeKapisi'nden FARKI: kapı yalnız ONAYLAMAMIŞ kullanıcıya çıkar ve
// kapatılamaz. Bu ekran her zaman açılabilir — onaylamış kişi de sözleşmeyi
// sonradan okuyabilmeli (metni bir daha göremeyeceği bir yükümlülüğü kabul
// etmiş olmaz). Onaylamamışsa onay butonu burada da çalışır.

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  aktifSozlesmeGetir, sozlesmeDurumum, sozlesmeOnayla, markdownToHtml,
} from '../services/kullaniciSozlesmeService'

export default function SozlesmeEkrani({ navigation }) {
  const insets = useSafeAreaInsets()
  const [sozlesme, setSozlesme] = useState(null)
  const [durum, setDurum] = useState(null)
  const [sonaGeldi, setSonaGeldi] = useState(false)
  const [kabul, setKabul] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState(null)

  useEffect(() => {
    let iptal = false
    Promise.all([aktifSozlesmeGetir(), sozlesmeDurumum()])
      .then(([s, d]) => { if (!iptal) { setSozlesme(s); setDurum(d) } })
      .catch(() => {})
    return () => { iptal = true }
  }, [])

  const onayla = async () => {
    if (!sozlesme?.versiyon) return
    setKaydediliyor(true); setHata(null)
    const sonuc = await sozlesmeOnayla(sozlesme.versiyon, `${Platform.OS} ${Platform.Version}`)
    setKaydediliyor(false)
    if (sonuc?.ok) setDurum({ ...durum, gerekli: false, onay_tarihi: new Date().toISOString() })
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
  window.addEventListener('scroll', function(){
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 60) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('son');
    }
  });
  window.addEventListener('load', function(){
    if (document.body.scrollHeight <= window.innerHeight + 40) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('son');
    }
  });
</script>
</body></html>` : ''

  const onaylandiMi = durum && durum.gerekli === false && durum.sebep === undefined

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Onay durumu şeridi */}
      {durum && (
        <View style={[
          styles.serit,
          { backgroundColor: durum.gerekli ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)' },
        ]}>
          <Feather
            name={durum.gerekli ? 'alert-circle' : 'check-circle'}
            size={14}
            color={durum.gerekli ? '#b45309' : '#059669'}
          />
          <Text style={[styles.seritText, { color: durum.gerekli ? '#b45309' : '#059669' }]}>
            {durum.gerekli
              ? 'Onayınız bekleniyor — metni okuyup aşağıdan onaylayın'
              : durum.onay_tarihi
                ? `Onayladınız · ${new Date(durum.onay_tarihi).toLocaleDateString('tr-TR')}`
                : 'Onaylandı'}
          </Text>
        </View>
      )}

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

      {/* Onay bölümü — yalnız henüz onaylamamışsa */}
      {durum?.gerekli && (
        <View style={[styles.altAlan, { paddingBottom: insets.bottom + 14 }]}>
          {!sonaGeldi && (
            <Text style={styles.uyari}>Onay kutusu, metnin sonuna geldiğinizde etkinleşir.</Text>
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
              Sözleşmeyi okudum ve kabul ediyorum.
            </Text>
          </TouchableOpacity>

          {!!hata && <Text style={styles.hata}>{hata}</Text>}

          <TouchableOpacity
            onPress={onayla}
            disabled={!kabul || kaydediliyor}
            style={[styles.onayBtn, (!kabul || kaydediliyor) && { opacity: 0.45 }]}
          >
            <Text style={styles.onayBtnText}>
              {kaydediliyor ? 'Kaydediliyor…' : 'Onaylıyorum'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  serit: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  seritText: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  altAlan: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff',
  },
  uyari: { fontSize: 11.5, color: '#94a3b8', marginBottom: 10 },
  kabulSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  kutu: {
    width: 21, height: 21, borderRadius: 5, borderWidth: 1.5, borderColor: '#94a3b8',
    alignItems: 'center', justifyContent: 'center',
  },
  kutuIsaretli: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  kabulMetin: { flex: 1, fontSize: 13, color: '#334155' },
  hata: {
    fontSize: 12, color: '#dc2626', marginBottom: 10,
    backgroundColor: 'rgba(220,38,38,0.07)', padding: 8, borderRadius: 8,
  },
  onayBtn: {
    backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  onayBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
