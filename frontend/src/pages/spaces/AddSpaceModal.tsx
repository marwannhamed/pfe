import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Select, message } from 'antd';
import { CloseOutlined, PlusOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { spaceApi, siteApi, buildingApi, floorApi } from '../../api/services';
import type { Site, Building, Floor } from '../../types';

const SPACE_TYPES = [
  { value: 'DEDICATED_OFFICE', label: '🏢 Dedicated Office' },
  { value: 'FLEXIBLE_DESK',    label: '🪑 Flexible Desk'    },
  { value: 'HOT_DESK',         label: '💻 Hot Desk'         },
  { value: 'MEETING_ROOM',     label: '📋 Meeting Room'     },
  { value: 'CONFERENCE_ROOM',  label: '🎯 Conference Room'  },
  { value: 'PHONE_BOOTH',      label: '📞 Phone Booth'      },
  { value: 'EVENT_SPACE',      label: '🎪 Event Space'      },
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'];

const OVERLAY: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const MODAL: React.CSSProperties   = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 660, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' };
const INPUT: React.CSSProperties   = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const LABEL: React.CSSProperties   = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

// Helper: safely extract array from any API response shape
function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as any)?.data)) return (raw as any).data;
  if (Array.isArray((raw as any)?.items)) return (raw as any).items;
  if (Array.isArray((raw as any)?.results)) return (raw as any).results;
  return [];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{children}</div>;
}
function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</span>}
    </div>
  );
}

interface Props { onClose: () => void }

export default function AddSpaceModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [selectedSiteId,     setSelectedSiteId]     = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId,    setSelectedFloorId]    = useState('');
  const [form, setForm] = useState({
    name: '', code: '', type: 'DEDICATED_OFFICE', capacity: '1', area_sqm: '',
    price_per_hour: '', price_per_day: '', price_per_month: '',
    currency: 'USD', requires_approval: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  // ── Cascading queries — always fresh ──────────────────────────────────────
  const { data: sitesRaw } = useQuery({
    queryKey: ['sites-modal'],
    queryFn: () => siteApi.getAll().then(r => r.data),
    staleTime: 0,
  });

  const { data: buildingsRaw, isLoading: loadingBuildings } = useQuery({
    queryKey: ['buildings-modal', selectedSiteId],
    queryFn: () => buildingApi.getAll(selectedSiteId).then(r => r.data),
    enabled: !!selectedSiteId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const {
    data: floorsRaw,
    isLoading: loadingFloors,
    refetch: refetchFloors,
    isFetching: fetchingFloors,
  } = useQuery({
    queryKey: ['floors-modal', selectedBuildingId],
    queryFn: () => floorApi.getAll(selectedBuildingId).then(r => r.data),
    enabled: !!selectedBuildingId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ── Safely extract arrays regardless of API response shape ────────────────
  const sites:     Site[]     = toArray<Site>(sitesRaw);
  const buildings: Building[] = toArray<Building>(buildingsRaw);
  const floors:    Floor[]    = toArray<Floor>(floorsRaw);

  const selectedSite     = sites.find(s => s.id === selectedSiteId);
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const selectedFloor    = floors.find(f => f.id === selectedFloorId);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedFloorId)          e.floor    = 'Please select a floor';
    if (!form.name.trim())         e.name     = 'Name is required';
    if (!form.code.trim())         e.code     = 'Code is required';
    if (!form.area_sqm)            e.area_sqm = 'Area is required';
    if (Number(form.capacity) < 1) e.capacity = 'Capacity must be ≥ 1';
    return e;
  };

  const mutation = useMutation({
    mutationFn: (payload: unknown) => spaceApi.create(payload as any),
    onSuccess: () => {
      message.success('Space created successfully!');
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['site'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to create space';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      floor_id:          selectedFloorId,
      name:              form.name.trim(),
      code:              form.code.trim().toUpperCase(),
      type:              form.type,
      capacity:          Number(form.capacity),
      area_sqm:          parseFloat(form.area_sqm),
      currency:          form.currency,
      requires_approval: form.requires_approval,
      ...(form.price_per_hour  && { price_per_hour:  parseFloat(form.price_per_hour)  }),
      ...(form.price_per_day   && { price_per_day:   parseFloat(form.price_per_day)   }),
      ...(form.price_per_month && { price_per_month: parseFloat(form.price_per_month) }),
    });
  };

  const onBackdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div style={OVERLAY} onMouseDown={onBackdrop}>
      <div style={MODAL}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Add New Space</h2>
            {selectedSite ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#2563eb', fontWeight: 500 }}>{selectedSite.name}</span>
                {selectedBuilding && <><span style={{ color: '#cbd5e1' }}>›</span><span style={{ color: '#7c3aed', fontWeight: 500 }}>{selectedBuilding.name}</span></>}
                {selectedFloor    && <><span style={{ color: '#cbd5e1' }}>›</span><span style={{ color: '#059669', fontWeight: 500 }}>Floor {selectedFloor.floor_number} — {selectedFloor.name}</span></>}
              </p>
            ) : (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Select a location then fill in the space details</p>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <CloseOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Location ── */}
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
            <SectionTitle>📍 Location — Site → Building → Floor</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

              <Field label="Site" required>
                <Select
                  value={selectedSiteId || undefined}
                  onChange={v => { setSelectedSiteId(v); setSelectedBuildingId(''); setSelectedFloorId(''); }}
                  placeholder="Select site..."
                  style={{ width: '100%' }}
                  options={sites.map(s => ({ value: s.id, label: `${s.name} (${s.city})` }))}
                />
              </Field>

              <Field label="Building" required>
                <Select
                  loading={loadingBuildings}
                  value={selectedBuildingId || undefined}
                  onChange={v => { setSelectedBuildingId(v); setSelectedFloorId(''); }}
                  placeholder={selectedSiteId ? 'Select building...' : 'Select site first'}
                  disabled={!selectedSiteId}
                  style={{ width: '100%' }}
                  options={buildings.map(b => ({ value: b.id, label: b.name }))}
                  notFoundContent={selectedSiteId ? 'No buildings — add in Sites' : null}
                />
              </Field>

              {/* Floor with refresh button */}
              <Field label="Floor" required error={errors.floor}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Select
                    loading={loadingFloors || fetchingFloors}
                    value={selectedFloorId || undefined}
                    onChange={v => { setSelectedFloorId(v); setErrors(e => { const n = { ...e }; delete n.floor; return n; }); }}
                    placeholder={selectedBuildingId ? 'Select floor...' : 'Select building first'}
                    disabled={!selectedBuildingId}
                    style={{ flex: 1, borderColor: errors.floor ? '#ef4444' : undefined }}
                    options={floors.map(f => ({ value: f.id, label: `Floor ${f.floor_number} — ${f.name}` }))}
                    notFoundContent={
                      selectedBuildingId
                        ? <div style={{ textAlign: 'center', padding: '8px 4px', fontSize: 12 }}>
                            No floors yet<br />
                            <span style={{ color: '#94a3b8' }}>Add one in Sites, then click 🔄</span>
                          </div>
                        : null
                    }
                  />
                  {/* ✅ Manual refresh button */}
                  {selectedBuildingId && (
                    <button
                      onClick={() => refetchFloors()}
                      disabled={fetchingFloors}
                      title="Refresh floors"
                      style={{ width: 34, height: 32, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: fetchingFloors ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
                    >
                      <ReloadOutlined style={{ fontSize: 13, animation: fetchingFloors ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  )}
                </div>
              </Field>
            </div>

            {/* Helper hint when floors are empty */}
            {selectedBuildingId && !loadingFloors && floors.length === 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠️ No floors found for this building.
                <strong>Go to Sites → select your site → Add Floor</strong>, then click 🔄 to refresh.
              </div>
            )}
          </div>

          {/* ── Basic Info ── */}
          <div>
            <SectionTitle>Basic Information</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Space Name" required error={errors.name}>
                <input style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : '#e5e7eb' }} placeholder="e.g. Executive Suite A" value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Space Code" required error={errors.code}>
                <input style={{ ...INPUT, borderColor: errors.code ? '#ef4444' : '#e5e7eb', fontFamily: 'monospace', textTransform: 'uppercase' }} placeholder="e.g. OFF-101" value={form.code} onChange={e => set('code', e.target.value)} />
              </Field>
              <Field label="Space Type" required>
                <Select value={form.type} onChange={v => set('type', v)} style={{ width: '100%' }} options={SPACE_TYPES} />
              </Field>
              <Field label="Capacity (people)" required error={errors.capacity}>
                <input style={{ ...INPUT, borderColor: errors.capacity ? '#ef4444' : '#e5e7eb' }} type="number" min="1" placeholder="e.g. 10" value={form.capacity} onChange={e => set('capacity', e.target.value)} />
              </Field>
              <Field label="Area (m²)" required error={errors.area_sqm}>
                <input style={{ ...INPUT, borderColor: errors.area_sqm ? '#ef4444' : '#e5e7eb' }} type="number" min="0" step="0.1" placeholder="e.g. 45.5" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── Pricing ── */}
          <div>
            <SectionTitle>Pricing</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
              <Field label="Currency">
                <Select value={form.currency} onChange={v => set('currency', v)} style={{ width: '100%' }} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
              </Field>
              <Field label="Price / Hour">
                <input style={INPUT} type="number" min="0" step="0.01" placeholder="0.00" value={form.price_per_hour} onChange={e => set('price_per_hour', e.target.value)} />
              </Field>
              <Field label="Price / Day">
                <input style={INPUT} type="number" min="0" step="0.01" placeholder="0.00" value={form.price_per_day} onChange={e => set('price_per_day', e.target.value)} />
              </Field>
              <Field label="Price / Month">
                <input style={INPUT} type="number" min="0" step="0.01" placeholder="0.00" value={form.price_per_month} onChange={e => set('price_per_month', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ── Settings ── */}
          <div>
            <SectionTitle>Settings</SectionTitle>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '10px 14px', background: form.requires_approval ? '#fef3c7' : '#f8fafc', borderRadius: 8, border: `1px solid ${form.requires_approval ? '#fcd34d' : '#e5e7eb'}`, transition: 'all 0.15s' }}>
              <input type="checkbox" checked={form.requires_approval} onChange={e => set('requires_approval', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#d97706' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Requires Approval</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Bookings will need admin approval before confirmation</div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} disabled={mutation.isPending} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Space</>}
          </button>
        </div>
      </div>
    </div>
  );
}