import type { CSSProperties, ReactNode } from 'react';
import { usePageTheme } from '../hooks/usePageTheme';

type ThemedPageContext = ReturnType<typeof usePageTheme>;

const ctx: { current: ThemedPageContext | null } = { current: null };

/** Read theme from nearest ThemedPage wrapper (for modals defined in the same file). */
export function useThemedPage(): ThemedPageContext {
  const hook = usePageTheme();
  return ctx.current ?? hook;
}

/**
 * Wraps admin/portal list pages so cards, text, and tables follow dark/light mode.
 * Usage: replace outer `<motionless style={{ padding: 24, background: '#f8fafc'...}}>` with `<ThemedPage>`.
 */
export default function ThemedPage({ children }: { children: ReactNode }) {
  const theme = usePageTheme();
  ctx.current = theme;

  const wrap: CSSProperties = {
    padding: 24,
    minHeight: '100%',
    color: theme.t.text,
    background: theme.isDark
      ? theme.t.pageBg
      : `linear-gradient(180deg, #e2e8f4 0%, ${theme.t.pageBg} 220px)`,
  };

  return <div className="lm-themed-page" style={wrap}>{children}</div>;
}

/** Card style matching existing pages (use instead of module-level CARD). */
export function useThemedCard(): CSSProperties {
  return useThemedPage().card;
}
