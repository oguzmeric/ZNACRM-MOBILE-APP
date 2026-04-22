import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { musteriGetir, musteriSil } from '../services/musteriService'
import { musteriKisileriniGetir } from '../services/musteriKisiService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { musteriCihazlariniGetir, durumBul as cihazDurumBul } from '../services/stokKalemiService'
import { tarihFormat } from '../utils/format'
import { useTheme } from '../context/ThemeContext'

export default function MusteriDetayScreen({ route, navigation }) {
  const { id } = route.params
  const { colors } = useTheme()
  const [musteri, setMusteri] = useState(null)
  const [kisiler, setKisiler] = useState([])
  const [lokasyonlar, setLokasyonlar] = useState([])
  const [cihazlar, setCihazlar] = useState([])
  const [loading, setLoading] = useState(true)

  const yukle = useCallback(async () => {
    const [m, k, l, c] = await Promise.all([
      musteriGetir(id),
      musteriKisileriniGetir(id),
      musteriLokasyonlariniGetir(id),
      musteriCihazlariniGetir(id),
    ])
    setMusteri(m)
    setKisiler(k ?? [])
    setLokasyonlar(l ?? [])
    setCihazlar(c ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { yukle() }, [yukle])

  // Düzenle ekranından dönünce verileri tazele
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  // Header'a Düzenle butonu — iOS 26 otomatik pill glass stilini uygular
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('MüşteriDüzenle', { id })}
          activeOpacity={0.6}
        >
          <Text style={{ color: '#60a5fa', fontWeight: '500', fontSize: 17 }}>
            Düzenle
          </Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, id])

  const ara = (tel) => {
    if (!tel) return
    const num = tel.replace(/\s/g, '')
    Linking.openURL(`tel:${num}`)
  }

  const sms = (tel) => {
    if (!tel) return
    const num = tel.replace(/\s/g, '')
    Linking.openURL(`sms:${num}`)
  }

  const email = (adres) => {
    if (!adres) return
    Linking.openURL(`mailto:${adres}`)
  }

  const harita = (sehir, firma) => {
    if (!sehir && !firma) return
    const q = encodeURIComponent([firma, sehir].filter(Boolean).join(' '))
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${q}`
        : `geo:0,0?q=${q}`
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`)
    )
  }

  const sil = () => {
    Alert.alert('Müşteri sil', 'Emin misin? Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await musteriSil(id)
          navigation.goBack()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!musteri) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted }}>Müşteri bulunamadı.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.firma, { color: colors.textPrimary }]}>
        {musteri.firma || `${musteri.ad} ${musteri.soyad}`}
      </Text>
      <View style={styles.firmaMetaRow}>
        {!!musteri.kod && <Text style={[styles.kod, { backgroundColor: colors.surface }]}>{musteri.kod}</Text>}
        {(musteri.sehir || musteri.firma) && (
          <TouchableOpacity
            onPress={() => harita(musteri.sehir, musteri.firma)}
            activeOpacity={0.7}
          >
            <Text style={styles.sehirLink}>
              📍 {musteri.sehir ? `${musteri.sehir} ›` : 'Haritada Aç ›'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TappableField label="Santral / Genel" deger={musteri.telefon} onPress={() => ara(musteri.telefon)} ikon="📞" />
      <TappableField label="Genel E-posta" deger={musteri.email} onPress={() => email(musteri.email)} ikon="✉️" />
      <Field label="Vergi No" deger={musteri.vergiNo} />
      <Field label="Durum" deger={musteri.durum} />
      <Field label="Notlar" deger={musteri.notlar} multi />
      <Field label="Kayıt Tarihi" deger={tarihFormat(musteri.olusturmaTarih)} />

      {/* İlgili Kişiler bölümü */}
      <View style={styles.kisilerHeader}>
        <Text style={[styles.kisilerBaslik, { color: colors.textPrimary }]}>İlgili Kişiler ({kisiler.length})</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('YeniKişi', { musteriId: id })}
          style={styles.kisiEkleBtn}
        >
          <Text style={styles.kisiEkleText}>+ Kişi Ekle</Text>
        </TouchableOpacity>
      </View>

      {kisiler.length === 0 ? (
        <Text style={[styles.kisiBosText, { color: colors.textFaded }]}>Henüz ilgili kişi yok.</Text>
      ) : (
        kisiler.map((k) => (
          <View
            key={k.id}
            style={[styles.kisiCard, { backgroundColor: colors.surface }]}
          >
            <TouchableOpacity
              style={styles.kisiHeader}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('KişiDüzenle', { musteriId: id, kisiId: k.id })}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.kisiAd, { color: colors.textPrimary }]} numberOfLines={1}>
                    {k.ad} {k.soyad ?? ''}
                  </Text>
                  {k.anaKisi && (
                    <View style={styles.anaKisiBadge}>
                      <Text style={styles.anaKisiText}>ANA</Text>
                    </View>
                  )}
                </View>
                {!!k.unvan && <Text style={[styles.kisiUnvan, { color: colors.textMuted }]}>{k.unvan}</Text>}
              </View>
              <Feather name="chevron-right" size={16} color={colors.textFaded} />
            </TouchableOpacity>

            <View style={styles.kisiActions}>
              <KisiActionBtn
                label="Ara"
                disabled={!k.telefon}
                onPress={() => ara(k.telefon)}
              />
              <KisiActionBtn
                label="SMS"
                disabled={!k.telefon}
                onPress={() => sms(k.telefon)}
              />
              <KisiActionBtn
                label="E-posta"
                disabled={!k.email}
                onPress={() => email(k.email)}
              />
            </View>

            {(k.telefon || k.email) && (
              <View style={{ marginTop: 8 }}>
                {!!k.telefon && <Text style={[styles.kisiMeta, { color: colors.textMuted }]}>📞 {k.telefon}</Text>}
                {!!k.email && <Text style={[styles.kisiMeta, { color: colors.textMuted }]}>✉  {k.email}</Text>}
              </View>
            )}
          </View>
        ))
      )}

      {/* Lokasyonlar bölümü */}
      <View style={styles.kisilerHeader}>
        <Text style={[styles.kisilerBaslik, { color: colors.textPrimary }]}>Lokasyonlar ({lokasyonlar.length})</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('YeniLokasyon', { musteriId: id })}
          style={styles.kisiEkleBtn}
        >
          <Text style={styles.kisiEkleText}>+ Lokasyon Ekle</Text>
        </TouchableOpacity>
      </View>

      {lokasyonlar.length === 0 ? (
        <Text style={[styles.kisiBosText, { color: colors.textFaded }]}>Henüz lokasyon yok.</Text>
      ) : (
        lokasyonlar.map((l) => (
          <TouchableOpacity
            key={l.id}
            style={[styles.lokasyonCard, { backgroundColor: colors.surface }, !l.aktif && { opacity: 0.5 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('LokasyonDuzenle', { musteriId: id, lokasyonId: l.id })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.lokasyonAd, { color: colors.textPrimary }]} numberOfLines={1}>📍 {l.ad}</Text>
              {!l.aktif && <Text style={styles.pasifBadge}>PASİF</Text>}
            </View>
            {!!l.adres && <Text style={[styles.lokasyonMeta, { color: colors.textMuted }]} numberOfLines={2}>{l.adres}</Text>}
            {(l.enlem != null && l.boylam != null) && (
              <Text style={[styles.lokasyonMeta, { color: colors.textMuted }]}>📐 {l.enlem.toFixed(5)}, {l.boylam.toFixed(5)}</Text>
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Cihazlar bölümü */}
      <View style={styles.kisilerHeader}>
        <Text style={[styles.kisilerBaslik, { color: colors.textPrimary }]}>Cihazlar ({cihazlar.length})</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Tara')}
          style={styles.taraBtn}
        >
          <Text style={styles.kisiEkleText}>📷 Tara</Text>
        </TouchableOpacity>
      </View>

      {cihazlar.length === 0 ? (
        <Text style={[styles.kisiBosText, { color: colors.textFaded }]}>
          Henüz cihaz kaydı yok. Sahada bir ürün taktığında "Tara" ile burada görünecek.
        </Text>
      ) : (
        <>
          {/* Lokasyon bazında gruplanmış cihaz tabloları */}
          {(() => {
            const gruplar = new Map()
            cihazlar.forEach((c) => {
              const key = c.musteriLokasyonId ?? 'konumsuz'
              if (!gruplar.has(key)) gruplar.set(key, [])
              gruplar.get(key).push(c)
            })
            return Array.from(gruplar.entries()).map(([lokId, liste]) => {
              const lok = lokasyonlar.find((l) => l.id === lokId)
              const baslik = lok ? lok.ad : 'Lokasyon Atanmamış'
              return (
                <View key={lokId} style={styles.cihazGrubu}>
                  <Text style={styles.cihazGrupBaslik}>📍 {baslik}</Text>
                  {/* Tablo başlığı */}
                  <View style={styles.cihazTabloBaslik}>
                    <Text style={[styles.cihazTabloSutun, { flex: 1.6 }]}>Cihaz</Text>
                    <Text style={[styles.cihazTabloSutun, { flex: 1.2 }]}>IP</Text>
                    <Text style={[styles.cihazTabloSutun, { flex: 1.2 }]}>Yer</Text>
                  </View>
                  {liste.map((c) => {
                    const d = cihazDurumBul(c.durum)
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.cihazSatir}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('CihazDetay', { id: c.id })}
                      >
                        <View style={{ flex: 1.6 }}>
                          <Text style={styles.cihazSatirAd} numberOfLines={1}>
                            {c.seriNo || c.model || c.stokKodu}
                          </Text>
                          {!!d && (
                            <Text style={[styles.cihazSatirDurum, { color: d.renk }]}>
                              {d.ikon} {d.isim}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.cihazSatirDeger, { flex: 1.2, fontFamily: 'monospace' }]} numberOfLines={1}>
                          {c.ipAdresi ?? '—'}
                        </Text>
                        <Text style={[styles.cihazSatirDeger, { flex: 1.2 }]} numberOfLines={1}>
                          {c.altLokasyon ?? '—'}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })
          })()}
        </>
      )}

      <TouchableOpacity style={styles.silBtn} onPress={sil}>
        <Text style={styles.silText}>Müşteriyi Sil</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function TappableField({ label, deger, onPress, ikon }) {
  const { colors } = useTheme()
  if (!deger) return null
  return (
    <TouchableOpacity
      style={styles.field}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[styles.fieldLabel, { color: colors.textFaded }]}>{label}</Text>
      <Text style={styles.tappableDeger}>
        {ikon ? `${ikon}  ` : ''}{String(deger)}
      </Text>
    </TouchableOpacity>
  )
}

function KisiActionBtn({ label, onPress, disabled }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.kisiActionBtn, { backgroundColor: colors.bg, borderColor: colors.borderStrong }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.kisiActionText, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

function Field({ label, deger, multi }) {
  const { colors } = useTheme()
  if (!deger) return null
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textFaded }]}>{label}</Text>
      <Text style={[styles.fieldDeger, { color: colors.textSecondary }, multi && { lineHeight: 22 }]}>{String(deger)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  firma: { color: '#fff', fontSize: 24, fontWeight: '800' },
  firmaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  kod: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  firmaMeta: { color: '#94a3b8', fontSize: 13 },

  sehirLink: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },

  field: { marginTop: 14 },
  fieldLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  fieldDeger: { color: '#e2e8f0', fontSize: 15 },
  tappableDeger: { color: '#60a5fa', fontSize: 15, fontWeight: '500' },

  silBtn: {
    marginTop: 18,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  silText: { color: '#ef4444', fontWeight: '700' },

  kisilerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 8,
  },
  kisilerBaslik: { color: '#fff', fontSize: 16, fontWeight: '700' },
  kisiEkleBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  kisiEkleText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  kisiBosText: {
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  kisiCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  kisiHeader: { flexDirection: 'row', alignItems: 'center' },
  kisiDuzenleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kisiAd: { color: '#fff', fontSize: 15, fontWeight: '700' },
  kisiUnvan: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  anaKisiBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  anaKisiText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  kisiActions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  kisiActionBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  kisiActionText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  kisiMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  taraBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  lokasyonCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  lokasyonAd: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lokasyonMeta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  pasifBadge: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  cihazCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  cihazHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cihazAd: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  cihazBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  cihazBadgeText: { fontSize: 10, fontWeight: '700' },
  cihazMeta: { color: '#94a3b8', fontSize: 12, marginTop: 3 },

  // Lokasyon bazlı tablo görünümü
  cihazGrubu: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cihazGrupBaslik: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.3)',
  },
  cihazTabloBaslik: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cihazTabloSutun: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cihazSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  cihazSatirAd: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  cihazSatirDurum: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  cihazSatirDeger: {
    color: '#cbd5e1',
    fontSize: 12,
  },
})
