// @mention destekli çok satırlı giriş (mobile).
// '@' yazınca personel önerileri açılır; seçilen kişi @AdSoyad token'ı olarak eklenir.
// Ayrıca MentionText: kayıtlı metinlerde @token'ları renkli gösterir.
//
// Kullanım:
//   <MentionInput value={not} onChangeText={setNot} kullanicilar={personeller}
//     placeholder="Not yaz... (@ ile etiketle)" style={...} />
//   <MentionText metin={n.metin} kullanicilar={personeller} stil={{ color: ... }} />

import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { adToMentionToken, aktifMentionSorgusu, segmentMetin } from '../lib/mention'
import { trNormalize } from '../utils/trSearch'

export default function MentionInput({
  value,
  onChangeText,
  kullanicilar = [],
  placeholder,
  style,
  inputProps = {},
}) {
  const { colors } = useTheme()
  const sorgu = aktifMentionSorgusu(value)

  const oneriler = sorgu != null
    ? kullanicilar
        .filter(k => k.ad && trNormalize(k.ad).includes(trNormalize(sorgu)))
        .slice(0, 5)
    : []

  const sec = (k) => {
    const token = '@' + adToMentionToken(k.ad) + ' '
    onChangeText(value.replace(/@([\p{L}\p{N}_]*)$/u, token))
  }

  return (
    <View style={{ flex: 1 }}>
      {oneriler.length > 0 && (
        <View style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: 10,
          backgroundColor: colors.surface, marginBottom: 6, overflow: 'hidden',
        }}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 160 }}>
            {oneriler.map(k => (
              <TouchableOpacity
                key={k.id}
                onPress={() => sec(k)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 12, paddingVertical: 9,
                  borderBottomWidth: 1, borderBottomColor: colors.border,
                }}
              >
                <Feather name="at-sign" size={13} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{k.ad}</Text>
                {!!k.rol && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{k.rol}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <TextInput
        style={style}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaded}
        value={value}
        onChangeText={onChangeText}
        multiline
        {...inputProps}
      />
    </View>
  )
}

// Kayıtlı metinde @mention'ları vurgula
export function MentionText({ metin, kullanicilar = [], stil = {} }) {
  const { colors } = useTheme()
  const segmentler = segmentMetin(metin, kullanicilar)
  if (!segmentler.length) return null
  return (
    <Text style={stil}>
      {segmentler.map((s, i) =>
        s.tip === 'mention'
          ? <Text key={i} style={{ color: colors.primary, fontWeight: '700' }}>{s.deger}</Text>
          : <Text key={i}>{s.deger}</Text>
      )}
    </Text>
  )
}
