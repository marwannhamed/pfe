import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Select } from 'antd';
import { message } from '../../utils/feedback';
import { CloseOutlined, PlusOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { spaceApi, buildingApi, floorApi, uploadApi } from '../../api/services';
import type { Building, Floor } from '../../types';
import SpaceLocationFields, { type SpaceLocationValues } from '../../components/spaces/SpaceLocationFields';
import SpaceMediaFields, { type SpaceMediaValues } from '../../components/spaces/SpaceMediaFields';
import SpaceAddonPicker, { type SelectedAddon } from '../../components/spaces/SpaceAddonPicker';
import { validatePublishLocation } from '../../utils/spacePublish';
import { errorMessage } from '../../utils/errors';

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
  const wrapper = raw as { data?: unknown; items?: unknown; results?: unknown };
  if (Array.isArray(wrapper.data)) return wrapper.data as T[];
  if (Array.isArray(wrapper.items)) return wrapper.items as T[];
  if (Array.isArray(wrapper.results)) return wrapper.results as T[];
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
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId,    setSelectedFloorId]    = useState('');
  const [form, setForm] = useState({
    name: '', code: '', type: 'DEDICATED_OFFICE', capacity: '1', area_sqm: '',
    description: '', featuresText: '',
    price_per_hour: '', price_per_day: '', price_per_month: '',
    currency: 'QAR', requires_approval: false, is_listed: false,
  });
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [location, setLocation] = useState<SpaceLocationValues>({
    is_published: false,
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    map_lat: '',
    map_lng: '',
    transportation_notes: '',
  });
  const [media, setMedia] = useState<SpaceMediaValues>({ photoFiles: [], virtual_tour_url: '' });

  const set = (k: string, v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  // ── Cascading queries — always fresh ──────────────────────────────────────
  const { data: buildingsRaw, isLoading: loadingBuildings } = useQuery({
    queryKey: ['buildings-modal'],
    queryFn: () => buildingApi.getAll(),
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
    queryFn: () => floorApi.getAll(selectedBuildingId),
    enabled: !!selectedBuildingId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ── Safely extract arrays regardless of API response shape ────────────────
  const buildings: Building[] = toArray<Building>(buildingsRaw);
  const floors:    Floor[]    = toArray<Floor>(floorsRaw);

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
    Object.assign(e, validatePublishLocation(location));
    return e;
  };

  const mutation = useMutation({
    mutationFn: async (payload: { body: Record<string, unknown>; photoFiles: File[] }) => {
      const created = await spaceApi.create(payload.body) as { id?: string; data?: { id?: string } };
      const spaceId = created?.id ?? created?.data?.id;
      if (spaceId && payload.photoFiles.length > 0) {
        await uploadApi.uploadSpacePhotos(spaceId, payload.photoFiles);
      }
      return created;
    },
    onSuccess: () => {
      message.success('Space created successfully!');
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['client-onboarding-spaces'] });
      qc.invalidateQueries({ queryKey: ['buildings'] });
      qc.invalidateQueries({ queryKey: ['public-map-spaces'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = errorMessage(err, 'Failed to create space');
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      body: {
        floor_id:          selectedFloorId,
        name:              form.name.trim(),
        code:              form.code.trim().toUpperCase(),
        type:              form.type,
        capacity:          Number(form.capacity),
        area_sqm:          parseFloat(form.area_sqm),
        currency:          form.currency,
        requires_approval: form.requires_approval,
        is_listed: form.is_listed,
        ...(form.price_per_hour  && { price_per_hour:  parseFloat(form.price_per_hour)  }),
        ...(form.price_per_day   && { price_per_day:   parseFloat(form.price_per_day)   }),
        ...(form.price_per_month && { price_per_month: parseFloat(form.price_per_month) }),
        is_published: location.is_published ?? false,
        address: location.address || undefined,
        city: location.city || undefined,
        state: location.state || undefined,
        zip: location.zip || undefined,
        country: location.country || undefined,
        map_lat: location.map_lat ? parseFloat(location.map_lat) : undefined,
        map_lng: location.map_lng ? parseFloat(location.map_lng) : undefined,
        transportation_notes: location.transportation_notes || undefined,
        ...(media.virtual_tour_url.trim() && { virtual_tour_url: media.virtual_tour_url.trim() }),
        ...(form.description.trim() && { description: form.description.trim() }),
        ...(form.featuresText.trim() && {
          features: form.featuresText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((name) => ({ name })),
        }),
        ...(selectedAddons.length && {
          addon_service_ids: selectedAddons.map((a) => a.addon_service_id),
        }),
      },
      photoFiles: media.photoFiles,
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
            {selectedBuilding ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#7c3aed', fontWeight: 500 }}>{selectedBuilding.name}</span>
                {selectedFloor && <><span style={{ color: '#cbd5e1' }}>›</span><span style={{ color: '#059669', fontWeight: 500 }}>Floor {selectedFloor.floor_number} — {selectedFloor.name}</span></>}
              </p>
            ) : (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Select a building and floor, then fill in the space details</p>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <CloseOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Location ── */}
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
            <SectionTitle>📍 Location — Building → Floor</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <Field label="Building" required>
                <Select
                  loading={loadingBuildings}
                  value={selectedBuildingId || undefined}
                  onChange={v => { setSelectedBuildingId(v); setSelectedFloorId(''); }}
                  placeholder="Select building..."
                  style={{ width: '100%' }}
                  options={buildings.map(b => ({ value: b.id, label: b.name }))}
                  notFoundContent="No buildings — add one in Buildings"
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
            <Field label="Description">
              <textarea
                style={{ ...INPUT, minHeight: 72, resize: 'vertical' }}
                placeholder="Describe the space — layout, natural light, fit-out, neighborhood…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
            <Field label="Features & amenities" >
              <textarea
                style={{ ...INPUT, minHeight: 64, resize: 'vertical', marginTop: 5 }}
                placeholder={'One per line, e.g.\nHigh-speed WiFi\n24/7 access\nParking nearby'}
                value={form.featuresText}
                onChange={(e) => set('featuresText', e.target.value)}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
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

          <SpaceLocationFields
            values={location}
            onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
          />

          <SpaceMediaFields
            values={media}
            onChange={(patch) => setMedia((prev) => ({ ...prev, ...patch }))}
          />

          <div>
            <SectionTitle>Add-on services for this space</SectionTitle>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
              Guests can optionally add these when applying — billed together with the space lease.
            </p>
            <SpaceAddonPicker
              tenantId={selectedBuilding?.tenant_id}
              value={selectedAddons}
              onChange={setSelectedAddons}
            />
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 10, padding: '10px 14px', background: form.is_listed ? '#dbeafe' : '#f8fafc', borderRadius: 8, border: `1px solid ${form.is_listed ? '#93c5fd' : '#e5e7eb'}` }}>
              <input type="checkbox" checked={form.is_listed} onChange={e => set('is_listed', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>List on marketplaces</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Coworker / LiquidSpace when AVAILABLE</div>
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