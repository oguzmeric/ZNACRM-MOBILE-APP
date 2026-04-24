import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '../../components/ScreenContainer'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { adminKpiGetir, aktiviteFeed } from '../../services/adminStatsService'
import { tarihSaatFormat } from '../../utils/format'

export default function AdminDashboardScreen({ navigation }) {
  const { kullanici, modDegistir } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [kpi, setKpi] = useState({ onayBekleyen: null, aktifServis: null, kronikAriza: null, minStokAlti: null, acikDestek: 0, onayKuyrugu: 0 })
  const [olaylar, setOlaylar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const yukle = useCallback(async () => {
    const [veri, feed] = await Promise.all([adminKpiGetir(), aktiviteFeed(20)])
    setKpi(veri)
    setOlaylar(feed ?? [])
    setYukleniyor(false)
  }, [])

  useFocusEffect(useCallback(() => { yukle() }, [yukle]))

  const onRefresh = async () => {
    setRefreshing(true)
    await yukle()
    setRefreshing(false)
  }

  const kpiDeger = (v) => (yukleniyor ? '…' : v == null ? '—' : String(v))

  const teknisyeneGec = () => modDegistir('teknisyen')

  return (
    <ScreenContainer>
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 24, flexGrow: 1, justifyContent: 'center' },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
        >
          {/* Üst bar */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Yönetim Paneli</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {kullanici?.ad} · {kullanici?.unvan}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.profilBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('Profil')}
              activeOpacity={0.8}
            >
              <Feather name="user" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modBtn, { marginLeft: 8 }]} onPress={teknisyeneGec}>
              <Feather name="log-out" size={14} color="#60a5fa" />
              <Text style={styles.modBtnText}>Teknisyene Dön</Text>
            </TouchableOpacity>
          </View>

          {/* Placeholder KPI kartları — sonraki adımda veri bağlanacak */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>⚡ Özet</Text>
          <View style={styles.kpiGrid}>
            <KpiCard sayi={kpiDeger(kpi.onayBekleyen)} label="Atanmamış" ikon="user-x" renk="#f59e0b" />
            <KpiCard sayi={kpiDeger(kpi.aktifServis)} label="Aktif Servis" ikon="briefcase" renk="#2563eb" />
            <KpiCard sayi={kpiDeger(kpi.kronikAriza)} label="Kronik Arıza" ikon="alert-triangle" renk="#ef4444" />
            <KpiCard sayi={kpiDeger(kpi.minStokAlti)} label="Min-Stok Altı" ikon="package" renk="#a855f7" />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>🗂️ Modüller</Text>
          <View style={styles.moduleGrid}>
            <ModuleCard
              title="Servis Atama"
              hint="Atanmamış talepleri ata"
              ikon="user-plus"
              renk="#f59e0b"
              badge={kpi.onayBekleyen}
              onPress={() => navigation.navigate('AdminServisAtama')}
            />
            <ModuleCard
              title="Personel Takip"
              hint="Kim nerede, üstünde ne var"
              ikon="users"
              renk="#3b82f6"
              onPress={() => navigation.navigate('AdminPersonelTakip')}
            />
            <ModuleCard
              title="Onay Kuyruğu"
              hint="Servisleri onayla / reddet"
              ikon="check-square"
              renk="#22c55e"
              badge={kpi.onayKuyrugu}
              onPress={() => navigation.navigate('AdminOnayKuyrugu')}
            />
            <ModuleCard
              title="Stok Raporu"
              hint="Depo durumu, uyarılar"
              ikon="package"
              renk="#a855f7"
              onPress={() => navigation.navigate('AdminStokRaporu')}
            />
            <ModuleCard
              title="Destek Talepleri"
              hint="Cevaplanmayı bekleyen"
              ikon="help-circle"
              renk="#f59e0b"
              badge={kpi.acikDestek}
              onPress={() => navigation.navigate('AdminDestekTalepleri')}
            />
            <ModuleCard
              title="Kronik Arıza"
              hint="3+ arıza yaşayan cihazlar"
              ikon="alert-triangle"
              renk="#ef4444"
              badge={kpi.kronikAriza}
              onPress={() => navigation.navigate('AdminKronikAriza')}
            />
            <ModuleCard
              title="Görevler"
              hint="Atama + takip"
              ikon="clipboard"
              renk="#0ea5e9"
              onPress={() => navigation.navigate('Görevler')}
            />
            <ModuleCard
              title="Raporlar"
              hint="İstatistikler & trend"
              ikon="bar-chart-2"
              renk="#06b6d4"
              onPress={() => navigation.navigate('AdminRaporlar')}
            />
          </View>

          {/* Aktivite feed */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 8 }]}>📡 Son Aktiviteler</Text>
          {olaylar.length === 0 ? (
            <Text style={[styles.bos, { color: colors.textFaded }]}>Henüz aktivite yok.</Text>
          ) : (
            olaylar.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.olayKart, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => o.rota && navigation.navigate(o.rota.name, o.rota.params)}
                activeOpacity={o.rota ? 0.7 : 1}
                disabled={!o.rota}
              >
                <View style={[styles.olayIkon, { backgroundColor: o.renk + '22' }]}>
                  <Feather name={o.ikon} size={14} color={o.renk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.olayMetin, { color: colors.textPrimary }]} numberOfLines={1}>
                    {o.metin}
                  </Text>
                  {!!o.altMetin && (
                    <Text style={[styles.olayAlt, { color: colors.textMuted }]} numberOfLines={1}>
                      {o.altMetin}
                    </Text>
                  )}
                </View>
                <Text style={[styles.olayTarih, { color: colors.textFaded }]} numberOfLines={1}>
                  {tarihSaatFormat(o.tarih)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Sabit alt bilgi */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textPrimary }]}>
            Bu panel{' '}
            <Text style={styles.footerHighlight}>
              Oğuz Meriç
            </Text>{' '}
            tarafından geliştiriliyor.
          </Text>
          <Text style={[styles.footerSub, { color: colors.textMuted }]}>
            Yakında KPI kartları canlı veri gösterecek ve modüller aktifleşecektir.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  )
}

function KpiCard({ sayi, label, ikon, renk }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: renk }]}>
      <View style={styles.kpiHeaderRow}>
        <Feather name={ikon} size={16} color={renk} />
        <Text style={[styles.kpiSayi, { color: renk }]}>{sayi}</Text>
      </View>
      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  )
}

function ModuleCard({ title, hint, ikon, renk, onPress, badge }) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[styles.moduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.moduleIconWrap, { backgroundColor: renk + '22' }]}>
        <Feather name={ikon} size={22} color={renk} />
      </View>
      <Text style={[styles.moduleTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.moduleHint, { color: colors.textFaded }]}>{hint}</Text>

      {Number(badge) > 0 && (
        <View style={[styles.badge, { borderColor: colors.bg }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  modBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  modBtnText: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  profilBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiSayi: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },

  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  moduleCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  moduleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  moduleTitle: { fontSize: 14, fontWeight: '700' },
  moduleHint: { fontSize: 11, marginTop: 4 },

  olayKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  olayIkon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  olayMetin: { fontSize: 12, fontWeight: '700' },
  olayAlt: { fontSize: 11, marginTop: 2 },
  olayTarih: { fontSize: 10, fontWeight: '600' },
  bos: { fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },

  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  footerHighlight: {
    fontWeight: '900',
  },
  footerSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
})
