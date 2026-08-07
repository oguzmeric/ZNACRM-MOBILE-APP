import { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ImzaTuvali from './ImzaTuvali'

// Müşteri imza modalı — tuval SKIA (yerli çizim), WebView DEĞİL.
// 07.08: WebView tabanlı eski tuval sahada "ekrana hiçbir şey çizilmiyor"
// durumuna düştü (Android WebView güncellemesi). Skia bundan bağımsız.

export default function ImzaModal({ visible, onClose, onKaydet, baslangicAd = '' }) {
  const ref = useRef()
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [adSoyad, setAdSoyad] = useState(baslangicAd)

  useEffect(() => {
    if (visible) {
      setAdSoyad(baslangicAd ?? '')
      ref.current?.temizle()
    }
  }, [visible, baslangicAd])

  const kaydetTikla = async () => {
    if (kaydediliyor) return
    if (ref.current?.bosMu()) {
      Alert.alert('Boş İmza', 'Önce alana imza atın.')
      return
    }
    if (!adSoyad.trim()) {
      Alert.alert('Eksik', 'Teslim alan kişinin adı soyadı gerekli.')
      return
    }
    const base64 = ref.current?.pngBase64()
    if (!base64) {
      Alert.alert('Hata', 'İmza görüntüsü alınamadı. Tekrar deneyin.')
      return
    }
    setKaydediliyor(true)
    try {
      await onKaydet?.(base64, adSoyad.trim())
      onClose?.()
    } catch (e) {
      Alert.alert('Hata', 'İmza kaydedilemedi: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setKaydediliyor(false)
    }
  }

  const temizle = () => ref.current?.temizle()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Müşteri İmzası</Text>
          <TouchableOpacity onPress={onClose} disabled={kaydediliyor}>
            <Feather name="x" size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.aciklama}>
          Teslim alan kişinin ad soyadını yaz, alana parmakla imzala, "Kaydet"e dokun.
        </Text>

        <View style={styles.adKutu}>
          <Text style={styles.adLabel}>TESLİM ALAN AD SOYAD *</Text>
          <TextInput
            style={styles.adInput}
            value={adSoyad}
            onChangeText={setAdSoyad}
            placeholder="Tam ad soyad (örn: Ahmet Yılmaz)"
            placeholderTextColor="#64748b"
            autoCapitalize="words"
            editable={!kaydediliyor}
          />
        </View>

        <View style={styles.imzaAlan}>
          <ImzaTuvali ref={ref} />
        </View>

        <View style={styles.butonlar}>
          <TouchableOpacity
            style={styles.temizleBtn}
            onPress={temizle}
            disabled={kaydediliyor}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={18} color="#ef4444" />
            <Text style={styles.temizleText}>Temizle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.onayBtn, kaydediliyor && { opacity: 0.6 }]}
            onPress={kaydetTikla}
            disabled={kaydediliyor}
            activeOpacity={0.85}
          >
            {kaydediliyor ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="check" size={18} color="#fff" />
            )}
            <Text style={styles.onayText}>
              {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  aciklama: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  imzaAlan: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: '#f8fafc',
  },
  butonlar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 30,
  },
  temizleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  temizleText: { color: '#ef4444', fontWeight: '700' },
  onayBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  onayText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  adKutu: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  adLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  adInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
  },
})
