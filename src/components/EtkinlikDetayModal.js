// Etkinlik detay modal'ı (mobile) — başlık, zaman, lokasyon, davetli,
// Meet linki + Sil butonu. Web'deki HariciEtkinlikDetay'in karşılığı.

import { useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { etkinlikSil } from '../services/takvimService'

const pad = (n) => String(n).padStart(2, '0')

export default function EtkinlikDetayModal({ visible, etkinlik, onKapat, onSilindi }) {
  const { colors } = useTheme()
  const [siliniyor, setSiliniyor] = useState(false)

  if (!visible || !etkinlik) return null

  const h = etkinlik
  const baslangic = h.baslangic ? new Date(h.baslangic) : null
  const bitis = h.bitis ? new Date(h.bitis) : null

  const tarihStr = baslangic?.toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const saatStr = h.tum_gun
    ? 'Tüm gün'
    : `${baslangic ? `${pad(baslangic.getHours())}:${pad(baslangic.getMinutes())}` : ''}` +
      `${bitis ? ` — ${pad(bitis.getHours())}:${pad(bitis.getMinutes())}` : ''}`

  const silTikla = () => {
    Alert.alert(
      'Etkinliği Sil',
      `"${h.baslik || '(başlıksız)'}" silinecek.\n\nBu işlem Google Calendar'dan da kaldıracak ve davetlilere iptal bildirimi gönderecek. Geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, sil', style: 'destructive',
          onPress: async () => {
            setSiliniyor(true)
            try {
              await etkinlikSil(h.id)
              onSilindi?.()
            } catch (e) {
              Alert.alert('Hata', e?.message ?? 'Silinemedi.')
              setSiliniyor(false)
            }
          },
        },
      ],
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onKapat}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.bg,
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          paddingTop: 12, paddingBottom: 24,
          maxHeight: '85%',
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: h.toplanti_linki ? '#1a73e815' : '#a855f720',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather
                  name={h.toplanti_linki ? 'video' : 'calendar'}
                  size={18}
                  color={h.toplanti_linki ? '#1a73e8' : '#a855f7'}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }} numberOfLines={2}>
                  {h.baslik || '(başlıksız)'}
                </Text>
                <Text style={{ color: h.toplanti_linki ? '#1a73e8' : '#a855f7', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  {h.toplanti_linki ? 'Google Meet' : 'Google Takvim'}
                </Text>
              </View>
              <TouchableOpacity onPress={onKapat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Zaman */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <Feather name="clock" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' }}>
                  {tarihStr}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {saatStr}
                </Text>
              </View>
            </View>

            {/* Meet katıl */}
            {h.toplanti_linki && (
              <TouchableOpacity
                onPress={() => Linking.openURL(h.toplanti_linki)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginVertical: 6,
                  padding: 12,
                  backgroundColor: '#1a73e8',
                  borderRadius: 10,
                }}
              >
                <Feather name="video" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Toplantıya Katıl</Text>
                <Feather name="external-link" size={12} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Lokasyon */}
            {h.lokasyon && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <Feather name="map-pin" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 13, flex: 1 }}>{h.lokasyon}</Text>
              </View>
            )}

            {/* Organizatör */}
            {h.organizator_email && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Feather name="user" size={16} color={colors.textMuted} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  <Text style={{ color: colors.textMuted }}>Organizatör: </Text>
                  {h.organizator_email}
                </Text>
              </View>
            )}

            {/* Davetliler */}
            {Array.isArray(h.davetliler) && h.davetliler.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <Feather name="users" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                    {h.davetliler.length} Davetli
                  </Text>
                  {h.davetliler.slice(0, 6).map((d, i) => (
                    <Text key={i} style={{ color: colors.textPrimary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {d.isim || d.email}
                      {d.durum && <Text style={{ color: colors.textMuted }}> · {d.durum}</Text>}
                    </Text>
                  ))}
                  {h.davetliler.length > 6 && (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      +{h.davetliler.length - 6} kişi daha
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Açıklama */}
            {h.aciklama && (
              <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
                  Açıklama
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>
                  {h.aciklama.replace(/<[^>]+>/g, '')}
                </Text>
              </View>
            )}

            {/* Footer: Sil butonu — büyük ve görünür */}
            <TouchableOpacity
              onPress={silTikla}
              disabled={siliniyor}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 20,
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#ef4444',
                backgroundColor: '#ef444415',
                opacity: siliniyor ? 0.5 : 1,
              }}
            >
              <Feather name="trash-2" size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700' }}>
                {siliniyor ? 'Siliniyor…' : 'Etkinliği Sil'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
