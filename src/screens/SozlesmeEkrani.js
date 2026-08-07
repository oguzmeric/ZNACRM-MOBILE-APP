// Kullanıcı Sözleşmesi ekranı (mig 264/265/266).
// İki yoldan açılır:
//   1) Bildirime dokunma (bildirimLink: /kullanici-sozlesmesi)
//   2) İleride profil/ayarlar bağlantısı
//
// SozlesmeKapisi'nden FARKI: kapı yalnız ONAYLAMAMIŞ kullanıcıya çıkar ve
// kapatılamaz. Bu ekran her zaman açılabilir — onaylamış kişi de sözleşmeyi
// sonradan okuyabilmeli (metni bir daha göremeyeceği bir yükümlülüğü kabul
// etmiş olmaz). Onaylamamışsa onay butonu burada da çalışır.

// ⚠️ Metin YERLİ render edilir (WebView değil) — bkz. SozlesmeMetni.js: onay
// kutusunu WebView'in JS köprüsüne bağlamak, köprü sessizce çalışmadığında
// kullanıcıyı onaylayamaz hâle getiriyordu (07.08).

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SozlesmeMetni from '../components/SozlesmeMetni'
import {
  aktifSozlesmeGetir, sozlesmeDurumum, sozlesmeOnayla,
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
        <SozlesmeMetni
          icerik={sozlesme.icerik}
          onSonaGelindi={() => setSonaGeldi(true)}
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
