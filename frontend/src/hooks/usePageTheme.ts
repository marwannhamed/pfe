import type { CSSProperties } from 'react';
import { useThemeStore, type ThemeColors } from '../store/themeStore';

/** Shared layout + card styles for custom (non-Ant) page UI. */
export function themedStyles(t: ThemeColors, isDark = false) {
  const card: CSSProperties = {
    background: t.cardBg,
    borderRadius: 12,
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  return {
    page: { padding: 24, minHeight: '100%' } satisfies CSSProperties,
    card,
    cardLg: { ...card, borderRadius: 14 } satisfies CSSProperties,
    input: {
      width: '100%',
      padding: '9px 12px',
      borderRadius: 8,
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      color: t.text,
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box',
    } satisfies CSSProperties,
    tableHead: {
      background: t.tableHead,
      borderBottom: `1px solid ${t.cardBorder}`,
      fontSize: 11,
      fontWeight: 600,
      color: t.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    } satisfies CSSProperties,
    btnSecondary: {
      padding: '9px 16px',
      borderRadius: 8,
      border: `1px solid ${t.cardBorder}`,
      background: t.cardBg,
      color: t.text,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
    } satisfies CSSProperties,
    btnGhost: {
      padding: '9px 16px',
      borderRadius: 8,
      border: `1px solid ${t.cardBorder}`,
      background: t.hover,
      color: t.text,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
    } satisfies CSSProperties,
    btnPrimary: {
      padding: '9px 18px',
      borderRadius: 8,
      border: 'none',
      background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
      color: '#fff',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
    } satisfies CSSProperties,
    btnIcon: {
      padding: '8px 14px',
      borderRadius: 8,
      border: `1px solid ${t.cardBorder}`,
      background: t.cardBg,
      color: t.text,
      cursor: 'pointer',
      fontSize: 13,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    } satisfies CSSProperties,
    headerCard: {
      ...card,
      padding: '20px 24px',
      marginBottom: 20,
      borderTop: '4px solid #2563eb',
      boxShadow: isDark
        ? '0 4px 24px rgba(0,0,0,0.35)'
        : '0 4px 24px rgba(37, 99, 235, 0.1)',
    } satisfies CSSProperties,
    statCell: {
      background: t.tableHead,
      borderRadius: 10,
      padding: '12px 16px',
      border: `1px solid ${t.cardBorder}`,
    } satisfies CSSProperties,
  };
}

export function usePageTheme() {
  const { t, isDark } = useThemeStore();
  return { t, isDark, ...themedStyles(t, isDark) };
}

/** The palette object `usePageTheme().t` returns — handy for typing props. */
export type PageTheme = ReturnType<typeof usePageTheme>['t'];
