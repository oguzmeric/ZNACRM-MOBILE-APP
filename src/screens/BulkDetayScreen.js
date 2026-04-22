import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  stokUrunGetir,
  stokKoduHareketleriniGetir,
  bulkHareketEkle,
} from '../services/stokUrunService'
import { musterileriGetir } from '../services/musteriService'
import { tarihSaatFormat } from '../utils/format'
import { sayimYapabilir } from '../utils/yetki'

const ISLEMLER_BASE = [
  { id: 'giris', label: '➕ Giriş', renk: '#22c55e', aciklamaPlaceholder: 'Yeni stok geldi, tedarikçi...' },
  { id: 'cikis', label: '➖ Çıkış', renk: '#ef4444', aciklamaPlaceholder: 'Şantiyede kullanıldı, satıldı...' },
  { id: 'sayim', label: '✓ Sayım', renk: '#3b82f6', aciklamaPlaceholder: 'Sayım sonrası gerçek miktar...', yetkili: true },
]

export default function BulkDetayScreen({ route, navigation }) {
  const { stokKodu } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [urun, setUrun] = useState(null)
  const [hareketler, setHareketler] = useState([])
  const [loading, setLoading] = useState(true)
  const [aktifIslem, setAktifIslem] = useState(null) // 'giris' | 'cikis' | 'sayim' | null

  // Sayım yetkisi olmayanlar için butonu gizle
  const islemler = useMemo(() => {
    return ISLEMLER_BASE.filter((i) => !i.yetkili || sayimYapabilir(kullanici))
  }, [kullanici])

  useEffect(() => {
    navigation.setOptions({ title: stokKodu })
  }, [navigation, stokKodu])

  const yukle = useCallback(async () => {
    const [u, h] = await Promise.all([
      stokUrunGetir(stokKodu),
      stokKoduHareketleriniGetir(stokKodu),
    ])
    setUrun(u)
    setHareketler(h ?? [])
    setLoading(false)
  }, [stokKodu])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!urun) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted }}>Ürün bulunamadı.</Text>
      </View>
    )
  }

  const minStokAlti = urun.minStok != null && Number(urun.stokMiktari) < Number(urun.minStok)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.stokAdi, { color: colors.textPrimary }]}>{urun.stokAdi}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.kod}>{urun.stokKodu}</Text>
          {!!urun.marka && <Text style={[styles.marka, { color: colors.textMuted }]}>{urun.marka}</Text>}
        </View>

        {/* Büyük miktar göstergesi */}
        <View style={[styles.miktarKart, { backgroundColor: colors.surface }, minStokAlti && styles.miktarKartUyari]}>
          <Text style={[styles.miktarSayi, minStokAlti && { color: '#ef4444' }]}>
            {urun.stokMiktari ?? 0}
          </Text>
          <Text style={[styles.miktarBirim, { color: colors.textMuted }]}>{urun.birim ?? 'Adet'}</Text>
          {minStokAlti && (
            <Text style={styles.uyariText}>⚠️ Min stok altında: {urun.minStok}</Text>
          )}
        </View>

        {/* Aksiyonlar */}
        <View style={styles.islemRow}>
          {islemler.map((i) => (
            <TouchableOpacity
              key={i.id}
              style={[styles.islemBtn, { backgroundColor: i.renk }]}
              onPress={() => setAktifIslem(i.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.islemBtnText}>{i.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bilgi */}
        {!!urun.aciklama && (
          <View style={[styles.aciklamaBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.aciklamaLabel, { color: colors.textFaded }]}>Açıklama</Text>
            <Text style={[styles.aciklamaText, { color: colors.textSecondary }]}>{urun.aciklama}</Text>
          </View>
        )}

        {/* Geçmiş */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Geçmiş ({hareketler.length})</Text>
        {hareketler.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz hareket yok.</Text>
        ) : (
          hareketler.map((h, i) => {
            const isim = h.hareketTipi === 'giris' ? 'GİRİŞ'
              : h.hareketTipi === 'cikis' ? 'ÇIKIŞ'
              : 'SAYIM'
            const renk = h.hareketTipi === 'giris' ? '#22c55e'
              : h.hareketTipi === 'cikis' ? '#ef4444'
              : '#3b82f6'
            const isaret = h.hareketTipi === 'giris' ? '+' : h.hareketTipi === 'cikis' ? '−' : '='
            return (
              <View key={i} style={[styles.hareketCard, { backgroundColor: colors.surface, borderLeftColor: renk }]}>
                <View style={styles.hareketHeader}>
                  <Text style={[styles.hareketTip, { color: renk }]}>{isim}</Text>
                  <Text style={[styles.hareketMiktar, { color: renk }]}>
                    {isaret}{h.miktar} {urun.birim ?? ''}
                  </Text>
                </View>
                {!!h.aciklama && <Text style={[styles.hareketAciklama, { color: colors.textSecondary }]}>{h.aciklama}</Text>}
                <Text style={[styles.hareketMeta, { color: colors.textFaded }]}>
                  {h.kullaniciAd ?? '—'} · {tarihSaatFormat(h.tarih)}
                  {h.oncekiMiktar != null && ` · ${h.oncekiMiktar} → ${h.sonrakiMiktar}`}
                </Text>
              </View>
            )
          })
        )}
      </ScrollView>

      <IslemModal
        visible={!!aktifIslem}
        islem={ISLEMLER_BASE.find((i) => i.id === aktifIslem)}
        urun={urun}
        kullanici={kullanici}
        onClose={() => setAktifIslem(null)}
        onDone={() => {
          setAktifIslem(null)
          yukle()
        }}
      />
    </View>
  )
}

function IslemModal({ visible, islem, urun, kullanici, onClose, onDone }) {
  const { colors } = useTheme()
  const [miktar, setMiktar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [musteri, setMusteri] = useState(null)
  const [musteriler, setMusteriler] = useState([])
  const [musteriPickerOpen, setMusteriPickerOpen] = useState(false)
  const [musteriArama, setMusteriArama] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (visible) {
      setMiktar('')
      setAciklama('')
      setMusteri(null)
      setMusteriArama('')
      // Sadece çıkışta müşteri seçimi anlamlı, ama erkenden yükleyelim
      if (islem?.id === 'cikis' && musteriler.length === 0) {
        musterileriGetir().then((l) => setMusteriler(l ?? []))
      }
    }
  }, [visible, islem])

  const filtrelenmisMusteriler = useMemo(() => {
    if (!musteriArama.trim()) return musteriler
    const q = musteriArama.toLowerCase()
    return musteriler.filter((m) =>
      [m.firma, m.ad, m.soyad, m.telefon, m.kod]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    )
  }, [musteriler, musteriArama])

  if (!islem) return null

  const onayla = async () => {
    const sayi = parseFloat(String(miktar).replace(',', '.'))
    if (isNaN(sayi) || sayi < 0) {
      Alert.alert('Hatalı miktar', 'Geçerli bir sayı gir.')
      return
    }
    if (islem.id !== 'sayim' && sayi <= 0) {
      Alert.alert('Hatalı miktar', '0\'dan büyük olmalı.')
      return
    }

    // Çıkışta mevcut stoktan fazla mı?
    if (islem.id === 'cikis' && sayi > Number(urun.stokMiktari ?? 0)) {
      Alert.alert(
        'Yetersiz stok',
        `Mevcut: ${urun.stokMiktari} ${urun.birim ?? ''}\nÇıkış istenen: ${sayi}\n\nYine de çıkış yapılsın mı? (stok eksiye düşer)`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Devam Et', onPress: () => kaydet(sayi) },
        ]
      )
      return
    }

    kaydet(sayi)
  }

  const kaydet = async (sayi) => {
    setKaydediliyor(true)

    const musteriAdi = musteri
      ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim())
      : null

    const sonuc = await bulkHareketEkle({
      stokKodu: urun.stokKodu,
      hareketTipi: islem.id,
      miktar: sayi,
      aciklama: aciklama.trim() || null,
      kullaniciAd: kullanici?.ad,
      musteriAdi,
    })

    setKaydediliyor(false)

    if (!sonuc) {
      Alert.alert('Hata', 'İşlem kaydedilemedi.')
      return
    }
    onDone()
  }

  const baslik = islem.id === 'giris' ? 'Stok Girişi'
    : islem.id === 'cikis' ? 'Stok Çıkışı'
    : 'Sayım Güncelle'

  const miktarLabel = islem.id === 'sayim'
    ? `Yeni mevcut miktar (mutlak)`
    : `Miktar (${islem.id === 'giris' ? 'eklenecek' : 'düşülecek'})`

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalBg}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{baslik}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={[styles.modalUrunAd, { color: colors.textPrimary }]}>{urun.stokAdi}</Text>
            <Text style={[styles.modalMevcut, { color: colors.textMuted }]}>
              Mevcut: {urun.stokMiktari ?? 0} {urun.birim ?? ''}
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>{miktarLabel}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={miktar}
              onChangeText={setMiktar}
              keyboardType="numeric"
              placeholder="Sayı"
              placeholderTextColor={colors.textFaded}
              autoFocus
            />

            {islem.id === 'cikis' && (
              <>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Müşteri / Saha (opsiyonel)</Text>
                <View style={styles.pickerRow}>
                  <TouchableOpacity
                    style={[styles.modalInput, { flex: 1, backgroundColor: colors.surface }]}
                    onPress={() => setMusteriPickerOpen(true)}
                  >
                    <Text style={{ color: musteri ? colors.textPrimary : colors.textFaded }} numberOfLines={1}>
                      {musteri
                        ? (musteri.firma || `${musteri.ad ?? ''} ${musteri.soyad ?? ''}`.trim())
                        : 'Müşteri seç (kim için kullanıldı?)'}
                    </Text>
                  </TouchableOpacity>
                  {!!musteri && (
                    <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => setMusteri(null)}>
                      <Text style={styles.clearText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Açıklama</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top', backgroundColor: colors.surface, color: colors.textPrimary }]}
              value={aciklama}
              onChangeText={setAciklama}
              multiline
              placeholder={islem.aciklamaPlaceholder}
              placeholderTextColor={colors.textFaded}
            />

            <TouchableOpacity
              style={[styles.onayBtn, { backgroundColor: islem.renk }, kaydediliyor && { opacity: 0.6 }]}
              onPress={onayla}
              disabled={kaydediliyor}
            >
              <Text style={styles.onayText}>
                {kaydediliyor ? 'Kaydediliyor...' : `Onayla — ${islem.label}`}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Modal visible={musteriPickerOpen} transparent animationType="fade">
            <View style={styles.modalBg}>
              <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.surface }]}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Müşteri Seç</Text>
                  <TouchableOpacity onPress={() => setMusteriPickerOpen(false)}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>Kapat</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                    placeholder="Ara..."
                    placeholderTextColor={colors.textFaded}
                    value={musteriArama}
                    onChangeText={setMusteriArama}
                    autoCapitalize="none"
                  />
                </View>
                <FlatList
                  data={filtrelenmisMusteriler}
                  keyExtractor={(m) => String(m.id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, { borderBottomColor: colors.surface }]}
                      onPress={() => {
                        setMusteri(item)
                        setMusteriPickerOpen(false)
                        setMusteriArama('')
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                        {item.firma || `${item.ad} ${item.soyad}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  stokAdi: { color: '#fff', fontSize: 22, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  kod: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  marka: { color: '#94a3b8', fontSize: 13 },

  miktarKart: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  miktarKartUyari: { borderLeftColor: '#ef4444' },
  miktarSayi: { color: '#22c55e', fontSize: 48, fontWeight: '900' },
  miktarBirim: { color: '#94a3b8', fontSize: 18, marginTop: 4 },
  uyariText: { color: '#ef4444', fontSize: 13, fontWeight: '700', marginTop: 8 },

  islemRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  islemBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  islemBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  aciklamaBox: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  aciklamaLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  aciklamaText: { color: '#e2e8f0', fontSize: 14 },

  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 8 },

  hareketCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  hareketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hareketTip: { fontSize: 13, fontWeight: '700' },
  hareketMiktar: { fontSize: 16, fontWeight: '800' },
  hareketAciklama: { color: '#cbd5e1', fontSize: 13, marginTop: 4 },
  hareketMeta: { color: '#64748b', fontSize: 11, marginTop: 6 },

  bos: { color: '#64748b', fontStyle: 'italic' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalUrunAd: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalMevcut: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  modalLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#1e293b',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    backgroundColor: '#1e293b',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearText: { color: '#ef4444', fontSize: 22, fontWeight: '700' },

  onayBtn: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  onayText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
})
