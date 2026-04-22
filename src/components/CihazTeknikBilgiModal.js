import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { stokKalemGuncelle } from '../services/stokKalemiService'

// Cihaz teknik bilgileri formu — IP, MAC, kullanıcı, şifre, NVR, kanal, alt-lokasyon
//
// Kullanım:
//   <CihazTeknikBilgiModal
//     visible={open}
//     onClose={() => setOpen(false)}
//     kalem={kalem}
//     onSave={(guncel) => setKalem(guncel)}
//     zorunlu={true}  // montaj sonrası popup için true (iptal edilemez)
//   />

export default function CihazTeknikBilgiModal({ visible, onClose, kalem, onSave, zorunlu = false }) {
  const [ipAdresi, setIpAdresi] = useState('')
  const [macAdresi, setMacAdresi] = useState('')
  const [cihazKullanici, setCihazKullanici] = useState('')
  const [cihazSifre, setCihazSifre] = useState('')
  const [nvrBilgisi, setNvrBilgisi] = useState('')
  const [kanalNo, setKanalNo] = useState('')
  const [altLokasyon, setAltLokasyon] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (visible && kalem) {
      setIpAdresi(kalem.ipAdresi ?? '')
      setMacAdresi(kalem.macAdresi ?? '')
      setCihazKullanici(kalem.cihazKullanici ?? '')
      setCihazSifre(kalem.cihazSifre ?? '')
      setNvrBilgisi(kalem.nvrBilgisi ?? '')
      setKanalNo(kalem.kanalNo != null ? String(kalem.kanalNo) : '')
      setAltLokasyon(kalem.altLokasyon ?? '')
    }
  }, [visible, kalem])

  const kaydet = async () => {
    if (zorunlu) {
      const eksikler = []
      if (!ipAdresi.trim()) eksikler.push('IP Adresi')
      if (!altLokasyon.trim()) eksikler.push('Alt-Lokasyon')
      if (eksikler.length > 0) {
        Alert.alert(
          'Eksik Bilgi',
          `Zorunlu alanları doldur:\n\n• ${eksikler.join('\n• ')}`
        )
        return
      }
    }
    setKaydediliyor(true)
    const guncel = await stokKalemGuncelle(kalem.id, {
      ipAdresi: ipAdresi.trim() || null,
      macAdresi: macAdresi.trim() || null,
      cihazKullanici: cihazKullanici.trim() || null,
      cihazSifre: cihazSifre.trim() || null,
      nvrBilgisi: nvrBilgisi.trim() || null,
      kanalNo: kanalNo ? parseInt(kanalNo, 10) : null,
      altLokasyon: altLokasyon.trim() || null,
    })
    setKaydediliyor(false)

    if (!guncel) {
      Alert.alert('Hata', 'Kaydedilemedi.')
      return
    }
    onSave?.(guncel)
    onClose?.()
  }

  const kapat = () => {
    if (zorunlu) {
      Alert.alert('Gerekli', 'Teknik bilgileri doldurman gerekiyor. İptal edilemez.')
      return
    }
    onClose?.()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={kapat}>
      <KeyboardAvoidingView
        style={styles.bg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Teknik Bilgiler</Text>
              <Text style={styles.subtitle}>
                {kalem?.marka ? `${kalem.marka} ` : ''}{kalem?.model ?? kalem?.stokKodu}
                {kalem?.seriNo ? ` · S/N: ${kalem.seriNo}` : ''}
              </Text>
            </View>
            {!zorunlu && (
              <TouchableOpacity onPress={kapat}>
                <Feather name="x" size={24} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Ağ bilgileri */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🌐 Ağ Bilgileri</Text>

              <Text style={styles.label}>
                IP Adresi{zorunlu && <Text style={styles.zorunluYildiz}> *</Text>}
              </Text>
              <TextInput
                style={styles.input}
                value={ipAdresi}
                onChangeText={setIpAdresi}
                placeholder="192.168.1.10"
                placeholderTextColor="#64748b"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>MAC Adresi</Text>
              <TextInput
                style={styles.input}
                value={macAdresi}
                onChangeText={setMacAdresi}
                placeholder="AA:BB:CC:DD:EE:FF"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            {/* Giriş bilgileri */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🔐 Giriş Bilgileri</Text>

              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                value={cihazKullanici}
                onChangeText={setCihazKullanici}
                placeholder="admin"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                value={cihazSifre}
                onChangeText={setCihazSifre}
                placeholder="••••••"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Sistem bilgileri */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>📹 Sistem Bilgileri</Text>

              <View style={styles.row2}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>NVR</Text>
                  <TextInput
                    style={styles.input}
                    value={nvrBilgisi}
                    onChangeText={setNvrBilgisi}
                    placeholder="NVR-01"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Kanal</Text>
                  <TextInput
                    style={styles.input}
                    value={kanalNo}
                    onChangeText={setKanalNo}
                    placeholder="3"
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>
                Alt-Lokasyon (Spesifik yer){zorunlu && <Text style={styles.zorunluYildiz}> *</Text>}
              </Text>
              <TextInput
                style={styles.input}
                value={altLokasyon}
                onChangeText={setAltLokasyon}
                placeholder="Giriş kapısı, Otopark güney, vb."
                placeholderTextColor="#64748b"
              />
              <Text style={styles.hint}>
                Örn: "Giriş kapısı" — müşterinin lokasyonu içinde cihazın tam yeri
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.kaydetBtn, kaydediliyor && { opacity: 0.6 }]}
              onPress={kaydet}
              disabled={kaydediliyor}
            >
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.kaydetText}>
                {kaydediliyor ? 'Kaydediliyor...' : 'Teknik Bilgileri Kaydet'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 13,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },

  kaydetBtn: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  kaydetText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  zorunluYildiz: { color: '#ef4444', fontWeight: '700' },
})
