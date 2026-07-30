// Tek sohbet — birebir veya grup. Web ile aynı veri, aynı kurallar:
//  • kendi mesajını herkes siler (uzun bas)
//  • "Sohbeti sil" yalnız BENDEN gizler, karşı tarafta kalır
//  • dosya Storage'da (base64 DEĞİL), indirme imzalı URL ile
// Emoji için ayrı palet YOK — telefon klavyesinde zaten var.

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Linking, Modal,
  Keyboard,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import ScreenContainer from '../components/ScreenContainer'
import Avatar from '../components/Avatar'
import SecimPicker from '../components/SecimPicker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { toCamel } from '../lib/mapper'
import { kullanicilariGetir } from '../services/kullaniciService'
import {
  sohbetMesajlariGetir, sohbetleriGetir, mesajGonder, mesajSil,
  birebirSohbetAc, sohbetiGizle, sohbetOkunduIsaretle, konusmayiOkunduYap,
  sohbetDosyaYukle, sohbetDosyaUrl, sohbetDosyaSil,
  grubaKisiEkle, gruptanAyril, dosyaMesajiCoz, DOSYA_LIMIT,
} from '../services/chatService'

const saat = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

const gunEtiketi = (t) => {
  const d = new Date(t), bugun = new Date()
  if (d.toDateString() === bugun.toDateString()) return 'Bugün'
  const dun = new Date(bugun); dun.setDate(dun.getDate() - 1)
  if (d.toDateString() === dun.toDateString()) return 'Dün'
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

const boyutYazi = (b) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function SohbetScreen({ route, navigation }) {
  const { tip, kisiId } = route.params || {}
  const [sohbetId, setSohbetId] = useState(route.params?.sohbetId ?? null)
  // Push bildiriminden gelince baslik parametresi YOKTUR (link sadece id
  // taşıyor) — o durumda adı kişi/sohbet listesinden kendimiz buluyoruz,
  // yoksa başlıkta "Sohbet" yazardı.
  const [baslik, setBaslik] = useState(route.params?.baslik || '')
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  // Bu ekranda stack header kapalı (kendi başlık barımız var) — çentik/durum
  // çubuğu boşluğunu ELLE vermek zorundayız, yoksa başlık status bar'ın altına
  // giriyor ve geri butonu tıklanamıyor.
  const insets = useSafeAreaInsets()

  const [mesajlar, setMesajlar] = useState([])
  const [kisiler, setKisiler] = useState([])
  const [sohbet, setSohbet] = useState(null)
  const [metin, setMetin] = useState('')
  const [yukleniyor, setYukleniyor] = useState(true)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [dosyaYuklenen, setDosyaYuklenen] = useState(null)
  const [klavyeAcik, setKlavyeAcik] = useState(false)
  const [menuAcik, setMenuAcik] = useState(false)
  const [kisiEkleAcik, setKisiEkleAcik] = useState(false)
  const [eklenecek, setEklenecek] = useState(null)
  const listeRef = useRef(null)

  const grupMu = tip === 'grup'

  const kisiAd = useCallback(
    (id) => (id === kullanici?.id ? 'Sen' : (kisiler.find(k => k.id === id)?.ad || '?')),
    [kisiler, kullanici?.id],
  )

  // ── Yükleme ──────────────────────────────────────────────────────────────
  const mesajlariCek = useCallback(async (sid = sohbetId) => {
    const d = await sohbetMesajlariGetir({
      tip, sohbetId: sid, kisiId, benId: kullanici?.id,
    })
    setMesajlar(d)
  }, [tip, sohbetId, kisiId, kullanici?.id])

  useEffect(() => {
    navigation.setOptions?.({ title: baslik || 'Sohbet' })
  }, [navigation, baslik])

  // Klavye açıkken alt çentik boşluğu EKLENMEMELİ — klavye zaten o alanı
  // kaplıyor, eklenirse yazma çubuğu klavyenin üstünde havada kalıyor.
  useEffect(() => {
    const ac = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const kapa = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const a = Keyboard.addListener(ac, () => setKlavyeAcik(true))
    const k = Keyboard.addListener(kapa, () => setKlavyeAcik(false))
    return () => { a.remove(); k.remove() }
  }, [])

  useEffect(() => {
    let iptal = false
    ;(async () => {
      if (!kullanici?.id) return
      const [ks, ss] = await Promise.all([kullanicilariGetir(), sohbetleriGetir()])
      if (iptal) return
      setKisiler(ks || [])

      let sid = sohbetId
      if (grupMu) {
        const g = (ss || []).find(s => s.id === sid) || null
        setSohbet(g)
        if (!route.params?.baslik) setBaslik(g?.ad || 'Grup')
      } else {
        if (!route.params?.baslik) {
          setBaslik((ks || []).find(k => k.id === Number(kisiId))?.ad || 'Sohbet')
        }
        // Birebirde sohbet henüz açılmamış olabilir; ilk mesajda açılacak.
        const bulunan = (ss || []).find(s =>
          s.tip === 'birebir' && (s.katilimcilar || []).includes(Number(kisiId))
        )
        if (bulunan) { sid = bulunan.id; setSohbetId(sid); setSohbet(bulunan) }
      }
      await mesajlariCek(sid)
      if (iptal) return
      setYukleniyor(false)

      // Okundu damgası
      if (grupMu && sid) sohbetOkunduIsaretle(sid)
      else if (!grupMu) konusmayiOkunduYap(kullanici.id, kisiId)
    })()
    return () => { iptal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici?.id])

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!kullanici?.id) return
    const kanal = supabase.channel(`mobil_sohbet_${tip}_${sohbetId || kisiId}_${kullanici.id}`)
    if (grupMu && sohbetId) {
      kanal.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `sohbet_id=eq.${sohbetId}` },
        (p) => {
          const y = toCamel(p.new)
          setMesajlar(prev => prev.some(m => m.id === y.id) ? prev : [y, ...prev])
          sohbetOkunduIsaretle(sohbetId)
        })
    } else if (!grupMu) {
      kanal.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `alici_id=eq.${kullanici.id}` },
        (p) => {
          const y = toCamel(p.new)
          if (y.gondericiId !== kisiId) return
          setMesajlar(prev => prev.some(m => m.id === y.id) ? prev : [y, ...prev])
          konusmayiOkunduYap(kullanici.id, kisiId)
        })
    }
    kanal.subscribe()
    return () => { supabase.removeChannel(kanal) }
  }, [kullanici?.id, tip, sohbetId, kisiId, grupMu])

  // Birebirde sohbet yoksa aç (dosya yüklemek de sohbet_id istiyor)
  const sohbetIdSagla = useCallback(async () => {
    if (sohbetId) return sohbetId
    if (grupMu) return null
    const r = await birebirSohbetAc(kisiId)
    if (r.__error) { Alert.alert('Hata', r.__error); return null }
    setSohbetId(r.sohbetId)
    return r.sohbetId
  }, [sohbetId, grupMu, kisiId])

  // ── Gönderme ─────────────────────────────────────────────────────────────
  const gonder = async () => {
    const icerik = metin.trim()
    if (!icerik || gonderiliyor) return
    setGonderiliyor(true)
    const sid = await sohbetIdSagla()
    if (!sid) { setGonderiliyor(false); return }
    const yeni = await mesajGonder(kullanici.id, grupMu ? null : kisiId, icerik, sid)
    setGonderiliyor(false)
    if (yeni?.__error) { Alert.alert('Gönderilemedi', yeni.__error); return }
    setMetin('')
    setMesajlar(prev => prev.some(m => m.id === yeni.id) ? prev : [yeni, ...prev])
  }

  const dosyaGonder = async (asset) => {
    setDosyaYuklenen(asset.name || asset.fileName || 'dosya')
    const sid = await sohbetIdSagla()
    if (!sid) { setDosyaYuklenen(null); return }
    const y = await sohbetDosyaYukle(sid, asset)
    if (y.__error) { setDosyaYuklenen(null); Alert.alert('Yüklenemedi', y.__error); return }
    const yeni = await mesajGonder(kullanici.id, grupMu ? null : kisiId, JSON.stringify({
      tip: 'dosya', dosyaAdi: y.ad, dosyaTipi: y.contentType, dosyaBoyutu: y.boyut, yol: y.yol,
    }), sid)
    setDosyaYuklenen(null)
    if (yeni?.__error) { Alert.alert('Gönderilemedi', yeni.__error); return }
    setMesajlar(prev => prev.some(m => m.id === yeni.id) ? prev : [yeni, ...prev])
  }

  const belgeSec = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (r.canceled || !r.assets?.length) return
    const a = r.assets[0]
    if (a.size && a.size > DOSYA_LIMIT) { Alert.alert('Çok büyük', 'Dosya 25 MB\'dan büyük olamaz.'); return }
    dosyaGonder(a)
  }

  const fotoSec = async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!izin.granted) { Alert.alert('İzin gerekli', 'Galeriye erişim izni verilmedi.'); return }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
    if (r.canceled || !r.assets?.length) return
    const a = r.assets[0]
    dosyaGonder({ ...a, name: a.fileName || `foto_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg' })
  }

  const ekle = () => {
    Alert.alert('Ekle', 'Ne göndermek istersin?', [
      { text: 'Fotoğraf', onPress: fotoSec },
      { text: 'Dosya', onPress: belgeSec },
      { text: 'Vazgeç', style: 'cancel' },
    ])
  }

  // ── Dosya aç / mesaj sil ─────────────────────────────────────────────────
  const dosyaAc = async (d) => {
    if (!d?.yol) {
      // Eski (base64) kayıtlar — mobilde açılmaz, webden indirilebilir
      Alert.alert('Eski kayıt', 'Bu dosya eski biçimde saklanmış; web panelinden açabilirsin.')
      return
    }
    const r = await sohbetDosyaUrl(d.yol)
    if (r.__error) { Alert.alert('Açılamadı', r.__error); return }
    Linking.openURL(r.url).catch(() => Alert.alert('Açılamadı', 'Bağlantı açılamadı.'))
  }

  const mesajaBas = (m) => {
    if (m.gondericiId !== kullanici?.id) return
    Alert.alert('Mesajı sil', 'Bu mesaj karşı taraftan da kalkacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const d = dosyaMesajiCoz(m.icerik)
          const r = await mesajSil(m.id)
          if (r.__error) { Alert.alert('Silinemedi', r.__error); return }
          setMesajlar(prev => prev.filter(x => x.id !== m.id))
          if (d?.yol) sohbetDosyaSil(d.yol)
        },
      },
    ])
  }

  // ── Menü işlemleri ───────────────────────────────────────────────────────
  const sohbetiSilTikla = () => {
    setMenuAcik(false)
    if (!sohbetId) { Alert.alert('Bilgi', 'Henüz mesaj yok.'); return }
    Alert.alert(
      'Sohbeti sil',
      'Yazışma SENİN ekranından kaldırılacak. Diğer katılımcılarda kalmaya devam eder; yeni mesaj gelince sohbet geri gelir (eski mesajlar gizli kalır).',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const r = await sohbetiGizle(sohbetId)
            if (r.__error) { Alert.alert('Silinemedi', r.__error); return }
            navigation.goBack()
          },
        },
      ],
    )
  }

  const ayrilTikla = () => {
    setMenuAcik(false)
    Alert.alert('Gruptan ayrıl', `"${baslik}" grubundan ayrılacaksın. Tekrar eklenmen için üyelerden birinin seni eklemesi gerekir.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: async () => {
          const r = await gruptanAyril(sohbetId)
          if (r.__error) { Alert.alert('Ayrılamadın', r.__error); return }
          navigation.goBack()
        },
      },
    ])
  }

  const kisiEkleKaydet = async () => {
    if (!eklenecek) return
    const r = await grubaKisiEkle(sohbetId, eklenecek)
    if (r.__error) { Alert.alert('Eklenemedi', r.__error); return }
    setKisiEkleAcik(false); setEklenecek(null)
    const ss = await sohbetleriGetir()
    setSohbet((ss || []).find(s => s.id === sohbetId) || null)
    Alert.alert('Tamam', 'Kişi gruba eklendi.')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const renderMesaj = ({ item, index }) => {
    const benim = item.gondericiId === kullanici?.id
    const d = dosyaMesajiCoz(item.icerik)
    // inverted liste: bir SONRAKİ eleman kronolojik olarak ÖNCEKİ mesaj
    const oncekiMesaj = mesajlar[index + 1]
    const gunBaslik = !oncekiMesaj || gunEtiketi(oncekiMesaj.tarih) !== gunEtiketi(item.tarih)

    return (
      <View>
        {gunBaslik && (
          <View style={styles.gunSatir}>
            <View style={[styles.gunCizgi, { backgroundColor: colors.border }]} />
            <Text style={[styles.gunYazi, { color: colors.textMuted }]}>{gunEtiketi(item.tarih)}</Text>
            <View style={[styles.gunCizgi, { backgroundColor: colors.border }]} />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={benim ? 0.7 : 1}
          onLongPress={() => mesajaBas(item)}
          style={[styles.satir, { justifyContent: benim ? 'flex-end' : 'flex-start' }]}
        >
          {!benim && (
            <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
              <Avatar ad={kisiAd(item.gondericiId)} size={28} />
            </View>
          )}
          <View style={{ maxWidth: '78%' }}>
            {grupMu && !benim && (
              <Text style={[styles.gonderenAd, { color: colors.primary }]}>{kisiAd(item.gondericiId)}</Text>
            )}
            {d ? (
              <TouchableOpacity
                onPress={() => dosyaAc(d)}
                style={[
                  styles.balon, styles.dosyaBalon,
                  { backgroundColor: benim ? colors.primary : colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="file" size={20} color={benim ? '#fff' : colors.textPrimary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: benim ? '#fff' : colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                    {d.dosyaAdi}
                  </Text>
                  <Text style={{ color: benim ? 'rgba(255,255,255,0.75)' : colors.textMuted, fontSize: 11 }}>
                    {boyutYazi(d.dosyaBoyutu)} · Aç
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[
                styles.balon,
                { backgroundColor: benim ? colors.primary : colors.card, borderColor: colors.border },
              ]}>
                <Text style={{ color: benim ? '#fff' : colors.textPrimary, fontSize: 15, lineHeight: 21 }}>
                  {item.icerik}
                </Text>
              </View>
            )}
            <Text style={[styles.saatYazi, { color: colors.textMuted, textAlign: benim ? 'right' : 'left' }]}>
              {saat(item.tarih)}{benim && !grupMu ? (item.okundu ? ' ✓✓' : ' ✓') : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    )
  }

  const grupUyeleri = (sohbet?.katilimcilar || [])
  const eklenebilir = kisiler.filter(k =>
    k.id !== kullanici?.id && k.tip !== 'musteri' && k.rol !== 'musteri' && !grupUyeleri.includes(k.id)
  )

  return (
    <ScreenContainer>
      {/* Başlık */}
      <View style={[
        styles.ustBar,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          paddingTop: Math.max(insets.top, 12) + 6,
        },
      ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.geriBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        {grupMu
          ? <View style={[styles.grupIkon, { backgroundColor: colors.primary + '22' }]}>
              <Feather name="users" size={18} color={colors.primary} />
            </View>
          : <Avatar ad={baslik} size={36} />}
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.ustAd, { color: colors.textPrimary }]}>{baslik}</Text>
          {grupMu && (
            <Text numberOfLines={1} style={[styles.ustAlt, { color: colors.textMuted }]}>
              {grupUyeleri.length} kişi
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setMenuAcik(true)} style={{ padding: 8 }}>
          <Feather name="more-vertical" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {yukleniyor ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // Ofset 0: KeyboardAvoidingView'ın ALT kenarı zaten ekranın altında.
          // Buraya başlık yüksekliği vermek klavyenin üstünde o kadar boşluk
          // bırakıyordu (kullanıcı ekran görüntüsüyle gösterdi).
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listeRef}
            data={mesajlar}
            inverted
            keyExtractor={(m) => String(m.id)}
            renderItem={renderMesaj}
            contentContainerStyle={{ padding: 14, flexGrow: 1, justifyContent: 'flex-end' }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                  Henüz mesaj yok. İlk mesajı gönder.
                </Text>
              </View>
            }
          />

          {dosyaYuklenen && (
            <View style={[styles.yukleniyorSerit, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Yükleniyor: {dosyaYuklenen}</Text>
            </View>
          )}

          <View style={[
            styles.girisBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.card,
              // iPhone'da ana ekran çubuğunun altına girmesin — ama klavye
              // açıkken o çubuk yok, boşluk eklersek çubuk havada kalır
              paddingBottom: 10 + (Platform.OS === 'ios' && !klavyeAcik ? insets.bottom : 0),
            },
          ]}>
            <TouchableOpacity onPress={ekle} style={styles.ekBtn} disabled={!!dosyaYuklenen}>
              <Feather name="paperclip" size={20} color={dosyaYuklenen ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
            <TextInput
              value={metin}
              onChangeText={setMetin}
              placeholder="Mesaj yaz…"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.giris, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <TouchableOpacity
              onPress={gonder}
              disabled={!metin.trim() || gonderiliyor}
              style={[styles.gonderBtn, { backgroundColor: metin.trim() ? colors.primary : colors.border }]}
            >
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Menü */}
      <Modal visible={menuAcik} transparent animationType="fade" onRequestClose={() => setMenuAcik(false)}>
        <TouchableOpacity style={styles.menuZemin} activeOpacity={1} onPress={() => setMenuAcik(false)}>
          <View style={[styles.menuKart, { backgroundColor: colors.card }]}>
            {grupMu && (
              <TouchableOpacity
                style={styles.menuSatir}
                onPress={() => { setMenuAcik(false); setKisiEkleAcik(true) }}
              >
                <Feather name="user-plus" size={18} color={colors.textPrimary} />
                <Text style={[styles.menuYazi, { color: colors.textPrimary }]}>Kişi ekle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuSatir} onPress={sohbetiSilTikla}>
              <Feather name="trash-2" size={18} color="#dc2626" />
              <Text style={[styles.menuYazi, { color: '#dc2626' }]}>Sohbeti sil</Text>
            </TouchableOpacity>
            {grupMu && (
              <TouchableOpacity style={styles.menuSatir} onPress={ayrilTikla}>
                <Feather name="log-out" size={18} color="#dc2626" />
                <Text style={[styles.menuYazi, { color: '#dc2626' }]}>Gruptan ayrıl</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Gruba kişi ekle */}
      <Modal visible={kisiEkleAcik} transparent animationType="slide" onRequestClose={() => setKisiEkleAcik(false)}>
        <View style={styles.menuZemin}>
          <View style={[styles.altKart, { backgroundColor: colors.card }]}>
            <View style={[styles.modalBaslikSatir, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalBaslik, { color: colors.textPrimary }]}>Gruba Kişi Ekle</Text>
              <TouchableOpacity onPress={() => setKisiEkleAcik(false)}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <SecimPicker
              deger={eklenecek}
              onSec={setEklenecek}
              secenekler={eklenebilir.map(k => ({ id: k.id, isim: k.ad }))}
              placeholder="Kişi seç…"
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
              Eklenen kişi gruptaki eski mesajları da görür.
            </Text>
            <TouchableOpacity
              style={[styles.kaydetBtn, { backgroundColor: colors.primary, opacity: eklenecek ? 1 : 0.5 }]}
              onPress={kisiEkleKaydet}
              disabled={!eklenecek}
            >
              <Text style={styles.kaydetYazi}>Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  ustBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: 1,
  },
  geriBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  grupIkon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ustAd: { fontSize: 16, fontWeight: '700' },
  ustAlt: { fontSize: 12, marginTop: 1 },

  gunSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  gunCizgi: { flex: 1, height: 1 },
  gunYazi: { fontSize: 11, fontWeight: '600' },

  satir: { flexDirection: 'row', marginBottom: 10 },
  gonderenAd: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 4 },
  balon: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  dosyaBalon: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saatYazi: { fontSize: 10, marginTop: 3, paddingHorizontal: 4 },

  yukleniyorSerit: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1,
  },
  girisBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
  },
  ekBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  giris: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, maxHeight: 110,
  },
  gonderBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  menuZemin: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuKart: { margin: 16, marginBottom: 40, borderRadius: 14, paddingVertical: 6 },
  menuSatir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  menuYazi: { fontSize: 15, fontWeight: '600' },

  altKart: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalBaslikSatir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, marginBottom: 16, borderBottomWidth: 1,
  },
  modalBaslik: { fontSize: 17, fontWeight: '700' },
  kaydetBtn: { marginTop: 20, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kaydetYazi: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
