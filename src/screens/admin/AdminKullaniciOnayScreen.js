import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { onayBekleyenleriGetir, kullaniciOnayla, kullaniciReddet } from '../../services/kullaniciService'
import { musterileriGetir } from '../../services/musteriService'

const ERISIMLER = [
  { id: 'musteri', label: 'Müşteri' },
  { id: 'personel', label: 'Personel' },
  { id: 'yonetici', label: 'Yönetici' },
]

export default function AdminKullaniciOnayScreen() {
  const { colors } = useTheme()
  const [liste, setListe] = useState([])
  const [musteriler, setMusteriler] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [secim, setSecim] = useState({}) // { [id]: { erisim, musteriId } }
  const [isleyen, setIsleyen] = useState(null)

  const yukle = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([
        onayBekleyenleriGetir(),
        musterileriGetir().catch(() => []),
      ])
      setListe(b)
      setMusteriler(m ?? [])
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Yüklenemedi.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const erisimSec = (id, erisim) => setSecim((p) => ({ ...p, [id]: { ...(p[id] || {}), erisim } }))
  const firmaSec = (id, musteriId) => setSecim((p) => ({ ...p, [id]: { ...(p[id] || {}), musteriId } }))

  const onayla = async (k) => {
    const s = secim[k.id] || { erisim: 'musteri' }
    const erisim = s.erisim || 'musteri'
    if (erisim === 'musteri' && !s.musteriId) {
      Alert.alert('Eksik', 'Müşteri için bağlı firma seçin.')
      return
    }
    setIsleyen(k.id)
    try {
      await kullaniciOnayla(k.id, erisim, { musteriId: s.musteriId || null })
      await yukle()
    } catch (e) {
      Alert.alert('Onaylanamadı', e?.message || '')
    } finally {
      setIsleyen(null)
    }
  }

  const reddet = (k) => {
    Alert.alert('Reddet', `${k.email} reddedilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: async () => {
          setIsleyen(k.id)
          try { await kullaniciReddet(k.id, null); await yukle() }
          catch (e) { Alert.alert('Hata', e?.message || '') }
          finally { setIsleyen(null) }
        },
      },
    ])
  }

  const renderItem = ({ item: k }) => {
    const s = secim[k.id] || { erisim: 'musteri' }
    const erisim = s.erisim || 'musteri'
    const busy = isleyen === k.id
    return (
      <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.email, { color: colors.textPrimary }]}>{k.email}</Text>
        <Text style={[styles.alt, { color: colors.textMuted }]}>{k.ad}</Text>

        <View style={styles.satir}>
          {ERISIMLER.map((e) => {
            const aktif = erisim === e.id
            return (
              <TouchableOpacity
                key={e.id}
                onPress={() => erisimSec(k.id, e.id)}
                style={[styles.chip, { borderColor: colors.border }, aktif && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={{ color: aktif ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 12 }}>{e.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {erisim === 'musteri' && (
          <View style={styles.satir}>
            {musteriler.slice(0, 40).map((m) => {
              const aktif = s.musteriId === m.id
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => firmaSec(k.id, m.id)}
                  style={[styles.chip, { borderColor: colors.border }, aktif && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={{ color: aktif ? '#fff' : colors.textMuted, fontSize: 12 }}>{m.firma ?? m.ad}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={[styles.satir, { marginTop: 10 }]}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }, busy && { opacity: 0.6 }]} onPress={() => onayla(k)} disabled={busy}>
            <Text style={styles.btnText}>{busy ? '…' : 'Onayla'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ef4444' }, busy && { opacity: 0.6 }]} onPress={() => reddet(k)} disabled={busy}>
            <Text style={styles.btnText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScreenContainer>
      <FlatList
        data={liste}
        keyExtractor={(k) => String(k.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle() }} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
            Onay bekleyen kayıt yok.
          </Text>
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  kart: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  email: { fontSize: 15, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
})
