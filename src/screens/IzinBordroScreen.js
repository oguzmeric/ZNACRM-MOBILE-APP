// İzin & Bordro (mobil) — KİŞİYE ÖZEL ekran.
//
// Herkes YALNIZ kendi bordrosunu ve kendi izin taleplerini görür (RLS + servis
// katmanında kullanıcı id filtresi). Onay/red ve bordro yükleme MOBİLDE YOK —
// izin talebi açılınca İK yetkililerine (Abdullah Bey) bildirim gider, kararı
// web tarafındaki İK Yönetim ekranından verir.

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
} from '../services/ikService'

const fmtTarih = (t) => t ? new Date(`${String(t).slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR') : '—'

export default function IzinBordroScreen() {
  const { colors } = useTheme()
  const { kullanici } = useAuth()
  const headerHeight = useHeaderHeight()

  const [sekme, setSekme] = useState('izin')     // izin | bordro
  const [izinler, setIzinler] = useState([])
  const [bordrolar, setBordrolar] = useState([])
  const [loading, setLoading] = useState(true)
  const [yenileniyor, setYenileniyor] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [indiriliyor, setIndiriliyor] = useState(null)

  const yukle = useCallback(async () => {
    if (!kullanici?.id) { setLoading(false); return }
    const [i, b] = await Promise.all([
      izinTaleplerimiGetir(kullanici.id),
      bordrolarimiGetir(kullanici.id),
    ])
    setIzinler(i)
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

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }

  const bekleyen = izinler.filter(i => i.durum === 'bekliyor').length

  return (
    <ScreenContainer>
      {/* Sekmeler */}
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }}>
        {[
          { id: 'izin', ad: 'İzinlerim', sayi: izinler.length },
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
              <Text style={{ color: aktif ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                {s.ad} ({s.sayi})
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Gizlilik notu — kullanıcı şüpheye düşmesin */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={{ color: colors.textFaded, fontSize: 11.5, lineHeight: 16 }}>
          🔒 Bu ekrandaki bordro ve izin kayıtları yalnızca size aittir; başka personel göremez.
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
