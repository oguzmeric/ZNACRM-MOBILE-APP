// Mobiltek araç takip — harita üstte, altta araç listesi (bottom sheet gibi).
// react-native-maps ile (Android: Google, iOS: Apple). Marker rengi motor durumuna göre.

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, RefreshControl, ActivityIndicator, Dimensions, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather } from '@expo/vector-icons'

// react-native-maps native modül — mevcut app binary'de yoksa çökme yerine
// güvenli fallback ver. EAS Build ile yeni binary yayınlanınca gerçek harita yüklenir.
let MapView = null
let Marker = null
let PROVIDER_DEFAULT = null
let haritaKullanilabilir = false
try {
  const maps = require('react-native-maps')
  MapView = maps.default
  Marker = maps.Marker
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT
  haritaKullanilabilir = !!MapView
} catch (e) {
  console.warn('[mobiltek] react-native-maps yüklenemedi — liste görünümü kullanılacak:', e?.message)
}
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { araclariGetir, kameralariGetir } from '../services/mobiltekService'

const { height: EKRAN_YUKSEKLIK } = Dimensions.get('window')
const HARITA_YUKSEKLIK = EKRAN_YUKSEKLIK * 0.55

const kucukSaat = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return String(iso) }
}

// Türkiye merkez varsayılan
const TR_MERKEZ = { latitude: 39.0, longitude: 35.0, latitudeDelta: 10, longitudeDelta: 10 }

export default function MobiltekScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const mapRef = useRef(null)
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

  // İlk yüklemede araç varsa haritayı ortala
  useEffect(() => {
    if (!haritaKullanilabilir) return
    if (araclar.length && mapRef.current) {
      const konumlar = araclar.filter(a => a.lat && a.lng).map(a => ({
        latitude: Number(a.lat), longitude: Number(a.lng),
      }))
      if (konumlar.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(konumlar, {
            edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
            animated: true,
          })
        }, 400)
      }
    }
  }, [araclar.length])

  const aracSec = async (a) => {
    setSeciliArac(a)
    setKameralar([])
    if (haritaKullanilabilir && a.lat && a.lng && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: Number(a.lat),
        longitude: Number(a.lng),
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      }, 600)
    }
    setKameraYukleniyor(true)
    const r = await kameralariGetir(a.id)
    if (r) setKameralar(r.veri?.cameras || [])
    setKameraYukleniyor(false)
  }

  const renderArac = ({ item: a }) => {
    const kontak = a.ignition === '1' || a.engineStatus === 'on'
    const aktif = seciliArac?.id === a.id
    return (
      <TouchableOpacity
        onPress={() => aracSec(a)}
        style={[styles.aracKart, {
          backgroundColor: aktif ? 'rgba(59,130,246,0.14)' : colors.surface,
          borderColor: aktif ? '#3b82f6' : colors.border,
        }]}
        activeOpacity={0.7}
      >
        <View style={[styles.aracIkon, { backgroundColor: kontak ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)' }]}>
          <Feather name="truck" size={20} color={kontak ? '#10b981' : '#94a3b8'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.plaka, { color: colors.textPrimary }]}>{a.plateNo || `#${a.id}`}</Text>
            <Feather name={kontak ? 'zap' : 'zap-off'} size={11} color={kontak ? '#10b981' : '#94a3b8'} />
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {Number(a.gpsSpeed || 0)} km/s · {kucukSaat(a.gpsTime)}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceDark }}>
      {/* HARİTA — native modül yoksa placeholder */}
      <View style={{ height: HARITA_YUKSEKLIK, backgroundColor: '#dfe6ee' }}>
        {haritaKullanilabilir ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={TR_MERKEZ}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {araclar.map(a => {
              if (!a.lat || !a.lng) return null
              const kontak = a.ignition === '1' || a.engineStatus === 'on'
              return (
                <Marker
                  key={a.id}
                  coordinate={{ latitude: Number(a.lat), longitude: Number(a.lng) }}
                  title={a.plateNo}
                  description={`${Number(a.gpsSpeed || 0)} km/s · ${kontak ? 'aktif' : 'kapalı'}`}
                  pinColor={kontak ? '#10b981' : '#94a3b8'}
                  onPress={() => aracSec(a)}
                />
              )
            })}
            {kameralar.map((k, i) => {
              if (!k.lat || !k.lng) return null
              return (
                <Marker
                  key={`k-${i}`}
                  coordinate={{ latitude: Number(k.lat), longitude: Number(k.lng) }}
                  title={`Kamera ${i + 1}`}
                  pinColor="#3b82f6"
                />
              )
            })}
          </MapView>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
            <Feather name="map" size={44} color="#64748b" />
            <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '700', marginTop: 12 }}>Harita bekleniyor</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              Harita modülü bir sonraki uygulama güncellemesinde aktifleşecek.{'\n'}Aşağıdan araç listesini kullanabilirsin.
            </Text>
          </View>
        )}

        {/* Üst bar — geri + mock rozeti + yenile */}
        <View style={[styles.ustBar, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.ustBaslikKart}>
              <Feather name="truck" size={14} color="#3b82f6" />
              <Text style={styles.ustBaslik}>{araclar.length} araç</Text>
              {mock && <View style={styles.mockRozet}><Text style={styles.mockText}>MOCK</Text></View>}
            </View>
          </View>
          <TouchableOpacity onPress={yukle} style={styles.yenileBtn}>
            <Feather name="refresh-cw" size={16} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ARAÇ LİSTESİ */}
      <View style={{ flex: 1 }}>
        <View style={styles.listeBaslik}>
          <Text style={[styles.listeBaslikText, { color: colors.textPrimary }]}>Araçlar</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Aşağıdan seçim yap</Text>
        </View>
        <FlatList
          data={araclar}
          keyExtractor={a => String(a.id)}
          renderItem={renderArac}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle() }} tintColor={colors.textPrimary} />}
          ListEmptyComponent={!yukleniyor && (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Feather name="truck" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Araç yok</Text>
            </View>
          )}
        />
      </View>

      {/* Kameralar sheet */}
      <Modal visible={!!seciliArac && kameralar.length > 0} animationType="slide" transparent onRequestClose={() => setSeciliArac(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surfaceDark, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, maxHeight: '80%' }}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
            </View>
            {seciliArac && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{seciliArac.plateNo}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{kameralar.length} kamera</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSeciliArac(null)} hitSlop={10}>
                    <Feather name="x" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                {kameraYukleniyor ? (
                  <ActivityIndicator />
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
                          <TouchableOpacity onPress={() => setWebviewUrl(item.urlCamera)} style={styles.canliBtn}>
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

      {/* Canlı yayın */}
      <Modal visible={!!webviewUrl} animationType="fade" onRequestClose={() => setWebviewUrl(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <TouchableOpacity
            onPress={() => setWebviewUrl(null)}
            style={{
              position: 'absolute', top: insets.top + 10, right: 16, zIndex: 2,
              backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8,
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
    </View>
  )
}

const styles = StyleSheet.create({
  ustBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  ustBaslikKart: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ustBaslik: { fontWeight: '700', color: '#111', fontSize: 13 },
  mockRozet: {
    backgroundColor: 'rgba(180,83,9,0.15)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 5, marginLeft: 4,
  },
  mockText: { color: '#B45309', fontSize: 10, fontWeight: '700' },
  yenileBtn: {
    backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  listeBaslik: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  listeBaslikText: { fontSize: 16, fontWeight: '700' },
  aracKart: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1,
    marginTop: 8,
  },
  aracIkon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  plaka: { fontSize: 15, fontWeight: '700' },
  kameraKart: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  canliBtn: {
    marginTop: 10, backgroundColor: '#3b82f6', padding: 12, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
})
