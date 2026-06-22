import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import {
  modelKalemleriniGetir,
  durumBul,
  DURUMLAR,
  urunSeriDurumu,
  serileriTopluEkle,
} from '../services/stokKalemiService'
import { seriListesiOku } from '../lib/seriExcel'
import * as DocumentPicker from 'expo-document-picker'
import { tarihFormat } from '../utils/format'
import { useTheme } from '../context/ThemeContext'
import { beklenenAdetGuncelle } from '../services/stokUrunService'

const FILTRELER = [
  { id: 'tumu', label: 'Tümü' },
  { id: 'depoda', label: 'Depoda' },
  { id: 'teknisyende', label: 'Teknisyen' },
  { id: 'sahada', label: 'Sahada' },
  { id: 'arizada', label: 'Arızalı' },
  { id: 'hurda', label: 'Hurda' },
]

// Durum / filtre → Feather ikon adı (emoji yerine)
const DURUM_IKON = {
  tumu: 'grid',
  depoda: 'package',
  teknisyende: 'truck',
  sahada: 'check-circle',
  arizada: 'alert-triangle',
  arizali_depoda: 'alert-octagon',
  tamirde: 'tool',
  hurda: 'trash-2',
}

export default function ModelDetayScreen({ route, navigation }) {
  const { stokKodu } = route.params
  const { colors } = useTheme()
  const [kalemler, setKalemler] = useState([])
  const [filtre, setFiltre] = useState('tumu')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seriDurum, setSeriDurum] = useState(null)
  const [hedefModalAcik, setHedefModalAcik] = useState(false)
  const [hedefInput, setHedefInput] = useState('')

  useEffect(() => {
    navigation.setOptions({ title: stokKodu })
  }, [navigation, stokKodu])

  const yukle = useCallback(async () => {
    const [liste, durum] = await Promise.all([
      modelKalemleriniGetir(stokKodu),
      urunSeriDurumu(stokKodu),
    ])
    setKalemler(liste ?? [])
    setSeriDurum(durum ?? null)
    setLoading(false)
  }, [stokKodu])

  useEffect(() => { yukle() }, [yukle])
  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const sayilar = useMemo(() => {
    const s = { toplam: kalemler.length, depoda: 0, teknisyende: 0, sahada: 0, arizada: 0, hurda: 0 }
    kalemler.forEach((k) => {
      if (s[k.durum] !== undefined) s[k.durum] += 1
    })
    return s
  }, [kalemler])

  const filtrelenmis = filtre === 'tumu'
    ? kalemler
    : kalemler.filter((k) => k.durum === filtre)

  const ornek = kalemler[0]

  const excelYukle = async () => {
    const sec = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    })
    if (sec.canceled || !sec.assets?.[0]) return
    let seriler = []
    try {
      seriler = await seriListesiOku(sec.assets[0].uri)
    } catch (e) {
      return Alert.alert('Hata', 'Excel okunamadı: ' + (e?.message ?? ''))
    }
    if (seriler.length === 0) return Alert.alert('Boş', "Excel'de seri bulunamadı (ilk sütun).")
    Alert.alert('Onay', `${seriler.length} satır okundu. Eklensin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Ekle', onPress: async () => {
          const r = await serileriTopluEkle(stokKodu, seriler, { marka: ornek?.marka, model: ornek?.model })
          await yukle()
          Alert.alert('Tamam',
            `${r.eklenen} eklendi.` +
            (r.zatenVar?.length ? `\n${r.zatenVar.length} zaten kayıtlıydı.` : '') +
            (r.bos ? `\n${r.bos} boş atlandı.` : ''))
      } },
    ])
  }

  const hedefKaydet = async () => {
    const ok = await beklenenAdetGuncelle(stokKodu, hedefInput.trim() === '' ? null : hedefInput)
    setHedefModalAcik(false)
    if (!ok) return Alert.alert('Hata', 'Hedef güncellenemedi.')
    await yukle()
  }

  const seriEkleMenu = () => {
    Alert.alert('Seri No Ekle', 'Yöntem seç', [
      { text: '📷 Tara (kamera)', onPress: () => navigation.navigate('SeriTara', {
          stokKodu, marka: ornek?.marka ?? null, model: ornek?.model ?? null }) },
      { text: "📄 Excel'den Yükle", onPress: excelYukle },
      { text: 'Vazgeç', style: 'cancel' },
    ])
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: colors.bg }]}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.ozetBox, { backgroundColor: colors.surface, borderBottomColor: colors.bg }]}>
        <Text style={[styles.modelAd, { color: colors.textPrimary }]} numberOfLines={2}>
          {ornek?.marka ? `${ornek.marka} ` : ''}{ornek?.model || stokKodu}
        </Text>
        <Text style={[styles.modelKod, { color: colors.primary }]}>{stokKodu}</Text>
        <View style={styles.rakamRow}>
          <Sayi ikon="package" sayi={sayilar.depoda} renk="#3b82f6" label="Depo" />
          <Sayi ikon="truck" sayi={sayilar.teknisyende} renk="#a855f7" label="Teknisyen" />
          <Sayi ikon="check-circle" sayi={sayilar.sahada} renk="#22c55e" label="Saha" />
          <Sayi ikon="alert-triangle" sayi={sayilar.arizada} renk="#f59e0b" label="Arıza" />
          <Sayi ikon="layers" sayi={sayilar.toplam} renk={colors.textPrimary} label="Toplam" />
        </View>
      </View>

      <View style={[styles.filtreWrap, { backgroundColor: colors.bg, borderBottomColor: colors.surface }]}>
        <FlatList
          data={FILTRELER}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filtre, { backgroundColor: colors.surface }, filtre === f.id && styles.filtreActive]}
              onPress={() => setFiltre(f.id)}
            >
              <Feather
                name={DURUM_IKON[f.id] || 'grid'}
                size={13}
                color={filtre === f.id ? '#fff' : colors.textMuted}
              />
              <Text style={[styles.filtreText, { color: colors.textMuted }, filtre === f.id && { color: '#fff' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtrelenmis}
        keyExtractor={(k) => String(k.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListHeaderComponent={seriDurum ? (
          <View style={[styles.seriKart, { backgroundColor: colors.surface }]}>
            <View style={styles.seriHeader}>
              <Text style={[styles.seriBaslik, { color: colors.textPrimary }]}>Seri Numaraları</Text>
              <TouchableOpacity
                onPress={() => {
                  setHedefInput(seriDurum?.beklenenAdet != null ? String(seriDurum.beklenenAdet) : '')
                  setHedefModalAcik(true)
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.seriSayac, { color: colors.textMuted }]}>
                  {seriDurum?.kayitliSeri ?? 0}
                  {seriDurum?.beklenenAdet != null ? ` / ${seriDurum.beklenenAdet}` : ' / —'}
                  {'  ✏️'}
                </Text>
              </TouchableOpacity>
            </View>
            {seriDurum?.eksik > 0 && (
              <Text style={styles.seriEksik}>⚠️ {seriDurum.eksik} seri no eksik</Text>
            )}
            {seriDurum?.beklenenAdet != null && seriDurum.kayitliSeri > seriDurum.beklenenAdet && (
              <Text style={styles.seriFazla}>
                {'Beklenenden fazla seri no var (' + seriDurum.kayitliSeri + ' > ' + seriDurum.beklenenAdet + ').'}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.seriEkleBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={seriEkleMenu}
            >
              <Text style={styles.seriEkleText}>+ Seri No Ekle</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textFaded }]}>Bu durumda kalem yok.</Text>
        }
        renderItem={({ item }) => {
          const d = durumBul(item.durum)
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CihazDetay', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.seriNo, { color: colors.textPrimary }]} numberOfLines={1}>
                  S/N: {item.seriNo || '—'}
                </Text>
                {d && (
                  <View style={[styles.durumBadge, { backgroundColor: d.renk + '22', borderColor: d.renk }]}>
                    <Feather name={DURUM_IKON[item.durum] || 'box'} size={11} color={d.renk} />
                    <Text style={[styles.durumText, { color: d.renk }]}>{d.isim}</Text>
                  </View>
                )}
              </View>
              {!!item.barkod && <Text style={[styles.meta, { color: colors.textMuted }]}>Barkod: {item.barkod}</Text>}
              {item.durum === 'sahada' && !!item.takilmaTarihi && (
                <View style={styles.tarihSatir}>
                  <Feather name="calendar" size={12} color="#10b981" />
                  <Text style={[styles.meta, { color: '#10b981', marginTop: 0 }]}>{tarihFormat(item.takilmaTarihi)}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />

      <Modal visible={hedefModalAcik} animationType="fade" transparent onRequestClose={() => setHedefModalAcik(false)}>
        <View style={styles.hedefBg}>
          <View style={[styles.hedefKart, { backgroundColor: colors.surface }]}>
            <Text style={[styles.hedefBaslik, { color: colors.textPrimary }]}>Beklenen Adet (hedef)</Text>
            <Text style={[styles.hedefAciklama, { color: colors.textMuted }]}>
              Depoya gelmesi beklenen toplam adet. Eksik seri sayısı buna göre hesaplanır. Boş bırakırsan hedef kalkar.
            </Text>
            <TextInput
              style={[styles.hedefInput, { color: colors.textPrimary, borderColor: colors.border ?? '#334155' }]}
              value={hedefInput}
              onChangeText={setHedefInput}
              keyboardType="number-pad"
              placeholder="Örn: 50"
              placeholderTextColor={colors.textFaded ?? '#64748b'}
              autoFocus
            />
            <View style={styles.hedefBtnRow}>
              <TouchableOpacity style={styles.hedefBtnIptal} onPress={() => setHedefModalAcik(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.hedefBtnKaydet, { backgroundColor: colors.primary }]} onPress={hedefKaydet}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Sayi({ ikon, sayi, renk, label }) {
  const { colors } = useTheme()
  return (
    <View style={styles.sayiBox}>
      <View style={[styles.sayiIkonDaire, { backgroundColor: renk + '1f' }]}>
        <Feather name={ikon} size={15} color={renk} />
      </View>
      <Text style={[styles.sayiSayi, { color: colors.textPrimary }]}>{sayi}</Text>
      <Text style={[styles.sayiLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  ozetBox: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  modelAd: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modelKod: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginTop: 2 },
  rakamRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  sayiBox: { alignItems: 'center', flex: 1 },
  sayiIkonDaire: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sayiSayi: { fontSize: 18, fontWeight: '800' },
  sayiLabel: { fontSize: 10, marginTop: 2, fontWeight: '600', letterSpacing: 0.2 },

  filtreWrap: {
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filtre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  filtreActive: { backgroundColor: '#2563eb' },
  filtreText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },

  card: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  seriNo: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, fontFamily: 'monospace' },
  durumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  durumText: { fontSize: 11, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  tarihSatir: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },

  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },

  seriKart: { borderRadius: 12, padding: 14, marginTop: 12 },
  seriHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seriBaslik: { fontSize: 15, fontWeight: '700' },
  seriSayac: { fontSize: 15, fontWeight: '700' },
  seriEksik: { color: '#f59e0b', fontSize: 12, marginTop: 6, fontWeight: '600' },
  seriFazla: { color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: '600' },
  seriEkleBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  seriEkleText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  hedefBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  hedefKart: { borderRadius: 16, padding: 20 },
  hedefBaslik: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  hedefAciklama: { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  hedefInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700' },
  hedefBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hedefBtnIptal: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  hedefBtnKaydet: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
})
