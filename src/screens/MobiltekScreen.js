// Mobiltek araç takip — mobil ana ekran. Liste + araç detay + kamera canlı yayın.
// Kredensiyeller gelmeden mock veri ile çalışır; UI aynı, üstte 'MOCK' rozeti.

import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, RefreshControl, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { araclariGetir, kameralariGetir } from '../services/mobiltekService'

const kucukSaat = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return String(iso) }
}

export default function MobiltekScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [araclar, setAraclar] = useState([])
  const [mock, setMock] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seciliArac, setSeciliArac] = useState(null)
  const [kameralar, setKameralar] = useState([])
  const [kameraYukleniyor, setKameraYukleniyor] = useState(false)
  const [webviewUrl, setWebviewUrl] = useState(null)

  const yukle = useCallback(async () => {
    const r = await araclariGetir()
    if (r) {
      setAraclar(r.veri?.vehicles || [])
      setMock(r.mock)
    }
    setYukleniyor(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const aracSec = async (a) => {
    setSeciliArac(a)
    setKameralar([])
    setKameraYukleniyor(true)
    const r = await kameralariGetir(a.id)
    if (r) setKameralar(r.veri?.cameras || [])
    setKameraYukleniyor(false)
  }

  const renderArac = ({ item: a }) => {
    const kontak = a.ignition === '1' || a.engineStatus === 'on'
    return (
      <TouchableOpacity
        onPress={() => aracSec(a)}
        style={[styles.aracKart, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <View style={[styles.aracIkon, { backgroundColor: kontak ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)' }]}>
          <Feather name="truck" size={22} color={kontak ? '#10b981' : '#94a3b8'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.plaka, { color: colors.textPrimary }]}>{a.plateNo || `#${a.id}`}</Text>
            <Feather name={kontak ? 'zap' : 'zap-off'} size={12} color={kontak ? '#10b981' : '#94a3b8'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="activity" size={11} color={colors.textMuted} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{Number(a.gpsSpeed || 0)} km/s</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{kucukSaat(a.gpsTime)}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    )
  }

  return (
    <ScreenContainer>
      <FlatList
        data={araclar}
        keyExtractor={a => String(a.id)}
        renderItem={renderArac}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle() }} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.baslik, { color: colors.textPrimary }]}>Araç Takip</Text>
              {mock && (
                <View style={styles.mockRozet}>
                  <Text style={{ color: '#B45309', fontSize: 11, fontWeight: '700' }}>MOCK</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {yukleniyor ? 'Yükleniyor…' : `${araclar.length} araç · ${mock ? 'kredensiyel bekleniyor' : 'canlı'}`}
            </Text>
          </View>
        }
        ListEmptyComponent={!yukleniyor && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Feather name="truck" size={40} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Araç yok</Text>
          </View>
        )}
      />

      {/* Araç detay bottom sheet */}
      <Modal
        visible={!!seciliArac}
        animationType="slide"
        transparent
        onRequestClose={() => setSeciliArac(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surfaceDark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, maxHeight: '85%' }}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
            </View>
            {seciliArac && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>{seciliArac.plateNo}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {kameraYukleniyor ? 'Yükleniyor…' : `${kameralar.length} kamera`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSeciliArac(null)} hitSlop={10}>
                    <Feather name="x" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {kameraYukleniyor ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginVertical: 30 }} />
                ) : kameralar.length === 0 ? (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Feather name="video-off" size={30} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>Bu araçta kamera yok</Text>
                  </View>
                ) : (
                  <FlatList
                    data={kameralar}
                    keyExtractor={(_, i) => String(i)}
                    renderItem={({ item, index }) => (
                      <View style={[styles.kameraKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Feather name="video" size={16} color="#60a5fa" />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>Kamera {index + 1}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                          {item.lat}, {item.lng} · {kucukSaat(item.gpsTime)}
                        </Text>
                        {item.urlCamera && (
                          <TouchableOpacity
                            onPress={() => setWebviewUrl(item.urlCamera)}
                            style={styles.canliBtn}
                          >
                            <Feather name="play-circle" size={16} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Canlı İzle</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Canlı yayın modal — WebView */}
      <Modal visible={!!webviewUrl} animationType="fade" onRequestClose={() => setWebviewUrl(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            onPress={() => setWebviewUrl(null)}
            style={{
              position: 'absolute', top: insets.top + 10, right: 16, zIndex: 2,
              backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
              padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
            }}
          >
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          {webviewUrl && (
            <WebView
              source={{ uri: webviewUrl }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          )}
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  baslik: { fontSize: 24, fontWeight: '700' },
  mockRozet: {
    backgroundColor: 'rgba(180,83,9,0.15)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1, borderColor: '#B4530955',
  },
  aracKart: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  aracIkon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  plaka: { fontSize: 16, fontWeight: '700' },
  kameraKart: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  canliBtn: {
    marginTop: 10,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
})
