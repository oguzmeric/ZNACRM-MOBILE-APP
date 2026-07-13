// Arızalı Ürün Girişi — teknisyen müşterideki cihazın SN'ini okutur,
// müşteri + lokasyon + arıza nedeni girer. SN daha önce kayıtlıysa cihaz
// bilgileri gelir ve mevcut kayda arıza işlenir.
import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { trIcerir } from '../utils/trSearch'
import QuickScanner from '../components/QuickScanner'
import SecimPicker from '../components/SecimPicker'
import { musterileriGetir } from '../services/musteriService'
import { musteriLokasyonlariniGetir } from '../services/musteriLokasyonService'
import { cihazGetirSeriNo, cihazEkle, cihazGuncelle, cihazArizaBildir } from '../services/musteriCihazService'

export default function ArizaliCihazScreen({ navigation, route }) {
  const { colors } = useTheme()
  const { kullanici } = useAuth()

  // 'ariza'   → arızalı ürün girişi (arıza nedeni zorunlu)
  // 'guncelle'→ cihaz kaydı / bilgi güncelleme (arıza işlenmez)
  const [islem, setIslem] = useState('ariza')
  const [seriNo, setSeriNo] = useState('')
  const [taramaAcik, setTaramaAcik] = useState(false)
  const [sorgulaniyor, setSorgulaniyor] = useState(false)
  const [mevcutCihaz, setMevcutCihaz] = useState(null) // SN kayıtlıysa dolu

  const [musteriler, setMusteriler] = useState([])
  const [firmaAdi, setFirmaAdi] = useState('')
  const [musteriId, setMusteriId] = useState(null)
  const [oneriGoster, setOneriGoster] = useState(false)
  const [lokasyonlar, setLokasyonlar] = useState([])

  const [form, setForm] = useState({
    lokasyon: '', cihazAdi: '', marka: '', model: '',
    ipAdresi: '', macAdresi: '', kullaniciAdi: '', sifre: '',
    arizaNedeni: '', notlar: '',
  })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    musterileriGetir().then(async (v) => {
      const liste = v ?? []
      setMusteriler(liste)
      // Başka ekrandan SN ile gelindiyse (TaraScreen / CihazDetay köprüsü)
      const paramSN = route?.params?.sn
      if (!paramSN) return
      setSeriNo(paramSN)
      const bulunan = await snSorgula(paramSN, liste)
      // SN müşteri envanterinde yoksa: stok kaydından gelen bilgilerle formu doldur
      const d = route?.params?.onDoldur
      if (!bulunan && d) {
        if (d.musteriId) {
          setMusteriId(d.musteriId)
          const m = liste.find((x) => x.id === d.musteriId)
          setFirmaAdi(m?.firma || m?.musteriAdi || `Müşteri #${d.musteriId}`)
        }
        setForm((f) => ({
          ...f,
          marka: d.marka || '', model: d.model || '',
          ipAdresi: d.ipAdresi || '', macAdresi: d.macAdresi || '',
          kullaniciAdi: d.kullaniciAdi || '', sifre: d.sifre || '',
          lokasyon: d.lokasyon || '',
        }))
      }
    })
  }, [])

  useEffect(() => {
    if (musteriId) {
      musteriLokasyonlariniGetir(musteriId)
        .then((l) => setLokasyonlar(l ?? []))
        .catch(() => setLokasyonlar([]))
    } else {
      setLokasyonlar([])
    }
  }, [musteriId])

  const oneriler = useMemo(() => {
    if (!oneriGoster) return []
    const q = firmaAdi.trim()
    if (!q) return musteriler.slice(0, 15)
    return musteriler.filter((m) => trIcerir([m.firma, m.musteriAdi], q)).slice(0, 15)
  }, [musteriler, firmaAdi, oneriGoster])

  const musteriSec = (m) => {
    setMusteriId(m.id)
    setFirmaAdi(m.firma || m.musteriAdi || '')
    setOneriGoster(false)
  }

  // SN sorgula — kayıtlıysa bilgileri getir
  // musteriListesi parametresi: mount anında müşteriler state'i henüz boşken çağrılırsa
  const snSorgula = async (sn, musteriListesi = null) => {
    const temiz = String(sn ?? seriNo).trim()
    if (!temiz) return null
    setSorgulaniyor(true)
    try {
      const c = await cihazGetirSeriNo(temiz)
      if (c) {
        setMevcutCihaz(c)
        setMusteriId(c.musteriId)
        const liste = musteriListesi || musteriler
        const m = liste.find((x) => x.id === c.musteriId)
        setFirmaAdi(m?.firma || m?.musteriAdi || `Müşteri #${c.musteriId}`)
        setForm({
          lokasyon: c.lokasyon || '', cihazAdi: c.cihazAdi || '',
          marka: c.marka || '', model: c.model || '',
          ipAdresi: c.ipAdresi || '', macAdresi: c.macAdresi || '',
          kullaniciAdi: c.kullaniciAdi || '', sifre: c.sifre || '',
          arizaNedeni: '', notlar: c.notlar || '',
        })
      } else {
        setMevcutCihaz(null)
      }
      return c
    } finally {
      setSorgulaniyor(false)
    }
  }

  const kaydet = async () => {
    if (!seriNo.trim()) { Alert.alert('Eksik', 'Seri numarası girin veya taratın.'); return }
    if (!musteriId) { Alert.alert('Eksik', 'Müşteri seçin.'); return }
    if (islem === 'ariza' && !form.arizaNedeni.trim()) { Alert.alert('Eksik', 'Arıza nedenini yazın.'); return }

    setKaydediliyor(true)
    try {
      if (mevcutCihaz) {
        // Kayıtlı cihaz: bilgileri güncelle (+ arıza modundaysa arızayı işle)
        const g1 = await cihazGuncelle(mevcutCihaz.id, {
          lokasyon: form.lokasyon, cihazAdi: form.cihazAdi,
          marka: form.marka, model: form.model,
          ipAdresi: form.ipAdresi, macAdresi: form.macAdresi,
          kullaniciAdi: form.kullaniciAdi, sifre: form.sifre, notlar: form.notlar,
        }, kullanici, islem === 'ariza' ? 'Sahada arızalı giriş sırasında güncellendi' : 'Sahada SN okutularak bilgiler güncellendi')
        if (!g1) { Alert.alert('Hata', 'Güncellenemedi.'); return }
        if (islem === 'ariza') {
          const g2 = await cihazArizaBildir(mevcutCihaz.id, form.arizaNedeni.trim(), kullanici)
          if (!g2) { Alert.alert('Hata', 'Arıza kaydedilemedi.'); return }
        }
      } else {
        const arizaMi = islem === 'ariza'
        const r = await cihazEkle({
          musteriId, seriNo: seriNo.trim(), ...form,
          arizaNedeni: arizaMi ? form.arizaNedeni.trim() : '',
          durum: arizaMi ? 'arizali' : 'aktif',
          arizaTarihi: arizaMi ? new Date().toISOString() : undefined,
        }, kullanici)
        if (r.hata) { Alert.alert('Hata', r.hata); return }
      }
      Alert.alert('✓ Kaydedildi',
        islem === 'ariza' ? 'Arızalı ürün girişi yapıldı.' : 'Cihaz bilgileri kaydedildi.', [
        { text: 'Yeni İşlem', onPress: sifirla },
        { text: 'Kapat', onPress: () => navigation.goBack() },
      ])
    } finally {
      setKaydediliyor(false)
    }
  }

  const sifirla = () => {
    setSeriNo(''); setMevcutCihaz(null); setMusteriId(null); setFirmaAdi('')
    setForm({
      lokasyon: '', cihazAdi: '', marka: '', model: '',
      ipAdresi: '', macAdresi: '', kullaniciAdi: '', sifre: '',
      arizaNedeni: '', notlar: '',
    })
  }

  const input = (deger, onChange, placeholder, ekstra = {}) => (
    <TextInput
      value={deger}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
      autoCapitalize="none"
      {...ekstra}
    />
  )

  const etiket = (t, zorunlu = false) => (
    <Text style={[styles.label, { color: colors.textSecondary }]}>
      {t}{zorunlu && <Text style={{ color: '#ef4444' }}> *</Text>}
    </Text>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* İşlem modu */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { id: 'ariza', etiket: '⚠️ Arızalı Giriş', renk: '#dc2626' },
            { id: 'guncelle', etiket: '💾 Kayıt & Güncelle', renk: '#2563eb' },
          ].map((m) => {
            const aktif = islem === m.id
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setIslem(m.id)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: aktif ? m.renk : colors.surface,
                  borderWidth: 1, borderColor: aktif ? m.renk : colors.border,
                }}
              >
                <Text style={{ color: aktif ? '#fff' : colors.textSecondary, fontWeight: '800', fontSize: 13 }}>
                  {m.etiket}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* SN */}
        {etiket('Seri Numarası', true)}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            {input(seriNo, (v) => { setSeriNo(v); setMevcutCihaz(null) }, 'SN yaz veya taratın', {
              onBlur: () => snSorgula(),
              style: [styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }],
            })}
          </View>
          <TouchableOpacity
            onPress={() => setTaramaAcik(true)}
            style={[styles.taraBtn, { backgroundColor: '#dc2626' }]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
            <Text style={styles.taraBtnT}>TARA</Text>
          </TouchableOpacity>
        </View>
        {sorgulaniyor && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>SN kontrol ediliyor…</Text>
          </View>
        )}
        {mevcutCihaz && (
          <View style={[styles.bilgiKart, mevcutCihaz.durum === 'arizali'
            ? { backgroundColor: 'rgba(220,38,38,0.10)', borderColor: 'rgba(220,38,38,0.45)' }
            : { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.35)' }]}>
            <Feather
              name={mevcutCihaz.durum === 'arizali' ? 'alert-triangle' : 'info'}
              size={14}
              color={mevcutCihaz.durum === 'arizali' ? '#ef4444' : '#3b82f6'}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                Bu SN kayıtlı: <Text style={{ fontWeight: '700' }}>{mevcutCihaz.cihazAdi || [mevcutCihaz.marka, mevcutCihaz.model].filter(Boolean).join(' ') || 'Cihaz'}</Text>
              </Text>
              {mevcutCihaz.durum === 'arizali' && (
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                  ⚠️ Şu an ARIZALI{mevcutCihaz.arizaNedeni ? `: ${mevcutCihaz.arizaNedeni}` : ''}
                </Text>
              )}
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {islem === 'ariza' ? 'Arıza mevcut kayda işlenecek.' : 'Değişiklikler mevcut kayda kaydedilecek.'}
              </Text>
            </View>
          </View>
        )}

        {/* Müşteri */}
        {etiket('Müşteri', true)}
        {input(firmaAdi, (v) => { setFirmaAdi(v); setMusteriId(null); setOneriGoster(true) }, 'Firma adı yaz…', {
          onFocus: () => setOneriGoster(true),
          editable: !mevcutCihaz,
          autoCapitalize: 'characters',
        })}
        {oneriGoster && !mevcutCihaz && oneriler.length > 0 && (
          <View style={[styles.oneriKutu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {oneriler.map((m) => (
              <TouchableOpacity key={m.id} onPress={() => musteriSec(m)} style={styles.oneriSatir}>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }} numberOfLines={1}>
                  {m.firma || m.musteriAdi}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {musteriId && !mevcutCihaz && (
          <Text style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>✓ Müşteri seçildi</Text>
        )}

        {/* Lokasyon */}
        {etiket('Lokasyon')}
        {lokasyonlar.length > 0 ? (
          <SecimPicker
            deger={form.lokasyon}
            onSec={(v) => setForm({ ...form, lokasyon: v === '__manuel__' ? '' : v })}
            secenekler={lokasyonlar.map((l) => l.ad)}
            placeholder="Lokasyon seç…"
            ekstraSecenek={{ etiket: '+ Manuel yaz', deger: '__manuel__' }}
          />
        ) : null}
        {(lokasyonlar.length === 0 || !lokasyonlar.some((l) => l.ad === form.lokasyon)) &&
          input(form.lokasyon, (v) => setForm({ ...form, lokasyon: v }), 'Merkez bina, 2. şube…', { autoCapitalize: 'sentences' })}

        {/* Cihaz bilgileri */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            {etiket('Cihaz adı')}
            {input(form.cihazAdi, (v) => setForm({ ...form, cihazAdi: v }), 'NVR, Kamera…', { autoCapitalize: 'sentences' })}
          </View>
          <View style={{ flex: 1 }}>
            {etiket('Marka')}
            {input(form.marka, (v) => setForm({ ...form, marka: v }), 'Hikvision…', { autoCapitalize: 'characters' })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            {etiket('Model')}
            {input(form.model, (v) => setForm({ ...form, model: v }), 'DS-...')}
          </View>
          <View style={{ flex: 1 }}>
            {etiket('IP adresi')}
            {input(form.ipAdresi, (v) => setForm({ ...form, ipAdresi: v }), '192.168.1.64', { keyboardType: 'numbers-and-punctuation' })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            {etiket('MAC adresi')}
            {input(form.macAdresi, (v) => setForm({ ...form, macAdresi: v }), 'AA:BB:CC:…')}
          </View>
          <View style={{ flex: 1 }}>
            {etiket('Kullanıcı adı')}
            {input(form.kullaniciAdi, (v) => setForm({ ...form, kullaniciAdi: v }), 'admin')}
          </View>
        </View>
        {etiket('Şifre')}
        {input(form.sifre, (v) => setForm({ ...form, sifre: v }), 'Cihaz şifresi')}

        {/* Arıza — yalnız arızalı giriş modunda */}
        {islem === 'ariza' && (
          <>
            {etiket('Arıza Nedeni', true)}
            <TextInput
              value={form.arizaNedeni}
              onChangeText={(v) => setForm({ ...form, arizaNedeni: v })}
              placeholder="Görüntü yok, disk arızası, güç sorunu…"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.input, { height: 80, textAlignVertical: 'top', borderColor: '#dc2626', backgroundColor: colors.surface, color: colors.textPrimary }]}
            />
          </>
        )}

        {etiket('Not')}
        <TextInput
          value={form.notlar}
          onChangeText={(v) => setForm({ ...form, notlar: v })}
          placeholder="Ek bilgi…"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, { height: 60, textAlignVertical: 'top', borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
        />

        <TouchableOpacity
          onPress={kaydet}
          disabled={kaydediliyor}
          style={[styles.kaydetBtn, { opacity: kaydediliyor ? 0.6 : 1, backgroundColor: islem === 'ariza' ? '#dc2626' : '#2563eb' }]}
          activeOpacity={0.8}
        >
          {kaydediliyor
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.kaydetT}>
                {islem === 'ariza'
                  ? '⚠️ Arızalı Ürün Girişini Kaydet'
                  : (mevcutCihaz ? '💾 Cihaz Bilgilerini Güncelle' : '💾 Cihazı Kaydet')}
              </Text>}
        </TouchableOpacity>
      </ScrollView>

      <QuickScanner
        visible={taramaAcik}
        onClose={() => setTaramaAcik(false)}
        onScan={(v) => { setSeriNo(v); setMevcutCihaz(null); snSorgula(v) }}
        title="Seri Numarası Tara"
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  taraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: 16, borderRadius: 10,
  },
  taraBtnT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bilgiKart: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8,
  },
  oneriKutu: { borderWidth: 1, borderRadius: 10, marginTop: 4, maxHeight: 260, overflow: 'hidden' },
  oneriSatir: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  kaydetBtn: {
    backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  kaydetT: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
