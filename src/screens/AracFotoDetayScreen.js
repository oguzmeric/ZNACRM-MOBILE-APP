// Araç foto detay — sabah/akşam toggle + 6 bölge kartı + kamera akışı.
import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView, Image, Alert, Modal, Dimensions } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import ScreenContainer from '../components/ScreenContainer'
import {
  BOLGELER, ZAMANLAR, bugunkuKayitlariGetir, fotoKaydet, imzaliUrl, fotoKaydiSil,
  referansDurumu, referansKaydet, referansYetkiliMi, FERDI_ID,
} from '../services/aracFotoService'
import { bildirimEkleDb } from '../services/bildirimService'

const ekranGen = Dimensions.get('window').width

export default function AracFotoDetayScreen({ route, navigation }) {
  const { aracId, plaka } = route.params
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const refYetkili = referansYetkiliMi(kullanici)
  const [zaman, setZaman] = useState('sabah')  // 'sabah' | 'aksam' | 'referans'
  const [kayitlar, setKayitlar] = useState([])
  const [referans, setReferans] = useState(null)  // referansDurumu() sonucu
  const [bildirGonderildi, setBildirGonderildi] = useState(false)
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
      const [veri, ref] = await Promise.all([
        bugunkuKayitlariGetir(aracId),
        referansDurumu(aracId).catch(() => null),
      ])
      setKayitlar(veri)
      setReferans(ref)
      // Signed URL'leri çek (günlük + referans fotoları)
      const imzalar = {}
      const hepsi = [...veri, ...(ref?.liste ?? [])]
      await Promise.all(hepsi.filter(k => k.foto_url).map(async k => {
        imzalar[k.foto_url] = await imzaliUrl(k.foto_url, 3600)
      }))
      setImzaMap(imzalar)
    } catch {}
    setYukleniyor(false)
  }, [aracId])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onTazele = async () => { setTazele(true); await yukle(); setTazele(false) }

  const referansModu = zaman === 'referans'
  const zamanKayitlari = useMemo(() => {
    if (referansModu) {
      // Referans kayıtlarını günlük kayıt biçimine benzet (cekim_zamani alanı)
      return Object.fromEntries((referans?.liste ?? []).map(r =>
        [r.bolge, { ...r, cekim_zamani: r.olusturma_tarih }]))
    }
    return Object.fromEntries(kayitlar.filter(k => k.zaman === zaman).map(k => [k.bolge, k]))
  }, [kayitlar, zaman, referansModu, referans])

  const tamamSayisi = Object.keys(zamanKayitlari).length
  const kilitli = !referansModu && referans && !referans.tamam

  // Referansı eksik araçta Teknik Müdür'e tek tıkla haber ver
  const teknikMudureBildir = async () => {
    if (bildirGonderildi) return
    const r = await bildirimEkleDb({
      aliciId: FERDI_ID,
      baslik: '🚗 Referans foto bekleniyor',
      mesaj: `${plaka} aracının referans fotoğrafları eksik (${referans?.eksikSayi ?? 6} bölge) — ${kullanici?.ad || 'araç sorumlusu'} günlük çekim yapamıyor.`,
      tip: 'bilgi',
    })
    if (r) { setBildirGonderildi(true); Alert.alert('İletildi', 'Teknik Müdür bilgilendirildi.') }
    else Alert.alert('Hata', 'Bildirim gönderilemedi.')
  }

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
      const r = referansModu
        ? await referansKaydet({ aracId, bolge: seciliBolge.id, dosyaUri: foto.uri, kullanici })
        : await fotoKaydet({ aracId, zaman, bolge: seciliBolge.id, dosyaUri: foto.uri })
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
          {referansModu
            ? `Referans ${tamamSayisi}/${BOLGELER.length} bölge · baz fotoğraflar`
            : `Bugün ${tamamSayisi}/${BOLGELER.length} bölge · ${ZAMANLAR.find(z => z.id === zaman).ad}`}
        </Text>

        {/* Sabah / Akşam (+ yetkiliye Referans) toggle */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 }}>
          {[...ZAMANLAR, ...(refYetkili ? [{ id: 'referans', ad: '📌 Referans' }] : [])].map(z => {
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

        {/* TAM KİLİT (mig 198): referans tamamlanmadan günlük çekim yok */}
        {kilitli && (
          <View style={{
            backgroundColor: colors.surface, borderRadius: 14, padding: 18, marginBottom: 16,
            borderWidth: 1, borderColor: colors.warning,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="lock" size={18} color={colors.warning} />
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 }}>
                Referans fotoğraflar bekleniyor
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>
              Bu aracın {referans?.eksikSayi ?? 6} bölge referans (baz) fotoğrafı henüz Teknik Müdür
              tarafından çekilmedi. Referanslar tamamlanmadan sabah/akşam çekimi yapılamaz —
              böylece her günkü fotoğraflar başlangıç durumuyla mukayese edilebilir.
            </Text>
            {!refYetkili ? (
              <TouchableOpacity onPress={teknikMudureBildir} disabled={bildirGonderildi}
                style={{
                  marginTop: 12, padding: 12, borderRadius: 10, alignItems: 'center',
                  backgroundColor: bildirGonderildi ? colors.surfaceDark : colors.warning,
                }}>
                <Text style={{ color: bildirGonderildi ? colors.textMuted : '#0f172a', fontWeight: '700', fontSize: 13 }}>
                  {bildirGonderildi ? '✓ Teknik Müdür bilgilendirildi' : 'Teknik Müdüre Bildir'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setZaman('referans')}
                style={{ marginTop: 12, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.primary }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📌 Referans Çekimine Başla</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 6 bölge kartı — tek sütun, geniş */}
        {yukleniyor ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : kilitli ? null : (
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
                    {referansModu ? `Referans v${onIzleme.kayit.versiyon ?? 1}` : ZAMANLAR.find(z => z.id === zaman)?.ad}
                    {' · '}{new Date(onIzleme.kayit.cekim_zamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
                {/* Referans SİLİNMEZ — yalnız yeni versiyon çekilir (arşiv ispattır) */}
                {!referansModu && (
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
                )}
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
                <Text style={{ color: '#fff', fontSize: 12 }}>{plaka} · {referansModu ? '📌 Referans' : ZAMANLAR.find(z => z.id === zaman)?.ad}</Text>
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
