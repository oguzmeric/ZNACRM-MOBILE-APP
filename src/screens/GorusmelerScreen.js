import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { gorusmeleriGetir } from '../services/gorusmeService'

const SEKMELER = [
  { id: 'bana', label: 'Benim' },
  { id: 'tumu', label: 'Tümü' },
]

const SAYFA = 30

export default function GorusmelerScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [aktifSekme, setAktifSekme] = useState('bana')
  const [arama, setArama] = useState('')
  const [veri, setVeri] = useState([])
  const [baslangic, setBaslangic] = useState(0)
  const [hepsi, setHepsi] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [yukleniyorEk, setYukleniyorEk] = useState(false)

  const ilkYukle = useCallback(async () => {
    setLoading(true)
    setBaslangic(0)
    setHepsi(false)
    const liste = await gorusmeleriGetir({
      baslangic: 0,
      limit: SAYFA,
      hazirlayan: aktifSekme === 'bana' ? kullanici?.ad : null,
      q: arama,
    })
    setVeri(liste)
    setBaslangic(liste.length)
    setHepsi(liste.length < SAYFA)
    setLoading(false)
  }, [aktifSekme, arama, kullanici])

  useEffect(() => { ilkYukle() }, [aktifSekme, kullanici])
  useFocusEffect(useCallback(() => { ilkYukle() }, [ilkYukle]))

  // Arama 400ms debounce
  useEffect(() => {
    const t = setTimeout(() => { ilkYukle() }, 400)
    return () => clearTimeout(t)
  }, [arama])

  const dahaYukle = async () => {
    if (hepsi || yukleniyorEk) return
    setYukleniyorEk(true)
    const ek = await gorusmeleriGetir({
      baslangic,
      limit: SAYFA,
      hazirlayan: aktifSekme === 'bana' ? kullanici?.ad : null,
      q: arama,
    })
    setVeri((onceki) => [...onceki, ...ek])
    setBaslangic((b) => b + ek.length)
    if (ek.length < SAYFA) setHepsi(true)
    setYukleniyorEk(false)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await ilkYukle()
    setRefreshing(false)
  }

  return (
    <ScreenContainer>
      {/* Sekmeler */}
      <View style={styles.tabWrap}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceDark, borderColor: colors.border }]}>
          {SEKMELER.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.tab, aktifSekme === s.id && { backgroundColor: colors.primary }]}
              onPress={() => setAktifSekme(s.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, { color: colors.textMuted }, aktifSekme === s.id && { color: '#fff' }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Arama */}
      <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.aramaInput, { color: colors.textPrimary }]}
          placeholder="Firma, müşteri, konu, not"
          placeholderTextColor={colors.textMuted}
          value={arama}
          onChangeText={setArama}
        />
        {!!arama && (
          <TouchableOpacity onPress={() => setArama('')}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={veri}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
          onEndReached={dahaYukle}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={[styles.bos, { color: colors.textFaded }]}>
              {arama ? 'Eşleşen görüşme yok.' : aktifSekme === 'bana' ? 'Sizin görüşmeniz yok.' : 'Henüz görüşme yok.'}
            </Text>
          }
          ListFooterComponent={yukleniyorEk ? (
            <ActivityIndicator color={colors.textPrimary} style={{ marginVertical: 16 }} />
          ) : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('GorusmeDetay', { id: item.id })}
            >
              <View style={styles.kartUst}>
                <Text style={[styles.firmaAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.firmaAdi || item.musteriAdi || 'Firma yok'}
                </Text>
                {!!item.tarih && (
                  <Text style={[styles.tarih, { color: colors.textFaded }]}>{item.tarih}{item.saat ? ` ${item.saat}` : ''}</Text>
                )}
              </View>
              {!!item.konu && (
                <Text style={[styles.konu, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.konu}
                </Text>
              )}
              {!!item.notlar && (
                <Text style={[styles.not, { color: colors.textMuted }]} numberOfLines={2}>
                  {item.notlar}
                </Text>
              )}
              <View style={styles.kartAlt}>
                {!!item.hazirlayan && (
                  <Text style={[styles.hazirlayan, { color: colors.textFaded }]}>
                    {item.hazirlayan}
                  </Text>
                )}
                {!!item.tip && (
                  <Text style={[styles.tip, { color: colors.primary }]}>{item.tip}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Yeni Görüşme FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('YeniGorusme')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={20} color="#fff" />
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  tabWrap: { padding: 16, paddingBottom: 8 },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 13 },

  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  aramaInput: { flex: 1, fontSize: 14, paddingVertical: 4 },

  kart: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  firmaAd: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  tarih: { fontSize: 11, fontWeight: '600' },
  konu: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  not: { fontSize: 11, marginTop: 4 },
  kartAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  hazirlayan: { fontSize: 11 },
  tip: { fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  bos: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 },
})
