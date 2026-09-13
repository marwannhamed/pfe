import type { CSSProperties, ReactNode } from 'react';
import { usePageTheme } from '../hooks/usePageTheme';

/**
 * Wraps admin/portal list pages so cards, text, and tables follow dark/light mode.
 * Usage: replace outer `<motionless style={{ padding: 24, background: '#f8fafc'...}}>` with `<ThemedPage>`.
 *
 * This file previously also exported useThemedPage/useThemedCard, which read the
 * theme from a module-level `{ current }` box that ThemedPage assigned to during
 * render. That made "the nearest wrapper" really mean "whichever ThemedPage
 * rendered last", and writing to module scope during render is not safe under
 * concurrent rendering. Nothing imported either hook, so both are gone; if the
 * need returns, use a React context rather than the box.
 */
export default function ThemedPage({ children }: { children: ReactNode }) {
  const theme = usePageTheme();

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
