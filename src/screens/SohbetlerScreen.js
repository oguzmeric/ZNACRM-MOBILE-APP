// Sohbetler — gruplar + kişiler tek listede.
// Veri WEB İLE AYNI: aynı tablo, aynı RPC'ler. Webde yazılan burada,
// burada yazılan webde görünür; arada senkron katmanı yok.

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import ScreenContainer from '../components/ScreenContainer'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import CokluSecimPicker from '../components/CokluSecimPicker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { kullanicilariGetir } from '../services/kullaniciService'
import {
  sohbetleriGetir, mesajlariGetir, grupSohbetAc, onizlemeMetni,
} from '../services/chatService'

const saatKisa = (t) => {
  if (!t) return ''
  const d = new Date(t)
  const bugun = new Date()
  if (d.toDateString() === bugun.toDateString()) {
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

const trKucuk = (s = '') => String(s).toLocaleLowerCase('tr')

export default function SohbetlerScreen({ navigation }) {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  // Bu ekran ALT SEKMEDE açılıyor: üstte stack header yok → çentik boşluğunu
  // elle ver; altta sekme çubuğu var → listenin sonu onun altında kalmasın.
  const insets = useSafeAreaInsets()
  const sekmeYuksek = useBottomTabBarHeight()
  const [kisiler, setKisiler] = useState([])
  const [sohbetler, setSohbetler] = useState([])
  const [mesajlar, setMesajlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)
  const [arama, setArama] = useState('')
  const [grupModal, setGrupModal] = useState(false)
  const [grupAd, setGrupAd] = useState('')
  const [grupUyeler, setGrupUyeler] = useState([])
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const kanalRef = useRef(null)

  const yukle = useCallback(async () => {
    if (!kullanici?.id) return
    const [k, s, m] = await Promise.all([
      kullanicilariGetir(), sohbetleriGetir(), mesajlariGetir(),
    ])
    // Liste = personel + YAZIŞMASI OLAN herkes.
    //
    // Neden birleşim: rozet okunmamışı DB'den ham sayıyor, liste ise kişi
    // tipine göre süzüyordu. `tip='musteri'` bir hesaptan mesaj gelince rozet
    // "1" diyor ama kişi listede çıkmıyordu → okunmamışı GÖREMİYOR, sohbeti
    // açamadığı için rozeti DÜŞÜREMİYOR (30.07 vakası: ZNA TEST hesabı
    // rol=personel ama tip=musteri).
    const yazismaliIdler = new Set(
      (s || [])
        .filter(x => x.tip === 'birebir')
        .flatMap(x => x.katilimcilar || [])
        .filter(id => id !== kullanici.id)
    )
    setKisiler((k || []).filter(x =>
      x.id !== kullanici.id &&
      ((x.tip !== 'musteri' && x.rol !== 'musteri') || yazismaliIdler.has(x.id))
    ))
    setSohbetler(s || [])
    setMesajlar(m || [])
    setYukleniyor(false)
  }, [kullanici?.id])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Realtime — bana gelen mesajlar + üyesi olduğum gruplara düşenler
  useEffect(() => {
    if (!kullanici?.id) return
    const grupIdler = sohbetler.filter(s => s.tip === 'grup').map(s => s.id)
    let kanal = supabase.channel(`mobil_sohbetler_${kullanici.id}_${grupIdler.join('_')}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `alici_id=eq.${kullanici.id}` },
        () => yukle())
    grupIdler.forEach((gid) => {
      kanal = kanal.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `sohbet_id=eq.${gid}` },
        () => yukle())
    })
    kanal.subscribe()
    kanalRef.current = kanal
    return () => { supabase.removeChannel(kanal) }
    // grup listesi değişince kanallar yeniden kurulur
  }, [kullanici?.id, sohbetler.map(s => s.id).join(','), yukle])

  const yenile = async () => { setYenileniyor(true); await yukle(); setYenileniyor(false) }

  // ── Türetmeler ───────────────────────────────────────────────────────────
  const gruplar = sohbetler.filter(s => s.tip === 'grup')

  const birebirMesajlari = (kisiId) => mesajlar.filter(m =>
    (m.gondericiId === kullanici?.id && m.aliciId === kisiId) ||
    (m.gondericiId === kisiId && m.aliciId === kullanici?.id)
  )
  const grupMesajlari = (sohbetId) => mesajlar.filter(m => m.sohbetId === sohbetId)

  const okunmamisKisi = (kisiId) => mesajlar.filter(m =>
    m.gondericiId === kisiId && m.aliciId === kullanici?.id && !m.okundu
  ).length

  const okunmamisGrup = (g) => {
    const damga = g.sonOkumaTarih ? new Date(g.sonOkumaTarih) : null
    return mesajlar.filter(m =>
      m.sohbetId === g.id && m.gondericiId !== kullanici?.id &&
      (!damga || new Date(m.tarih) > damga)
    ).length
  }

  const kisiAd = (id) => kisiler.find(k => k.id === id)?.ad || (id === kullanici?.id ? 'Sen' : '?')

  const q = trKucuk(arama)
  const gorunenGruplar = q ? gruplar.filter(g => trKucuk(g.ad).includes(q)) : gruplar
  const gorunenKisiler = q ? kisiler.filter(k => trKucuk(k.ad).includes(q)) : kisiler

  // Gruplar üstte, sonra kişiler — başlıklı tek liste
  const veri = [
    ...(gorunenGruplar.length ? [{ __baslik: 'GRUPLAR' }] : []),
    ...gorunenGruplar.map(g => ({ __tip: 'grup', g })),
    ...(gorunenKisiler.length ? [{ __baslik: 'KİŞİLER' }] : []),
    ...gorunenKisiler.map(k => ({ __tip: 'kisi', k })),
  ]

  const grupKur = async () => {
    if (!grupAd.trim()) { Alert.alert('Eksik', 'Grup adı gerekli'); return }
    if (!grupUyeler.length) { Alert.alert('Eksik', 'En az bir kişi seç'); return }
    setKaydediliyor(true)
    const r = await grupSohbetAc(grupAd.trim(), grupUyeler)
    setKaydediliyor(false)
    if (r.__error) { Alert.alert('Hata', r.__error); return }
    setGrupModal(false); setGrupAd(''); setGrupUyeler([])
    await yukle()
    navigation.navigate('SohbetDetay', { tip: 'grup', sohbetId: r.sohbetId, baslik: grupAd.trim() })
  }

  const satirAc = (item) => {
    if (item.__tip === 'grup') {
      navigation.navigate('SohbetDetay', { tip: 'grup', sohbetId: item.g.id, baslik: item.g.ad })
    } else {
      navigation.navigate('SohbetDetay', { tip: 'kisi', kisiId: item.k.id, baslik: item.k.ad })
    }
  }

  const renderSatir = ({ item }) => {
    if (item.__baslik) {
      return <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>{item.__baslik}</Text>
    }

    const grupMu = item.__tip === 'grup'
    const ad = grupMu ? item.g.ad : item.k.ad
    const sonMesaj = (grupMu ? grupMesajlari(item.g.id) : birebirMesajlari(item.k.id))
      .slice().sort((a, b) => new Date(b.tarih) - new Date(a.tarih))[0]
    const okunmamis = grupMu ? okunmamisGrup(item.g) : okunmamisKisi(item.k.id)
    const uyeSayisi = grupMu ? (item.g.katilimcilar || []).length : 0

    return (
      <TouchableOpacity
        style={[styles.satir, { borderBottomColor: colors.border }]}
        onPress={() => satirAc(item)}
        activeOpacity={0.7}
      >
        <View>
          {grupMu ? (
            <View style={[styles.grupIkon, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="users" size={20} color={colors.primary} />
            </View>
          ) : (
            <Avatar ad={item.k.ad} fotoUrl={item.k.fotoUrl} size={44} />
          )}
          {okunmamis > 0 && (
            <View style={styles.rozet}>
              <Text style={styles.rozetYazi}>{okunmamis > 99 ? '99+' : okunmamis}</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text
            style={[styles.ad, { color: colors.textPrimary, fontWeight: okunmamis > 0 ? '700' : '600' }]}
            numberOfLines={1}
          >
            {ad}
          </Text>
          {grupMu && (
            <Text style={[styles.altYazi, { color: colors.textMuted }]} numberOfLines={1}>
              {uyeSayisi} kişi
            </Text>
          )}
          {sonMesaj ? (
            <Text style={[styles.onizleme, { color: colors.textMuted }]} numberOfLines={1}>
              {sonMesaj.gondericiId === kullanici?.id
                ? 'Sen: '
                : grupMu ? `${kisiAd(sonMesaj.gondericiId).split(' ')[0]}: ` : ''}
              {onizlemeMetni(sonMesaj.icerik)}
            </Text>
          ) : (
            <Text style={[styles.onizleme, { color: colors.textMuted, fontStyle: 'italic' }]}>
              Henüz mesaj yok
            </Text>
          )}
        </View>

        {sonMesaj && (
          <Text style={[styles.saat, { color: colors.textMuted }]}>{saatKisa(sonMesaj.tarih)}</Text>
        )}
      </TouchableOpacity>
    )
  }

  if (yukleniyor) return <ScreenContainer><LoadingState /></ScreenContainer>

  return (
    <ScreenContainer>
      <View style={[
        styles.ustBar,
        { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 12) + 8 },
      ]}>
        <View style={[styles.aramaKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={arama}
            onChangeText={setArama}
            placeholder="Kişi veya grup ara…"
            placeholderTextColor={colors.textMuted}
            style={[styles.aramaGiris, { color: colors.textPrimary }]}
          />
          {arama.length > 0 && (
            <TouchableOpacity onPress={() => setArama('')}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.grupBtn, { backgroundColor: colors.primary }]}
          onPress={() => setGrupModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.grupBtnYazi}>Grup</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={veri}
        keyExtractor={(it, i) => it.__baslik ? `b-${it.__baslik}` : (it.__tip === 'grup' ? `g-${it.g.id}` : `k-${it.k.id}`)}
        renderItem={renderSatir}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState ikon="message-circle" baslik="Sohbet yok" mesaj="Personel listesi boş görünüyor." />
        }
        contentContainerStyle={
          veri.length === 0
            ? { flexGrow: 1, justifyContent: 'center', paddingBottom: sekmeYuksek }
            : { paddingBottom: sekmeYuksek + 24 }
        }
      />

      {/* Yeni grup */}
      <Modal visible={grupModal} animationType="slide" transparent onRequestClose={() => setGrupModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalZemin}
        >
          <View style={[styles.modalKart, { backgroundColor: colors.card }]}>
            <View style={[styles.modalBaslikSatir, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalBaslik, { color: colors.textPrimary }]}>Yeni Grup Sohbeti</Text>
              <TouchableOpacity onPress={() => setGrupModal(false)}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.etiket, { color: colors.textMuted }]}>GRUP ADI</Text>
            <TextInput
              value={grupAd}
              onChangeText={setGrupAd}
              placeholder="Örn. Saha Ekibi"
              placeholderTextColor={colors.textMuted}
              style={[styles.giris, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            />

            <Text style={[styles.etiket, { color: colors.textMuted, marginTop: 14 }]}>KATILIMCILAR</Text>
            <CokluSecimPicker
              degerler={grupUyeler}
              onChange={setGrupUyeler}
              secenekler={kisiler.map(k => ({ id: k.id, isim: k.ad }))}
              placeholder="Kişi seç…"
            />
            <Text style={[styles.ipucu, { color: colors.textMuted }]}>
              Sen otomatik olarak gruba dahilsin. Sonradan da kişi ekleyebilirsin.
            </Text>

            <TouchableOpacity
              style={[styles.kaydetBtn, { backgroundColor: colors.primary, opacity: kaydediliyor ? 0.6 : 1 }]}
              onPress={grupKur}
              disabled={kaydediliyor}
              activeOpacity={0.85}
            >
              <Text style={styles.kaydetYazi}>{kaydediliyor ? 'Oluşturuluyor…' : 'Grubu Oluştur'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  ustBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1,
  },
  aramaKutu: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 40,
  },
  aramaGiris: { flex: 1, fontSize: 14, padding: 0 },
  grupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, height: 40, borderRadius: 10,
  },
  grupBtnYazi: { color: '#fff', fontSize: 13, fontWeight: '700' },

  bolumBaslik: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  satir: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  grupIkon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rozet: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
  },
  rozetYazi: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ad: { fontSize: 15 },
  altYazi: { fontSize: 12, marginTop: 1 },
  onizleme: { fontSize: 13, marginTop: 2 },
  saat: { fontSize: 11, marginLeft: 8 },

  modalZemin: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKart: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalBaslikSatir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, marginBottom: 16, borderBottomWidth: 1,
  },
  modalBaslik: { fontSize: 17, fontWeight: '700' },
  etiket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  giris: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 15 },
  ipucu: { fontSize: 12, marginTop: 8 },
  kaydetBtn: { marginTop: 20, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kaydetYazi: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
