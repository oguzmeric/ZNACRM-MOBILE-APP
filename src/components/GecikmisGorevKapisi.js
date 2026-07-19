// Gecikmiş GÖREV kapısı (mobil) — bitiş tarihi geçmiş görevi olan kullanıcı,
// sebep + açıklama + yeni bitiş tarihi girmeden (veya görevi tamamlamadan)
// uygulamayı kullanamaz. YALNIZ görevler içindir — servis talepleriyle
// hiçbir ilgisi yoktur (2026-07-19 talebi). Web'deki GecikmisGorevKapisi.jsx
// ile aynı kural seti.
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, AppState,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { gorevleriGetir, gorevGuncelle, gorevNotEkle, gorevDurumGuncelle } from '../services/gorevService'
import { bildirimEkleDb } from '../services/bildirimService'

const SEBEPLER = [
  { id: 'hava_muhalefeti',   isim: 'Hava Muhalefeti',   ikon: 'cloud-rain' },
  { id: 'program_yogunlugu', isim: 'Program Yoğunluğu', ikon: 'calendar' },
  { id: 'tamir_ariza',       isim: 'Tamir / Arıza',     ikon: 'tool' },
  { id: 'uretici_tedarik',   isim: 'Üretici / Tedarik', ikon: 'package' },
]

// Mobilde tarih seçici yerine hızlı ek süre çipleri — sahada tek dokunuş
const EK_SURELER = [
  { gun: 1, etiket: 'Yarın' },
  { gun: 3, etiket: '+3 gün' },
  { gun: 7, etiket: '+1 hafta' },
  { gun: 14, etiket: '+2 hafta' },
]

const bugunStr = () => new Date().toISOString().slice(0, 10)
const gunEkle = (gun) => {
  const d = new Date()
  d.setDate(d.getDate() + gun)
  return d.toISOString().slice(0, 10)
}
const trTarih = (iso) => iso.split('-').reverse().join('.')

const benimMi = (g, kullaniciId) => {
  const id = String(kullaniciId)
  if (String(g.atananId ?? '') === id) return true
  if (String(g.atanan ?? '') === id) return true
  if (Array.isArray(g.ekip) && g.ekip.map(String).includes(id)) return true
  return false
}

const gecikmeGunu = (sonTarih) => {
  const fark = Date.now() - new Date(sonTarih + 'T23:59:59').getTime()
  return Math.max(1, Math.ceil(fark / 86400000))
}

export default function GecikmisGorevKapisi() {
  const { kullanici } = useAuth()
  const { colors } = useTheme()
  const [gecikmisler, setGecikmisler] = useState([])
  const [sebep, setSebep] = useState(null)
  const [aciklama, setAciklama] = useState('')
  const [ekGun, setEkGun] = useState(null)
  const [hata, setHata] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const sonTaramaRef = useRef(0)

  useEffect(() => {
    if (!kullanici?.id) { setGecikmisler([]); return }
    let iptal = false

    const tara = async () => {
      sonTaramaRef.current = Date.now()
      try {
        const liste = await gorevleriGetir()
        if (iptal) return
        const bugun = bugunStr()
        // Kapıya TAKILMAYAN durumlar: kapalılar + onayda bekleyen + taslak +
        // bilinçli duraklatılmışlar (denetim bulgusu 2026-07-19, web ile aynı)
        const KAPI_DISI = ['tamamlandi', 'iptal', 'reddedildi', 'onay_bekliyor', 'taslak', 'beklemede', 'bilgi_bekleniyor']
        const geciken = (liste || [])
          .filter(g => !KAPI_DISI.includes(g.durum))
          .filter(g => g.sonTarih && String(g.sonTarih).slice(0, 10) < bugun)
          .filter(g => benimMi(g, kullanici.id))
          .sort((a, b) => String(a.sonTarih).localeCompare(String(b.sonTarih)))
        setGecikmisler(geciken)
      } catch (e) {
        console.warn('[gecikme kapisi]', e?.message)
      }
    }

    tara()
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      if (Date.now() - sonTaramaRef.current < 10 * 60_000) return
      tara()
    })
    return () => { iptal = true; sub.remove() }
  }, [kullanici?.id])

  const aktif = gecikmisler[0] || null
  const yeniTarih = useMemo(() => (ekGun ? gunEkle(ekGun) : null), [ekGun])

  useEffect(() => {
    setSebep(aktif?.devamSebep || null)
    setAciklama('')
    setEkGun(null)
    setHata('')
  }, [aktif?.id])

  if (!aktif) return null

  const gun = gecikmeGunu(String(aktif.sonTarih).slice(0, 10))
  const dusur = () => setGecikmisler(prev => prev.filter(g => g.id !== aktif.id))

  const ekSureKaydet = async () => {
    if (!sebep) { setHata('Gecikme sebebini seç.'); return }
    if (!aciklama.trim()) { setHata('Kısa bir açıklama zorunlu — ne oldu, neden gecikti?'); return }
    if (!yeniTarih) { setHata('Ek süre seç (yeni bitiş tarihi).'); return }
    setHata('')
    setMesgul(true)
    try {
      const g = await gorevGuncelle(aktif.id, { durum: 'devam', devamSebep: sebep, sonTarih: yeniTarih })
      if (!g) throw new Error('Görev güncellenemedi')
      const sebepAd = SEBEPLER.find(s => s.id === sebep)?.isim || sebep
      await gorevNotEkle(
        aktif.id,
        `⏰ Gecikme bildirimi (${gun} gün) — Sebep: ${sebepAd}. ${aciklama.trim()} · Yeni bitiş: ${trTarih(yeniTarih)}`,
        kullanici?.ad || '',
      ).catch(() => {})
      dusur()
    } catch (e) {
      setHata('Kaydedilemedi: ' + (e?.message || 'hata'))
    } finally {
      setMesgul(false)
    }
  }

  const tamamlandiYap = async () => {
    setMesgul(true)
    try {
      // Kapı, detay ekranındaki kapıları BAYPAS edemez (denetim bulgusu):
      // 1) Açık zorunlu alt görev varsa engelle
      const liste = await gorevleriGetir().catch(() => [])
      const KAPALI = ['tamamlandi', 'iptal', 'reddedildi']
      const acikZorunluAlt = (liste || []).filter(a =>
        String(a.ustGorevId) === String(aktif.id) && a.zorunlu !== false && !KAPALI.includes(a.durum))
      if (acikZorunluAlt.length > 0) {
        setHata(`Alt görevler tamamlanmadan bu görev kapatılamaz (${acikZorunluAlt.length} açık) — görev detayından yönet.`)
        return
      }
      // 2) Onay gerekliyse doğrudan kapanmaz, onaya gider
      const benOnaylayici = aktif.onaylayiciId
        ? String(aktif.onaylayiciId) === String(kullanici?.id)
        : (String(aktif.olusturanId ?? '') === String(kullanici?.id) || aktif.olusturanAd === kullanici?.ad)
      if (aktif.onayGerekli && !benOnaylayici) {
        const g = await gorevGuncelle(aktif.id, { durum: 'onay_bekliyor', onayDurumu: 'bekliyor', ilerleme: 100 })
        if (!g) throw new Error('Onaya gönderilemedi')
        const hedef = aktif.onaylayiciId || aktif.olusturanId
        if (hedef && String(hedef) !== String(kullanici?.id)) {
          bildirimEkleDb({
            aliciId: hedef, baslik: '⏳ Görev onayınızı bekliyor',
            mesaj: `${kullanici?.ad}, "${aktif.baslik}" görevini tamamladı — onayınız bekleniyor.`,
            tip: 'gorev', link: `/gorevler/${aktif.id}`,
          }).catch(() => {})
        }
        dusur()
        return
      }
      const g = await gorevDurumGuncelle(aktif.id, 'tamamlandi')
      if (!g) throw new Error('Görev güncellenemedi')
      dusur()
    } catch (e) {
      setHata('Kaydedilemedi: ' + (e?.message || 'hata'))
    } finally {
      setMesgul(false)
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', justifyContent: 'center', padding: 16 }}>
        <ScrollView
          style={{ maxHeight: '92%' }}
          contentContainerStyle={{ flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{
            backgroundColor: colors.surface, borderRadius: 16, padding: 18,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Feather name="alert-triangle" size={20} color="#f59e0b" />
              <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
                Gecikmiş görevin var{gecikmisler.length > 1 ? ` (${gecikmisler.length})` : ''}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
              Görev takibimizi hep birlikte güncel tutmak istiyoruz. Bitiş tarihi geçen görevin için
              kısa bir açıklama ve yeni bir bitiş tarihi girmeni rica ediyoruz — görev bittiyse tek
              dokunuşla tamamlandı yapabilirsin. ZNA Yönetim
            </Text>

            <View style={{
              backgroundColor: 'rgba(239,68,68,0.10)', borderLeftWidth: 3, borderLeftColor: '#ef4444',
              borderRadius: 8, padding: 12, marginBottom: 14,
            }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{aktif.baslik}</Text>
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                Bitiş: {trTarih(String(aktif.sonTarih).slice(0, 10))} · {gun} gün gecikti
              </Text>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>GECİKME SEBEBİ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SEBEPLER.map(s => {
                const secili = sebep === s.id
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSebep(s.id)}
                    style={{
                      width: '48%', paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                      backgroundColor: secili ? 'rgba(96,165,250,0.18)' : colors.surfaceAlt || 'rgba(148,163,184,0.08)',
                      borderWidth: 1, borderColor: secili ? '#60a5fa' : colors.border,
                    }}
                  >
                    <Feather name={s.ikon} size={18} color={secili ? '#93c5fd' : colors.textMuted} style={{ marginBottom: 4 }} />
                    <Text style={{ fontSize: 12, color: secili ? '#93c5fd' : colors.textPrimary, fontWeight: secili ? '700' : '400' }}>
                      {s.isim}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              AÇIKLAMA (ZORUNLU) — NE OLDU, NEDEN GECİKTİ?
            </Text>
            <TextInput
              value={aciklama}
              onChangeText={setAciklama}
              multiline
              numberOfLines={3}
              placeholder="Kısaca durumu yaz — görev notlarına işlenecek…"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.surfaceAlt || 'rgba(148,163,184,0.08)',
                borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                color: colors.textPrimary, padding: 10, minHeight: 70,
                textAlignVertical: 'top', marginBottom: 14, fontSize: 14,
              }}
            />

            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              EK SÜRE — YENİ BİTİŞ TARİHİ (ZORUNLU)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
              {EK_SURELER.map(e => {
                const secili = ekGun === e.gun
                return (
                  <TouchableOpacity
                    key={e.gun}
                    onPress={() => setEkGun(e.gun)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: secili ? 'rgba(96,165,250,0.18)' : colors.surfaceAlt || 'rgba(148,163,184,0.08)',
                      borderWidth: 1, borderColor: secili ? '#60a5fa' : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: secili ? '#93c5fd' : colors.textPrimary, fontWeight: secili ? '700' : '400' }}>
                      {e.etiket}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {yeniTarih && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                Yeni bitiş: {trTarih(yeniTarih)}
              </Text>
            )}

            {!!hata && (
              <Text style={{ color: '#ef4444', fontSize: 12.5, marginBottom: 8 }}>{hata}</Text>
            )}

            <TouchableOpacity
              onPress={ekSureKaydet}
              disabled={mesgul}
              style={{
                backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginTop: 6, opacity: mesgul ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                {mesgul ? 'Kaydediliyor…' : 'Ek Süreyi Kaydet ve Devam Et'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={tamamlandiYap}
              disabled={mesgul}
              style={{
                borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8,
                borderWidth: 1, borderColor: colors.border, opacity: mesgul ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 14 }}>✓ Görev Aslında Bitti — Tamamlandı Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
