// Tüm liste/içerik ekranlarında tutarlı "veri yok" görünümü.
// Kullanım:
//   <EmptyState ikon="inbox" baslik="Görev yok" mesaj="Yeni görev ekleyerek başla" />
//   <EmptyState ikon="bell-off" baslik="Henüz bildirim yok" />
//   <EmptyState ikon="alert-triangle" baslik="Bulunamadı" tip="hata" />
//
// CTA istenirse:
//   <EmptyState
//     ikon="plus-circle"
//     baslik="Henüz müşteri yok"
//     mesaj="İlk müşterini ekleyerek başla"
//     buton="Yeni Müşteri"
//     onPress={() => navigation.navigate('YeniMüşteri')}
//   />

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'

export default function EmptyState({
  ikon = 'inbox',
  baslik,
  mesaj,
  buton,
  onPress,
  tip = 'normal',  // 'normal' | 'hata'
  kompakt = false,
}) {
  const { colors } = useTheme()
  const renk = tip === 'hata' ? colors.danger ?? '#ef4444' : colors.textMuted

  return (
    <View style={[styles.kapsayici, kompakt && styles.kompakt]}>
      <View style={[styles.ikonKutu, { backgroundColor: `${renk}15` }]}>
        <Feather name={ikon} size={kompakt ? 22 : 32} color={renk} />
      </View>
      {!!baslik && (
        <Text style={[styles.baslik, { color: colors.textPrimary }, kompakt && { fontSize: 14 }]}>
          {baslik}
        </Text>
      )}
      {!!mesaj && (
        <Text style={[styles.mesaj, { color: colors.textFaded }, kompakt && { fontSize: 12, marginTop: 4 }]}>
          {mesaj}
        </Text>
      )}
      {!!buton && onPress && (
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: colors.primary }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={14} color="#fff" />
          <Text style={styles.butonText}>{buton}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  kapsayici: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  kompakt: { paddingVertical: 20 },
  ikonKutu: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  baslik: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  mesaj: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  buton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  butonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
