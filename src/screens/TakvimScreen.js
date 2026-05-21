// Mobile Takvim ekranı — ay görünümü + seçili gün etkinlikleri + Meet'li etkinlik oluşturma.
// Etkinlik verisi harici_etkinlikler tablosundan (web'in sync ettiği) okunur.
// OAuth bağlantısı web tarafında yapılır; mobile sadece okur ve yazar.

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import YeniEtkinlikModal from '../components/YeniEtkinlikModal'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  takvimBaglantilariniGetir, hariciEtkinlikleriGetir, takvimSyncTetikle,
} from '../services/takvimService'

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const pad = (n) => String(n).padStart(2, '0')
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Ay grid'i — Pazartesi başlangıcı, 6 hafta = 42 hücre
function ayGridiUret(yil, ay) {
  const ilkGun = new Date(yil, ay, 1)
  // JS: 0=Paz, 1=Pzt ... → Pazartesi başlangıçlı offset
  const ilkGunHafta = (ilkGun.getDay() + 6) % 7
  const grid = []
  const baslangic = new Date(yil, ay, 1 - ilkGunHafta)
  for (let i = 0; i < 42; i++) {
    const d = new Date(baslangic)
    d.setDate(baslangic.getDate() + i)
    grid.push({
      date: d,
      str: toYMD(d),
      ayIcinde: d.getMonth() === ay,
    })
  }
  return grid
}

function saatKisa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TakvimScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()

  const bugun = new Date()
  const [yil, setYil] = useState(bugun.getFullYear())
  const [ay, setAy] = useState(bugun.getMonth())
  const [secilenGun, setSecilenGun] = useState(toYMD(bugun))
  const [etkinlikler, setEtkinlikler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)
  const [baglantilar, setBaglantilar] = useState([])
  const [etkinlikModalAcik, setEtkinlikModalAcik] = useState(false)
  const [etkinlikModalTarihi, setEtkinlikModalTarihi] = useState(null)

  const todayStr = toYMD(bugun)
  const ayGrid = useMemo(() => ayGridiUret(yil, ay), [yil, ay])

  // Etkinlikleri çek — ay grid'inin başından sonuna kadar (42 gün)
  const yukle = useCallback(async () => {
    if (!kullanici?.id) { setYukleniyor(false); return }
    const ilk = ayGrid[0].date
    const son = ayGrid[41].date
    const baslangicISO = new Date(ilk.getFullYear(), ilk.getMonth(), ilk.getDate(), 0, 0, 0).toISOString()
    const bitisISO = new Date(son.getFullYear(), son.getMonth(), son.getDate(), 23, 59, 59).toISOString()
    const [evs, bag] = await Promise.all([
      hariciEtkinlikleriGetir(kullanici.id, baslangicISO, bitisISO),
      takvimBaglantilariniGetir(kullanici.id),
    ])
    setEtkinlikler(evs)
    setBaglantilar(bag)
    setYukleniyor(false)
  }, [kullanici?.id, yil, ay])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // YYYY-MM-DD → etkinlik[] map
  const evsMap = useMemo(() => {
    const m = {}
    for (const e of etkinlikler) {
      const k = e.baslangic ? toYMD(new Date(e.baslangic)) : null
      if (!k) continue
      if (!m[k]) m[k] = []
      m[k].push(e)
    }
    return m
  }, [etkinlikler])

  const secilenEvs = secilenGun ? (evsMap[secilenGun] || []) : []

  const aydanGec = (delta) => {
    let yeniAy = ay + delta
    let yeniYil = yil
    if (yeniAy < 0) { yeniAy = 11; yeniYil-- }
    if (yeniAy > 11) { yeniAy = 0; yeniYil++ }
    setYil(yeniYil); setAy(yeniAy)
  }

  const bugunGit = () => {
    const b = new Date()
    setYil(b.getFullYear())
    setAy(b.getMonth())
    setSecilenGun(toYMD(b))
  }

  const onRefresh = async () => {
    setYenileniyor(true)
    try {
      // Aktif bağlantıları yenile (Google'dan çek)
      for (const b of baglantilar) {
        try { await takvimSyncTetikle(b.id) } catch {}
      }
      await yukle()
    } finally {
      setYenileniyor(false)
    }
  }

  const yeniEtkinlik = (tarih = null) => {
    if (baglantilar.length === 0) {
      Alert.alert(
        'Google bağlantısı yok',
        'Etkinlik oluşturabilmek için web üzerinden bir Google Takvim hesabı bağlamalısın.',
        [{ text: 'Tamam' }],
      )
      return
    }
    setEtkinlikModalTarihi(tarih)
    setEtkinlikModalAcik(true)
  }

  const etkinligeTikla = (ev) => {
    const detaylar = [
      ev.aciklama && `📝 ${ev.aciklama}`,
      ev.lokasyon && `📍 ${ev.lokasyon}`,
      ev.davetliler?.length > 0 && `👥 ${ev.davetliler.length} davetli`,
      ev.toplanti_linki && '🎥 Meet linki var',
    ].filter(Boolean).join('\n\n')
    const butonlar = [{ text: 'Kapat', style: 'cancel' }]
    if (ev.toplanti_linki) {
      butonlar.unshift({ text: 'Meet\'e Katıl', onPress: () => Linking.openURL(ev.toplanti_linki) })
    }
    Alert.alert(ev.baslik || '(başlıksız)', detaylar || 'Detay yok.', butonlar)
  }

  if (yukleniyor) return <ScreenContainer><LoadingState /></ScreenContainer>

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Ay başlık + navigation */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
        }}>
          <TouchableOpacity onPress={() => aydanGec(-1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={bugunGit}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
              {AYLAR[ay]} {yil}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => aydanGec(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-right" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Bağlantı uyarısı (yoksa) */}
        {baglantilar.length === 0 && (
          <View style={{
            marginHorizontal: 16, marginBottom: 8, padding: 12,
            backgroundColor: '#f59e0b15', borderRadius: 8,
            borderWidth: 1, borderColor: '#f59e0b40',
          }}>
            <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '600' }}>
              ⚠️ Google Takvim bağlantısı yok
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
              Etkinlik oluşturmak için web sürümünden Takvim → Takvim Bağlantıları'ndan bir Google hesabı bağla.
            </Text>
          </View>
        )}

        {/* Hafta gün başlıkları */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 }}>
          {GUNLER.map((g) => (
            <View key={g} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>{g}</Text>
            </View>
          ))}
        </View>

        {/* Ay grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
          {ayGrid.map((cell) => {
            const isSelected = cell.str === secilenGun
            const isToday = cell.str === todayStr
            const sayi = (evsMap[cell.str] || []).length
            return (
              <TouchableOpacity
                key={cell.str}
                onPress={() => setSecilenGun(cell.str)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  padding: 2,
                }}
              >
                <View style={{
                  flex: 1,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? colors.primary : (isToday ? colors.primary + '20' : 'transparent'),
                  borderRadius: 8,
                  borderWidth: isToday && !isSelected ? 1 : 0,
                  borderColor: colors.primary,
                  opacity: cell.ayIcinde ? 1 : 0.3,
                }}>
                  <Text style={{
                    color: isSelected ? '#fff' : (isToday ? colors.primary : colors.textPrimary),
                    fontSize: 14,
                    fontWeight: isSelected || isToday ? '700' : '500',
                  }}>
                    {cell.date.getDate()}
                  </Text>
                  {sayi > 0 && (
                    <View style={{
                      width: 4, height: 4, borderRadius: 2,
                      backgroundColor: isSelected ? '#fff' : '#1a73e8',
                      marginTop: 2,
                    }} />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Seçili gün paneli */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
                {new Date(secilenGun + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' }}>
                {new Date(secilenGun + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' })}
                {secilenGun === todayStr ? ' · Bugün' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => yeniEtkinlik(secilenGun)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 8,
                backgroundColor: baglantilar.length > 0 ? '#1a73e8' : colors.surface,
                borderRadius: 8,
                opacity: baglantilar.length > 0 ? 1 : 0.5,
              }}
            >
              <Feather name="video" size={13} color={baglantilar.length > 0 ? '#fff' : colors.textMuted} />
              <Text style={{
                color: baglantilar.length > 0 ? '#fff' : colors.textMuted,
                fontSize: 12, fontWeight: '700',
              }}>+ Etkinlik</Text>
            </TouchableOpacity>
          </View>

          {secilenEvs.length === 0 ? (
            <EmptyState
              ikon="calendar"
              baslik="Bu gün için etkinlik yok"
              mesaj={baglantilar.length > 0 ? '"+ Etkinlik" ile yeni bir toplantı oluşturabilirsin' : ''}
            />
          ) : (
            <View style={{ gap: 8 }}>
              {secilenEvs.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  onPress={() => etkinligeTikla(ev)}
                  activeOpacity={0.7}
                  style={{
                    padding: 12, borderRadius: 10,
                    backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.border,
                    borderLeftWidth: 3, borderLeftColor: ev.toplanti_linki ? '#1a73e8' : colors.primary,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                      {saatKisa(ev.baslangic)} – {saatKisa(ev.bitis)}
                    </Text>
                    {ev.toplanti_linki && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Feather name="video" size={10} color="#1a73e8" />
                        <Text style={{ color: '#1a73e8', fontSize: 10, fontWeight: '700' }}>MEET</Text>
                      </View>
                    )}
                    {ev.davetliler?.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                        <Feather name="users" size={10} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>{ev.davetliler.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>
                    {ev.baslik || '(başlıksız)'}
                  </Text>
                  {!!ev.lokasyon && (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      📍 {ev.lokasyon}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB — bugüne hızlı etkinlik */}
      <TouchableOpacity
        onPress={() => yeniEtkinlik(secilenGun)}
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: baglantilar.length > 0 ? '#1a73e8' : colors.textMuted }]}
      >
        <Feather name="video" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Yeni etkinlik modal */}
      <YeniEtkinlikModal
        visible={etkinlikModalAcik}
        baglantilar={baglantilar}
        varsayilanTarih={etkinlikModalTarihi}
        onKapat={() => setEtkinlikModalAcik(false)}
        onBasarili={() => {
          setEtkinlikModalAcik(false)
          // 1.5 sn bekle (Google'a yazılma + DB sync), sonra etkinlikleri yeniden çek
          setTimeout(() => yukle(), 1500)
        }}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
