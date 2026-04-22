import { KeyboardAvoidingView, ScrollView, Platform } from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'

// Form ekranları için ortak sarmalayıcı — klavye açıldığında input'un kapanmamasını sağlar.
// iOS ve Android için farklı davranışlar uygular.
//
// Kullanım:
//   <FormScroll contentStyle={{ padding: 16, paddingBottom: 80 }}>
//     <TextInput ... />
//     <TouchableOpacity ... />
//   </FormScroll>

export default function FormScroll({ children, contentStyle, style, extraOffset = 0 }) {
  let headerHeight = 0
  try {
    headerHeight = useHeaderHeight()
  } catch {}

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight + extraOffset}
    >
      <ScrollView
        contentContainerStyle={[
          { padding: 16, paddingBottom: 120 },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
