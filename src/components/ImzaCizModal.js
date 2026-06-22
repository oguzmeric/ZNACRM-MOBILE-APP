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
import Signature from 'react-native-signature-canvas'

// Kişisel imza çizme modalı — ad alanı YOK (sadece imza).
// Profil ayarlarında personelin kendi imzasını bir kere eklemesi için.
// signature-canvas'ın kendi butonlarını gizleyip kendi butonlarımızı kullanıyoruz.

export default function ImzaCizModal({ visible, onClose, onKaydet, baslik = 'İmzan' }) {
  const ref = useRef()
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const imzaAlindi = async (base64) => {
    if (!base64 || base64.length < 100) {
      Alert.alert('Boş İmza', 'İmza algılanamadı, lütfen daha belirgin çiz.')
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

  const tetikleKaydet = () => {
    if (kaydediliyor) return
    ref.current?.readSignature()
  }

  const temizle = () => {
    ref.current?.clearSignature()
  }

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; background: #f8fafc; }
    .m-signature-pad--footer { display: none !important; margin: 0px; height: 0 !important; }
    body, html { background-color: #f8fafc; margin: 0; padding: 0; height: 100%; width: 100%; }
    canvas { background-color: #f8fafc !important; width: 100% !important; height: 100% !important; }
  `

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
          <Signature
            ref={ref}
            onOK={imzaAlindi}
            onEmpty={() => Alert.alert('Boş', 'İmza atılmamış. Ekrana çiz, sonra Kaydet\'e bas.')}
            webStyle={webStyle}
            backgroundColor="#f8fafc"
            penColor="#0f172a"
            imageType="image/png"
            descriptionText=""
            autoClear={false}
          />
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
            onPress={tetikleKaydet}
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
