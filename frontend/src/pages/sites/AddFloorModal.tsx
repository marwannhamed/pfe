import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { CloseOutlined, PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { floorApi } from '../../api/services';

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
  maxWidth: 520,
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
  buildingId: string;
  buildingName: string;
  onClose: () => void;
}

export default function AddFloorModal({ buildingId, buildingName, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    floor_number:  '',
    name:          '',
    area_sqm:      '',
    floor_plan_url:'',
    status:        'ACTIVE',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.floor_number)  e.floor_number = 'Floor number is required';
    if (!form.name.trim())   e.name         = 'Floor name is required';
    if (!form.area_sqm)      e.area_sqm     = 'Area is required';
    return e;
  };

  const mutation = useMutation({
    mutationFn: (payload: any) => floorApi.create(payload),
    onSuccess: () => {
      message.success('Floor created successfully!');
      // Invalidate site detail (which nests buildings→floors) and floors list
      qc.invalidateQueries({ queryKey: ['site'] });
      qc.invalidateQueries({ queryKey: ['floors'] });
      qc.invalidateQueries({ queryKey: ['buildings'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to create floor';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    mutation.mutate({
      building_id:  buildingId,
      floor_number: Number(form.floor_number),
      name:         form.name.trim(),
      area_sqm:     parseFloat(form.area_sqm), // ✅ send as number
      status:       form.status,
      ...(form.floor_plan_url.trim() && { floor_plan_url: form.floor_plan_url.trim() }),
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Add New Floor</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
              Building: <strong style={{ color: '#2563eb' }}>{buildingName}</strong>
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

            <Field label="Floor Number" required error={errors.floor_number}>
              <input
                style={{ ...INPUT, borderColor: errors.floor_number ? '#ef4444' : '#e5e7eb' }}
                type="number"
                placeholder="e.g. 1"
                value={form.floor_number}
                onChange={e => set('floor_number', e.target.value)}
              />
            </Field>

            <Field label="Floor Name" required error={errors.name}>
              <input
                style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : '#e5e7eb' }}
                placeholder="e.g. Ground Floor"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </Field>

            <Field label="Area (m²)" required error={errors.area_sqm}>
              <input
                style={{ ...INPUT, borderColor: errors.area_sqm ? '#ef4444' : '#e5e7eb' }}
                type="number" min="0" step="0.1"
                placeholder="e.g. 500"
                value={form.area_sqm}
                onChange={e => set('area_sqm', e.target.value)}
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
                <option value="UNDER_RENOVATION">Under Renovation</option>
              </select>
            </Field>
          </div>

          <Field label="Floor Plan URL">
            <input
              style={INPUT}
              type="url"
              placeholder="https://... (optional)"
              value={form.floor_plan_url}
              onChange={e => set('floor_plan_url', e.target.value)}
            />
          </Field>
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
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Floor</>}
          </button>
        </div>
      </div>
    </div>
  );
}
