import type { CSSProperties, ReactNode } from 'react';
import ThemedPage from '../ThemedPage';

export default function PageShell({
  children,
  maxWidth,
  style,
}: {
  children: ReactNode;
  maxWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <ThemedPage>
      <div
        style={{
          maxWidth: maxWidth ?? undefined,
          margin: maxWidth ? '0 auto' : undefined,
          width: '100%',
          ...style,
        }}
      >
        {children}
      </div>
    </ThemedPage>
  );
}
