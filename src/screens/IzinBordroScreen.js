// İzin & Bordro (mobil) — KİŞİYE ÖZEL ekran.
//
// Herkes YALNIZ kendi bordrosunu, izin ve avans taleplerini görür (RLS + servis
// katmanında kullanıcı id filtresi). Onay/red, ödeme ve bordro yükleme MOBİLDE
// YOK — talep açılınca İK yetkililerine (Abdullah Bey) bildirim gider, kararı
// web tarafındaki İK Yönetim ekranından verir.
//
// ⚠️ İzin bildirimi istemciden gider, AVANS bildirimi DB trigger'ından
// (tr_avans_bildir) — avans için buradan bildirim yazılmaz, yoksa çift gider.

import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Modal, Linking, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useHeaderHeight } from '@react-navigation/elements'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import SecimPicker from '../components/SecimPicker'
import TarihSec from '../components/TarihSec'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import {
  IZIN_TURLERI, AYLAR, izinTurBilgi, izinDurumBilgi, isGunuHesapla,
  bordrolarimiGetir, bordroIndirUrl,
  izinTaleplerimiGetir, izinTalepEkle, izinIptal,
  TAKSIT_SECENEKLERI, avansDurumBilgi, tutarBicim, donemBicim, tutarCoz,
  avansTaleplerimiGetir, avansTalepEkle, avansIptal,
} from '../services/ikService'

const fmtTarih = (t) => t ? new Date(`${String(t).slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR') : '—'

export default function IzinBordroScreen() {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()

  const [sekme, setSekme] = useState('izin')     // izin | avans | bordro
  const [izinler, setIzinler] = useState([])
  const [avanslar, setAvanslar] = useState([])
  const [bordrolar, setBordrolar] = useState([])
  const [loading, setLoading] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [avansFormAcik, setAvansFormAcik] = useState(false)
  const [indiriliyor, setIndiriliyor] = useState(null)

  const yukle = useCallback(async () => {
    if (!kullanici?.id) { setLoading(false); return }
    const [i, a, b] = await Promise.all([
      izinTaleplerimiGetir(kullanici.id),
      avansTaleplerimiGetir(kullanici.id),
      bordrolarimiGetir(kullanici.id),
    ])
    setIzinler(i)
    setAvanslar(a)
    setBordrolar(b)
    setLoading(false)
  }, [kullanici?.id])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const yenile = async () => {
    setYenileniyor(true)
    await yukle()
    setYenileniyor(false)
  }

  const bordroAc = async (b) => {
    setIndiriliyor(b.id)
    try {
      const url = await bordroIndirUrl(b.dosyaYol)
      if (!url) { Alert.alert('Hata', 'Bordro bağlantısı alınamadı.'); return }
      const acilir = await Linking.canOpenURL(url)
      if (acilir) await Linking.openURL(url)
      else Alert.alert('Hata', 'Dosya açılamadı.')
    } finally {
      setIndiriliyor(null)
    }
  }

  const talepIptal = (t) => {
    Alert.alert('İzin talebini iptal et', `${izinTurBilgi(t.tur).isim} talebiniz iptal edilecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et', style: 'destructive',
        onPress: async () => {
          try {
            await izinIptal(t.id)
            setIzinler(prev => prev.map(x => x.id === t.id ? { ...x, durum: 'iptal' } : x))
          } catch (e) {
            Alert.alert('Hata', e?.message || 'İptal edilemedi.')
          }
        },
      },
    ])
  }

  const avansIptalEt = (a) => {
    Alert.alert('Avans talebini iptal et', `${tutarBicim(a.tutar)} tutarındaki avans talebiniz iptal edilecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et', style: 'destructive',
        onPress: async () => {
          try {
            await avansIptal(a.id)
            setAvanslar(prev => prev.map(x => x.id === a.id ? { ...x, durum: 'iptal' } : x))
          } catch (e) {
            Alert.alert('Hata', e?.message || 'İptal edilemedi.')
          }
        },
      },
    ])
  }

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }

  const bekleyen = izinler.filter(i => i.durum === 'bekliyor').length
  const avansBekleyen = avanslar.filter(a => a.durum === 'bekliyor').length
  // Ödenmiş ama taksitleri bitmemiş avansların toplam kalan borcu
  const toplamKalanBorc = avanslar.reduce((s, a) => s + (a.kalanBorc || 0), 0)

  return (
    <ScreenContainer>
      {/* Sekmeler — 3 sekme dar ekranda da tek satırda kalsın diye küçültüldü */}
      <View style={{ flexDirection: 'row', gap: 6, padding: 16, paddingBottom: 8 }}>
        {[
          { id: 'izin', ad: 'İzinlerim', sayi: izinler.length },
          { id: 'avans', ad: 'Avanslarım', sayi: avanslar.length },
          { id: 'bordro', ad: 'Bordrolarım', sayi: bordrolar.length },
        ].map(s => {
          const aktif = sekme === s.id
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSekme(s.id)}
              activeOpacity={0.8}
              style={[styles.sekme, {
                backgroundColor: aktif ? colors.primary : colors.surface,
                borderColor: aktif ? colors.primary : colors.border,
              }]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={{ color: aktif ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12.5 }}
              >
                {s.ad} ({s.sayi})
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Gizlilik notu — kullanıcı şüpheye düşmesin */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={{ color: colors.textFaded, fontSize: 11.5, lineHeight: 16 }}>
          🔒 Bu ekrandaki bordro, izin ve avans kayıtları yalnızca size aittir; başka personel göremez.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={colors.textMuted} />}
      >
        {sekme === 'izin' ? (
          <>
            <TouchableOpacity
              onPress={() => setFormAcik(true)}
              activeOpacity={0.85}
              style={[styles.anaButon, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={17} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Yeni İzin Talebi</Text>
            </TouchableOpacity>

            {bekleyen > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
                {bekleyen} talebiniz onay bekliyor.
              </Text>
            )}

            {izinler.length === 0 ? (
              <BosDurum colors={colors} ikon="calendar" metin="Henüz izin talebiniz yok." />
            ) : izinler.map(t => {
              const d = izinDurumBilgi(t.durum)
              return (
                <View key={t.id} style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1 }}>
                      {izinTurBilgi(t.tur).isim}
                    </Text>
                    <View style={[styles.rozet, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                      <Text style={{ color: d.renk, fontSize: 11, fontWeight: '700' }}>{d.isim}</Text>
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                    {fmtTarih(t.baslangic)} → {fmtTarih(t.bitis)}
                    <Text style={{ color: colors.textFaded }}>  ·  {t.gunSayisi} iş günü</Text>
                  </Text>

                  {!!t.aciklama && (
                    <Text style={{ color: colors.textFaded, fontSize: 12.5, marginTop: 4 }}>{t.aciklama}</Text>
                  )}

                  {t.durum !== 'bekliyor' && (t.onaylayanAd || t.kararNotu) && (
                    <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: colors.bg }}>
                      {!!t.onaylayanAd && (
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {t.durum === 'onaylandi' ? 'Onaylayan' : 'Karar veren'}: {t.onaylayanAd}
                          {t.onayTarihi ? ` · ${fmtTarih(t.onayTarihi)}` : ''}
                        </Text>
                      )}
                      {!!t.kararNotu && (
                        <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginTop: 2 }}>
                          "{t.kararNotu}"
                        </Text>
                      )}
                    </View>
                  )}

                  {t.durum === 'bekliyor' && (
                    <TouchableOpacity onPress={() => talepIptal(t)} activeOpacity={0.7} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Text style={{ color: '#dc2626', fontSize: 12.5, fontWeight: '700' }}>Talebi iptal et</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </>
        ) : sekme === 'avans' ? (
          <>
            <TouchableOpacity
              onPress={() => setAvansFormAcik(true)}
              activeOpacity={0.85}
              style={[styles.anaButon, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={17} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Yeni Avans Talebi</Text>
            </TouchableOpacity>

            {toplamKalanBorc > 0 && (
              <View style={{
                padding: 12, borderRadius: 12, marginBottom: 12,
                backgroundColor: 'rgba(245,158,11,0.12)',
                borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
              }}>
                <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 13.5 }}>
                  Kalan avans borcunuz: {tutarBicim(toplamKalanBorc)}
                </Text>
              </View>
            )}

            {avansBekleyen > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
                {avansBekleyen} avans talebiniz onay bekliyor.
              </Text>
            )}

            {avanslar.length === 0 ? (
              <BosDurum colors={colors} ikon="credit-card"
                metin={'Henüz avans talebiniz yok.\n"Yeni Avans Talebi" ile tutarı ve taksit sayısını seçin.'} />
            ) : avanslar.map(a => {
              const d = avansDurumBilgi(a.durum)
              const taksitTutar = (Number(a.tutar) || 0) / (Number(a.taksitSayisi) || 1)
              return (
                <View key={a.id} style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 17, flex: 1 }}>
                      {tutarBicim(a.tutar)}
                    </Text>
                    <View style={[styles.rozet, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                      <Text style={{ color: d.renk, fontSize: 11, fontWeight: '700' }}>{d.isim}</Text>
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                    {a.taksitSayisi} taksit
                    <Text style={{ color: colors.textFaded }}>  ·  ayda {tutarBicim(taksitTutar)}</Text>
                  </Text>

                  {!!a.gerekce && (
                    <Text style={{ color: colors.textFaded, fontSize: 12.5, marginTop: 4 }}>{a.gerekce}</Text>
                  )}

                  {/* Ödendiyse taksit ilerlemesi — borç eriyor mu, görünür olsun */}
                  {!!a.odemeTarihi && (
                    <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: colors.bg }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>
                        Ödendi: {fmtTarih(a.odemeTarihi)} · {a.kesilenTaksit}/{a.taksitSayisi} taksit kesildi
                      </Text>
                      {a.kalanBorc > 0 && (
                        <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: '700', marginTop: 2 }}>
                          Kalan borç: {tutarBicim(a.kalanBorc)}
                        </Text>
                      )}
                      {!!a.sonrakiTaksit && (
                        <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 2 }}>
                          Sıradaki kesinti: {donemBicim(a.sonrakiTaksit.donem)} · {tutarBicim(a.sonrakiTaksit.tutar)}
                        </Text>
                      )}
                    </View>
                  )}

                  {a.durum !== 'bekliyor' && (a.onaylayanAd || a.kararNotu) && (
                    <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: colors.bg }}>
                      {!!a.onaylayanAd && (
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {a.durum === 'onaylandi' ? 'Onaylayan' : 'Karar veren'}: {a.onaylayanAd}
                          {a.onayTarihi ? ` · ${fmtTarih(a.onayTarihi)}` : ''}
                        </Text>
                      )}
                      {!!a.kararNotu && (
                        <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginTop: 2 }}>
                          "{a.kararNotu}"
                        </Text>
                      )}
                    </View>
                  )}

                  {a.durum === 'bekliyor' && (
                    <TouchableOpacity onPress={() => avansIptalEt(a)} activeOpacity={0.7} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <Text style={{ color: '#dc2626', fontSize: 12.5, fontWeight: '700' }}>Talebi iptal et</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </>
        ) : (
          <>
            {bordrolar.length === 0 ? (
              <BosDurum colors={colors} ikon="file-text" metin="Henüz bordronuz yüklenmemiş." />
            ) : bordrolar.map(b => (
              <TouchableOpacity
                key={b.id}
                onPress={() => bordroAc(b)}
                activeOpacity={0.8}
                disabled={indiriliyor === b.id}
                style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: 'rgba(16,185,129,0.14)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Feather name="file-text" size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                    {AYLAR[(Number(b.donemAy) || 1) - 1]} {b.donemYil}
                  </Text>
                  <Text style={{ color: colors.textFaded, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {b.aciklama || b.dosyaAd || 'Bordro'}
                  </Text>
                </View>
                {indiriliyor === b.id
                  ? <ActivityIndicator size="small" color={colors.textMuted} />
                  : <Feather name="download" size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {formAcik && (
        <IzinTalepModal
          kullaniciId={kullanici?.id}
          headerHeight={headerHeight}
          onKapat={() => setFormAcik(false)}
          onEklendi={(yeni) => {
            setIzinler(prev => [yeni, ...prev])
            setFormAcik(false)
            setSekme('izin')
            Alert.alert('Gönderildi', 'İzin talebiniz İK onayına gönderildi.')
          }}
        />
      )}

      {avansFormAcik && (
        <AvansTalepModal
          kullaniciId={kullanici?.id}
          headerHeight={headerHeight}
          onKapat={() => setAvansFormAcik(false)}
          onEklendi={async () => {
            setAvansFormAcik(false)
            setSekme('avans')
            // Taksit alanları DB trigger'ından türediği için listeyi TEKRAR ÇEK —
            // insert dönüşünü listeye eklemek eksik kayıt gösterirdi.
            await yukle()
            Alert.alert('Gönderildi', 'Avans talebiniz İK onayına gönderildi.')
          }}
        />
      )}
    </ScreenContainer>
  )
}

function BosDurum({ colors, ikon, metin }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
      <Feather name={ikon} size={30} color={colors.textFaded} />
      <Text style={{ color: colors.textMuted, fontSize: 13.5 }}>{metin}</Text>
    </View>
  )
}

function IzinTalepModal({ kullaniciId, headerHeight, onKapat, onEklendi }) {
  const { colors } = useTheme()
  const [tur, setTur] = useState('yillik')
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const gun = isGunuHesapla(baslangic, bitis)

  const gonder = async () => {
    setKaydediliyor(true)
    try {
      const yeni = await izinTalepEkle({ kullaniciId, tur, baslangic, bitis, gunSayisi: gun, aciklama })
      onEklendi(yeni)
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Talep gönderilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={headerHeight}
        >
          <View style={{
            backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
            borderTopWidth: 1, borderColor: colors.border, maxHeight: '90%',
          }}>
            <View style={[styles.modalBaslik, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>Yeni İzin Talebi</Text>
              <TouchableOpacity onPress={onKapat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.etiket, { color: colors.textMuted }]}>İZİN TÜRÜ</Text>
              <SecimPicker
                deger={tur}
                onSec={setTur}
                secenekler={IZIN_TURLERI.map(t => ({ id: t.id, isim: t.isim }))}
                placeholder="İzin türü seç…"
              />

              <View style={{ height: 12 }} />
              <TarihSec value={baslangic} onChange={setBaslangic} label="BAŞLANGIÇ" />
              <View style={{ height: 12 }} />
              <TarihSec value={bitis} onChange={setBitis} label="BİTİŞ" />

              {gun > 0 && (
                <View style={{
                  marginTop: 12, padding: 10, borderRadius: 10,
                  backgroundColor: 'rgba(59,130,246,0.10)',
                }}>
                  <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 13 }}>
                    {gun} iş günü (hafta sonları hariç)
                  </Text>
                </View>
              )}

              <Text style={[styles.etiket, { color: colors.textMuted, marginTop: 14 }]}>AÇIKLAMA (opsiyonel)</Text>
              <TextInput
                value={aciklama}
                onChangeText={setAciklama}
                placeholder="İzin sebebi, iletişim notu…"
                placeholderTextColor={colors.textFaded}
                multiline
                style={[styles.input, {
                  color: colors.textPrimary, borderColor: colors.border,
                  backgroundColor: colors.bg, minHeight: 80, textAlignVertical: 'top',
                }]}
              />

              <Text style={{ color: colors.textFaded, fontSize: 11.5, marginTop: 12, lineHeight: 16 }}>
                Talebiniz İK onayına gönderilir; sonucu bu ekrandan ve bildirimlerden görürsünüz.
              </Text>

              <TouchableOpacity
                onPress={gonder}
                disabled={kaydediliyor || !baslangic || !bitis || !gun}
                activeOpacity={0.85}
                style={[styles.anaButon, {
                  backgroundColor: (!baslangic || !bitis || !gun) ? colors.border : colors.primary,
                  marginTop: 16, marginBottom: 0,
                }]}
              >
                {kaydediliyor
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={16} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {kaydediliyor ? 'Gönderiliyor…' : 'Onaya Gönder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function AvansTalepModal({ kullaniciId, headerHeight, onKapat, onEklendi }) {
  const { colors } = useTheme()
  const [tutar, setTutar] = useState('')
  const [taksit, setTaksit] = useState('1')
  const [gerekce, setGerekce] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const sayi = tutarCoz(tutar)
  const gecerli = Number.isFinite(sayi) && sayi > 0
  const taksitSayi = Number(taksit) || 1
  const taksitTutar = gecerli ? sayi / taksitSayi : 0

  const gonder = async () => {
    if (!gecerli) { Alert.alert('Hata', 'Geçerli bir avans tutarı girin.'); return }
    setKaydediliyor(true)
    try {
      await avansTalepEkle({ kullaniciId, tutar, taksitSayisi: taksitSayi, gerekce })
      onEklendi()
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Talep gönderilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={headerHeight}
        >
          <View style={{
            backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
            borderTopWidth: 1, borderColor: colors.border, maxHeight: '90%',
          }}>
            <View style={[styles.modalBaslik, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>Yeni Avans Talebi</Text>
              <TouchableOpacity onPress={onKapat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.etiket, { color: colors.textMuted }]}>AVANS TUTARI (₺)</Text>
              <TextInput
                value={tutar}
                onChangeText={(v) => setTutar(v.replace(/[^0-9.,]/g, ''))}
                placeholder="Örn: 9000"
                placeholderTextColor={colors.textFaded}
                keyboardType="decimal-pad"
                style={[styles.input, {
                  color: colors.textPrimary, borderColor: colors.border,
                  backgroundColor: colors.bg, fontSize: 17, fontWeight: '700',
                }]}
              />

              <Text style={[styles.etiket, { color: colors.textMuted, marginTop: 14 }]}>KAÇ TAKSİTTE KESİLSİN?</Text>
              <SecimPicker
                deger={taksit}
                onSec={setTaksit}
                secenekler={TAKSIT_SECENEKLERI.map(n => ({ id: String(n), isim: `${n} taksit` }))}
                placeholder="Taksit sayısı seç…"
              />

              {/* Talep göndermeden önce aylık kesintiyi göster — sürpriz olmasın */}
              {gecerli && (
                <View style={{
                  marginTop: 12, padding: 10, borderRadius: 10,
                  backgroundColor: 'rgba(59,130,246,0.10)',
                }}>
                  <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 13 }}>
                    Maaşınızdan {taksitSayi} ay boyunca ayda {tutarBicim(taksitTutar)} kesilir.
                  </Text>
                  <Text style={{ color: colors.textFaded, fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>
                    Kesintiler avans ödendikten sonraki ay başlar. Küsurat son taksite eklenir.
                  </Text>
                </View>
              )}

              <Text style={[styles.etiket, { color: colors.textMuted, marginTop: 14 }]}>GEREKÇE (opsiyonel)</Text>
              <TextInput
                value={gerekce}
                onChangeText={setGerekce}
                placeholder="Örn: Ev taşınma masrafı…"
                placeholderTextColor={colors.textFaded}
                multiline
                style={[styles.input, {
                  color: colors.textPrimary, borderColor: colors.border,
                  backgroundColor: colors.bg, minHeight: 80, textAlignVertical: 'top',
                }]}
              />

              <Text style={{ color: colors.textFaded, fontSize: 11.5, marginTop: 12, lineHeight: 16 }}>
                Talebiniz İK onayına gönderilir; sonucu bu ekrandan ve bildirimlerden görürsünüz.
              </Text>

              <TouchableOpacity
                onPress={gonder}
                disabled={kaydediliyor || !gecerli}
                activeOpacity={0.85}
                style={[styles.anaButon, {
                  backgroundColor: !gecerli ? colors.border : colors.primary,
                  marginTop: 16, marginBottom: 0,
                }]}
              >
                {kaydediliyor
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={16} color="#fff" />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {kaydediliyor ? 'Gönderiliyor…' : 'Onaya Gönder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sekme: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  kart: {
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  rozet: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  anaButon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 12, marginBottom: 14,
  },
  modalBaslik: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  etiket: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
})
