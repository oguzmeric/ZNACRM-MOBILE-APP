// Magic Navigation TabBar — active tab'in arkasında yuvarlak (lifted)
// indicator, tab'lar arası geçişte yumuşak slide animasyonu.
// Bottom Tabs Navigator'a `tabBar={(props) => <MagicTabBar {...props} />}` olarak verilir.

import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'

const IKONLAR = {
  'Ana Sayfa': 'home',
  'Görevler':  'check-square',
  'Servisler': 'tool',
  'Tara':      'maximize',
  'Profil':    'user',
}

const INDICATOR_BOYUT = 44   // yuvarlak indicator çapı
const TAB_BAR_YUKSEKLIK = 64 // tab bar yüksekliği (label + ikon + padding)

export default function MagicTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const ekranGenisligi = Dimensions.get('window').width
  const tabSayisi = state.routes.length
  const tabGenisligi = ekranGenisligi / tabSayisi

  // Indicator pozisyonu (animasyonlu)
  const indicatorX = useSharedValue(0)

  // İlk render'da & her tab değişiminde animasyon
  useEffect(() => {
    const hedef = state.index * tabGenisligi + (tabGenisligi - INDICATOR_BOYUT) / 2
    indicatorX.value = withSpring(hedef, {
      damping: 18,
      stiffness: 180,
      mass: 0.6,
    })
  }, [state.index, tabGenisligi])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  // "Ana Sayfa"da tab bar gizli (mevcut davranış — options.tabBarStyle.display)
  const aktifRoute = state.routes[state.index]
  const aktifOptions = descriptors[aktifRoute.key]?.options
  if (aktifOptions?.tabBarStyle?.display === 'none') {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          height: TAB_BAR_YUKSEKLIK + insets.bottom,
        },
      ]}
    >
      {/* Slide eden yuvarlak indicator — tab bar'ın bir miktar yukarı taşan (lifted) parçası.
          Etrafındaki renkli halka (borderColor: bg) "carved out / floating" hissini verir. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          indicatorStyle,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            borderColor: colors.bg,
          },
        ]}
      />

      {/* Tab'lar */}
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const ikonAd = IKONLAR[route.name] ?? 'circle'

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key })
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <Feather
                name={ikonAd}
                size={focused ? 22 : 20}
                color={focused ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.label,
                  { color: focused ? colors.primary : colors.textMuted, fontWeight: focused ? '700' : '500' },
                ]}
                numberOfLines={1}
              >
                {route.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_YUKSEKLIK - 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    top: -INDICATOR_BOYUT / 2 + 8,         // tab bar'dan yukarı taşan (lifted) miktar
    width: INDICATOR_BOYUT,
    height: INDICATOR_BOYUT,
    borderRadius: INDICATOR_BOYUT / 2,
    // iOS gölge
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    // Android elevation
    elevation: 8,
    // Beyaz bir halka — indicator tab bar'dan ayrılsın
    borderWidth: 4,
    borderColor: 'transparent',
  },
})
