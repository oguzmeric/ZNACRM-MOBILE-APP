// Magic Navigation TabBar — active tab'in arkasında yuvarlak (lifted) indicator,
// tab'lar arası geçişte yumuşak slide animasyonu.
// Bottom Tabs Navigator'a `tabBar={(props) => <MagicTabBar {...props} />}` olarak verilir.

import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
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

const INDICATOR_BOYUT = 40        // yuvarlak indicator çapı (Reel'deki gibi, icon'u kapsayan boy)
const INDICATOR_YUKARI = 14       // tab bar'dan yukarı taşma miktarı (lifted)
const TAB_BAR_YUKSEKLIK = 58      // tab bar yüksekliği

export default function MagicTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const ekranGenisligi = Dimensions.get('window').width
  const tabSayisi = state.routes.length
  const tabGenisligi = ekranGenisligi / tabSayisi

  const indicatorX = useSharedValue((tabGenisligi - INDICATOR_BOYUT) / 2)

  useEffect(() => {
    const hedef = state.index * tabGenisligi + (tabGenisligi - INDICATOR_BOYUT) / 2
    indicatorX.value = withSpring(hedef, { damping: 18, stiffness: 180, mass: 0.6 })
  }, [state.index, tabGenisligi])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  // Ana Sayfa'da tab bar gizli olsun (mevcut davranış)
  const aktifRoute = state.routes[state.index]
  const aktifOptions = descriptors[aktifRoute.key]?.options
  if (aktifOptions?.tabBarStyle?.display === 'none') return null

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
      {/* Slide eden yuvarlak indicator — icon'un arkasında, yarısı tab bar dışında.
          zIndex: 1 → tab item'ların altında (icon'lar üstte beyaz renkte gözüksün). */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          indicatorStyle,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            borderColor: colors.bg,  // tab bar'dan ayrılmış görünsün
          },
        ]}
      />

      {/* Tab'lar — zIndex: 2 → indicator'ın üstünde render olur */}
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
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              {/* Icon container — yukarı taşan kısım için yer açar */}
              <View style={styles.iconWrap}>
                <Feather
                  name={ikonAd}
                  size={20}
                  color={focused ? '#fff' : colors.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: focused ? colors.primary : colors.textMuted,
                    fontWeight: focused ? '700' : '500',
                    opacity: focused ? 1 : 0.9,
                  },
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
    overflow: 'visible',  // indicator'ın üst kısmı dışarı taşabilsin
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 8,
    zIndex: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconWrap: {
    width: INDICATOR_BOYUT,
    height: INDICATOR_BOYUT,
    alignItems: 'center',
    justifyContent: 'center',
    // Icon'u yukarı kaydır → indicator'ın merkeziyle hizalı
    marginTop: -INDICATOR_YUKARI,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    top: -INDICATOR_YUKARI + 8,  // yarısı tab bar içinde, yarısı dışarıda
    width: INDICATOR_BOYUT,
    height: INDICATOR_BOYUT,
    borderRadius: INDICATOR_BOYUT / 2,
    borderWidth: 4,
    // iOS gölge
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    // Android elevation
    elevation: 6,
    zIndex: 1,
  },
})
