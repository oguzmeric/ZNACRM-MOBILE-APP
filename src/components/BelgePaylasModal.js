import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { belgePaylas } from '../services/smsService'

const KANALLAR = [
  { id: 'sms', label: 'SMS', ikon: 'message-square' },
  { id: 'mail', label: 'E-posta', ikon: 'mail' },
  { id: 'her_ikisi', label: 'Her ikisi', ikon: 'send' },
]

const FORMATLAR = [
  { id: 'trassir', label: 'Trassir' },
  { id: 'karel', label: 'Karel' },
]

const smsVar = (kanal) => kanal === 'sms' || kanal === 'her_ikisi'
const mailVar = (kanal) => kanal === 'mail' || kanal === 'her_ikisi'

export default function BelgePaylasModal({
  visible,
  onClose,
  belgeTipi,         // 'teklif' | 'servis_raporu'
  belgeId,
  formatSecimi = false,
  prefillGsm = '',
  prefillEmail = '',
  baslikMetni = '',
  onBeforeSend,        // opsiyonel async — gonderim oncesi calisir (orn. formu arsivle)
  hazirlikMetni = 'Hazırlanıyor…',
}) {
  const { colors } = useTheme()
  const [kanal, setKanal] = useState('sms')
  const [sablon, setSablon] = useState('trassir')
  const [sirket, setSirket] = useState('zna') // servis raporu: ZNA / Anadolunet
  const [gsm, setGsm] = useState('')
  const [email, setEmail] = useState('')
  const [ozelMesaj, setOzelMesaj] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hazirlaniyor, setHazirlaniyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)

  // Modal her açıldığında alanları kayıttan tazele
  useEffect(() => {
    if (visible) {
      setKanal('sms')
      setSablon('trassir')
      setSirket('zna')
      setGsm(prefillGsm ?? '')
      setEmail(prefillEmail ?? '')
      setOzelMesaj('')
      setSonuc(null)
      setGonderiliyor(false)
    }
  }, [visible, prefillGsm, prefillEmail])

  const gonder = async () => {
    if (smsVar(kanal) && !gsm.trim()) {
      Alert.alert('Eksik bilgi', 'SMS için telefon numarası gir.')
      return
    }
    if (mailVar(kanal) && !email.trim()) {
      Alert.alert('Eksik bilgi', 'E-posta için adres gir.')
      return
    }
    // Gönderim öncesi hazırlık (örn. servis formunu üret + arşivle)
    if (onBeforeSend) {
      setHazirlaniyor(true)
      try {
        await onBeforeSend()
      } catch (e) {
        setHazirlaniyor(false)
        Alert.alert('Hazırlanamadı', `Belge hazırlanamadı, gönderim iptal edildi.\n${String(e?.message ?? e)}`)
        return
      }
      setHazirlaniyor(false)
    }

    setGonderiliyor(true)
    try {
      const args = {
        belge_tipi: belgeTipi,
        belge_id: belgeId,
        kanal,
        sure_gun: 30,
      }
      if (smsVar(kanal)) args.gsm = gsm.trim()
      if (mailVar(kanal)) args.email = email.trim()
      if (formatSecimi) args.sablon = sablon
      if (belgeTipi === 'servis_raporu') args.sirket = sirket
      if (ozelMesaj.trim()) args.ozel_mesaj = ozelMesaj.trim()

      const res = await belgePaylas(args)
      setSonuc(res)
    } catch (e) {
      Alert.alert('Gönderilemedi', String(e?.message ?? e))
    } finally {
      setGonderiliyor(false)
    }
  }

  const linkPaylas = async () => {
    if (!sonuc?.link) return
    try {
      await Share.share({ message: sonuc.link })
    } catch {
      // kullanıcı iptal etti — sessiz geç
    }
  }

  const durumOzeti = () => {
    if (!sonuc) return ''
    const parcalar = []
    if (sonuc.sms_durumu) parcalar.push(`SMS: ${sonuc.sms_durumu}`)
    if (sonuc.mail_durumu) parcalar.push(`E-posta: ${sonuc.mail_durumu}`)
    return parcalar.join('  ·  ')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.arka}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Başlık */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.baslik, { color: colors.textPrimary }]}>Müşteriye Gönder</Text>
              {!!baslikMetni && (
                <Text style={[styles.altBaslik, { color: colors.textMuted }]} numberOfLines={1}>
                  {baslikMetni}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {sonuc ? (
            /* ---- Başarı görünümü ---- */
            <View style={styles.govde}>
              <View style={styles.basariIkon}>
                <Feather name="check-circle" size={40} color="#22c55e" />
              </View>
              <Text style={[styles.basariBaslik, { color: colors.textPrimary }]}>
                {sonuc.kismi ? 'Kısmen gönderildi' : 'Gönderildi'}
              </Text>
              {!!durumOzeti() && (
                <Text style={[styles.basariDurum, { color: colors.textMuted }]}>{durumOzeti()}</Text>
              )}
              <Text style={[styles.linkLabel, { color: colors.textFaded }]}>MÜŞTERİ LİNKİ</Text>
              <Text selectable style={[styles.linkMetin, { color: colors.primaryLight, borderColor: colors.border }]}>
                {sonuc.link}
              </Text>
              <TouchableOpacity style={[styles.gonderBtn, { backgroundColor: colors.primary }]} onPress={linkPaylas}>
                <Feather name="share-2" size={18} color="#fff" />
                <Text style={styles.gonderBtnText}>Linki Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.kapatBtn} onPress={onClose}>
                <Text style={[styles.kapatBtnText, { color: colors.textMuted }]}>Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ---- Form görünümü ---- */
            <ScrollView contentContainerStyle={styles.govde} keyboardShouldPersistTaps="handled">
              {/* Kanal */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Gönderim Kanalı</Text>
              <View style={styles.segment}>
                {KANALLAR.map((k) => {
                  const aktif = kanal === k.id
                  return (
                    <TouchableOpacity
                      key={k.id}
                      style={[
                        styles.segItem,
                        { borderColor: colors.border },
                        aktif && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setKanal(k.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name={k.ikon} size={14} color={aktif ? '#fff' : colors.textMuted} />
                      <Text style={[styles.segText, { color: aktif ? '#fff' : colors.textMuted }]}>{k.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Format (yalnız teklif) */}
              {formatSecimi && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Teklif Formatı</Text>
                  <View style={styles.segment}>
                    {FORMATLAR.map((f) => {
                      const aktif = sablon === f.id
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.segItem,
                            { borderColor: colors.border },
                            aktif && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => setSablon(f.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.segText, { color: aktif ? '#fff' : colors.textMuted }]}>{f.label}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}

              {/* Şirket/format — servis raporu için ZNA / Anadolunet */}
              {belgeTipi === 'servis_raporu' && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Form Şirketi</Text>
                  <View style={styles.segment}>
                    {[{ id: 'zna', label: 'ZNA Teknoloji' }, { id: 'anadolunet', label: 'Anadolunet' }].map((s) => {
                      const aktif = sirket === s.id
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.segItem, { borderColor: colors.border }, aktif && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                          onPress={() => setSirket(s.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.segText, { color: aktif ? '#fff' : colors.textMuted }]}>{s.label}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}

              {/* Telefon */}
              {smsVar(kanal) && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Telefon (SMS)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
                    value={gsm}
                    onChangeText={setGsm}
                    placeholder="5XX XXX XX XX"
                    placeholderTextColor={colors.textFaded}
                    keyboardType="phone-pad"
                  />
                </>
              )}

              {/* E-posta */}
              {mailVar(kanal) && (
                <>
                  <Text style={[styles.label, { color: colors.textMuted }]}>E-posta</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="ornek@firma.com"
                    placeholderTextColor={colors.textFaded}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </>
              )}

              {/* Özel mesaj */}
              <Text style={[styles.label, { color: colors.textMuted }]}>Özel Mesaj (opsiyonel)</Text>
              <TextInput
                style={[styles.input, styles.cokSatir, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceDark }]}
                value={ozelMesaj}
                onChangeText={setOzelMesaj}
                placeholder="Mail gövdesine eklenecek not…"
                placeholderTextColor={colors.textFaded}
                multiline
              />

              <TouchableOpacity
                style={[styles.gonderBtn, { backgroundColor: colors.primary }, (gonderiliyor || hazirlaniyor) && { opacity: 0.7 }]}
                onPress={gonder}
                disabled={gonderiliyor || hazirlaniyor}
                activeOpacity={0.85}
              >
                {gonderiliyor || hazirlaniyor ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="send" size={18} color="#fff" />
                )}
                <Text style={styles.gonderBtnText}>
                  {hazirlaniyor ? hazirlikMetni : gonderiliyor ? 'Gönderiliyor…' : 'Gönder'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  arka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  baslik: { fontSize: 16, fontWeight: '800' },
  altBaslik: { fontSize: 12, marginTop: 2 },
  govde: { padding: 16, paddingBottom: 28 },

  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  segText: { fontWeight: '700', fontSize: 13 },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  cokSatir: { minHeight: 70, textAlignVertical: 'top' },

  gonderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 15,
    borderRadius: 12,
    marginTop: 22,
  },
  gonderBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  basariIkon: { alignItems: 'center', marginTop: 8 },
  basariBaslik: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  basariDurum: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  linkLabel: { fontSize: 11, fontWeight: '700', marginTop: 22, marginBottom: 6 },
  linkMetin: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    lineHeight: 19,
  },
  kapatBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  kapatBtnText: { fontSize: 14, fontWeight: '600' },
})
