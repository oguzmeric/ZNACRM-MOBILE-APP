// Keşif fotoğrafı üzerine çizim (KEŞİF DÜZENLEME dokümanı §3, §9).
// CizimYapModal'ın foto-arka-planlı, çok-araçlı versiyonu (Skia).
// Şekiller GÖRÜNTÜ koordinatında ve web KesifFotoCizim.jsx ile AYNI formatta
// tutulur → cizim_veri iki platformda da açılıp düzenlenebilir.
// Kaydet: canvas snapshot (foto + çizim flatten) → base64 PNG; orijinal korunur.

import { useState, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Modal, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import {
  Canvas, Path, Group, Circle, useCanvasRef, useImage,
  Image as SkiaImage, Text as SkiaText, matchFont, Fill, DashPathEffect, Skia,
} from '@shopify/react-native-skia'
import SecimPicker from './SecimPicker'
import { KROKI_SEMBOLLERI, KROKI_KATEGORILER, krokiSembolBilgi, KROKI_SEMBOL_PATH } from '../services/kesifService'

// Sembol path'lerini bir kez Skia Path'e çevir
const SEMBOL_SKIA_PATH = Object.fromEntries(
  Object.entries(KROKI_SEMBOL_PATH).map(([k, d]) => [k, Skia.Path.MakeFromSVGString(d)]).filter(([, p]) => p),
)

// Palet çipi ikonu — tuvalle AYNI kaynak (Skia path, minik canvas)
function SembolCipIkon({ id, renk }) {
  const p = SEMBOL_SKIA_PATH[id]
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: renk, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {p ? (
        <Canvas style={{ width: 15, height: 15 }}>
          <Group transform={[{ scale: 15 / 24 }]}>
            <Path path={p} color="#ffffff" style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" />
          </Group>
        </Canvas>
      ) : null}
    </View>
  )
}

const RENKLER = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#0f172a', '#ffffff']
const KALINLIKLAR = [2, 4, 6, 10]
const ARACLAR = [
  { id: 'kalem',      ikon: 'edit-2',        ad: 'Kalem' },
  { id: 'ok',         ikon: 'arrow-up-right', ad: 'Ok' },
  { id: 'cizgi',      ikon: 'minus',          ad: 'Çizgi' },
  { id: 'daire',      ikon: 'circle',         ad: 'Daire' },
  { id: 'dikdortgen', ikon: 'square',         ad: 'Kutu' },
  { id: 'metin',      ikon: 'type',           ad: 'Metin' },
  { id: 'balon',      ikon: 'hash',           ad: 'No' },
  { id: 'silgi',      ikon: 'x-square',       ad: 'Silgi' },
]
// Kroki moduna özel araçlar — web KROKI_ARACLAR karşılığı
const KROKI_ARACLAR = [
  { id: 'sembol', ikon: 'map-pin',       ad: 'Sembol' },
  { id: 'duvar',  ikon: 'align-justify', ad: 'Duvar' },
  { id: 'kablo',  ikon: 'share-2',       ad: 'Kablo' },
]

const fontCache = {}
const fontAl = (boyut) => {
  const k = Math.max(8, Math.round(boyut))
  if (!fontCache[k]) {
    fontCache[k] = matchFont({
      fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
      fontSize: k,
      fontWeight: 'bold',
    })
  }
  return fontCache[k]
}

// Şekil → SVG path dizesi (görüntü koordinatında; ölçek Group transform'unda)
function sekilPath(s) {
  if ((s.tip === 'kalem' || s.tip === 'kablo') && s.noktalar?.length) {
    let p = `M ${s.noktalar[0].x.toFixed(1)} ${s.noktalar[0].y.toFixed(1)}`
    for (let i = 1; i < s.noktalar.length; i++) p += ` L ${s.noktalar[i].x.toFixed(1)} ${s.noktalar[i].y.toFixed(1)}`
    return p
  }
  if (s.tip === 'cizgi' || s.tip === 'duvar') return `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`
  if (s.tip === 'ok') {
    const aci = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
    const boy = Math.max(12, (s.kalinlik || 4) * 4)
    const u1x = s.x2 - boy * Math.cos(aci - Math.PI / 6), u1y = s.y2 - boy * Math.sin(aci - Math.PI / 6)
    const u2x = s.x2 - boy * Math.cos(aci + Math.PI / 6), u2y = s.y2 - boy * Math.sin(aci + Math.PI / 6)
    return `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2} M ${u1x} ${u1y} L ${s.x2} ${s.y2} L ${u2x} ${u2y}`
  }
  if (s.tip === 'daire') {
    const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2
    const rx = Math.abs(s.x2 - s.x1) / 2 || 1, ry = Math.abs(s.y2 - s.y1) / 2 || 1
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`
  }
  if (s.tip === 'dikdortgen') {
    const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2)
    const w = Math.abs(s.x2 - s.x1) || 1, h = Math.abs(s.y2 - s.y1) || 1
    return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
  }
  return ''
}

// Silgi hit-testi — web sekilIcindeMi ile aynı mantık
function sekilIcindeMi(s, x, y, minSembol = 0) {
  const PAY = 18
  if (s.tip === 'kalem' || s.tip === 'kablo') return (s.noktalar || []).some(n => Math.abs(n.x - x) < PAY && Math.abs(n.y - y) < PAY)
  if (s.tip === 'sembol') return Math.hypot(s.x - x, s.y - y) < Math.max(s.boyut || 26, minSembol) + PAY
  if (s.tip === 'metin') return x > s.x - PAY && x < s.x + (s.metin?.length || 1) * (s.boyut || 28) * 0.6 + PAY && y > s.y - (s.boyut || 28) - PAY && y < s.y + PAY
  if (s.tip === 'balon') return Math.hypot(s.x - x, s.y - y) < (s.yaricap || 22) + PAY
  const minX = Math.min(s.x1, s.x2) - PAY, maxX = Math.max(s.x1, s.x2) + PAY
  const minY = Math.min(s.y1, s.y2) - PAY, maxY = Math.max(s.y1, s.y2) + PAY
  return x >= minX && x <= maxX && y >= minY && y <= maxY
}

function SekilGoster({ s, minSembol = 0 }) {
  if (s.tip === 'sembol') {
    const b = krokiSembolBilgi(s.sembol)
    const r = Math.max(s.boyut || 28, minSembol)
    const ikonPath = SEMBOL_SKIA_PATH[s.sembol]
    const sc = (r * 1.35) / 24
    // numara rozeti (sağ-alt) — ikon tip, numara sıra
    const nr = r * 0.6
    const nx = s.x + r * 0.72, ny = s.y + r * 0.72
    const nfont = fontAl(nr * 1.15)
    const noStr = String(s.no)
    const nw = nfont.measureText ? nfont.measureText(noStr).width : noStr.length * nr * 0.5
    return (
      <>
        <Circle cx={s.x} cy={s.y} r={r} color={b.renk} />
        <Circle cx={s.x} cy={s.y} r={r} color={s.kalemId ? '#facc15' : '#ffffff'} style="stroke" strokeWidth={2.5} />
        {ikonPath && (
          <Group transform={[{ translateX: s.x - r * 0.675 }, { translateY: s.y - r * 0.675 }, { scale: sc }]}>
            <Path path={ikonPath} color="#ffffff" style="stroke" strokeWidth={2 / sc} strokeCap="round" strokeJoin="round" />
          </Group>
        )}
        <Circle cx={nx} cy={ny} r={nr} color="#0f172a" />
        <Circle cx={nx} cy={ny} r={nr} color="#ffffff" style="stroke" strokeWidth={1.5} />
        <SkiaText x={nx - nw / 2} y={ny + nr * 0.35} text={noStr} font={nfont} color="#ffffff" />
      </>
    )
  }
  if (s.tip === 'duvar') {
    const p = sekilPath(s)
    return p ? <Path path={p} color={s.renk || '#334155'} style="stroke" strokeWidth={10} strokeCap="round" /> : null
  }
  if (s.tip === 'kablo') {
    const p = sekilPath(s)
    if (!p) return null
    return (
      <Path path={p} color={s.renk} style="stroke" strokeWidth={s.kalinlik || 4} strokeCap="round" strokeJoin="round">
        <DashPathEffect intervals={[12, 8]} />
      </Path>
    )
  }
  if (s.tip === 'metin' && s.metin) {
    const boyut = s.boyut || 28
    const font = fontAl(boyut)
    const kontur = s.renk === '#ffffff' ? '#0f172a' : '#ffffff'
    return (
      <>
        {[[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]].map(([dx, dy], i) => (
          <SkiaText key={i} x={s.x + dx} y={s.y + dy} text={s.metin} font={font} color={kontur} />
        ))}
        <SkiaText x={s.x} y={s.y} text={s.metin} font={font} color={s.renk} />
      </>
    )
  }
  if (s.tip === 'balon') {
    const r = s.yaricap || 22
    const font = fontAl(r * 1.1)
    const genislik = font.measureText ? font.measureText(String(s.no)).width : String(s.no).length * r * 0.6
    return (
      <>
        <Circle cx={s.x} cy={s.y} r={r} color={s.renk} />
        <Circle cx={s.x} cy={s.y} r={r} color="#ffffff" style="stroke" strokeWidth={2} />
        <SkiaText x={s.x - genislik / 2} y={s.y + r * 0.4} text={String(s.no)} font={font} color="#ffffff" />
      </>
    )
  }
  const p = sekilPath(s)
  if (!p) return null
  return (
    <Path path={p} color={s.renk} style="stroke" strokeWidth={s.kalinlik || 4} strokeCap="round" strokeJoin="round" />
  )
}

export default function KesifFotoCizimModal({
  visible, imageUrl, baslangicSekilleri = [], onKapat, onKaydet, kaydediliyor,
  krokiModu = false, tuval = { w: 1600, h: 1200 }, kalemler = [],
}) {
  const canvasRef = useCanvasRef()
  const insets = useSafeAreaInsets()
  const skImage = useImage(visible && !krokiModu ? imageUrl : null)

  const [sekiller, setSekiller] = useState(baslangicSekilleri)
  const [geriYigin, setGeriYigin] = useState([])
  const [ileriYigin, setIleriYigin] = useState([])
  const [arac, setArac] = useState('kalem')
  const [renk, setRenk] = useState('#dc2626')
  const [kalinlik, setKalinlik] = useState(4)
  const [taslak, setTaslak] = useState(null)
  const [metinDeger, setMetinDeger] = useState('')
  const [alan, setAlan] = useState({ w: 0, h: 0 })
  const [secSembol, setSecSembol] = useState('dome')      // aktif sembol tipi
  const [secKategori, setSecKategori] = useState('kamera') // sembol paleti aktif kategori
  const [sembolPanel, setSembolPanel] = useState(null)  // index — kaleme bağla / sil paneli
  const ilkSekillerRef = useRef(baslangicSekilleri)

  // Modal her açılışta başlangıç şekillerini tazele
  if (visible && ilkSekillerRef.current !== baslangicSekilleri) {
    ilkSekillerRef.current = baslangicSekilleri
    setSekiller(baslangicSekilleri)
    setGeriYigin([])
    setIleriYigin([])
  }

  const imgW = krokiModu ? tuval.w : (skImage?.width() || 0)
  const imgH = krokiModu ? tuval.h : (skImage?.height() || 0)
  // İşaret ölçeği — web ile aynı: fotoğrafta sembol/metin/balon çözünürlüğe oranlı,
  // sembol yarıçapı uzun kenarın ~1/26'sı (yoksa 4000px fotoda görünmez kalıyor)
  const isaretOlcek = Math.max(1, Math.max(imgW, imgH) / 1600)
  const minSembol = krokiModu ? 34 : Math.max(34, Math.round(Math.max(imgW, imgH) / 26))
  const olcek = useMemo(() => {
    if (!imgW || !imgH || !alan.w || !alan.h) return 0
    return Math.min(alan.w / imgW, alan.h / imgH)
  }, [imgW, imgH, alan])
  const cw = Math.round(imgW * olcek)
  const ch = Math.round(imgH * olcek)

  // Kroki ızgarası — 100px aralıklı açık gri çizgiler (tek path)
  const izgaraPath = useMemo(() => {
    if (!krokiModu) return ''
    let p = ''
    for (let x = 100; x < tuval.w; x += 100) p += `M ${x} 0 L ${x} ${tuval.h} `
    for (let y = 100; y < tuval.h; y += 100) p += `M 0 ${y} L ${tuval.w} ${y} `
    return p
  }, [krokiModu, tuval.w, tuval.h])

  const degistir = (yeni) => {
    setGeriYigin(p => [...p, sekiller])
    setIleriYigin([])
    setSekiller(yeni)
  }

  const konum = (e) => ({
    x: e.nativeEvent.locationX / olcek,
    y: e.nativeEvent.locationY / olcek,
  })

  const dokunBasla = (e) => {
    if (!olcek) return
    const { x, y } = konum(e)
    if (arac === 'silgi') {
      for (let i = sekiller.length - 1; i >= 0; i--) {
        if (sekilIcindeMi(sekiller[i], x, y, minSembol)) {
          degistir(sekiller.filter((_, j) => j !== i))
          return
        }
      }
      return
    }
    if (arac === 'metin') {
      if (!metinDeger.trim()) { Alert.alert('Metin', 'Önce üstteki kutuya metni yaz, sonra fotoğrafa dokun.'); return }
      degistir([...sekiller, { tip: 'metin', x, y, metin: metinDeger.trim(), renk, boyut: Math.round((22 + kalinlik * 3) * isaretOlcek) }])
      return
    }
    if (arac === 'balon') {
      const no = sekiller.filter(s => s.tip === 'balon').length + 1
      degistir([...sekiller, { tip: 'balon', x, y, no, renk, yaricap: Math.round((22 + kalinlik * 2) * isaretOlcek) }])
      return
    }
    if (arac === 'sembol') {
      // Mevcut sembole dokunma: kaleme bağla / sil paneli
      for (let i = sekiller.length - 1; i >= 0; i--) {
        if (sekiller[i].tip === 'sembol' && sekilIcindeMi(sekiller[i], x, y, minSembol)) {
          setSembolPanel(i)
          return
        }
      }
      const no = sekiller.filter(s => s.tip === 'sembol' && s.sembol === secSembol).length + 1
      degistir([...sekiller, { tip: 'sembol', sembol: secSembol, x, y, no, boyut: minSembol }])
      return
    }
    if (arac === 'kalem' || arac === 'kablo') setTaslak({ tip: arac, noktalar: [{ x, y }], renk, kalinlik })
    else if (arac === 'duvar') setTaslak({ tip: 'duvar', x1: x, y1: y, x2: x, y2: y, renk: '#334155' })
    else setTaslak({ tip: arac, x1: x, y1: y, x2: x, y2: y, renk, kalinlik })
  }

  const dokunHareket = (e) => {
    if (!taslak || !olcek) return
    const { x, y } = konum(e)
    setTaslak(t => (t.tip === 'kalem' || t.tip === 'kablo')
      ? { ...t, noktalar: [...t.noktalar, { x, y }] }
      : { ...t, x2: x, y2: y })
  }

  const dokunBitir = () => {
    setTaslak(t => {
      if (t) {
        const bos = (t.tip === 'kalem' || t.tip === 'kablo')
          ? t.noktalar.length < 2
          : Math.abs(t.x2 - t.x1) < 4 && Math.abs(t.y2 - t.y1) < 4
        if (!bos) degistir([...sekiller, t])
      }
      return null
    })
  }

  const sembolGuncelle = (index, degisiklik) => {
    degistir(sekiller.map((s, i) => i === index ? { ...s, ...degisiklik } : s))
    setSembolPanel(null)
  }

  const geriAl = () => {
    if (!geriYigin.length) return
    setIleriYigin(p => [...p, sekiller])
    setSekiller(geriYigin[geriYigin.length - 1])
    setGeriYigin(p => p.slice(0, -1))
  }
  const ileriAl = () => {
    if (!ileriYigin.length) return
    setGeriYigin(p => [...p, sekiller])
    setSekiller(ileriYigin[ileriYigin.length - 1])
    setIleriYigin(p => p.slice(0, -1))
  }
  const temizle = () => {
    if (!sekiller.length) return
    Alert.alert('Tümünü temizle', 'Tüm çizim silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => degistir([]) },
    ])
  }

  const kaydet = () => {
    if (!sekiller.length) { Alert.alert('Boş', 'Önce bir işaretleme yap.'); return }
    const snapshot = canvasRef.current?.makeImageSnapshot()
    if (!snapshot) { Alert.alert('Hata', 'Çizim alınamadı.'); return }
    onKaydet(snapshot.encodeToBase64(), { surum: 1, sekiller })
  }

  const kapat = () => {
    if (sekiller.length !== baslangicSekilleri.length) {
      Alert.alert('Çizim Kaybolacak', 'Kaydetmeden kapatmak istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kapat', style: 'destructive', onPress: onKapat },
      ])
    } else onKapat()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={kapat}>
      <View style={{ flex: 1, backgroundColor: '#0b1120', paddingTop: insets.top }}>
        {/* Üst toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={kapat} style={styles.tbBtn}>
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={geriAl} disabled={!geriYigin.length} style={[styles.tbBtn, !geriYigin.length && { opacity: 0.3 }]}>
              <Feather name="rotate-ccw" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={ileriAl} disabled={!ileriYigin.length} style={[styles.tbBtn, !ileriYigin.length && { opacity: 0.3 }]}>
              <Feather name="rotate-cw" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={temizle} disabled={!sekiller.length} style={[styles.tbBtn, !sekiller.length && { opacity: 0.3 }]}>
              <Feather name="trash-2" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={kaydet}
            disabled={kaydediliyor || !sekiller.length}
            style={[styles.kaydetBtn, (kaydediliyor || !sekiller.length) && { opacity: 0.5 }]}
          >
            {kaydediliyor ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.kaydetText}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Araçlar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
          {[...KROKI_ARACLAR, ...ARACLAR].map(a => {
            const aktif = arac === a.id
            return (
              <TouchableOpacity key={a.id} onPress={() => setArac(a.id)}
                style={[styles.aracBtn, aktif && { borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.22)' }]}>
                <Feather name={a.ikon} size={15} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{a.ad}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Sembol paleti — sembol aracı seçiliyken; kategori sekmeleri + kategorinin sembolleri */}
        {arac === 'sembol' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 5, paddingHorizontal: 10, paddingBottom: 5, alignItems: 'center' }}>
              {KROKI_KATEGORILER.map(k => {
                const aktif = secKategori === k.id
                return (
                  <TouchableOpacity key={k.id}
                    onPress={() => {
                      setSecKategori(k.id)
                      const ilk = KROKI_SEMBOLLERI.find(s => !s.eski && s.kategori === k.id)
                      if (ilk && krokiSembolBilgi(secSembol).kategori !== k.id) setSecSembol(ilk.id)
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                      borderWidth: aktif ? 2 : 1,
                      borderColor: aktif ? k.renk : 'rgba(255,255,255,0.18)',
                      backgroundColor: aktif ? `${k.renk}33` : 'rgba(255,255,255,0.05)',
                    }}>
                    <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: k.renk }} />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{k.ad}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingBottom: 6, alignItems: 'center' }}>
              {KROKI_SEMBOLLERI.filter(s => !s.eski && s.kategori === secKategori).map(s => (
                <TouchableOpacity key={s.id} onPress={() => setSecSembol(s.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
                    borderWidth: secSembol === s.id ? 2 : 1,
                    borderColor: secSembol === s.id ? '#60a5fa' : 'rgba(255,255,255,0.18)',
                    backgroundColor: secSembol === s.id ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)',
                  }}>
                  <SembolCipIkon id={s.id} renk={s.renk} />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{s.ad}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {arac === 'metin' && (
          <TextInput
            value={metinDeger}
            onChangeText={setMetinDeger}
            placeholder="Metni yaz, sonra fotoğrafta yerine dokun…"
            placeholderTextColor="#64748b"
            style={{
              marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8,
              borderRadius: 8, borderWidth: 1, borderColor: '#334155',
              color: '#fff', backgroundColor: '#1e293b', fontSize: 14,
            }}
          />
        )}

        {/* Canvas */}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          onLayout={(e) => setAlan({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {!krokiModu && !skImage ? (
            <ActivityIndicator color="#60a5fa" size="large" />
          ) : olcek > 0 ? (
            <View
              style={{ width: cw, height: ch }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={dokunBasla}
              onResponderMove={dokunHareket}
              onResponderRelease={dokunBitir}
              onResponderTerminate={dokunBitir}
            >
              <Canvas ref={canvasRef} style={{ width: cw, height: ch }} pointerEvents="none">
                {krokiModu && <Fill color="#ffffff" />}
                <Group transform={[{ scale: olcek }]}>
                  {krokiModu
                    ? (izgaraPath ? <Path path={izgaraPath} color="#e8edf3" style="stroke" strokeWidth={1.5} /> : null)
                    : <SkiaImage image={skImage} x={0} y={0} width={imgW} height={imgH} fit="fill" />}
                  {sekiller.map((s, i) => <SekilGoster key={i} s={s} minSembol={minSembol} />)}
                  {taslak && <SekilGoster s={taslak} minSembol={minSembol} />}
                </Group>
              </Canvas>
            </View>
          ) : null}
        </View>

        {/* Sembol paneli — kaleme bağla / sil (alt sayfa) */}
        {sembolPanel !== null && sekiller[sembolPanel] && (
          <View style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16,
            padding: 16, paddingBottom: 16 + (insets.bottom || 0),
            borderTopWidth: 1, borderTopColor: '#334155',
          }}>
            {(() => {
              const s = sekiller[sembolPanel]
              const b = krokiSembolBilgi(s.sembol)
              return (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{b.kod}{s.no} — {b.ad}</Text>
                    <TouchableOpacity onPress={() => setSembolPanel(null)} style={{ padding: 4 }}>
                      <Feather name="x" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  {kalemler.length > 0 ? (
                    <SecimPicker
                      deger={s.kalemId ? String(s.kalemId) : ''}
                      onSec={(v) => sembolGuncelle(sembolPanel, { kalemId: v ? Number(v) : null })}
                      secenekler={[
                        { id: '', isim: '— Kaleme bağlı değil —' },
                        ...kalemler.map(k => ({ id: String(k.id), isim: `${k.miktar} ${k.birim} — ${k.urunAdi}` })),
                      ]}
                      placeholder="İlgili keşif kalemi…"
                    />
                  ) : (
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Keşifte malzeme kalemi yok — önce kalem ekle, sonra sembolü bağla.</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => { degistir(sekiller.filter((_, j) => j !== sembolPanel)); setSembolPanel(null) }}
                    style={{
                      marginTop: 10, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                      backgroundColor: 'rgba(220,38,38,0.15)', borderWidth: 1, borderColor: '#dc2626',
                    }}>
                    <Text style={{ color: '#fca5a5', fontWeight: '800', fontSize: 13 }}>Sembolü Sil</Text>
                  </TouchableOpacity>
                </>
              )
            })()}
          </View>
        )}

        {/* Renk + kalınlık */}
        <View style={[styles.altToolbar, { paddingBottom: 10 + (insets.bottom || 0) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, alignItems: 'center' }}>
            {RENKLER.map(r => (
              <TouchableOpacity key={r} onPress={() => setRenk(r)}
                style={{
                  width: 30, height: 30, borderRadius: 15, backgroundColor: r,
                  borderWidth: renk === r ? 3 : 1,
                  borderColor: renk === r ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                }} />
            ))}
            <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 }} />
            {KALINLIKLAR.map(k => (
              <TouchableOpacity key={k} onPress={() => setKalinlik(k)}
                style={{
                  width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                  borderWidth: kalinlik === k ? 2 : 1,
                  borderColor: kalinlik === k ? '#60a5fa' : 'rgba(255,255,255,0.25)',
                }}>
                <View style={{ width: k * 1.6, height: k * 1.6, borderRadius: k, backgroundColor: '#fff' }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tbBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  aracBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
    width: 52, height: 44, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  kaydetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#16a34a', borderRadius: 8,
  },
  kaydetText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  altToolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
})
