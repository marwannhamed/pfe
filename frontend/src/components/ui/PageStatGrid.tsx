import type { ReactNode } from 'react';
import { usePageTheme } from '../../hooks/usePageTheme';

export type StatItem = {
  label: string;
  value: ReactNode;
  color?: string;
  icon?: ReactNode;
};

export default function PageStatGrid({ items, columns }: { items: StatItem[]; columns?: number }) {
  const { statCell, t: th } = usePageTheme();
  const cols = columns ?? Math.min(items.length, 6);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={statCell}>
          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {item.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: item.color ?? th.text, marginTop: 2, lineHeight: 1.2 }}>
            {item.value}
          </div>
          {item.icon && <div style={{ marginTop: 6 }}>{item.icon}</div>}
        </div>
      ))}
    </div>
  );
}
