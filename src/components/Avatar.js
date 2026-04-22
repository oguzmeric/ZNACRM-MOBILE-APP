import { View, Text, Image, StyleSheet } from 'react-native'

// Kullanıcı avatarı — fotoğraf varsa göster, yoksa baş harfler
// Kullanım:
//   <Avatar ad="Oğuz Aktepe" fotoUrl="https://..." size={44} />

export const initialsAl = (ad) => {
  if (!ad) return '?'
  const parcalar = String(ad).trim().split(/\s+/)
  if (parcalar.length === 1) return parcalar[0].charAt(0).toUpperCase()
  return (parcalar[0].charAt(0) + parcalar[parcalar.length - 1].charAt(0)).toUpperCase()
}

export default function Avatar({ ad, fotoUrl, size = 44, style, bgRenk = '#2563eb' }) {
  const initials = initialsAl(ad)
  const boyut = {
    width: size,
    height: size,
    borderRadius: size / 2,
  }
  const fontSize = size * 0.38

  return (
    <View style={[styles.container, boyut, { backgroundColor: bgRenk }, style]}>
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={[boyut, { backgroundColor: '#1e293b' }]} />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  initials: {
    color: '#fff',
    fontWeight: '800',
  },
})
