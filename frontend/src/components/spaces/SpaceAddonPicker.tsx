import { useQuery } from '@tanstack/react-query';
import { Checkbox, InputNumber, Spin } from 'antd';
import { addonServiceApi } from '../../api/services';

export type SelectedAddon = { addon_service_id: string; quantity: number };

import { usePageTheme } from '../../hooks/usePageTheme';
import { currencySymbol, DEFAULT_CURRENCY } from '../../constants/qatar';

type AddonSvc = {
  id: string;
  name: string;
  description?: string;
  price: number;
  billing_cycle: string;
  category?: string;
};

type Props = {
  tenantId?: string;
  value: SelectedAddon[];
  onChange: (next: SelectedAddon[]) => void;
  compact?: boolean;
  /** Pre-loaded catalog (e.g. from public space API — no auth). Skips fetch when set. */
  catalog?: AddonSvc[];
  /** When set, only these add-on IDs are shown (e.g. space-specific catalog). */
  allowedIds?: string[];
  /** Display currency for prices (defaults to QAR). */
  currency?: string;
};

function cycleLabel(cycle: string) {
  switch (cycle?.toUpperCase()) {
    case 'MONTHLY': return '/mo';
    case 'DAILY': return '/day';
    case 'HOURLY': return '/hr';
    default: return '';
  }
}

export default function SpaceAddonPicker({ tenantId, value, onChange, compact, catalog, allowedIds, currency }: Props) {
  const { t: th, isDark } = usePageTheme();
  const sym = currencySymbol(currency ?? DEFAULT_CURRENCY);
  const { data: addonsRaw, isLoading } = useQuery({
    queryKey: ['addon-services-active', tenantId],
    queryFn: () => addonServiceApi.getActive(tenantId).then((r) => r),
    enabled: !!tenantId && !catalog,
  });

  const fetchedAddons: AddonSvc[] = Array.isArray(addonsRaw)
    ? addonsRaw
    : Array.isArray((addonsRaw as { data?: AddonSvc[] })?.data)
      ? (addonsRaw as { data: AddonSvc[] }).data
      : [];

  const allAddons = catalog ?? fetchedAddons;

  const allowed = allowedIds?.length ? new Set(allowedIds) : null;
  const addons = allowed ? allAddons.filter((a) => allowed.has(a.id)) : allAddons;

  const isSelected = (id: string) => value.some((v) => v.addon_service_id === id);
  const qty = (id: string) => value.find((v) => v.addon_service_id === id)?.quantity ?? 1;

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...value, { addon_service_id: id, quantity: 1 }]);
    else onChange(value.filter((v) => v.addon_service_id !== id));
  };

  const setQty = (id: string, quantity: number) => {
    onChange(value.map((v) => (v.addon_service_id === id ? { ...v, quantity } : v)));
  };

  if (!tenantId && !catalog?.length) {
    return <p style={{ fontSize: 12, color: th.textMuted, margin: 0 }}>Select a building first to see optional services.</p>;
  }

  if (!catalog && isLoading) return <Spin size="small" />;

  if (!addons.length) {
    return (
      <p style={{ fontSize: 12, color: th.textMuted, margin: 0 }}>
        No add-on services available for this property yet.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10 }}>
      {addons.map((a) => {
        const selected = isSelected(a.id);
        return (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: compact ? '8px 10px' : '10px 14px',
              borderRadius: 10,
              border: `1px solid ${selected ? '#93c5fd' : th.cardBorder}`,
              background: selected ? (isDark ? '#1e3a5f' : '#eff6ff') : th.cardBg,
            }}
          >
            <Checkbox checked={selected} onChange={(e) => toggle(a.id, e.target.checked)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{a.name}</div>
              {!compact && a.description && (
                <div style={{ fontSize: 11, color: th.textSub, marginTop: 2 }}>{a.description}</div>
              )}
              <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
                {sym}{Number(a.price).toLocaleString()}{cycleLabel(a.billing_cycle)}
                {a.category && <span style={{ color: '#94a3b8', marginLeft: 8 }}>{a.category.replace(/_/g, ' ')}</span>}
              </div>
            </div>
            {selected && (
              <InputNumber min={1} max={99} size="small" value={qty(a.id)} onChange={(n) => setQty(a.id, n ?? 1)} style={{ width: 64 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
