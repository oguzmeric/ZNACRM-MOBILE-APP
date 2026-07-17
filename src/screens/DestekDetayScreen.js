import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { destekTalepGetir, destekTalepSil, durumEtiket } from '../services/destekService'
import { tarihSaatFormat } from '../utils/format'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

export default function DestekDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  // Destek yöneticisi TEK kişi: Oğuz Meriç (id 2) — mig 190 RLS aynı kuralı DB'de uygular
  const yoneticiMi = Number(kullanici?.id) === 2
  const [talep, setTalep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fotoTamEkran, setFotoTamEkran] = useState(null)

  useEffect(() => {
    destekTalepGetir(id).then((t) => {
      setTalep(t)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    )
  }

  if (!talep) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Talep bulunamadı.</Text>
      </View>
    )
  }

  const d = durumEtiket(talep.durum)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.durumChip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
          <Text style={[styles.durumText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
        </View>

        <Text style={[styles.olusturmaTarih, { color: colors.textFaded }]}>
          {tarihSaatFormat(talep.olusturmaTarih)}
        </Text>

        <View style={[styles.blok, { backgroundColor: colors.surface }]}>
          <Text style={[styles.blokLabel, { color: colors.textMuted }]}>📝 Mesajın</Text>
          <Text style={[styles.mesaj, { color: colors.textPrimary }]}>{talep.mesaj}</Text>
          {!!talep.fotoUrl && (
            <TouchableOpacity onPress={() => setFotoTamEkran(talep.fotoUrl)}>
              <Image source={{ uri: talep.fotoUrl }} style={styles.foto} />
            </TouchableOpacity>
          )}
        </View>

        {talep.cevap ? (
          <View style={[styles.cevapBlok, { backgroundColor: colors.surface }]}>
            <Text style={[styles.blokLabel, { color: colors.textMuted }]}>💬 Destek Ekibi Cevabı</Text>
            <Text style={[styles.mesaj, { color: colors.textPrimary }]}>{talep.cevap}</Text>
            {!!talep.cevapTarihi && (
              <Text style={[styles.cevapTarih, { color: colors.textFaded }]}>{tarihSaatFormat(talep.cevapTarihi)}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.bekleniyor, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="clock" size={16} color={colors.textMuted} />
            <Text style={[styles.bekleniyorText, { color: colors.textMuted }]}>
              Destek ekibi talebini inceliyor. Cevap gelince burada görünecek.
            </Text>
          </View>
        )}

        {/* Sil — yalnız destek yöneticisi (web ile senkron, kalıcı silme) */}
        {yoneticiMi && (
          <TouchableOpacity
            style={styles.silBtn}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                'Talebi Sil',
                'Bu destek talebi kalıcı olarak silinecek. Emin misin?',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Sil', style: 'destructive',
                    onPress: async () => {
                      const ok = await destekTalepSil(id)
                      if (ok) navigation.goBack()
                      else Alert.alert('Hata', 'Talep silinemedi.')
                    },
                  },
                ]
              )
            }}
          >
            <Feather name="trash-2" size={15} color="#ef4444" />
            <Text style={styles.silBtnText}>Talebi Sil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={!!fotoTamEkran}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoTamEkran(null)}
      >
        <Pressable style={styles.tamEkranBg} onPress={() => setFotoTamEkran(null)}>
          {fotoTamEkran && (
            <Image source={{ uri: fotoTamEkran }} style={styles.tamEkranImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.tamEkranKapat} onPress={() => setFotoTamEkran(null)}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  durumChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  durumText: { fontSize: 12, fontWeight: '700' },
  olusturmaTarih: { color: '#64748b', fontSize: 12, marginTop: 6 },

  blok: {
    marginTop: 20,
    padding: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  cevapBlok: {
    marginTop: 14,
    padding: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  blokLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  mesaj: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  foto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#0f172a',
  },
  cevapTarih: { color: '#64748b', fontSize: 11, marginTop: 10 },

  bekleniyor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    padding: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  bekleniyorText: { color: '#94a3b8', fontSize: 13, flex: 1, lineHeight: 18 },

  silBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  silBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  tamEkranBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tamEkranImg: { width: '100%', height: '100%' },
  tamEkranKapat: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
