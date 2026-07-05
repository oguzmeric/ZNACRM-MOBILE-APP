// Araç foto detay — sabah/akşam toggle + 6 bölge kartı + kamera akışı.
import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, Image, Alert, Modal, Dimensions } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTheme } from '../context/ThemeContext'
import ScreenContainer from '../components/ScreenContainer'
import { BOLGELER, ZAMANLAR, bugunkuKayitlariGetir, fotoKaydet, imzaliUrl, fotoKaydiSil } from '../services/aracFotoService'

const ekranGen = Dimensions.get('window').width

export default function AracFotoDetayScreen({ route, navigation }) {
  const { aracId, plaka } = route.params
  const { colors } = useTheme()
  const [zaman, setZaman] = useState('sabah')
  const [kayitlar, setKayitlar] = useState([])
  const [imzaMap, setImzaMap] = useState({})   // foto_url → signed URL
  const [yukleniyor, setYukleniyor] = useState(true)
  const [tazele, setTazele] = useState(false)
  const [seciliBolge, setSeciliBolge] = useState(null)
  const [onIzleme, setOnIzleme] = useState(null)   // { bolge, kayit, url }
  const [silmeOnay, setSilmeOnay] = useState(false)
  const [siliniyor, setSiliniyor] = useState(false)
  const [kameraAcik, setKameraAcik] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [izin, izinIste] = useCameraPermissions()
  const kameraRef = useRef(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const veri = await bugunkuKayitlariGetir(aracId)
      setKayitlar(veri)
      // Signed URL'leri çek
      const imzalar = {}
      await Promise.all(veri.filter(k => k.foto_url).map(async k => {
        imzalar[k.foto_url] = await imzaliUrl(k.foto_url, 3600)
      }))
      setImzaMap(imzalar)
    } catch {}
    setYukleniyor(false)
  }, [aracId])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onTazele = async () => { setTazele(true); await yukle(); setTazele(false) }

  const zamanKayitlari = useMemo(
    () => Object.fromEntries(kayitlar.filter(k => k.zaman === zaman).map(k => [k.bolge, k])),
    [kayitlar, zaman]
  )

  const tamamSayisi = Object.keys(zamanKayitlari).length

  const kamerayaGit = async (bolge) => {
    setSeciliBolge(bolge)
    if (!izin?.granted) {
      const r = await izinIste()
      if (!r.granted) { Alert.alert('Kamera İzni', 'Kamera izni verilmedi.'); return }
    }
    setKameraAcik(true)
  }

  const bolgeSec = (bolge) => {
    const kayit = zamanKayitlari[bolge.id]
    if (kayit) {
      setOnIzleme({ bolge, kayit, url: imzaMap[kayit.foto_url] })
      setSilmeOnay(false)
    } else {
      kamerayaGit(bolge)
    }
  }

  const yenidenCek = (bolge) => {
    setOnIzleme(null); setSilmeOnay(false)
    kamerayaGit(bolge)
  }

  const kaydiSil = async () => {
    if (!onIzleme?.kayit) return
    setSiliniyor(true)
    const r = await fotoKaydiSil(onIzleme.kayit)
    setSiliniyor(false)
    if (r.ok) {
      setOnIzleme(null); setSilmeOnay(false)
      yukle()
    } else {
      Alert.alert('Hata', r.hata ?? 'Silinemedi')
    }
  }

  const cek = async () => {
    if (!kameraRef.current || kaydediliyor) return
    setKaydediliyor(true)
    try {
      const foto = await kameraRef.current.takePictureAsync({ quality: 0.7, exif: false, skipProcessing: false })
      const r = await fotoKaydet({ aracId, zaman, bolge: seciliBolge.id, dosyaUri: foto.uri })
      if (r.ok) {
        setKameraAcik(false)
        setSeciliBolge(null)
        await yukle()
      } else {
        Alert.alert('Hata', r.hata ?? 'Yükleme başarısız')
      }
    } catch (e) {
      Alert.alert('Hata', String(e?.message ?? e))
    } finally {
      setKaydediliyor(false)
    }
  }

  const kameraKapat = () => { setKameraAcik(false); setSeciliBolge(null) }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={tazele} onRefresh={onTazele} tintColor={colors.textMuted} />}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 }}>{plaka}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
          Bugün {tamamSayisi}/{BOLGELER.length} bölge · {ZAMANLAR.find(z => z.id === zaman).ad}
        </Text>

        {/* Sabah / Akşam toggle */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 }}>
          {ZAMANLAR.map(z => {
            const aktif = zaman === z.id
            return (
              <TouchableOpacity key={z.id} onPress={() => setZaman(z.id)} activeOpacity={0.8}
                style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  backgroundColor: aktif ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: aktif ? colors.primary : colors.border,
                  alignItems: 'center',
                }}>
                <Text style={{ color: aktif ? '#fff' : colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{z.ad}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* 6 bölge kartı — tek sütun, geniş */}
        {yukleniyor ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={{ gap: 10 }}>
            {BOLGELER.map(b => (
              <BolgeKart
                key={b.id}
                bolge={b}
                kayit={zamanKayitlari[b.id]}
                colors={colors}
                imzaliUrl={imzaMap[zamanKayitlari[b.id]?.foto_url]}
                onBas={() => bolgeSec(b)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Önizleme modal — çekilmiş foto için Yeniden Çek / Sil / Kapat */}
      <Modal visible={!!onIzleme} animationType="fade" transparent onRequestClose={() => setOnIzleme(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 16 }}>
          {onIzleme && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{onIzleme.bolge.ad}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    {ZAMANLAR.find(z => z.id === zaman).ad} · {new Date(onIzleme.kayit.cekim_zamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setOnIzleme(null)} style={{ padding: 8 }}>
                  <Feather name="x" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {onIzleme.url ? (
                <Image source={{ uri: onIzleme.url }} style={{ width: '100%', height: 400, borderRadius: 12 }} resizeMode="cover" />
              ) : (
                <View style={{ height: 200, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={silmeOnay ? kaydiSil : () => setSilmeOnay(true)}
                  disabled={siliniyor}
                  style={{
                    flex: 1, padding: 14, borderRadius: 12,
                    backgroundColor: silmeOnay ? '#b91c1c' : colors.danger,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: siliniyor ? 0.6 : 1,
                    borderWidth: silmeOnay ? 2 : 0, borderColor: '#fff',
                  }}>
                  {siliniyor
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Feather name={silmeOnay ? 'alert-triangle' : 'trash-2'} size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                          {silmeOnay ? 'Emin misin?' : 'Sil'}
                        </Text>
                      </>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => yenidenCek(onIzleme.bolge)}
                  style={{
                    flex: 1, padding: 14, borderRadius: 12,
                    backgroundColor: colors.primary,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <Feather name="camera" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Yeniden Çek</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Kamera modal */}
      <Modal visible={kameraAcik} animationType="slide" onRequestClose={kameraKapat}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={kameraRef} style={{ flex: 1 }} facing="back" />
          {/* Üst şerit — bölge etiketi */}
          <View style={{ position: 'absolute', top: 40, left: 16, right: 16 }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#fff', fontSize: 12 }}>{plaka} · {ZAMANLAR.find(z => z.id === zaman).ad}</Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }}>{seciliBolge?.ad}</Text>
              </View>
              <TouchableOpacity onPress={kameraKapat} style={{ padding: 8 }}>
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Alt şerit — çekim butonu */}
          <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
            <TouchableOpacity onPress={cek} disabled={kaydediliyor}
              style={{
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
                alignItems: 'center', justifyContent: 'center',
                opacity: kaydediliyor ? 0.6 : 1,
              }}>
              {kaydediliyor
                ? <ActivityIndicator color="#0f172a" />
                : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 2, borderColor: '#0f172a' }} />}
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 12, marginTop: 10 }}>
              {kaydediliyor ? 'Yükleniyor…' : 'Foto çek'}
            </Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

function BolgeKart({ bolge, kayit, colors, imzaliUrl, onBas }) {
  const tamam = !!kayit
  return (
    <TouchableOpacity onPress={onBas} activeOpacity={0.85}
      style={{
        borderRadius: 14, overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: tamam ? colors.success + '66' : colors.border,
        flexDirection: 'row', alignItems: 'stretch',
      }}>
      {/* Sol — ikon veya thumbnail (sabit kare) */}
      <View style={{
        width: 96, height: 96,
        backgroundColor: tamam ? colors.success + '15' : colors.surfaceDark,
        alignItems: 'center', justifyContent: 'center',
        borderRightWidth: tamam ? 0 : 1, borderRightColor: colors.border,
      }}>
        {tamam && imzaliUrl ? (
          <Image source={{ uri: imzaliUrl }} style={{ width: 96, height: 96 }} resizeMode="cover" />
        ) : (
          <BolgeIkon id={bolge.id} renk={colors.textMuted} />
        )}
        {tamam && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.success, borderRadius: 10, padding: 3 }}>
            <Feather name="check" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Sağ — bilgi + eylem */}
      <View style={{ flex: 1, padding: 14, justifyContent: 'center' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>{bolge.ad}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
          {tamam
            ? `Çekildi · ${new Date(kayit.cekim_zamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
            : bolge.aciklama}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Feather name={tamam ? 'refresh-ccw' : 'camera'} size={12} color={tamam ? colors.warning : colors.primary} />
          <Text style={{ color: tamam ? colors.warning : colors.primary, fontSize: 12, fontWeight: '600' }}>
            {tamam ? 'Yeniden Çek' : 'Foto Çek'}
          </Text>
        </View>
      </View>

      {/* En sağ — chevron */}
      <View style={{ paddingRight: 12, justifyContent: 'center' }}>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  )
}

function BolgeIkon({ id, renk }) {
  // MaterialCommunityIcons — gerçek araç ikonları
  const config = {
    on:     { lib: 'mci', ad: 'car',           boy: 46 },
    arka:   { lib: 'mci', ad: 'car-back',      boy: 46 },
    sol:    { lib: 'mci', ad: 'car-side',      boy: 46, cevir: true },
    sag:    { lib: 'mci', ad: 'car-side',      boy: 46 },
    kokpit: { lib: 'mci', ad: 'steering',      boy: 46 },
    ic:     { lib: 'mci', ad: 'car-seat',      boy: 46 },
  }[id] ?? { lib: 'feather', ad: 'camera', boy: 46 }

  const stil = config.cevir ? { transform: [{ scaleX: -1 }] } : null

  if (config.lib === 'mci') {
    return <MaterialCommunityIcons name={config.ad} size={config.boy} color={renk} style={stil} />
  }
  return <Feather name={config.ad} size={config.boy} color={renk} />
}
