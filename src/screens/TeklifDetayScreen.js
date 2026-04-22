import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  teklifGetir,
  teklifDurumGuncelle,
  teklifSil,
  onayDurumuBul,
  ONAY_DURUMLARI,
  satirHesapla,
  teklifToplamHesapla,
} from '../services/teklifService'
import { tarihFormat, tarihSaatFormat } from '../utils/format'
import { paraFormat } from '../utils/paraFormat'

export default function TeklifDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [teklif, setTeklif] = useState(null)
  const [loading, setLoading] = useState(true)

  const yukle = useCallback(async () => {
    const t = await teklifGetir(id)
    setTeklif(t)
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const durumDegistir = async (yeni) => {
    if (yeni === teklif?.onayDurumu) return
    const guncel = await teklifDurumGuncelle(id, yeni)
    if (guncel) setTeklif(guncel)
    else Alert.alert('Hata', 'Durum güncellenemedi.')
  }

  const sil = () => {
    Alert.alert('Teklifi sil', 'Emin misin? Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await teklifSil(id)
          navigation.goBack()
        },
      },
    ])
  }

  const emailGonder = () => {
    // İleride: PDF üret + gönder; şimdilik standart mailto
    Alert.alert(
      'Email Gönderimi',
      'Email + PDF gönderimi yakında aktif olacak. Şimdilik teklifi özetleyerek standart mail ile gönderiyoruz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Mail Aç',
          onPress: () => {
            const konu = `Teklif ${teklif.teklifNo} - ${teklif.konu ?? ''}`
            const govde = `Sayın ${teklif.musteriYetkilisi ?? 'Yetkili'},\n\n` +
              `${teklif.firmaAdi} için hazırladığımız teklif:\n\n` +
              `Teklif No: ${teklif.teklifNo}\n` +
              `Konu: ${teklif.konu ?? '—'}\n` +
              `Tarih: ${tarihFormat(teklif.tarih)}\n` +
              `Geçerlilik: ${tarihFormat(teklif.gecerlilikTarihi)}\n\n` +
              `Genel Toplam: ${paraFormat(teklif.genelToplam, teklif.paraBirimi)}\n\n` +
              `Detayları ekte gönderdik. Sorularınız için bize ulaşabilirsiniz.\n\n` +
              `Saygılarımla,\n${teklif.hazirlayan ?? kullanici?.ad}`
            Linking.openURL(
              `mailto:?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`
            )
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      </ScreenContainer>
    )
  }

  if (!teklif) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Teklif bulunamadı.</Text>
        </View>
      </ScreenContainer>
    )
  }

  const durum = onayDurumuBul(teklif.onayDurumu)
  const satirlar = teklif.satirlar ?? []
  const toplam = teklifToplamHesapla(satirlar, teklif.genelIskonto ?? 0)

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Başlık */}
        <Text style={[styles.teklifNo, { color: colors.primaryLight }]}>
          {teklif.teklifNo}
          {teklif.revizyon > 0 && ` · Revizyon ${teklif.revizyon}`}
        </Text>

        {durum && (
          <View style={[styles.durumBadge, { backgroundColor: durum.renk + '22', borderColor: durum.renk }]}>
            <Text style={[styles.durumText, { color: durum.renk }]}>
              {durum.ikon} {durum.isim}
            </Text>
          </View>
        )}

        <Text style={[styles.firma, { color: colors.textPrimary }]}>{teklif.firmaAdi}</Text>
        {!!teklif.konu && (
          <View style={[styles.konuBox, { backgroundColor: colors.surface, borderLeftColor: colors.info }]}>
            <Text style={[styles.konu, { color: colors.textPrimary }]}>{teklif.konu}</Text>
          </View>
        )}

        {/* Meta bilgiler */}
        <View style={styles.row2}>
          <Field label="Tarih" deger={tarihFormat(teklif.tarih)} flex colors={colors} />
          <Field label="Geçerlilik" deger={tarihFormat(teklif.gecerlilikTarihi)} flex colors={colors} />
        </View>
        <View style={styles.row2}>
          <Field label="Yetkili" deger={teklif.musteriYetkilisi} flex colors={colors} />
          <Field label="Hazırlayan" deger={teklif.hazirlayan} flex colors={colors} />
        </View>
        <View style={styles.row2}>
          <Field label="Ödeme" deger={teklif.odemeSecenegi} flex colors={colors} />
          <Field label="Para Birimi" deger={teklif.paraBirimi} flex colors={colors} />
        </View>
        {!!teklif.aciklama && <Field label="Açıklama" deger={teklif.aciklama} multi colors={colors} />}

        {/* Satırlar */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Satırlar ({satirlar.length})</Text>
        {satirlar.length === 0 ? (
          <Text style={[styles.bos, { color: colors.textFaded }]}>Satır yok.</Text>
        ) : (
          satirlar.map((s, i) => {
            const h = satirHesapla(s)
            return (
              <View key={i} style={[styles.satirCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.satirHeader}>
                  <Text style={[styles.satirAd, { color: colors.textPrimary }]} numberOfLines={2}>
                    {s.stokAdi || s.stokKodu || 'Ürün'}
                  </Text>
                  <Text style={[styles.satirTutar, { color: colors.success }]}>
                    {paraFormat(h.netTutar, teklif.paraBirimi)}
                  </Text>
                </View>
                <Text style={[styles.satirDetay, { color: colors.textMuted }]}>
                  {Number(s.miktar ?? 0)} {s.birim ?? ''} × {paraFormat(s.birimFiyat, teklif.paraBirimi)}
                  {Number(s.iskonto) > 0 && ` · İsk %${s.iskonto}`}
                  {Number(s.kdv) > 0 && ` · KDV %${s.kdv}`}
                </Text>
              </View>
            )
          })
        )}

        {/* Toplam kartı */}
        {satirlar.length > 0 && (
          <View style={[styles.toplamKart, { backgroundColor: colors.surface, borderColor: colors.success + '55' }]}>
            <ToplamSatiri label="Ara Toplam" deger={paraFormat(toplam.araToplam, teklif.paraBirimi)} colors={colors} />
            {toplam.satirIskontoToplam > 0 && (
              <ToplamSatiri
                label="Satır İskonto"
                deger={`- ${paraFormat(toplam.satirIskontoToplam, teklif.paraBirimi)}`}
                renk={colors.danger}
                colors={colors}
              />
            )}
            {Number(teklif.genelIskonto) > 0 && (
              <ToplamSatiri
                label={`Genel İskonto (%${teklif.genelIskonto})`}
                deger={`- ${paraFormat(toplam.genelIskontoTutari, teklif.paraBirimi)}`}
                renk={colors.danger}
                colors={colors}
              />
            )}
            <ToplamSatiri label="KDV Hariç" deger={paraFormat(toplam.kdvHaric, teklif.paraBirimi)} colors={colors} />
            <ToplamSatiri label="KDV" deger={paraFormat(toplam.kdvToplam, teklif.paraBirimi)} colors={colors} />
            <View style={[styles.toplamCizgi, { backgroundColor: colors.border }]} />
            <ToplamSatiri
              label="GENEL TOPLAM"
              deger={paraFormat(toplam.genelToplam, teklif.paraBirimi)}
              renk={colors.success}
              bold
              colors={colors}
            />
          </View>
        )}

        {/* Durum değiştir */}
        <Text style={[styles.sectionLabel, { marginTop: 20, color: colors.textMuted }]}>Durumu Değiştir</Text>
        <View style={styles.durumGrid}>
          {ONAY_DURUMLARI.map((d) => {
            const aktif = teklif.onayDurumu === d.id
            return (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.durumBtn,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                  aktif && { backgroundColor: d.renk, borderColor: d.renk },
                ]}
                onPress={() => durumDegistir(d.id)}
              >
                <Text style={[styles.durumBtnText, { color: colors.textSecondary }, aktif && { color: '#fff' }]}>
                  {d.ikon} {d.isim}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Aksiyonlar */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
            onPress={() => navigation.navigate('YeniTeklif', { editId: id })}
            activeOpacity={0.85}
          >
            <Feather name="edit-2" size={18} color="#fff" />
            <Text style={styles.actionText}>Revize Et</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
            onPress={emailGonder}
            activeOpacity={0.85}
          >
            <Feather name="mail" size={18} color="#fff" />
            <Text style={styles.actionText}>Email Gönder</Text>
          </TouchableOpacity>
        </View>

        <Field label="Oluşturuldu" deger={tarihSaatFormat(teklif.olusturmaTarih)} colors={colors} />

        <TouchableOpacity style={[styles.silBtn, { borderColor: colors.danger + '66' }]} onPress={sil}>
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={[styles.silText, { color: colors.danger }]}>Teklifi Sil</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  )
}

function Field({ label, deger, multi, flex, colors }) {
  if (!deger) return null
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={[styles.fieldLabel, { color: colors?.textFaded ?? '#64748b' }]}>{label}</Text>
      <Text style={[styles.fieldDeger, { color: colors?.textSecondary ?? '#e2e8f0' }, multi && { lineHeight: 22 }]}>{String(deger)}</Text>
    </View>
  )
}

function ToplamSatiri({ label, deger, renk, bold, colors }) {
  const degerRenk = renk ?? colors?.textSecondary ?? '#e2e8f0'
  return (
    <View style={styles.toplamSatir}>
      <Text style={[styles.toplamLabel, { color: colors?.textMuted ?? '#94a3b8' }, bold && { fontWeight: '800', fontSize: 15 }]}>{label}</Text>
      <Text style={[styles.toplamDeger, { color: degerRenk }, bold && { fontWeight: '800', fontSize: 17 }]}>
        {deger}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  teklifNo: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  durumBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  durumText: { fontSize: 12, fontWeight: '700' },
  firma: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  konuBox: {
    marginTop: 10,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  konu: { color: '#fff', fontSize: 15, fontWeight: '600' },

  row2: { flexDirection: 'row', gap: 12 },
  field: { marginTop: 14 },
  fieldLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  fieldDeger: { color: '#e2e8f0', fontSize: 14 },

  sectionLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },

  satirCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  satirHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  satirAd: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  satirTutar: { color: '#22c55e', fontSize: 14, fontWeight: '800' },
  satirDetay: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  toplamKart: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  toplamSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toplamLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  toplamDeger: { fontSize: 13, fontWeight: '700' },
  toplamCizgi: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 8,
  },

  durumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durumBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  durumBtnText: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bos: { color: '#64748b', fontStyle: 'italic' },

  silBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  silText: { color: '#ef4444', fontWeight: '700' },
})
