import { usePageTheme } from '../../hooks/usePageTheme';

const PRESETS: Record<string, { label?: string; bg: string; color: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#475569' },
  PENDING: { bg: '#fef3c7', color: '#92400e' },
  ISSUED: { bg: '#dbeafe', color: '#1d4ed8' },
  SENT: { bg: '#ede9fe', color: '#6d28d9' },
  PARTIALLY_PAID: { label: 'Partial', bg: '#fef3c7', color: '#92400e' },
  PAID: { bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { bg: '#dcfce7', color: '#15803d' },
  OVERDUE: { bg: '#fee2e2', color: '#b91c1c' },
  CANCELLED: { bg: '#f1f5f9', color: '#94a3b8' },
  REFUNDED: { bg: '#f1f5f9', color: '#475569' },
  ACTIVE: { bg: '#dcfce7', color: '#15803d' },
  OPEN: { bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'In progress', bg: '#fef3c7', color: '#92400e' },
  RESOLVED: { bg: '#dcfce7', color: '#15803d' },
  CLOSED: { bg: '#f1f5f9', color: '#475569' },
  PENDING_PHONE_CONFIRMATION: { label: 'To call', bg: '#e0f2fe', color: '#0369a1' },
  AWAITING_PHYSICAL_VISIT: { label: 'Awaiting visit', bg: '#ede9fe', color: '#6d28d9' },
  DOCUMENTS_PENDING_UPLOAD: { label: 'Docs pending', bg: '#fff7ed', color: '#c2410c' },
  REFUSED: { bg: '#fee2e2', color: '#b91c1c' },
};

function formatLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({
  status,
  label,
  bg,
  color,
}: {
  status: string;
  label?: string;
  bg?: string;
  color?: string;
}) {
  const { t: th } = usePageTheme();
  const preset = PRESETS[status];
  const display = label ?? preset?.label ?? formatLabel(status);
  return (
    <span
      style={{
        background: bg ?? preset?.bg ?? th.badge,
        color: color ?? preset?.color ?? th.badgeText,
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 20,
        display: 'inline-block',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}
    >
      {display}
    </span>
  );
}
