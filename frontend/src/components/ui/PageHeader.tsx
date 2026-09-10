import type { ReactNode } from 'react';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageStatGrid, { type StatItem } from './PageStatGrid';

export default function PageHeader({
  title,
  subtitle,
  actions,
  stats,
  inCard = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: StatItem[];
  /** Wrap in branded header card (blue top accent). */
  inCard?: boolean;
}) {
  const { t: th, headerCard } = usePageTheme();

  const inner = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: stats?.length ? 20 : 0,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 4,
              minHeight: 44,
              borderRadius: 4,
              background: 'linear-gradient(180deg, #2563eb, #60a5fa)',
              flexShrink: 0,
            }}
          />
          <div>
            <h1
              style={{
                margin: '0 0 4px',
                fontSize: 22,
                fontWeight: 800,
                color: th.text,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ margin: 0, color: th.textSub, fontSize: 14, lineHeight: 1.5 }}>{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>
        )}
      </div>
      {stats && stats.length > 0 && <PageStatGrid items={stats} />}
    </>
  );

  if (!inCard) return <div style={{ marginBottom: 20 }}>{inner}</div>;
  return <div style={headerCard}>{inner}</div>;
}
