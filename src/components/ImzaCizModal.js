import { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import ImzaTuvali from './ImzaTuvali'

// Kişisel imza çizme modalı — ad alanı YOK (sadece imza).
// Profil ayarlarında personelin kendi imzasını bir kere eklemesi için.
// Tuval SKIA (yerli çizim) — WebView tabanlı eski tuval sahada çizim almıyordu (07.08).

export default function ImzaCizModal({ visible, onClose, onKaydet, baslik = 'İmzan' }) {
  const ref = useRef()
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const kaydetTikla = async () => {
    if (kaydediliyor) return
    if (ref.current?.bosMu()) {
      Alert.alert('Boş İmza', 'Önce alana imzanı çiz.')
      return
    }
    const base64 = ref.current?.pngBase64()
    if (!base64) {
      Alert.alert('Hata', 'İmza görüntüsü alınamadı. Tekrar deneyin.')
      return
    }
    setKaydediliyor(true)
    try {
      await onKaydet?.(base64)
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
          <Text style={styles.title}>{baslik}</Text>
          <TouchableOpacity onPress={onClose} disabled={kaydediliyor}>
            <Feather name="x" size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.aciklama}>
          Alana parmağınla imzanı çiz, sonra "Kaydet"e dokun. Bu imza servis
          formlarında otomatik kullanılacak.
        </Text>

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
    paddingHorizontal: 20,
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
})
