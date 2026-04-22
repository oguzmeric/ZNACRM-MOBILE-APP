// Merkezi tema dosyası — renkler, boyutlar, gölgeler
// Gece (koyu) ve gündüz (açık) paletleri — ThemeContext üzerinden seçilir

export const darkColors = {
  mod: 'gece',
  // Arka plan
  bg: '#0a0f1e',
  bgDark: '#0a0f1e',
  surface: '#1e293b',
  surfaceDark: '#0f172a',
  surfaceTransparent: 'rgba(30, 41, 59, 0.85)',

  // Çerçeve
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: '#334155',

  // Yazı
  textPrimary: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textFaded: '#64748b',
  textDim: '#475569',

  // Marka
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#60a5fa',
  accent: '#7c3aed',

  // Durum
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',

  // Glow
  glowBlue: '#2563eb',
  glowPurple: '#7c3aed',
  glowOpacity: 0.10,
}

export const lightColors = {
  mod: 'gunduz',
  bg: '#f8fafc',
  bgDark: '#f1f5f9',
  surface: '#ffffff',
  surfaceDark: '#f1f5f9',
  surfaceTransparent: 'rgba(255, 255, 255, 0.85)',

  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: '#cbd5e1',

  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textFaded: '#94a3b8',
  textDim: '#cbd5e1',

  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',
  accent: '#7c3aed',

  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  purple: '#9333ea',
  cyan: '#0891b2',

  glowBlue: '#2563eb',
  glowPurple: '#7c3aed',
  glowOpacity: 0.12,
}

// Geriye uyumluluk — mevcut `colors` import'u koyu paletini döner
// Yeni kod `useTheme()` hook'unu kullanmalı
export const colors = darkColors

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
}

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
}
