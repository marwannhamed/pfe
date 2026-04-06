import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Color tokens ─────────────────────────────────────────────────────────────
export interface ThemeColors {
  pageBg:      string;
  cardBg:      string;
  cardBorder:  string;
  cardShadow:  string;
  text:        string;
  textSub:     string;
  textMuted:   string;
  tableHead:   string;
  divider:     string;
  hover:       string;
  inputBg:     string;
  inputBorder: string;
  topbar:      string;
  badge:       string;
  badgeText:   string;
}

export const LIGHT: ThemeColors = {
  pageBg:      '#f8fafc',
  cardBg:      '#fff',
  cardBorder:  '#e5e7eb',
  cardShadow:  '0 1px 6px rgba(0,0,0,0.06)',
  text:        '#0f172a',
  textSub:     '#64748b',
  textMuted:   '#94a3b8',
  tableHead:   '#f8fafc',
  divider:     '#f1f5f9',
  hover:       '#fafafa',
  inputBg:     '#fff',
  inputBorder: '#e5e7eb',
  topbar:      '#fff',
  badge:       '#f1f5f9',
  badgeText:   '#475569',
};

export const DARK: ThemeColors = {
  pageBg:      '#0f172a',
  cardBg:      '#1e293b',
  cardBorder:  '#334155',
  cardShadow:  '0 1px 6px rgba(0,0,0,0.4)',
  text:        '#f1f5f9',
  textSub:     '#94a3b8',
  textMuted:   '#64748b',
  tableHead:   '#0f172a',
  divider:     '#334155',
  hover:       '#253347',
  inputBg:     '#334155',
  inputBorder: '#475569',
  topbar:      '#1e293b',
  badge:       '#334155',
  badgeText:   '#94a3b8',
};

// ─── Store ────────────────────────────────────────────────────────────────────
interface ThemeStore {
  isDark: boolean;
  t:      ThemeColors;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: false,
      t:      LIGHT,
      toggle: () => {
        const next = !get().isDark;
        set({ isDark: next, t: next ? DARK : LIGHT });
      },
    }),
    { name: 'lm-theme' }
  )
);