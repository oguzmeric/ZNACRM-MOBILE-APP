import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { arrayToCamel, toCamel } from '../../lib/mapper'
import { banaAtananTalepler } from '../../services/servisService'
import { kullaniciAktiflikGuncelle, adminSifreSifirla, geciciSifreUret } from '../../services/kullaniciService'
import { teknisyenStoktariniGetir } from '../../services/stokKalemiService'
import { Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { durumBul } from '../../utils/servisConstants'
import { tarihSaatFormat } from '../../utils/format'

export default function AdminPersonelDetayScreen({ route, navigation }) {
  const { kullaniciId, ad } = route.params
  const { colors } = useTheme()

  const [kullaniciBilgi, setKullaniciBilgi] = useState(null)
  const [talepler, setTalepler] = useState([])
  const [malzemeler, setMalzemeler] = useState([])
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [uzerindeStok, setUzerindeStok] = useState([])
  const [loading, setLoading] = useState(true)
  const [guncelleniyor, setGuncelleniyor] = useState(false)

  useEffect(() => {
    navigation.setOptions({ title: ad ?? 'Personel Detayı' })
  }, [navigation, ad])

  const yukle = useCallback(async () => {
    // Kullanıcı bilgisi
    const { data: k } = await supabase
      .from('kullanicilar')
      .select('*')
      .eq('id', kullaniciId)
      .maybeSingle()
    if (k) setKullaniciBilgi(toCamel(k))

    // Atanan tüm talepler (aktif + geçmiş)
    const atanan = (await banaAtananTalepler(kullaniciId)) ?? []
    setTalepler(atanan)

    // Bu personelin talepleri üzerindeki kullanılan malzemeler
    const talepIds = atanan.map((t) => t.id)
    if (talepIds.length > 0) {
      const { data: m } = await supabase
        .from('servis_malzeme_plani')
        .select('*')
        .in('servis_talep_id', talepIds)
        .gt('kullanilan_miktar', 0)
      const toplamMalzeme = {}
      for (const row of arrayToCamel(m ?? [])) {
        const key = row.stokKodu ?? row.stokAdi
        if (!toplamMalzeme[key]) {
          toplamMalzeme[key] = {
            stokKodu: row.stokKodu,
            stokAdi: row.stokAdi,
            birim: row.birim,
            toplamKullanilan: 0,
          }
        }
        toplamMalzeme[key].toplamKullanilan += Number(row.kullanilanMiktar ?? 0)
      }
      setMalzemeler(Object.values(toplamMalzeme).sort((a, b) => b.toplamKullanilan - a.toplamKullanilan))
    } else {
      setMalzemeler([])
    }

    // Gittiği lokasyonlar (unique)
    const lokSayac = {}
    for (const t of atanan) {
      const lok = t.lokasyon?.trim()
      if (!lok) continue
      lokSayac[lok] = (lokSayac[lok] ?? 0) + 1
    }
    setLokasyonlar(
      Object.entries(lokSayac)
        .map(([lokasyon, sayi]) => ({ lokasyon, sayi }))
        .sort((a, b) => b.sayi - a.sayi)
    )

    // Üzerindeki stok (durum: teknisyende)
    const stok = await teknisyenStoktariniGetir(kullaniciId)
    setUzerindeStok(stok ?? [])

    setLoading(false)
  }, [kullaniciId])

  useEffect(() => { yukle() }, [yukle])

  // Şifre sıfırlama modal state
  const [sifreModalAcik, setSifreModalAcik] = useState(false)
  const [yeniSifre, setYeniSifre] = useState('')
  const [sifreKaydediliyor, setSifreKaydediliyor] = useState(false)

  const sifreModalAc = () => {
    setYeniSifre(geciciSifreUret(8))
    setSifreModalAcik(true)
  }

  const sifreyiSifirla = async () => {
    if (!kullaniciBilgi?.id) return
    if (yeniSifre.trim().length < 6) {
      Alert.alert('Geçersiz', 'Şifre en az 6 karakter olmalı.')
      return
    }
    setSifreKaydediliyor(true)
    const sonuc = await adminSifreSifirla(kullaniciBilgi.id, yeniSifre.trim())
    setSifreKaydediliyor(false)
    if (!sonuc.ok) {
      Alert.alert('Sıfırlanamadı', sonuc.hata ?? 'Bilinmeyen hata')
      return
    }
    setSifreModalAcik(false)
    Alert.alert(
      'Şifre Sıfırlandı',
      `${kullaniciBilgi.ad} kullanıcısının yeni şifresi:\n\n${yeniSifre.trim()}\n\nBu şifreyi kullanıcıya iletin. Giriş yaptıktan sonra Profil → Şifre Değiştir'den kendi şifresini belirleyebilir.`,
      [{ text: 'Tamam', style: 'default' }]
    )
  }

  const aktiflikDegistir = () => {
    if (!kullaniciBilgi) return
    const simdiAktif = !kullaniciBilgi.hesapSilindi
    const yeniAktif = !simdiAktif
    Alert.alert(
      yeniAktif ? 'Aktif Et' : 'Pasife Al',
      yeniAktif
        ? `${kullaniciBilgi.ad} tekrar aktif edilsin mi? Giriş yapabilecek.`
        : `${kullaniciBilgi.ad} pasife alınsın mı? Giriş yapamaz ama geçmiş veri korunur.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: yeniAktif ? 'Aktif Et' : 'Pasife Al',
          style: yeniAktif ? 'default' : 'destructive',
          onPress: async () => {
            setGuncelleniyor(true)
            const ok = await kullaniciAktiflikGuncelle(kullaniciBilgi.id, yeniAktif)
            setGuncelleniyor(false)
            if (!ok) {
              Alert.alert('Hata', 'Güncellenemedi.')
              return
            }
            yukle()
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} />
      </ScreenContainer>
    )
  }

  const aktif = talepler.filter((t) => !['tamamlandi', 'onaylandi', 'iptal'].includes(t.durum))
  const tamamlanan = talepler.filter((t) => ['tamamlandi', 'onaylandi'].includes(t.durum))

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hesap durumu */}
        {kullaniciBilgi && (
          <View style={[styles.durumBlok, {
            backgroundColor: colors.surface,
            borderColor: kullaniciBilgi.hesapSilindi ? colors.danger : colors.success,
          }]}>
            <Feather
              name={kullaniciBilgi.hesapSilindi ? 'user-x' : 'user-check'}
              size={16}
              color={kullaniciBilgi.hesapSilindi ? colors.danger : colors.success}
            />
            <Text style={[styles.durumText, {
              color: kullaniciBilgi.hesapSilindi ? colors.danger : colors.success,
            }]}>
              {kullaniciBilgi.hesapSilindi ? 'Pasif' : 'Aktif'}
            </Text>
            <TouchableOpacity
              style={[styles.toggleBtn, {
                backgroundColor: kullaniciBilgi.hesapSilindi ? colors.success : colors.danger,
                opacity: guncelleniyor ? 0.5 : 1,
              }]}
              onPress={aktiflikDegistir}
              disabled={guncelleniyor}
              activeOpacity={0.85}
            >
              <Text style={styles.toggleText}>
                {kullaniciBilgi.hesapSilindi ? 'Aktif Et' : 'Pasife Al'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Şifre Sıfırla butonu */}
        {kullaniciBilgi && !kullaniciBilgi.hesapSilindi && (
          <TouchableOpacity
            onPress={sifreModalAc}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 14,
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#f59e0b22', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="key" size={16} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Şifre Sıfırla</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                Yeni geçici şifre üret veya yaz
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Özet */}
        <View style={styles.ozetRow}>
          <Ozet sayi={aktif.length} label="Aktif" renk={colors.warning} colors={colors} />
          <Ozet sayi={tamamlanan.length} label="Tamamlanan" renk={colors.success} colors={colors} />
          <Ozet sayi={talepler.length} label="Toplam" renk={colors.primaryLight} colors={colors} />
        </View>

        {/* Gittiği lokasyonlar */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          📍 Gittiği Lokasyonlar ({lokasyonlar.length})
        </Text>
        {lokasyonlar.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Kayıtlı lokasyon yok.</Text>
        ) : (
          lokasyonlar.slice(0, 10).map((l) => (
            <View key={l.lokasyon} style={[styles.lokCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.primaryLight} />
              <Text style={[styles.lokAd, { color: colors.textPrimary }]} numberOfLines={1}>{l.lokasyon}</Text>
              <Text style={[styles.lokSayi, { color: colors.textMuted }]}>{l.sayi}×</Text>
            </View>
          ))
        )}

        {/* Üzerindeki stok */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>
            📦 Üzerindeki Stok ({uzerindeStok.length})
          </Text>
          {uzerindeStok.length > 5 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminPersonelStok', { kullaniciId, ad })}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Tümünü Gör</Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {uzerindeStok.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Bu personelde stok yok.</Text>
        ) : (
          uzerindeStok.slice(0, 5).map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.malzemeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('CihazDetay', { kalemId: s.id })}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.malzemeAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {s.marka ?? ''} {s.model ?? ''}
                </Text>
                <Text style={[styles.malzemeKodu, { color: colors.textFaded }]} numberOfLines={1}>
                  S/N: {s.seriNo ?? '—'}{s.stokKodu ? ` · ${s.stokKodu}` : ''}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textFaded} />
            </TouchableOpacity>
          ))
        )}

        {/* Kullanılan malzemeler */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
          🔧 Kullanılan Malzemeler ({malzemeler.length})
        </Text>
        {malzemeler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Kullanılan malzeme kaydı yok.</Text>
        ) : (
          malzemeler.slice(0, 20).map((m) => (
            <View key={m.stokKodu ?? m.stokAdi} style={[styles.malzemeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.malzemeAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.stokAdi ?? m.stokKodu}
                </Text>
                {!!m.stokKodu && (
                  <Text style={[styles.malzemeKodu, { color: colors.textFaded }]}>{m.stokKodu}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.malzemeMiktar, { color: colors.success }]}>
                  {m.toplamKullanilan}
                </Text>
                <Text style={[styles.malzemeBirim, { color: colors.textFaded }]}>{m.birim ?? ''}</Text>
              </View>
            </View>
          ))
        )}

        {/* Son servisler */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
          🗂️ Son Servisler ({talepler.length})
        </Text>
        {talepler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Atanmış servis yok.</Text>
        ) : (
          talepler.slice(0, 15).map((t) => {
            const d = durumBul(t.durum)
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.servisCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate('ServisDetay', { id: t.id })}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.talepNo, { color: colors.primaryLight }]}>
                    {t.talepNo ?? `#${t.id}`}
                  </Text>
                  {d && (
                    <View style={[styles.chip, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                      <Text style={[styles.chipText, { color: d.renk }]}>{d.ikon} {d.isim}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.firma, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t.firmaAdi ?? '—'}
                </Text>
                {!!t.konu && (
                  <Text style={[styles.konu, { color: colors.textMuted }]} numberOfLines={1}>
                    {t.konu}
                  </Text>
                )}
                <Text style={[styles.tarih, { color: colors.textFaded }]}>
                  {tarihSaatFormat(t.olusturmaTarihi)}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Şifre Sıfırla Modal */}
      <Modal visible={sifreModalAcik} animationType="slide" transparent onRequestClose={() => setSifreModalAcik(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ padding: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: colors.surface, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>Şifre Sıfırla</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {kullaniciBilgi?.ad} için yeni şifre belirle.
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 16, letterSpacing: 0.5 }}>YENİ ŞİFRE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput
                value={yeniSifre}
                onChangeText={setYeniSifre}
                placeholder="En az 6 karakter"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceDark,
                }}
              />
              <TouchableOpacity
                onPress={() => setYeniSifre(geciciSifreUret(8))}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceDark,
                  justifyContent: 'center',
                }}
              >
                <Feather name="refresh-cw" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
              ⚠ Yeni şifreyi kullanıcıya iletmen gerekecek. Kayıtsız bir yere not alma.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => setSifreModalAcik(false)}
                activeOpacity={0.8}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sifreyiSifirla}
                activeOpacity={0.8}
                disabled={sifreKaydediliyor}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, backgroundColor: '#f59e0b', borderColor: '#f59e0b', alignItems: 'center', opacity: sifreKaydediliyor ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {sifreKaydediliyor ? 'Sıfırlanıyor…' : 'Sıfırla'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

function Ozet({ sayi, label, renk, colors }) {
  return (
    <View style={[styles.ozetKart, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: renk }]}>
      <Text style={[styles.ozetSayi, { color: renk }]}>{sayi}</Text>
      <Text style={[styles.ozetLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  durumBlok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  durumText: { fontSize: 14, fontWeight: '800', flex: 1 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  ozetRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  ozetKart: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
  },
  ozetSayi: { fontSize: 22, fontWeight: '800' },
  ozetLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  bos: { fontStyle: 'italic', fontSize: 12 },

  lokCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  lokAd: { flex: 1, fontSize: 13, fontWeight: '600' },
  lokSayi: { fontSize: 12, fontWeight: '700' },

  malzemeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  malzemeAd: { fontSize: 14, fontWeight: '700' },
  malzemeKodu: { fontSize: 11, marginTop: 2 },
  malzemeMiktar: { fontSize: 17, fontWeight: '800' },
  malzemeBirim: { fontSize: 10, marginTop: 1 },

  servisCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  talepNo: { fontSize: 11, fontWeight: '700' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  firma: { fontSize: 14, fontWeight: '700' },
  konu: { fontSize: 12, marginTop: 2 },
  tarih: { fontSize: 10, marginTop: 6 },
})
