import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import ScreenContainer from '../components/ScreenContainer'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { gorusmeGetir, gorusmeGuncelle } from '../services/gorusmeService'
import { musterileriGetir } from '../services/musteriService'

const trIcerir = (haystack, q) => {
  if (!q) return true
  const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/i̇/g, 'i')
  return norm(haystack).includes(norm(q))
}

const DURUM_ETIKET = {
  acik: 'Açık',
  beklemede: 'Beklemede',
  kapali: 'Kapalı',
  tamamlandi: 'Tamamlandı',
  planlandi: 'Planlandı',
}
const DURUMLAR = ['acik', 'beklemede', 'kapali']
const IRTIBAT_SEKILLERI = ['Telefon', 'WhatsApp', 'E-posta', 'Yüz yüze', 'Video görüşme', 'Mesaj', 'Link']

export default function GorusmeDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { colors } = useTheme()
  const { kullanicilar } = useAuth()
  const [g, setG] = useState(null)
  const [loading, setLoading] = useState(true)
  const [duzenleAcik, setDuzenleAcik] = useState(false)
  const [form, setForm] = useState(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [musteriler, setMusteriler] = useState([])
  const [firmaOneriGoster, setFirmaOneriGoster] = useState(false)

  useEffect(() => {
    musterileriGetir().then((v) => setMusteriler(v ?? [])).catch(() => setMusteriler([]))
  }, [])

  const firmaOneriler = useMemo(() => {
    if (!form?.firmaAdi) return musteriler.slice(0, 20)
    return musteriler
      .filter((m) => trIcerir(`${m.firma || ''} ${m.ad || ''} ${m.soyad || ''}`, form.firmaAdi))
      .slice(0, 20)
  }, [musteriler, form?.firmaAdi])

  const yukle = useCallback(async () => {
    const veri = await gorusmeGetir(id)
    setG(veri)
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const duzenleAc = () => {
    setForm({
      firmaAdi: g.firmaAdi || '',
      musteriId: g.musteriId || null,
      konu: g.konu || '',
      muhatapAd: g.muhatapAd || '',
      gorusen: g.gorusen || '',
      irtibatSekli: g.irtibatSekli || '',
      tarih: g.tarih || '',
      durum: g.durum || 'acik',
      takipNotu: g.takipNotu ?? g.notlar ?? '',
    })
    setFirmaOneriGoster(false)
    setDuzenleAcik(true)
  }

  const firmaSec = (m) => {
    setForm({
      ...form,
      firmaAdi: m.firma || '',
      musteriId: m.id,
      muhatapAd: form.muhatapAd || (m.ad && m.soyad ? `${m.ad} ${m.soyad}` : ''),
    })
    setFirmaOneriGoster(false)
  }

  const duzenleIptal = () => { setDuzenleAcik(false); setForm(null) }

  const duzenleKaydet = async () => {
    if (!form.konu?.trim()) {
      Alert.alert('Eksik bilgi', 'Konu zorunludur.')
      return
    }
    setKaydediliyor(true)
    try {
      const guncellenen = await gorusmeGuncelle(id, {
        firmaAdi: (form.firmaAdi || '').trim() || null,
        musteriId: form.musteriId || null,
        konu: form.konu.trim(),
        muhatapAd: (form.muhatapAd || '').trim(),
        gorusen: form.gorusen || '',
        irtibatSekli: form.irtibatSekli || null,
        tarih: form.tarih || null,
        durum: form.durum,
        takipNotu: form.takipNotu || null,
      })
      if (!guncellenen) {
        Alert.alert('Hata', 'Güncelleme başarısız oldu.')
        return
      }
      setG(guncellenen)
      setDuzenleAcik(false)
      setForm(null)
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Güncellenemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  const toggleGorusen = (ad) => {
    const list = (form.gorusen || '').split(',').map(x => x.trim()).filter(Boolean)
    const yeni = list.includes(ad) ? list.filter(x => x !== ad) : [...list, ad]
    setForm({ ...form, gorusen: yeni.join(', ') })
  }

  if (loading) {
    return <ScreenContainer><ActivityIndicator color={colors.textPrimary} style={{ marginTop: 32 }} /></ScreenContainer>
  }

  if (!g) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textMuted, padding: 24, textAlign: 'center' }}>
          Görüşme bulunamadı.
        </Text>
      </ScreenContainer>
    )
  }

  const gorusenList = (g.gorusen || '').split(',').map(s => s.trim()).filter(Boolean)
  const formGorusenList = form ? (form.gorusen || '').split(',').map(s => s.trim()).filter(Boolean) : []

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Başlık */}
          <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.firmaAd, { color: colors.textPrimary }]}>{g.firmaAdi || '—'}</Text>
                {!!g.musteriAdi && (
                  <Text style={[styles.alt, { color: colors.textMuted }]}>{g.musteriAdi}</Text>
                )}
              </View>
              {!duzenleAcik && (
                <TouchableOpacity
                  onPress={duzenleAc}
                  style={[styles.duzenleBtn, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={13} color={colors.textPrimary} />
                  <Text style={[styles.duzenleText, { color: colors.textPrimary }]}>Düzenle</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.rozetRow}>
              {!!g.konu && <Rozet renk={colors.primary} text={g.konu} />}
              {!!g.irtibatSekli && <Rozet renk={colors.info ?? '#06b6d4'} text={g.irtibatSekli} />}
              {!!g.durum && <Rozet renk={colors.warning ?? '#f59e0b'} text={DURUM_ETIKET[g.durum] ?? g.durum} />}
              {!!g.aktNo && <Rozet renk={colors.textMuted} text={g.aktNo} />}
            </View>
          </View>

          {duzenleAcik ? (
            /* DÜZENLEME FORMU */
            <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>FİRMA</Text>
              <TextInput
                value={form.firmaAdi}
                onChangeText={(t) => { setForm({ ...form, firmaAdi: t, musteriId: null }); setFirmaOneriGoster(true) }}
                onFocus={() => setFirmaOneriGoster(true)}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Müşteri seçmek için dokun veya yaz"
                placeholderTextColor={colors.textFaded}
              />
              {firmaOneriGoster && (
                <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {musteriler.length === 0 ? 'Yükleniyor…' : `${firmaOneriler.length} müşteri`}
                    </Text>
                    <TouchableOpacity onPress={() => setFirmaOneriGoster(false)} activeOpacity={0.7}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Kapat</Text>
                    </TouchableOpacity>
                  </View>
                  {firmaOneriler.length === 0 && musteriler.length > 0 ? (
                    <Text style={{ padding: 14, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                      Eşleşen müşteri yok. Yazılı olarak da kaydedebilirsin.
                    </Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {firmaOneriler.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => firmaSec(m)}
                          activeOpacity={0.7}
                          style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                            {m.firma || 'Firma yok'}
                          </Text>
                          {(m.ad || m.soyad) && (
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                              {[m.ad, m.soyad].filter(Boolean).join(' ')}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>KONU</Text>
              <TextInput
                value={form.konu}
                onChangeText={v => setForm({ ...form, konu: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Görüşme konusu"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>GÖRÜŞÜLEN KİŞİ</Text>
              <TextInput
                value={form.muhatapAd}
                onChangeText={v => setForm({ ...form, muhatapAd: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Karşı taraf"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>GÖRÜŞEN (bizden)</Text>
              {formGorusenList.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {formGorusenList.map(ad => (
                    <TouchableOpacity key={ad} onPress={() => toggleGorusen(ad)} style={styles.chipAktif}>
                      <Text style={styles.chipAktifText}>{ad} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(kullanicilar || []).filter(k => !formGorusenList.includes(k.ad)).map(k => (
                  <TouchableOpacity key={k.id} onPress={() => toggleGorusen(k.ad)} style={[styles.chipPasif, { borderColor: colors.border }]}>
                    <Text style={[styles.chipPasifText, { color: colors.textPrimary }]}>+ {k.ad}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>İRTİBAT ŞEKLİ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {IRTIBAT_SEKILLERI.map(s => {
                  const aktif = form.irtibatSekli === s
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setForm({ ...form, irtibatSekli: aktif ? '' : s })}
                      style={[aktif ? styles.chipAktif : styles.chipPasif, !aktif && { borderColor: colors.border }]}
                    >
                      <Text style={aktif ? styles.chipAktifText : [styles.chipPasifText, { color: colors.textPrimary }]}>{s}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>TARİH (YYYY-MM-DD)</Text>
              <TextInput
                value={form.tarih}
                onChangeText={v => setForm({ ...form, tarih: v })}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="2026-07-01"
                placeholderTextColor={colors.textFaded}
              />

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>DURUM</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DURUMLAR.map(d => {
                  const aktif = form.durum === d
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setForm({ ...form, durum: d })}
                      style={[aktif ? styles.chipAktif : styles.chipPasif, !aktif && { borderColor: colors.border }]}
                    >
                      <Text style={aktif ? styles.chipAktifText : [styles.chipPasifText, { color: colors.textPrimary }]}>{DURUM_ETIKET[d]}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>TAKİP NOTU</Text>
              <TextInput
                value={form.takipNotu}
                onChangeText={v => setForm({ ...form, takipNotu: v })}
                style={[styles.input, styles.textarea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Takip edilecek konular / notlar..."
                placeholderTextColor={colors.textFaded}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={duzenleKaydet}
                  disabled={kaydediliyor}
                  style={[styles.aksiyonBtn, { backgroundColor: colors.primary, flex: 1, marginTop: 0, opacity: kaydediliyor ? 0.6 : 1 }]}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.aksiyonText}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={duzenleIptal}
                  style={[styles.aksiyonBtnSecondary, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.aksiyonText, { color: colors.textPrimary }]}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Bilgiler */}
              <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Satir ikon="calendar" label="Tarih" value={g.tarih ? `${g.tarih}${g.saat ? ` · ${g.saat}` : ''}` : '—'} colors={colors} />
                {!!g.hazirlayan && (
                  <Satir ikon="user-plus" label="Hazırlayan" value={g.hazirlayan} colors={colors} />
                )}
                {gorusenList.length > 0 && (
                  <Satir ikon="users" label={`Görüşen (${gorusenList.length})`} value={gorusenList.join(', ')} colors={colors} />
                )}
                {!!g.muhatapAd && <Satir ikon="user" label="Görüşülen kişi" value={g.muhatapAd} colors={colors} />}
                {!!g.irtibatSekli && <Satir ikon="phone" label="İrtibat şekli" value={g.irtibatSekli} colors={colors} />}
                {!!g.aktNo && <Satir ikon="hash" label="Aktivite No" value={g.aktNo} colors={colors} />}
              </View>

              {/* Takip Notu */}
              {!!(g.takipNotu || g.notlar) && (
                <View style={[styles.kart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>TAKİP NOTU</Text>
                  <Text style={[styles.notlar, { color: colors.textPrimary }]} selectable>
                    {g.takipNotu || g.notlar}
                  </Text>
                </View>
              )}

              {/* Aksiyonlar */}
              <TouchableOpacity
                style={[styles.aksiyonBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('YeniGörev', {
                  baslangicGorusmeId: g.id,
                  baslangicMusteriId: g.musteriId,
                  baslangicLokasyonId: g.lokasyonId,
                  baslangicBaslik: g.konu ? `Görüşme: ${g.konu}` : '',
                  baslangicAciklama: [
                    g.firmaAdi && `Firma: ${g.firmaAdi}`,
                    g.tarih && `Görüşme tarihi: ${g.tarih}${g.saat ? ' ' + g.saat : ''}`,
                    (g.takipNotu || g.notlar) && `\nNotlar:\n${g.takipNotu || g.notlar}`,
                  ].filter(Boolean).join('\n'),
                })}
                activeOpacity={0.85}
              >
                <Feather name="check-square" size={18} color="#fff" />
                <Text style={styles.aksiyonText}>Bu Görüşmeden Görev Oluştur</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

function Rozet({ text, renk }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: renk + '22', marginRight: 6, marginBottom: 4 }}>
      <Text style={{ color: renk, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  )
}

function Satir({ ikon, label, value, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={ikon} size={14} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  kart: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  firmaAd: { fontSize: 18, fontWeight: '800' },
  alt: { fontSize: 12, marginTop: 4 },
  rozetRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  notlar: { fontSize: 13, lineHeight: 20 },
  duzenleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  duzenleText: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chipAktif: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  chipAktifText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  chipPasif: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  chipPasifText: { fontSize: 11, fontWeight: '500' },
  dropdown: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  aksiyonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  aksiyonBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  aksiyonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
