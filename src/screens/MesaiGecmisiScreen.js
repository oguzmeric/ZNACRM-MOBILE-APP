// Mesai geçmişi — kendi kayıtlar + Ali/Oğuz için ekip toggle.
import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ScreenContainer from '../components/ScreenContainer'
import { kendiMesaiGecmisim, ekipBugunMesai } from '../services/mesaiService'

const YONETIM_RE = /\b(oğuz|oguz|ali|ferdi)\b/i

function sureGoster(dk) {
  if (dk == null) return '—'
  const s = String(Math.floor(dk / 60)).padStart(2, '0')
  const m = String(dk % 60).padStart(2, '0')
  return `${s}:${m}`
}

function saatGoster(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function tarihGoster(iso) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

export default function MesaiGecmisiScreen() {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const yonetim = YONETIM_RE.test(kullanici?.ad ?? '')
  const [mod, setMod] = useState('kendi')  // 'kendi' | 'ekip'
  const [kendi, setKendi] = useState([])
  const [ekip, setEkip] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [tazele, setTazele] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const [k, e] = await Promise.all([
        kendiMesaiGecmisim({ gun: 30 }),
        yonetim ? ekipBugunMesai() : Promise.resolve([]),
      ])
      setKendi(k); setEkip(e)
    } finally { setYukleniyor(false) }
  }, [yonetim])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onTazele = async () => { setTazele(true); await yukle(); setTazele(false) }

  const toplamDk = kendi.reduce((t, k) => t + (k.sure_dakika ?? 0), 0)
  const acikKayit = kendi.find(k => !k.cikis_zamani)

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={tazele} onRefresh={onTazele} tintColor={colors.textMuted} />}
      >
        {/* Üst başlık */}
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>Mesai Geçmişi</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Son 30 gün</Text>

        {/* Yönetim ise tab */}
        {yonetim && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {['kendi', 'ekip'].map(x => (
              <TouchableOpacity key={x} onPress={() => setMod(x)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: mod === x ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: mod === x ? colors.primary : colors.border,
                }}>
                <Text style={{ color: mod === x ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                  {x === 'kendi' ? 'Kendim' : 'Ekip (Bugün)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {yukleniyor ? (
          <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : mod === 'kendi' ? (
          <>
            {/* Özet */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Ozet colors={colors} etiket="Toplam süre" deger={sureGoster(toplamDk)} />
              <Ozet colors={colors} etiket="Gün sayısı" deger={String(kendi.length)} />
              <Ozet colors={colors} etiket="Durum" deger={acikKayit ? 'Mesaide' : 'Kapalı'}
                    vurgu={acikKayit ? colors.success : null} />
            </View>

            {/* Liste */}
            <View style={{ marginTop: 20, gap: 8 }}>
              {kendi.length === 0 ? (
                <BosDurum colors={colors} yazi="Bu dönemde mesai kaydın yok." />
              ) : kendi.map(k => (
                <KayitSatiri key={k.id} kayit={k} colors={colors} />
              ))}
            </View>
          </>
        ) : (
          // Ekip görünümü
          <View style={{ marginTop: 16, gap: 8 }}>
            {ekip.length === 0 ? (
              <BosDurum colors={colors} yazi="Ekipte mesai_takip modülü tanımlı kimse yok." />
            ) : ekip.map(e => (
              <EkipSatiri key={e.kullanici_id} satir={e} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

function Ozet({ colors, etiket, deger, vurgu }) {
  return (
    <View style={{
      flex: 1, backgroundColor: colors.surface, padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{etiket.toUpperCase()}</Text>
      <Text style={{ color: vurgu ?? colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 4 }}>{deger}</Text>
    </View>
  )
}

function KayitSatiri({ kayit, colors }) {
  const aktif = !kayit.cikis_zamani
  const ofisDisi = (kayit.not_ ?? '').toLowerCase().includes('ofis dışı')
  return (
    <View style={{
      backgroundColor: colors.surface, padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: aktif ? 'rgba(34,197,94,0.35)' : colors.border,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <View style={{
        width: 40, alignItems: 'center', paddingVertical: 4,
        borderRightWidth: 1, borderRightColor: colors.border,
      }}>
        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>
          {tarihGoster(kayit.giris_zamani).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
          {saatGoster(kayit.giris_zamani)} → {aktif ? 'devam' : saatGoster(kayit.cikis_zamani)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            Süre: {sureGoster(kayit.sure_dakika)}
          </Text>
          {kayit.giris_mesafe_m != null && (
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              Mesafe: {kayit.giris_mesafe_m} m
            </Text>
          )}
          {ofisDisi && (
            <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>⚠ Ofis dışı</Text>
          )}
        </View>
      </View>
      {aktif && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />}
    </View>
  )
}

function EkipSatiri({ satir, colors }) {
  const k = satir.kayit
  const aktif = k && !k.cikis_zamani
  const durumRenk = aktif ? colors.success : (k ? colors.textMuted : colors.danger)
  const durumMetin = aktif
    ? `Mesaide · ${saatGoster(k.giris_zamani)}`
    : k
      ? `${saatGoster(k.giris_zamani)} → ${saatGoster(k.cikis_zamani)} · ${sureGoster(k.sure_dakika)}`
      : 'Bugün giriş yok'
  return (
    <View style={{
      backgroundColor: colors.surface, padding: 12, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <View style={{ width: 8, height: 40, borderRadius: 4, backgroundColor: durumRenk }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{satir.ad}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{satir.unvan ?? ''}</Text>
      </View>
      <Text style={{ color: durumRenk, fontSize: 12, fontWeight: '600', textAlign: 'right' }}>{durumMetin}</Text>
    </View>
  )
}

function BosDurum({ colors, yazi }) {
  return (
    <View style={{ padding: 30, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
      <Feather name="calendar" size={24} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>{yazi}</Text>
    </View>
  )
}
