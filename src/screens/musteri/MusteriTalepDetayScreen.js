// Müşteri portalı — Talep Detayı (webdeki MusteriTalepDetay'ın mobil karşılığı).
// Müşteri dalında 'ServisDetay' adıyla kayıtlıdır: push bildirimi
// (/servis-talepleri/<id> → ServisDetay) böylece portal hesabında da doğru
// ekrana düşer. Yazma yolları RPC'lerledir (mig 311 not + 319 onay/değerlendirme)
// — müşteride servis_talepleri UPDATE politikası YOK.
import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Alert, Linking, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../../components/ScreenContainer'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  talepDetayGetir, talepNotEkle, talepOnayVer, talepDegerlendir, talepEkLinkiAl,
} from '../../services/portalService'
import { turBul, aciliyetBul, durumBul } from '../../utils/servisConstants'
import { tarihSaatFormat } from '../../utils/format'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/LoadingState'

const YOL_ASAMALARI = [
  { id: 'bekliyor', isim: 'Bekliyor' },
  { id: 'inceleniyor', isim: 'İnceleniyor' },
  { id: 'atandi', isim: 'Atandı' },
  { id: 'devam_ediyor', isim: 'Devam ediyor' },
  { id: 'tamamlandi', isim: 'Tamamlandı' },
]

export default function MusteriTalepDetayScreen({ route }) {
  const id = route?.params?.id
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [talep, setTalep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hata, setHata] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [yeniNot, setYeniNot] = useState('')
  const [notGonderiliyor, setNotGonderiliyor] = useState(false)
  const [onayIsleniyor, setOnayIsleniyor] = useState(false)
  const [degPuan, setDegPuan] = useState(0)
  const [degYorum, setDegYorum] = useState('')
  const [degKaydediliyor, setDegKaydediliyor] = useState(false)
  const [gecmisAcik, setGecmisAcik] = useState(false)

  const yukle = useCallback(async () => {
    if (!id) return
    try {
      const veri = await talepDetayGetir(id)
      setTalep(veri)
      setHata(null)
    } catch (e) {
      console.warn('[musteri talep detay]', e?.message)
      setHata(e?.message || 'Talep yüklenemedi')
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      yukle().finally(() => setLoading(false))
    }, [yukle])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const notGonder = async () => {
    const metin = yeniNot.trim()
    if (!metin || notGonderiliyor) return
    setNotGonderiliyor(true)
    try {
      const yeni = await talepNotEkle(talep.id, metin)
      // Hata olursa metin KUTUDA KALIR (18.08 web dersi) — sessiz kayıp yok
      setTalep((t) => ({ ...t, notlar: [...(t?.notlar || []), yeni] }))
      setYeniNot('')
    } catch (e) {
      Alert.alert('Gönderilemedi', e?.message || 'Mesaj kaydedilemedi, tekrar deneyin.')
    } finally {
      setNotGonderiliyor(false)
    }
  }

  const onayVer = async (onay) => {
    if (onayIsleniyor) return
    setOnayIsleniyor(true)
    try {
      await talepOnayVer(talep.id, onay)
      // ⚠️ musteri_onay BOOLEAN (mig 320): null=sorulmadı, true=onaylandı,
      // false=başlangıç/ret (ret ayrımı durumdan okunur).
      setTalep((t) => ({
        ...t,
        musteriOnay: onay,
        durum: onay ? t.durum : 'devam_ediyor',
      }))
      if (!onay) {
        Alert.alert('Bildirim alındı', 'Ekibimiz sorunla ilgilenmeye devam edecek.')
      }
    } catch (e) {
      Alert.alert('Kaydedilemedi', e?.message || 'İşlem tamamlanamadı, tekrar deneyin.')
    } finally {
      setOnayIsleniyor(false)
    }
  }

  const degerlendir = async () => {
    if (!degPuan || degKaydediliyor) return
    setDegKaydediliyor(true)
    try {
      await talepDegerlendir(talep.id, degPuan, degYorum.trim())
      setTalep((t) => ({ ...t, degerlendirmePuan: degPuan, degerlendirmeYorum: degYorum.trim() || null }))
    } catch (e) {
      Alert.alert('Kaydedilemedi', e?.message || 'Değerlendirme gönderilemedi.')
    } finally {
      setDegKaydediliyor(false)
    }
  }

  // Ek dosyası: web şeması path (private bucket → imzalı link), mobil şeması url
  const ekAc = async (dosya) => {
    try {
      const link = dosya?.path
        ? await talepEkLinkiAl(dosya.path)
        : (dosya?.url || null)
      if (!link) throw new Error('Dosya adresi bulunamadı.')
      await Linking.openURL(link)
    } catch (e) {
      Alert.alert('Açılamadı', e?.message || 'Dosya açılamadı.')
    }
  }

  if (loading) return <ScreenContainer><LoadingState /></ScreenContainer>
  if (hata || !talep) {
    return (
      <ScreenContainer>
        <View style={{ paddingTop: 40 }}>
          <EmptyState
            ikon="alert-triangle"
            baslik="Talep yüklenemedi"
            mesaj={hata || 'Talep bulunamadı ya da erişim yetkiniz yok.'}
          />
        </View>
      </ScreenContainer>
    )
  }

  const tur = turBul(talep.anaTur)
  const durum = durumBul(talep.durum)
  const aciliyet = aciliyetBul(talep.aciliyet)
  const kapali = ['tamamlandi', 'onaylandi', 'iptal'].includes((talep.durum || '').toLowerCase())
  const aktifIdx = YOL_ASAMALARI.findIndex((y) => y.id === talep.durum)
  const notlar = talep.notlar || []
  const dosyalar = talep.dosyalar || []
  const gecmis = talep.durumGecmisi || []

  const bilgiler = [
    talep.lokasyon && { ikon: 'map-pin', etiket: 'Lokasyon', deger: talep.lokasyon },
    talep.cihazTuru && { ikon: 'monitor', etiket: 'Cihaz / sistem', deger: talep.cihazTuru },
    talep.atananKullaniciAd && { ikon: 'user', etiket: 'Atanan ekip', deger: talep.atananKullaniciAd },
    talep.planliTarih && { ikon: 'calendar', etiket: 'Planlı tarih', deger: tarihSaatFormat(talep.planliTarih) },
    talep.ilgiliKisi && { ikon: 'user-check', etiket: 'İlgili kişi', deger: talep.ilgiliKisi },
    talep.telefon && { ikon: 'phone', etiket: 'Telefon', deger: talep.telefon },
  ].filter(Boolean)

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
      >
        {/* Üst blok */}
        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rozetSatir}>
            <Text style={[styles.talepNo, { color: colors.textFaded }]}>
              {tur?.ikon} {talep.talepNo ?? `#${talep.id}`}
            </Text>
            {durum && <Text style={[styles.rozet, { color: durum.renk }]}>{durum.ikon} {durum.isim}</Text>}
            {aciliyet && <Text style={[styles.rozet, { color: aciliyet.renk }]}>{aciliyet.ikon} {aciliyet.isim}</Text>}
          </View>
          <Text style={[styles.konu, { color: colors.textPrimary }]}>{talep.konu || '—'}</Text>
          <Text style={[styles.tarih, { color: colors.textFaded }]}>{tarihSaatFormat(talep.olusturmaTarihi)}</Text>

          {/* Durum ilerlemesi */}
          {talep.durum !== 'iptal' && aktifIdx >= 0 && (
            <View style={styles.yolSatir}>
              {YOL_ASAMALARI.map((y, i) => (
                <View key={y.id} style={styles.yolAdim}>
                  <View
                    style={[
                      styles.yolNokta,
                      {
                        backgroundColor: i <= aktifIdx ? colors.primary : colors.surfaceDark,
                        borderColor: i <= aktifIdx ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {i < aktifIdx && <Feather name="check" size={9} color="#fff" />}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.yolEtiket,
                      { color: i === aktifIdx ? colors.primary : colors.textFaded },
                      i === aktifIdx && { fontWeight: '800' },
                    ]}
                  >
                    {y.isim}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bilgiler */}
        {bilgiler.length > 0 && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {bilgiler.map((b, i) => (
              <View key={b.etiket} style={[styles.bilgiSatir, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Feather name={b.ikon} size={14} color={colors.textMuted} />
                <Text style={[styles.bilgiEtiket, { color: colors.textMuted }]}>{b.etiket}</Text>
                <Text style={[styles.bilgiDeger, { color: colors.textPrimary }]} numberOfLines={2}>{b.deger}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Açıklama */}
        {!!talep.aciklama && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>AÇIKLAMA</Text>
            <Text style={[styles.aciklama, { color: colors.textSecondary }]}>{talep.aciklama}</Text>
          </View>
        )}

        {/* Ekler */}
        {dosyalar.length > 0 && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>EKLER ({dosyalar.length})</Text>
            {dosyalar.map((d, i) => (
              <TouchableOpacity
                key={`${d.path || d.url || i}`}
                style={[styles.ekSatir, { borderColor: colors.border }]}
                onPress={() => ekAc(d)}
                activeOpacity={0.7}
              >
                <Feather
                  name={(d.type || d.tip || '').startsWith('video') ? 'film' : 'image'}
                  size={15}
                  color={colors.primary}
                />
                <Text style={[styles.ekAd, { color: colors.textPrimary }]} numberOfLines={1}>
                  {d.name || d.ad || 'Dosya'}
                </Text>
                <Feather name="external-link" size={14} color={colors.textFaded} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Müşteri onayı — iş tamamlandığında */}
        {/* musteri_onay == null → onay hiç sorulmamış (personel açılışlı
            taleplerde false başlar; onlara onay sorusu gösterilmez — web ile aynı) */}
        {talep.durum === 'tamamlandi' && talep.musteriOnay == null && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.bolumBaslik, { color: colors.primary }]}>İŞ TAMAMLANDI — ONAYINIZ GEREKİYOR</Text>
            <Text style={[styles.aciklama, { color: colors.textSecondary, marginBottom: 12 }]}>
              Ekibimiz işlemi tamamladı. Çözümden memnun musunuz?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.onayButon, { backgroundColor: colors.success }]}
                onPress={() => onayVer(true)}
                disabled={onayIsleniyor}
                activeOpacity={0.85}
              >
                <Feather name="thumbs-up" size={15} color="#fff" />
                <Text style={styles.onayButonText}>Çözümü onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.onayButon, { backgroundColor: colors.danger }]}
                onPress={() => onayVer(false)}
                disabled={onayIsleniyor}
                activeOpacity={0.85}
              >
                <Feather name="thumbs-down" size={15} color="#fff" />
                <Text style={styles.onayButonText}>Sorun devam ediyor</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Değerlendirme — onay sonrası */}
        {talep.musteriOnay === true && !talep.degerlendirmePuan && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>HİZMETİ DEĞERLENDİRİN</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((p) => (
                <TouchableOpacity key={p} onPress={() => setDegPuan(p)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                  <Feather
                    name="star"
                    size={28}
                    color={p <= degPuan ? colors.warning : colors.textDim}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.yorumKutu, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
              placeholder="Yorumunuz (isteğe bağlı)…"
              placeholderTextColor={colors.textMuted}
              value={degYorum}
              onChangeText={setDegYorum}
              multiline
            />
            <TouchableOpacity
              style={[styles.gonderButon, { backgroundColor: degPuan ? colors.primary : colors.surfaceDark }]}
              onPress={degerlendir}
              disabled={!degPuan || degKaydediliyor}
              activeOpacity={0.85}
            >
              <Text style={[styles.onayButonText, !degPuan && { color: colors.textFaded }]}>
                {degKaydediliyor ? 'Kaydediliyor…' : 'Değerlendirmeyi gönder'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {!!talep.degerlendirmePuan && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>DEĞERLENDİRMENİZ</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((p) => (
                <Feather key={p} name="star" size={18} color={p <= talep.degerlendirmePuan ? colors.warning : colors.textDim} />
              ))}
            </View>
            {!!talep.degerlendirmeYorum && (
              <Text style={[styles.aciklama, { color: colors.textSecondary, marginTop: 6 }]}>{talep.degerlendirmeYorum}</Text>
            )}
          </View>
        )}

        {/* Yazışmalar */}
        <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bolumBaslik, { color: colors.textMuted }]}>
            YAZIŞMALAR{notlar.length > 0 ? ` (${notlar.length})` : ''}
          </Text>
          {notlar.length === 0 ? (
            <Text style={[styles.aciklama, { color: colors.textFaded }]}>
              Henüz yazışma yok. Sorunuzu aşağıdan iletebilirsiniz.
            </Text>
          ) : (
            notlar.map((not, i) => {
              const benim = not.kullaniciId === kullanici?.id
              // Ekip içi notlar müşteriye "ZNA Ekibi" olarak görünür (web ile aynı)
              const ekip = not.tip === 'ic' && !benim
              return (
                <View
                  key={not.id || i}
                  style={[
                    styles.balon,
                    benim
                      ? { backgroundColor: colors.primary, alignSelf: 'flex-end' }
                      : { backgroundColor: colors.surfaceDark, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.balonAd, { color: benim ? 'rgba(255,255,255,0.8)' : ekip ? colors.success : colors.textMuted }]}>
                    {ekip ? '🛡️ ZNA Ekibi' : (not.kullaniciAd || not.kullanici || '—')}
                  </Text>
                  <Text style={[styles.balonMetin, { color: benim ? '#fff' : colors.textPrimary }]}>
                    {not.metin}
                  </Text>
                  <Text style={[styles.balonTarih, { color: benim ? 'rgba(255,255,255,0.6)' : colors.textFaded }]}>
                    {tarihSaatFormat(not.tarih)}
                  </Text>
                </View>
              )
            })
          )}

          {!kapali && (
            <View style={[styles.notSatir, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.notInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
                placeholder="Not veya soru yazın…"
                placeholderTextColor={colors.textMuted}
                value={yeniNot}
                onChangeText={setYeniNot}
                multiline
              />
              <TouchableOpacity
                style={[styles.notGonder, { backgroundColor: yeniNot.trim() ? colors.primary : colors.surfaceDark }]}
                onPress={notGonder}
                disabled={!yeniNot.trim() || notGonderiliyor}
                activeOpacity={0.85}
              >
                <Feather name="send" size={16} color={yeniNot.trim() ? '#fff' : colors.textFaded} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Durum geçmişi (katlanır) */}
        {gecmis.length > 0 && (
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => setGecmisAcik((a) => !a)}
              activeOpacity={0.7}
            >
              <Text style={[styles.bolumBaslik, { color: colors.textMuted, marginBottom: 0 }]}>
                DURUM GEÇMİŞİ ({gecmis.length})
              </Text>
              <Feather name={gecmisAcik ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {gecmisAcik && [...gecmis].reverse().map((g, i) => {
              const d = durumBul(g.durum)
              return (
                <View key={i} style={[styles.gecmisSatir, { borderTopColor: colors.border }]}>
                  <Text style={[styles.gecmisDurum, { color: d?.renk || colors.textPrimary }]}>
                    {d ? `${d.ikon} ${d.isim}` : g.durum}
                  </Text>
                  {!!g.aciklama && (
                    <Text style={[styles.gecmisAciklama, { color: colors.textSecondary }]}>{g.aciklama}</Text>
                  )}
                  <Text style={[styles.gecmisTarih, { color: colors.textFaded }]}>
                    {[g.kullaniciAd || g.kullanici, tarihSaatFormat(g.tarih)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  kart: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  rozetSatir: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  talepNo: { fontSize: 12, fontWeight: '800' },
  rozet: { fontSize: 11.5, fontWeight: '700' },
  konu: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  tarih: { fontSize: 11.5, marginTop: 3 },

  yolSatir: { flexDirection: 'row', marginTop: 14, gap: 2 },
  yolAdim: { flex: 1, alignItems: 'center', gap: 4 },
  yolNokta: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  yolEtiket: { fontSize: 8.5, fontWeight: '600' },

  bilgiSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  bilgiEtiket: { fontSize: 12, fontWeight: '600', width: 92 },
  bilgiDeger: { fontSize: 13, fontWeight: '600', flex: 1 },

  bolumBaslik: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  aciklama: { fontSize: 13.5, lineHeight: 20 },

  ekSatir: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 9, paddingHorizontal: 10,
    borderWidth: 1, borderRadius: 9, marginBottom: 6,
  },
  ekAd: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  onayButon: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  onayButonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  yorumKutu: {
    borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 60,
    fontSize: 13.5, textAlignVertical: 'top', marginBottom: 10,
  },
  gonderButon: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },

  balon: { maxWidth: '85%', borderRadius: 12, padding: 10, marginBottom: 8 },
  balonAd: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  balonMetin: { fontSize: 13.5, lineHeight: 19 },
  balonTarih: { fontSize: 10, marginTop: 4 },

  notSatir: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderTopWidth: 1, paddingTop: 10, marginTop: 4,
  },
  notInput: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10,
    paddingVertical: 8, fontSize: 13.5, maxHeight: 90,
  },
  notGonder: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  gecmisSatir: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  gecmisDurum: { fontSize: 12.5, fontWeight: '700' },
  gecmisAciklama: { fontSize: 12.5, marginTop: 2 },
  gecmisTarih: { fontSize: 11, marginTop: 2 },
})
