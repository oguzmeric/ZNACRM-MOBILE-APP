// Mobiltek araç takip — harita üstte, altta araç listesi (bottom sheet gibi).
// react-native-maps ile (Android: Google, iOS: Apple). Marker rengi motor durumuna göre.

import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, RefreshControl, ActivityIndicator, Dimensions, Platform, NativeModules, UIManager } from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'

// react-native-maps native modül gerektirir — binary'de yoksa render'da 'AIRMap'
// view config not found hatası verir. Sadece require başarılı olmak yetmez,
// native view'ın da register olması lazım. UIManager kontrolü ile bakalım.
let MapView = null
let Marker = null
let PROVIDER_DEFAULT = null
let haritaKullanilabilir = false
// Android'de Google Maps API key olmadan MapView native crash yapıyor
// (Sentry: "IllegalStateException: API key not found")
// Bu nedenle Android'de MapView'ı devre dışı bırak — Leaflet WebView fallback kullanılır
if (Platform.OS !== 'android') {
  try {
    const cfg =
      (UIManager.getViewManagerConfig && UIManager.getViewManagerConfig('AIRMap')) ||
      UIManager.AIRMap ||
      null
    if (cfg) {
      const maps = require('react-native-maps')
      MapView = maps.default
      Marker = maps.Marker
      PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT
      haritaKullanilabilir = !!MapView
    }
  } catch (e) {
    console.warn('[mobiltek] harita init hata:', e?.message)
  }
}
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { araclariGetir, kameralariGetir, yakinlikTara, aktifYakinliklarGetir, normalizeArac } from '../services/mobiltekService'

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
  const navigation = useNavigation()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const mapRef = useRef(null)
  const webviewRef = useRef(null)
  const [araclar, setAraclar] = useState([])
  const [mock, setMock] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seciliArac, setSeciliArac] = useState(null)
  const [kameralar, setKameralar] = useState([])
  const [kameraYukleniyor, setKameraYukleniyor] = useState(false)
  const [webviewUrl, setWebviewUrl] = useState(null)

  const [yakinliklar, setYakinliklar] = useState([])
  const [sonGuncelleme, setSonGuncelleme] = useState(null)

  const yukle = useCallback(async () => {
    const r = await araclariGetir()
    if (r) {
      const ham = r.veri?.vehicles || []
      setAraclar(ham.map(normalizeArac))
      setMock(r.mock)
      setSonGuncelleme(new Date())
    }
    setYukleniyor(false)
    setRefreshing(false)
    // Yakınlık tara (sessiz) + aktif listeyi çek
    yakinlikTara().catch(() => {})
    aktifYakinliklarGetir().then(setYakinliklar).catch(() => {})
  }, [])

  useEffect(() => {
    yukle()
    const t = setInterval(yukle, 30_000)
    return () => clearInterval(t)
  }, [yukle])
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
    } else if (!haritaKullanilabilir && a.lat && a.lng && webviewRef.current) {
      // Leaflet WebView fallback — injectJavaScript ile pan
      webviewRef.current.injectJavaScript(`
        if (window.map) { window.map.flyTo([${Number(a.lat)}, ${Number(a.lng)}], 15, { duration: 0.8 }); }
        true;
      `)
    }
    setKameraYukleniyor(true)
    const r = await kameralariGetir(a.id)
    if (r) setKameralar(r.veri?.cameras || [])
    setKameraYukleniyor(false)
  }

  const renderArac = ({ item: a }) => {
    // Mobiltek 'ignition' bazen yanlış rapor ediyor (aracın çalışırken bile false döndürebiliyor)
    // Birden fazla sinyale bakıyoruz: ignition, engineStatus veya hız > 0
    const kontak = a.ignition === '1' || a.ignition === true || a.ignition === 1
      || a.engineStatus === 'on'
      || Number(a.gpsSpeed || 0) > 0
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
          <MaterialCommunityIcons name="car-side" size={22} color={kontak ? '#10b981' : '#94a3b8'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.plaka, { color: colors.textPrimary }]}>{a.plateNo || `#${a.id}`}</Text>
            <Feather name={kontak ? 'zap' : 'zap-off'} size={11} color={kontak ? '#10b981' : '#94a3b8'} />
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {Number(a.gpsSpeed || 0)} km/s · {kucukSaat(a.gpsTime)}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: kontak ? '#10b981' : '#94a3b8', marginTop: 3 }}>
            {kontak ? 'Kontak açık' : 'Kontak kapalı'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.()
            navigation.navigate('CanliKamera', { aracId: a.id, aracPlaka: a.plateNo || a.label })
          }}
          style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
            marginRight: 6,
          }}
        >
          <Feather name="video" size={16} color="#fff" />
        </TouchableOpacity>
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
              // Mobiltek 'ignition' bazen yanlış rapor ediyor (aracın çalışırken bile false döndürebiliyor)
    // Birden fazla sinyale bakıyoruz: ignition, engineStatus veya hız > 0
    const kontak = a.ignition === '1' || a.ignition === true || a.ignition === 1
      || a.engineStatus === 'on'
      || Number(a.gpsSpeed || 0) > 0
              return (
                <Marker
                  key={a.id}
                  coordinate={{ latitude: Number(a.lat), longitude: Number(a.lng) }}
                  title={a.plateNo}
                  description={`${Number(a.gpsSpeed || 0)} km/s · ${kontak ? 'aktif' : 'kapalı'}`}
                  onPress={() => aracSec(a)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: kontak ? '#10b981' : '#64748b',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: '#fff',
                    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                  }}>
                    <MaterialCommunityIcons name="car-side" size={20} color="#fff" />
                  </View>
                </Marker>
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
          // Fallback: react-native-maps native modülü yoksa WebView + Leaflet HTML
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            style={{ flex: 1, backgroundColor: '#dfe6ee' }}
            source={{ html: `
              <!DOCTYPE html><html><head>
              <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
              <style>body,html,#map{margin:0;padding:0;height:100%;font-family:system-ui,sans-serif}
                .arac-pin{width:30px;height:30px;background:#10b981;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(16,185,129,0.5);border:2px solid #fff}
                .arac-pin.kapali{background:#64748b;box-shadow:0 3px 8px rgba(0,0,0,0.3)}
                .arac-pin span{transform:rotate(45deg);color:#fff;font-size:14px}</style>
              </head><body>
              <div id="map"></div>
              <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
              <script>
                const araclar = ${JSON.stringify((araclar||[]).filter(a=>a.lat&&a.lng).map(a=>({
                  id:a.id, plaka:a.plateNo||('#'+a.id),
                  lat:Number(a.lat), lng:Number(a.lng),
                  hiz:Number(a.gpsSpeed||0), kontak:!!a.ignition,
                })))};
                const map = L.map('map').setView([39.0, 35.0], 6);
                window.map = map;  // injectJavaScript'ten erişim için global expose
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
                if (araclar.length) {
                  const bounds = [];
                  araclar.forEach(a => {
                    const html = '<div class="arac-pin ' + (a.kontak?'':'kapali') + '"><span>🚗</span></div>';
                    const ikon = L.divIcon({html, iconSize:[30,30], iconAnchor:[15,30], className:''});
                    L.marker([a.lat,a.lng],{icon:ikon}).addTo(map).bindPopup('<b>'+a.plaka+'</b><br>'+a.hiz+' km/s · '+(a.kontak?'kontak açık':'kontak kapalı'));
                    bounds.push([a.lat,a.lng]);
                  });
                  if (bounds.length===1) map.setView(bounds[0], 13);
                  else map.fitBounds(bounds, { padding:[40,40], maxZoom:12 });
                }
              </script>
              </body></html>
            ` }}
            javaScriptEnabled
            domStorageEnabled
          />
        )}

        {/* Üst bar — geri + mock rozeti + yenile */}
        <View style={[styles.ustBar, { paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.ustBaslikKart}>
              <MaterialCommunityIcons name="car-multiple" size={16} color="#3b82f6" />
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
          ListHeaderComponent={yakinliklar.length > 0 && (
            <View style={{
              marginBottom: 12, padding: 12, borderRadius: 10,
              backgroundColor: yakinliklar.some(y => y.alarm_verildi) ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.08)',
              borderLeftWidth: 4,
              borderLeftColor: yakinliklar.some(y => y.alarm_verildi) ? '#dc2626' : '#f59e0b',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>🕵️</Text>
                <Text style={{ fontWeight: '700', color: colors.textPrimary, fontSize: 13 }}>
                  {yakinliklar.filter(y => y.alarm_verildi).length > 0
                    ? `${yakinliklar.filter(y => y.alarm_verildi).length} aktif alarm`
                    : `${yakinliklar.length} yakınlık izleniyor`}
                </Text>
              </View>
              {yakinliklar.map(y => {
                const dk = Math.max(0, Math.round((Date.now() - new Date(y.ilk_zaman).getTime()) / 60000))
                return (
                  <View key={y.id} style={{ paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                      {y.alarm_verildi ? '🚨 ' : ''}<Text style={{ fontWeight: '600' }}>{y.arac1_plaka}</Text> + <Text style={{ fontWeight: '600' }}>{y.arac2_plaka}</Text> · {dk} dk · {y.son_mesafe_m}m
                    </Text>
                    {!!y.son_adres && <Text style={{ fontSize: 11, color: colors.textMuted }}>{y.son_adres}</Text>}
                  </View>
                )
              })}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); yukle() }} tintColor={colors.textPrimary} />}
          ListEmptyComponent={!yukleniyor && (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <MaterialCommunityIcons name="car-side" size={44} color={colors.textMuted} />
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
