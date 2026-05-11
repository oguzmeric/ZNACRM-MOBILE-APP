// Notlarım liste ekranı — kategori filtre + arama + yeni not + düzenle.

import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import { useRefresh } from '../hooks/useRefresh'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { notlarimiGetir, KATEGORILER } from '../services/notService'
import { trIcerir } from '../utils/trSearch'

const FILTRELER = [{ id: 'hepsi', isim: 'Hepsi', renk: '#64748b' }, ...KATEGORILER]

function tarihKisa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function NotlarimScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [notlar, setNotlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [filtre, setFiltre] = useState('hepsi')
  const [arama, setArama] = useState('')

  const yukle = useCallback(async () => {
    if (!kullanici?.id) { setYukleniyor(false); return }
    const data = await notlarimiGetir(kullanici.id)
    setNotlar(data)
    setYukleniyor(false)
  }, [kullanici?.id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const { refreshControl } = useRefresh(yukle)

  const filtreli = notlar.filter((n) => {
    if (filtre !== 'hepsi' && n.kategori !== filtre) return false
    if (arama && !trIcerir([n.baslik, n.icerik, n.musteri?.firma], arama)) return false
    return true
  })

  return (
    <ScreenContainer>
      {/* Arama */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
        <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder="Notlarda ara…"
            placeholderTextColor={colors.textFaded}
            style={{ flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 }}
          />
          {!!arama && (
            <TouchableOpacity onPress={() => setArama('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Kategori filtreleri — kompakt yatay chip'ler */}
      <View style={{ height: 36, marginBottom: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center', gap: 6 }}
        >
          {FILTRELER.map((f) => {
            const aktif = filtre === f.id
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFiltre(f.id)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 28,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  backgroundColor: aktif ? `${f.renk}20` : colors.surface,
                  borderWidth: 1,
                  borderColor: aktif ? f.renk : colors.border,
                }}
              >
                {f.id !== 'hepsi' && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.renk, marginRight: 5 }} />
                )}
                <Text style={{
                  color: aktif ? f.renk : colors.textSecondary,
                  fontSize: 12, fontWeight: '600',
                }}>{f.isim}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Liste */}
      {yukleniyor ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filtreli}
          keyExtractor={(n) => String(n.id)}
          refreshControl={refreshControl}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <EmptyState
              ikon="edit-3"
              baslik={arama || filtre !== 'hepsi' ? 'Eşleşen not yok' : 'Henüz not yok'}
              mesaj={arama || filtre !== 'hepsi' ? 'Farklı bir filtre dene' : 'Sağ alttaki + ile yeni not ekle'}
            />
          }
          renderItem={({ item }) => {
            const kategori = KATEGORILER.find((k) => k.id === item.kategori) || KATEGORILER[3]
            const cizimSayisi = Array.isArray(item.cizimler) ? item.cizimler.length : 0
            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('NotDuzenle', { id: item.id })}
                activeOpacity={0.8}
                style={[styles.kart, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: kategori.renk,
                }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kategori.renk }} />
                  <Text style={{ color: kategori.renk, fontSize: 11, fontWeight: '700' }}>
                    {kategori.isim.toUpperCase()}
                  </Text>
                  {cizimSayisi > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 }}>
                      <Feather name="image" size={11} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{cizimSayisi}</Text>
                    </View>
                  )}
                  <Text style={{ color: colors.textFaded, fontSize: 10, marginLeft: 'auto' }}>
                    {tarihKisa(item.olusturmaTarih)}
                  </Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 4 }} numberOfLines={1}>
                  {item.baslik || '(başlıksız)'}
                </Text>
                {!!item.icerik && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 16 }} numberOfLines={3}>
                    {item.icerik}
                  </Text>
                )}
                {item.musteri?.firma && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Feather name="briefcase" size={11} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                      {item.musteri.firma}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* FAB — Yeni Not */}
      <TouchableOpacity
        onPress={() => navigation.navigate('NotDuzenle', { id: null })}
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  aramaKutu: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1,
  },
  kart: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20, right: 20,
    width: 56, height: 56,
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 6,
  },
})
