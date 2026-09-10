import type { CSSProperties, ReactNode } from 'react';
import { usePageTheme } from '../../hooks/usePageTheme';

export default function PageCard({
  children,
  style,
  padding = '16px 20px',
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string | number;
}) {
  const { card } = usePageTheme();
  return <div style={{ ...card, padding, ...style }}>{children}</div>;
}
