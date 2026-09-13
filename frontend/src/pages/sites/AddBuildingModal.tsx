import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from '../../utils/feedback';
import { CloseOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { buildingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types';
import { asApiError } from '../../utils/errors';

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
};

const MODAL: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 560,
  boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 13,
  color: '#0f172a',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 5,
};

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</span>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

export default function AddBuildingModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [form, setForm] = useState({
    name:           '',
    code:           '',
    address:        '',
    total_floors_in_building: '',
    total_area_sqm: '',
    year_built:     '',
    status:         'ACTIVE',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())           e.name           = 'Building name is required';
    if (!form.code.trim())           e.code           = 'Building code is required';
    if (!form.total_area_sqm)        e.total_area_sqm = 'Total area is required';
    if (
      form.total_floors_in_building &&
      Number(form.total_floors_in_building) < 1
    ) {
      e.total_floors_in_building = 'Enter a valid floor count or leave empty';
    }
    return e;
  };

  const mutation = useMutation({
    mutationFn: (payload: unknown) => buildingApi.create(payload),
    onSuccess: () => {
      message.success('Building saved — now add the floor(s) you manage');
      // Invalidate both the site detail (which nests buildings) and buildings list
      qc.invalidateQueries({ queryKey: ['buildings'] });
      qc.invalidateQueries({ queryKey: ['buildings-for-floors'] });
      qc.invalidateQueries({ queryKey: ['buildings-publish'] });
      onClose();
    },
    onError: (err: ApiError) => {
      const msg = asApiError(err).response?.data?.message ?? 'Failed to create building';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    mutation.mutate({
      ...(user?.tenant_id ? { tenant_id: user.tenant_id } : {}),
      name:           form.name.trim(),
      code:           form.code.trim().toUpperCase(),
      total_area_sqm: parseFloat(form.total_area_sqm),
      status:         form.status,
      ...(form.address.trim() && { address: form.address.trim() }),
      ...(form.total_floors_in_building && {
        total_floors_in_building: Number(form.total_floors_in_building),
      }),
      ...(form.year_built && { year_built: Number(form.year_built) }),
    });
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div style={OVERLAY} onMouseDown={onBackdrop}>
      <div style={MODAL}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Add New Building</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
              Register where your spaces are located. You add only the floors you manage next.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
          >
            <CloseOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Building Name" required error={errors.name}>
              <input
                style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : '#e5e7eb' }}
                placeholder="e.g. Tower A"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </Field>

            <Field label="Building Code" required error={errors.code}>
              <input
                style={{ ...INPUT, borderColor: errors.code ? '#ef4444' : '#e5e7eb', textTransform: 'uppercase', fontFamily: 'monospace' }}
                placeholder="e.g. TWR-A"
                value={form.code}
                onChange={e => set('code', e.target.value)}
              />
            </Field>

            <Field label="Address" error={errors.address}>
              <input
                style={INPUT}
                placeholder="e.g. West Bay, Doha"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </Field>

            <Field label="Total floors in building (optional)" error={errors.total_floors_in_building}>
              <input
                style={{ ...INPUT, borderColor: errors.total_floors_in_building ? '#ef4444' : '#e5e7eb' }}
                type="number" min="1"
                placeholder="e.g. 10 — whole building, for reference"
                value={form.total_floors_in_building}
                onChange={e => set('total_floors_in_building', e.target.value)}
              />
            </Field>
            <p style={{ gridColumn: '1 / -1', margin: '-8px 0 0', fontSize: 11, color: '#64748b' }}>
              This does not create floors. On the <strong>Floors</strong> page, add only the level(s) you lease (e.g. floor 2 only, or floors 1 and 3).
            </p>

            <Field label="Leasable area you manage (m²)" required error={errors.total_area_sqm}>
              <input
                style={{ ...INPUT, borderColor: errors.total_area_sqm ? '#ef4444' : '#e5e7eb' }}
                type="number" min="0" step="0.1"
                placeholder="e.g. 2500"
                value={form.total_area_sqm}
                onChange={e => set('total_area_sqm', e.target.value)}
              />
            </Field>

            <Field label="Year Built">
              <input
                style={INPUT}
                type="number" min="1800" max={new Date().getFullYear()}
                placeholder={`e.g. ${new Date().getFullYear()}`}
                value={form.year_built}
                onChange={e => set('year_built', e.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                style={{ ...INPUT, cursor: 'pointer' }}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_CONSTRUCTION">Under Construction</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Building</>}
          </button>
        </div>
      </div>
    </div>
  );
}