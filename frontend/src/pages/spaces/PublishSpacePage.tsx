import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, Steps, Modal, Input, Button } from 'antd';
import { message } from '../../utils/feedback';
import {
  ArrowLeftOutlined, LoadingOutlined, CheckCircleOutlined,
  GlobalOutlined, PictureOutlined, HomeOutlined,
} from '@ant-design/icons';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useAuthStore } from '../../store/authStore';
import { buildingApi, floorApi, spaceApi, uploadApi } from '../../api/services';
import SpaceLocationFields, { type SpaceLocationValues } from '../../components/spaces/SpaceLocationFields';
import SpaceMediaFields, { type SpaceMediaValues } from '../../components/spaces/SpaceMediaFields';
import SpaceAddonPicker, { type SelectedAddon } from '../../components/spaces/SpaceAddonPicker';
import { validatePublishLocation } from '../../utils/spacePublish';
import type { Building, Floor } from '../../types';
import { isClientOperatorRole, visibleClientBuildings } from '../../utils/propertyScope';

const SPACE_TYPES = [
  { value: 'DEDICATED_OFFICE', label: 'Dedicated Office' },
  { value: 'FLEXIBLE_DESK', label: 'Flexible Desk' },
  { value: 'HOT_DESK', label: 'Hot Desk' },
  { value: 'MEETING_ROOM', label: 'Meeting Room' },
  { value: 'CONFERENCE_ROOM', label: 'Conference Room' },
  { value: 'PHONE_BOOTH', label: 'Phone Booth' },
  { value: 'EVENT_SPACE', label: 'Event Space' },
];

function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: unknown[] })?.data)) return (raw as { data: T[] }).data;
  return [];
}

const STEPS = [
  { title: 'Building', icon: <HomeOutlined /> },
  { title: 'Space details', icon: <PictureOutlined /> },
  { title: 'Location & map', icon: <GlobalOutlined /> },
  { title: 'Publish', icon: <CheckCircleOutlined /> },
];

type StepKind = 'property' | 'details' | 'location' | 'publish';

const STEP_ORDER: StepKind[] = ['property', 'details', 'location', 'publish'];

function stepKind(step: number): StepKind {
  return STEP_ORDER[step] ?? 'property';
}


export default function PublishSpacePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { headerCard, t: th, btnPrimary } = usePageTheme();
  const { user } = useAuthStore();
  const steps = STEPS;
  const [step, setStep] = useState(0);
  const [buildingId, setBuildingId] = useState('');
  // Derived rather than reset in an effect: with no building chosen there is
  // no valid floor, so the empty value falls out of the selection itself.
  const [pickedFloorId, setFloorId] = useState('');
  const floorId = buildingId ? pickedFloorId : '';
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'DEDICATED_OFFICE',
    capacity: '4',
    area_sqm: '',
    description: '',
    featuresText: '',
    price_per_month: '',
    currency: 'QAR',
    requires_approval: true,
  });
  const [location, setLocation] = useState<SpaceLocationValues>({
    is_published: true,
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'QA',
    map_lat: '',
    map_lng: '',
    transportation_notes: '',
  });
  const [media, setMedia] = useState<SpaceMediaValues>({ photoFiles: [], virtual_tour_url: '' });
  const [addons, setAddons] = useState<SelectedAddon[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingAddress, setNewBuildingAddress] = useState('');

  const isClientOps = isClientOperatorRole(user?.role);

  const { data: buildingsRaw, isLoading: loadingBuildings } = useQuery({
    queryKey: ['buildings-publish', isClientOps ? user?.tenant_id : 'all'],
    queryFn: () => buildingApi.getAll(isClientOps ? user?.tenant_id : undefined),
  });
  const { data: floorsRaw, isLoading: loadingFloors } = useQuery({
    queryKey: ['floors-publish', buildingId],
    queryFn: () => floorApi.getAll(buildingId),
    enabled: !!buildingId,
  });

  const buildings = visibleClientBuildings(toArray<Building>(buildingsRaw));
  const floors = toArray<Floor>(floorsRaw);
  const building = buildings.find((b) => b.id === buildingId);

  const createBuildingMut = useMutation({
    mutationFn: () =>
      buildingApi.create({
        name: newBuildingName.trim(),
        code: newBuildingName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'BLDG',
        total_area_sqm: 0,
        address: newBuildingAddress.trim() || undefined,
      }),
    onSuccess: (res) => {
      const created = ((res as { data?: Building })?.data ?? res) as Building;
      qc.invalidateQueries({ queryKey: ['buildings-publish'] });
      setBuildingId(created.id);
      setFloorId('');
      setShowAddBuilding(false);
      setNewBuildingName('');
      setNewBuildingAddress('');
      message.success('Building added');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to add building'));
    },
  });

  const setF = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validateStep = (s: number, ctx?: { floorId?: string }) => {
    const e: Record<string, string> = {};
    const kind = stepKind(s);
    const effectiveFloorId = ctx?.floorId ?? floorId ?? '';
    if (kind === 'property') {
      if (!buildingId) e.building = 'Select a building';
      else if (!loadingFloors && floors.length === 0) {
        e.floor = 'Add a floor to this building first';
      } else if (!loadingFloors && !effectiveFloorId) {
        e.floor = 'Select a floor';
      }
    }
    if (kind === 'details') {
      if (!form.name.trim()) e.name = 'Name is required';
      if (!form.code.trim()) e.code = 'Code is required';
      if (!form.area_sqm || parseFloat(form.area_sqm) <= 0) e.area_sqm = 'Valid area required';
      if (!form.capacity || parseInt(form.capacity, 10) < 1) e.capacity = 'Capacity must be ≥ 1';
      if (!form.price_per_month || parseFloat(form.price_per_month) <= 0) {
        e.price_per_month = 'Monthly price is required';
      }
    }
    if (kind === 'location') {
      Object.assign(e, validatePublishLocation(location));
    }
    if (kind === 'publish' && media.photoFiles.length === 0) {
      e.photos = 'Add at least one photo before publishing';
    }
    return e;
  };

  const goNext = async () => {
    if (stepKind(step) === 'property') {
      if (loadingFloors) {
        message.info('Loading floors for this building…');
        return;
      }
      const e = validateStep(step);
      if (Object.keys(e).length) {
        setErrors(e);
        message.warning('Please select a building and floor');
        return;
      }

      setErrors({});
      setStep((s) => Math.min(s + 1, steps.length - 1));
      return;
    }

    const e = validateStep(step);
    if (Object.keys(e).length) {
      setErrors(e);
      message.warning('Please complete the required fields');
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const created = (await spaceApi.create({
        floor_id: floorId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        type: form.type,
        capacity: Number(form.capacity),
        area_sqm: parseFloat(form.area_sqm),
        currency: form.currency,
        requires_approval: form.requires_approval,
        price_per_month: parseFloat(form.price_per_month),
        is_published: location.is_published ?? true,
        address: location.address,
        city: location.city,
        state: location.state || undefined,
        zip: location.zip || undefined,
        country: location.country,
        map_lat: parseFloat(location.map_lat!),
        map_lng: parseFloat(location.map_lng!),
        transportation_notes: location.transportation_notes || undefined,
        virtual_tour_url: media.virtual_tour_url.trim() || undefined,
        description: form.description.trim() || undefined,
        features: form.featuresText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        addon_service_ids: addons.map((a) => a.addon_service_id),
      })) as { id?: string; data?: { id?: string } };
      const spaceId = created?.id ?? created?.data?.id;
      if (spaceId && media.photoFiles.length > 0) {
        await uploadApi.uploadSpacePhotos(spaceId, media.photoFiles);
      }
      return spaceId;
    },
    onSuccess: (spaceId) => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['public-map-spaces'] });
      qc.invalidateQueries({ queryKey: ['client-onboarding-spaces'] });
      message.success('Space published on the public map!');
      navigate(spaceId ? `/admin/spaces/${spaceId}` : '/admin/spaces', { replace: true });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Failed to publish space'));
    },
  });

  const submit = () => {
    const e = STEP_ORDER.reduce<Record<string, string>>(
      (acc, _, i) => ({ ...acc, ...validateStep(i, { floorId }) }),
      {},
    );
    if (!floorId) e.floor = 'Select a floor for this space';
    if (Object.keys(e).length) {
      setErrors(e);
      message.warning('Please fix the highlighted fields');
      return;
    }
    mutation.mutate();
  };

  const currentKind = stepKind(step);
  const tenantIdForAddons = building?.tenant_id ?? user?.tenant_id;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${th.cardBorder}`,
    borderRadius: 8,
    fontSize: 13,
    color: th.text,
    background: th.cardBg,
    boxSizing: 'border-box',
  };

  return (
    <PageShell maxWidth={920}>
      <div style={headerCard}>
        <button
          type="button"
          onClick={() => navigate('/admin/spaces')}
          style={{ border: 'none', background: 'none', color: th.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}
        >
          <ArrowLeftOutlined /> Back to spaces
        </button>
        <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: th.text }}>Publish a space</h2>
        <p style={{ margin: '0 0 20px', color: th.textSub, fontSize: 14, lineHeight: 1.5 }}>
          Create a listing with photos, map location, characteristics, and an optional 3D tour — visible to renters on the public map.
        </p>
        <Steps current={step} items={steps} size="small" />
      </div>

      <div style={{ marginTop: 20, padding: 24, border: `1px solid ${th.cardBorder}`, borderRadius: 14, background: th.cardBg }}>
        {currentKind === 'property' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: th.textSub }}>
              Select the building where this space is located. Add a new building if yours is not listed yet.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: buildingId ? '1fr 1fr' : '1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Building *</label>
                <Select
                  loading={loadingBuildings}
                  value={buildingId || undefined}
                  onChange={(v) => { setBuildingId(v); setFloorId(''); }}
                  placeholder={buildings.length ? 'Select building' : 'No buildings yet — add one below'}
                  style={{ width: '100%' }}
                  options={buildings.map((b) => ({ value: b.id, label: b.name }))}
                />
                {errors.building && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.building}</div>}
                <Button type="link" style={{ padding: '4px 0', marginTop: 4 }} onClick={() => setShowAddBuilding(true)}>
                  + Add building
                </Button>
              </div>
              {buildingId && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Floor *</label>
                  <Select
                    loading={loadingFloors}
                    value={floorId || undefined}
                    onChange={setFloorId}
                    disabled={!buildingId || floors.length === 0}
                    placeholder={floors.length ? 'Select floor' : 'No floors yet'}
                    style={{ width: '100%' }}
                    options={floors.map((f) => ({
                      value: f.id,
                      label: `Level ${f.floor_number} — ${f.name}`,
                    }))}
                  />
                  {errors.floor && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.floor}</div>}
                  {!loadingFloors && floors.length === 0 && (
                    <Button
                      type="link"
                      style={{ padding: '4px 0', marginTop: 4 }}
                      onClick={() => navigate('/admin/floors')}
                    >
                      + Add floor to this building
                    </Button>
                  )}
                </div>
              )}
            </div>
            {buildingId && loadingFloors && (
              <div style={{ fontSize: 12, color: th.textSub }}>Loading floors…</div>
            )}
          </div>
        )}

        {currentKind === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Space name *</label>
                <input style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : th.cardBorder }} value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Executive Suite A" />
                {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Code *</label>
                <input style={{ ...inputStyle, borderColor: errors.code ? '#ef4444' : th.cardBorder, fontFamily: 'monospace' }} value={form.code} onChange={(e) => setF('code', e.target.value.toUpperCase())} placeholder="OFF-101" />
                {errors.code && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.code}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
                <Select value={form.type} onChange={(v) => setF('type', v)} style={{ width: '100%' }} options={SPACE_TYPES} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Capacity (people) *</label>
                <input type="number" min={1} style={{ ...inputStyle, borderColor: errors.capacity ? '#ef4444' : th.cardBorder }} value={form.capacity} onChange={(e) => setF('capacity', e.target.value)} />
                {errors.capacity && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.capacity}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Area (m²) *</label>
                <input type="number" min={0} step={0.1} style={{ ...inputStyle, borderColor: errors.area_sqm ? '#ef4444' : th.cardBorder }} value={form.area_sqm} onChange={(e) => setF('area_sqm', e.target.value)} />
                {errors.area_sqm && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.area_sqm}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Monthly price (QAR) *</label>
                <input type="number" min={0} step={0.01} style={{ ...inputStyle, borderColor: errors.price_per_month ? '#ef4444' : th.cardBorder }} value={form.price_per_month} onChange={(e) => setF('price_per_month', e.target.value)} />
                {errors.price_per_month && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.price_per_month}</div>}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={(e) => setF('description', e.target.value)} placeholder="Layout, natural light, fit-out, neighborhood…" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Characteristics & amenities</label>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.featuresText} onChange={(e) => setF('featuresText', e.target.value)} placeholder={'One per line\ne.g. High-speed WiFi\n24/7 access\nParking'} />
            </div>
            <SpaceMediaFields values={media} onChange={(patch) => setMedia((p) => ({ ...p, ...patch }))} />
            {errors.photos && <div style={{ fontSize: 12, color: '#b45309' }}>{errors.photos}</div>}
          </div>
        )}

        {currentKind === 'location' && (
          <SpaceLocationFields
            values={location}
            onChange={(patch) => {
              setLocation((p) => ({ ...p, ...patch }));
              setErrors((e) => {
                const n = { ...e };
                Object.keys(patch).forEach((k) => delete n[k]);
                return n;
              });
            }}
          />
        )}

        {currentKind === 'publish' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Ready to go live</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
                <li><strong>{form.name || '—'}</strong> · {form.type.replace(/_/g, ' ')}</li>
                <li>{building?.name ?? '—'}{floors.find((f) => f.id === floorId) ? ` · ${floors.find((f) => f.id === floorId)?.name}` : ''}</li>
                <li>{location.address}, {location.city}, Qatar</li>
                <li>{media.photoFiles.length} photo(s){media.virtual_tour_url ? ' · 3D tour linked' : ''}</li>
              </ul>
            </div>
            <SpaceAddonPicker tenantId={tenantIdForAddons} value={addons} onChange={setAddons} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: 12, borderRadius: 8, border: `1px solid ${th.cardBorder}` }}>
              <input type="checkbox" checked={form.requires_approval} onChange={(e) => setF('requires_approval', e.target.checked)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Require approval for bookings</div>
                <div style={{ fontSize: 12, color: th.textSub }}>Applications stay pending until your team approves them.</div>
              </div>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: `1px solid ${th.cardBorder}` }}>
          <button
            type="button"
            disabled={step === 0 || mutation.isPending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => void goNext()}
              disabled={step === 0 && !!buildingId && loadingFloors}
              style={{ ...btnPrimary, padding: '9px 22px', opacity: step === 0 && loadingFloors ? 0.6 : 1 }}
            >
              {step === 0 && loadingFloors ? 'Loading floors…' : 'Continue'}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={mutation.isPending}
              style={{ ...btnPrimary, padding: '9px 22px', opacity: mutation.isPending ? 0.7 : 1 }}
            >
              {mutation.isPending ? <><LoadingOutlined /> Publishing…</> : 'Publish to public map'}
            </button>
          )}
        </div>
      </div>

      <Modal
        title="Add building"
        open={showAddBuilding}
        onCancel={() => setShowAddBuilding(false)}
        onOk={() => {
          if (!newBuildingName.trim()) {
            message.warning('Building name is required');
            return;
          }
          createBuildingMut.mutate();
        }}
        confirmLoading={createBuildingMut.isPending}
        okText="Add building"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Building name *</label>
            <Input
              placeholder="e.g. Tornado Tower, West Bay"
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Address (optional)</label>
            <Input
              placeholder="Street, zone, Doha"
              value={newBuildingAddress}
              onChange={(e) => setNewBuildingAddress(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
