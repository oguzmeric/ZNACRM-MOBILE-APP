// Araç Rota Geçmişi (mig 261) — bir aracın seçilen gündeki izi.
// Harita üstte (Leaflet WebView), altta gün özeti + duraklama listesi.
//
// ⚠️ Harita neden WebView? react-native-maps bu projede BİLİNÇLİ olarak
// kaldırılmış (MobiltekScreen'deki nota bakınız: Android'de Google Maps API
// key sorunu + ücretlendirme). Ayrıca yeni bir native modül eklemek OTA
// güncellemesiyle eski derlemelere inince uygulamayı ÇÖKERTİR — WebView
// zaten kurulu olduğu için hem güvenli hem ücretsiz.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import SecimPicker from '../components/SecimPicker'
import TakvimPicker from '../components/TakvimPicker'
import {
  izleriGetir, parklariGetir, rotaOzeti, gunAraligi,
  kayitliAraclariGetir, sureMetni, bugunYMD, gunKaydir, gunEtiketi, yolaOturt,
} from '../services/rotaService'
import { araclariGetir, normalizeArac } from '../services/mobiltekService'

const { height: EKRAN_YUKSEKLIK } = Dimensions.get('window')
const HARITA_YUKSEKLIK = EKRAN_YUKSEKLIK * 0.46

const saat = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

export default function AracRotaScreen() {
  const { colors } = useTheme()
  const [araclar, setAraclar] = useState([])          // {id, plaka}
  const [aracId, setAracId] = useState(null)
  const [gun, setGun] = useState(bugunYMD())
  const [takvimAcik, setTakvimAcik] = useState(false)
  const [izler, setIzler] = useState([])
  const [parklar, setParklar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [yolHatlari, setYolHatlari] = useState(null)   // yola oturtulmuş güzergâh

  // Araç listesi: canlı Mobiltek + kayıt tutulanlar (plaka bazında tekil)
  useEffect(() => {
    let iptal = false
    const kur = async () => {
      const [canli, kayitli] = await Promise.all([
        araclariGetir().catch(() => null),
        kayitliAraclariGetir().catch(() => []),
      ])
      if (iptal) return
      const harita = new Map()
      for (const v of (canli?.veri?.vehicles || []).map(normalizeArac)) {
        if (v?.id) harita.set(String(v.id), v.plateNo || `#${v.id}`)
      }
      for (const k of kayitli) {
        if (!harita.has(String(k.arac_id))) harita.set(String(k.arac_id), k.plaka || `#${k.arac_id}`)
      }
      const liste = [...harita.entries()].map(([id, isim]) => ({ id, isim }))
      setAraclar(liste)
      setAracId(prev => prev ?? liste[0]?.id ?? null)
    }
    kur()
    return () => { iptal = true }
  }, [])

  // Araç/gün değişince rotayı getir
  useEffect(() => {
    if (!aracId) return
    let iptal = false
    setYukleniyor(true)
    setYolHatlari(null)
    const { baslangic, bitis } = gunAraligi(gun)
    Promise.all([
      izleriGetir(aracId, baslangic, bitis),
      parklariGetir(aracId, baslangic, bitis),
    ])
      .then(([iz, park]) => {
        if (iptal) return
        setIzler(iz)
        setParklar(park)
        // Güzergâhı yollara oturt — ayrı ve sonradan: dış servis yavaşsa
        // harita yine de hemen görünür, yol gelince üstüne biner
        if (iz.length > 1) {
          yolaOturt(iz).then(h => { if (!iptal) setYolHatlari(h) }).catch(() => {})
        }
      })
      .catch(() => { if (!iptal) { setIzler([]); setParklar([]) } })
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, [aracId, gun])

  const ozet = useMemo(() => rotaOzeti(izler, parklar), [izler, parklar])

  // Harita HTML'i — izler/parklar değişince yeniden kurulur.
  // ⚠️ JSON.stringify ile gömülüyor: adres metinlerindeki tırnak/kesme işareti
  // (Kayabaşı Mah. gibi) düz string birleştirmede script'i bozardı.
  const haritaHtml = useMemo(() => {
    const noktalar = izler
      .filter(i => i.enlem && i.boylam)
      .map(i => [Number(i.enlem), Number(i.boylam)])
    const parkVeri = parklar
      .filter(p => p.enlem && p.boylam)
      .map(p => ({
        lat: Number(p.enlem), lng: Number(p.boylam),
        dk: p.sure_dk || 0, acik: !p.bitis,
        bas: saat(p.baslangic), bit: p.bitis ? saat(p.bitis) : null,
        adres: p.adres || '',
      }))

    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  body,html,#map{margin:0;padding:0;height:100%;font-family:system-ui,sans-serif}
  .park-pin{border-radius:50%;background:#475569;color:#fff;border:2.5px solid #fff;
    display:flex;align-items:center;justify-content:center;font-weight:700;
    box-shadow:0 2px 8px rgba(0,0,0,.35)}
  .park-pin.acik{background:#7c3aed}
  .uc-pin{width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;border:2px solid #fff;
    box-shadow:0 3px 8px rgba(0,0,0,.35)}
  .uc-pin span{transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700}
  .bos{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(255,255,255,.75);z-index:500;font-size:13px;color:#475569;text-align:center;padding:20px}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var noktalar = ${JSON.stringify(noktalar)};
  var parklar = ${JSON.stringify(parkVeri)};
  var yolHatlari = ${JSON.stringify(yolHatlari || [])};
  var yolVar = yolHatlari.length > 0;
  var map = L.map('map').setView([41.0082, 28.9784], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);

  if (noktalar.length > 1) {
    if (yolVar) {
      // Ham noktalar arası düz bağ yalnız soluk referans kalır
      L.polyline(noktalar, {color:'#94a3b8', weight:1.5, opacity:.5, dashArray:'4 6'}).addTo(map);
    } else {
      // Yol servisi cevap vermediyse eski davranış: düz hat
      L.polyline(noktalar, {color:'#fff', weight:7, opacity:.9}).addTo(map);
      L.polyline(noktalar, {color:'#2563eb', weight:3.5, opacity:.95}).addTo(map);
    }
  }

  // Yola oturtulmuş güzergâh + ölçülen noktalar
  if (yolVar) {
    yolHatlari.forEach(function(hat){
      L.polyline(hat, {color:'#fff', weight:8, opacity:.9}).addTo(map);
      L.polyline(hat, {color:'#2563eb', weight:4, opacity:.95}).addTo(map);
    });
    noktalar.forEach(function(n){
      L.circleMarker(n, {radius:3.5, color:'#fff', weight:1.5, fillColor:'#1d4ed8', fillOpacity:1}).addTo(map);
    });
  }

  parklar.forEach(function(p){
    var boy = p.dk >= 120 ? 34 : (p.dk >= 30 ? 30 : 26);
    var ikon = L.divIcon({
      html:'<div class="park-pin '+(p.acik?'acik':'')+'" style="width:'+boy+'px;height:'+boy+'px;font-size:'+Math.round(boy*0.45)+'px">P</div>',
      iconSize:[boy,boy], iconAnchor:[boy/2,boy/2], className:''
    });
    var sure = p.acik ? 'hâlâ burada' : (p.dk >= 60 ? Math.floor(p.dk/60)+' sa '+(p.dk%60)+' dk' : p.dk+' dk');
    L.marker([p.lat,p.lng],{icon:ikon}).addTo(map)
      .bindPopup('<b>'+(p.acik?'Hâlâ burada':'Park')+'</b><br>'+p.bas+(p.bit?' → '+p.bit:' → devam')+'<br>'+sure+(p.adres?'<br><small>'+p.adres+'</small>':''));
  });

  if (noktalar.length) {
    var sinir = yolVar ? yolHatlari.reduce(function(t,h){ return t.concat(h) }, []) : noktalar;
    var uc = function(renk, etiket){
      return L.divIcon({html:'<div class="uc-pin" style="background:'+renk+'"><span>'+etiket+'</span></div>',
        iconSize:[28,28], iconAnchor:[14,28], className:''});
    };
    L.marker(noktalar[0],{icon:uc('#10b981','B')}).addTo(map).bindPopup('Başlangıç');
    if (noktalar.length > 1) {
      L.marker(noktalar[noktalar.length-1],{icon:uc('#dc2626','S')}).addTo(map).bindPopup('Son konum');
    }
    if (sinir.length === 1) map.setView(sinir[0], 15);
    else map.fitBounds(sinir, {padding:[40,40], maxZoom:16});
  } else {
    var d = document.createElement('div');
    d.className = 'bos';
    d.innerHTML = 'Bu gün için kayıt yok.<br><small>Rota kaydı 4 Ağustos 2026\\'da başladı.</small>';
    document.body.appendChild(d);
  }
</script></body></html>`
  }, [izler, parklar, yolHatlari])

  const bugunMu = gun >= bugunYMD()

  const ozetKutu = (etiket, deger, renk) => (
    <View key={etiket} style={[styles.ozetKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.ozetDeger, { color: renk }]}>{deger}</Text>
      <Text style={[styles.ozetEtiket, { color: colors.textMuted }]}>{etiket}</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceDark }}>
      {/* Harita */}
      <View style={{ height: HARITA_YUKSEKLIK, backgroundColor: '#dfe6ee' }}>
        {/* key'de yolHatlari da var: güzergâh sonradan geldiğinde WebView
            yeniden kurulmazsa eski HTML'de kalır ve yol hiç görünmez */}
        <WebView
          key={`${aracId}-${gun}-${izler.length}-${parklar.length}-${yolHatlari ? 'yol' : 'ham'}`}
          originWhitelist={['*']}
          style={{ flex: 1, backgroundColor: '#dfe6ee' }}
          source={{ html: haritaHtml }}
          javaScriptEnabled
          domStorageEnabled
        />
        {yukleniyor && (
          <View style={styles.yukleniyorKatman}>
            <ActivityIndicator color="#2563eb" />
          </View>
        )}
      </View>

      {/* Seçim çubuğu */}
      <View style={[styles.secimCubugu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <SecimPicker
            deger={aracId}
            onSec={setAracId}
            secenekler={araclar}
            placeholder="Araç seç…"
          />
        </View>
      </View>

      <View style={styles.gunCubugu}>
        <TouchableOpacity onPress={() => setGun(g => gunKaydir(g, -1))} style={styles.okBtn} hitSlop={8}>
          <Feather name="chevron-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTakvimAcik(true)} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
            {bugunMu ? 'Bugün' : gunEtiketi(gun)}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
            değiştirmek için dokun
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => !bugunMu && setGun(g => gunKaydir(g, 1))}
          style={[styles.okBtn, bugunMu && { opacity: 0.3 }]}
          disabled={bugunMu}
          hitSlop={8}
        >
          <Feather name="chevron-right" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Gün özeti */}
      <View style={styles.ozetSatir}>
        {ozetKutu('Yol', ozet.mesafeKm >= 1 ? `${ozet.mesafeKm.toFixed(1)} km` : (ozet.nokta ? '<1 km' : '—'), '#2563eb')}
        {ozetKutu('Hareket', sureMetni(ozet.hareketDk), '#10b981')}
        {ozetKutu('Park', ozet.parkSayisi || '—', '#7c3aed')}
        {ozetKutu('Maks. hız', ozet.maxHiz ? `${Math.round(ozet.maxHiz)}` : '—', '#f59e0b')}
      </View>

      {/* Duraklamalar */}
      <FlatList
        data={parklar}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <Text style={[styles.listeBaslik, { color: colors.textSecondary }]}>
            Duraklamalar ({parklar.length})
          </Text>
        }
        renderItem={({ item: p }) => {
          const acik = !p.bitis
          return (
            <View style={[styles.parkKart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.parkRozet, { backgroundColor: acik ? '#7c3aed' : '#475569' }]}>
                <Text style={styles.parkRozetText}>P</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {saat(p.baslangic)} → {acik ? 'devam ediyor' : saat(p.bitis)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  {acik ? 'hâlâ burada' : sureMetni(p.sure_dk)}
                </Text>
                {!!p.adres && (
                  <Text numberOfLines={2} style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {p.adres}
                  </Text>
                )}
              </View>
            </View>
          )
        }}
        ListEmptyComponent={!yukleniyor && (
          <View style={{ alignItems: 'center', paddingVertical: 28 }}>
            <MaterialCommunityIcons name="parking" size={34} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>
              {aracId ? 'Bu gün için park kaydı yok.' : 'Önce araç seçin.'}
            </Text>
          </View>
        )}
      />

      <TakvimPicker
        visible={takvimAcik}
        onClose={() => setTakvimAcik(false)}
        secili={gun}
        onSelect={(t) => { if (t) setGun(t); setTakvimAcik(false) }}
        title="Gün Seç"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  yukleniyorKatman: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: 8,
  },
  secimCubugu: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    borderBottomWidth: 0,
  },
  gunCubugu: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  okBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ozetSatir: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12,
  },
  ozetKutu: {
    flex: 1, borderRadius: 10, borderWidth: 1,
    paddingVertical: 9, alignItems: 'center',
  },
  ozetDeger: { fontSize: 15, fontWeight: '800' },
  ozetEtiket: { fontSize: 10, marginTop: 2 },
  listeBaslik: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 8,
  },
  parkKart: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  parkRozet: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  parkRozetText: { color: '#fff', fontWeight: '800', fontSize: 14 },
})
