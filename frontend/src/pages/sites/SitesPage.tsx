import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import {
  SearchOutlined, PlusOutlined, DownloadOutlined,
  AppstoreOutlined, UnorderedListOutlined, EnvironmentOutlined,
  ReloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  CloseOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Site, SiteStatus, Building, Floor, Space } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<SiteStatus, { label: string; bg: string; color: string }> = {
  ACTIVE:   { label: 'Active',   bg: '#dcfce7', color: '#15803d' },
  INACTIVE: { label: 'Inactive', bg: '#f1f5f9', color: '#475569' },
  CLOSED:   { label: 'Closed',   bg: '#fee2e2', color: '#b91c1c' },
};

function getSiteStats(site: Site) {
  let totalSpaces = 0, availableSpaces = 0;
  (site.buildings ?? []).forEach((b: Building) => {
    (b.floors ?? []).forEach((f: Floor) => {
      (f.spaces ?? []).forEach((s: Space) => {
        totalSpaces++;
        if (s.status === 'AVAILABLE') availableSpaces++;
      });
    });
  });
  return { totalSpaces, availableSpaces };
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb',
  borderRadius: 8, fontSize: 13, color: '#0f172a', outline: 'none',
  background: '#fff', boxSizing: 'border-box',
};

const TIMEZONES = [
  { value: 'UTC',                  label: 'UTC'                  },
  { value: 'America/New_York',     label: 'New York (EST)'       },
  { value: 'America/Los_Angeles',  label: 'Los Angeles (PST)'    },
  { value: 'Europe/London',        label: 'London (GMT)'         },
  { value: 'Europe/Paris',         label: 'Paris (CET)'          },
  { value: 'Asia/Tokyo',           label: 'Tokyo (JST)'          },
  { value: 'Asia/Dubai',           label: 'Dubai (GST)'          },
  { value: 'Australia/Sydney',     label: 'Sydney (AEDT)'        },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar'        },
  { value: 'EUR', label: 'EUR — Euro'              },
  { value: 'GBP', label: 'GBP — British Pound'    },
  { value: 'JPY', label: 'JPY — Japanese Yen'     },
  { value: 'AUD', label: 'AUD — Australian Dollar'},
  { value: 'AED', label: 'AED — UAE Dirham'       },
  { value: 'TND', label: 'TND — Tunisian Dinar'   },
];

// ─── Add Site Modal ───────────────────────────────────────────────────────────
interface AddSiteModalProps { onClose: () => void; tenantId: string; }

function AddSiteModal({ onClose, tenantId }: AddSiteModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '', code: '', status: 'ACTIVE',
    city: '', country: '',
    timezone: 'UTC', currency: 'USD',
  });

  const setF = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.name.trim()) e.name = 'Required';
      if (!form.code.trim()) e.code = 'Required';
    }
    if (step === 1) {
      if (!form.city.trim())    e.city    = 'Required';
      if (!form.country.trim()) e.country = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < 2) { setStep(s => s + 1); return; }
    setLoading(true);
    try {
      await siteApi.create({ ...form, tenant_id: tenantId, code: form.code.toUpperCase() });
      qc.invalidateQueries({ queryKey: ['sites'] });
      onClose();
    } catch (err: unknown) {
      const msg = (err as unknown as any)?.response?.data?.message ?? 'Failed to create branch';
      setErrors({ submit: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Basic Info', 'Location', 'Settings'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Add New Branch</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Step {step + 1} of 3 — {steps[step]}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <CloseOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 24px 0' }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#2563eb' : '#e5e7eb', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {errors.submit && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
              {errors.submit}
            </div>
          )}

          {step === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Branch Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : '#e5e7eb' }} placeholder="e.g. Manhattan Downtown" value={form.name} onChange={e => setF('name', e.target.value)} />
                {errors.name && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>{errors.name}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Branch Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input style={{ ...INPUT, borderColor: errors.code ? '#ef4444' : '#e5e7eb', textTransform: 'uppercase', fontFamily: 'monospace' }} placeholder="e.g. NYC" value={form.code} onChange={e => setF('code', e.target.value)} />
                {errors.code && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>{errors.code}</span>}
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
                <Select value={form.status} onChange={v => setF('status', v)} style={{ width: '100%' }}
                  options={[{ value: 'ACTIVE', label: '✅ Active' }, { value: 'INACTIVE', label: '⏸ Inactive' }]} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  City <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input style={{ ...INPUT, borderColor: errors.city ? '#ef4444' : '#e5e7eb' }} placeholder="e.g. New York" value={form.city} onChange={e => setF('city', e.target.value)} />
                {errors.city && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>{errors.city}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Country <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input style={{ ...INPUT, borderColor: errors.country ? '#ef4444' : '#e5e7eb' }} placeholder="e.g. USA" value={form.country} onChange={e => setF('country', e.target.value)} />
                {errors.country && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3, display: 'block' }}>{errors.country}</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Timezone</label>
                <Select value={form.timezone} onChange={v => setF('timezone', v)} style={{ width: '100%' }} options={TIMEZONES} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Currency</label>
                <Select value={form.currency} onChange={v => setF('currency', v)} style={{ width: '100%' }} options={CURRENCIES} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => { if (step > 0) setStep(s => s - 1); else onClose(); }}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
          >
            {step > 0 ? '← Back' : 'Cancel'}
          </button>
          <button
            onClick={handleNext}
            disabled={loading}
            style={{ padding: '9px 24px', borderRadius: 8, background: loading ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {loading ? <><LoadingOutlined /> Creating...</> : step < 2 ? 'Continue →' : '✓ Create Branch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Site Modal ──────────────────────────────────────────────────────────
function EditSiteModal({ site, onClose }: { site: Site; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: site.name,
    city: site.city,
    country: site.country,
    currency: site.currency,
    status: site.status,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const mutation = useMutation({
    mutationFn: (d: any) => siteApi.update(site.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); onClose(); },
    onError:   (err: any) => alert(err?.response?.data?.message ?? 'Failed'),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.country.trim()) e.country = 'Required';
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate(form);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Edit Site</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Update site information</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <CloseOutlined />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Site Name *</label>
            <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.name} onChange={e => setF('name', e.target.value)} />
            {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>City *</label>
              <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.city ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.city} onChange={e => setF('city', e.target.value)} />
              {errors.city && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.city}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Country *</label>
              <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.country ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.country} onChange={e => setF('country', e.target.value)} />
              {errors.country && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.country}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Currency</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} value={form.currency} onChange={e => setF('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AED">AED</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Status</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} value={form.status} onChange={e => setF('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} disabled={mutation.isPending} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SitesPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { user }  = useAuthStore();
  const tenantId  = user?.tenant_id ?? '';

  const [view,    setView]   = useState<'card' | 'table'>('card');
  const [status,  setStatus] = useState('');
  const [q,       setQ]      = useState('');
  const [addOpen, setAdd]    = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const { data: sitesRaw = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sites', tenantId],
    queryFn:  () => siteApi.getAll(tenantId || undefined).then(r => r.data),
  });
  const sites: Site[] = Array.isArray(sitesRaw) ? sitesRaw : [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => siteApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['sites'] }); refetch(); },
    onError:    () => alert('Failed to delete site'),
  });

  const filtered = sites.filter(s => {
    if (status && s.status !== status) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.city.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const avgOccupancy = (() => {
    if (!sites.length) return 0;
    let total = 0, occ = 0;
    sites.forEach(s => {
      const { totalSpaces, availableSpaces } = getSiteStats(s);
      total += totalSpaces;
      occ   += totalSpaces - availableSpaces;
    });
    return total > 0 ? Math.round((occ / total) * 100) : 0;
  })();

  const totalAvailable = sites.reduce((acc, s) => acc + getSiteStats(s).availableSpaces, 0);

  const STATS = [
    { label: 'Total Branches',    value: sites.length,                               sub: `${filtered.length} shown`,        color: '#2563eb', bg: '#eff6ff' },
    { label: 'Average Occupancy', value: `${avgOccupancy}%`,                         sub: avgOccupancy >= 75 ? '↑ Above target' : '↓ Below target', color: '#059669', bg: '#f0fdf4' },
    { label: 'Available Offices', value: totalAvailable,                              sub: 'Ready for occupancy',              color: '#d97706', bg: '#fffbeb' },
    { label: 'Active Sites',      value: sites.filter(s => s.status === 'ACTIVE').length, sub: 'Fully operational',           color: '#7c3aed', bg: '#f5f3ff' },
  ];

  // ── FIX: wrap in a fragment so EditSiteModal is a sibling of the main div ──
  return (
    <>
      <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

        {addOpen && <AddSiteModal onClose={() => setAdd(false)} tenantId={tenantId} />}

        {/* Header */}
        <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Branch Overview Dashboard</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Monitor occupancy, availability and maintenance across all locations</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
                <ReloadOutlined /> Refresh
              </button>
              <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
                <DownloadOutlined /> Export
              </button>
              <button onClick={() => setAdd(true)} style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                <PlusOutlined /> Add Branch
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                    <p style={{ margin: '0 0 3px', fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                    <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search by name or city..."
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
          />
          <Select
            value={status || 'all'}
            onChange={v => setStatus(v === 'all' ? '' : v)}
            style={{ width: 160 }}
            options={[
              { value: 'all',      label: 'All Status' },
              { value: 'ACTIVE',   label: '✅ Active'   },
              { value: 'INACTIVE', label: '⏸ Inactive'  },
              { value: 'CLOSED',   label: '🔒 Closed'   },
            ]}
          />
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
            Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {sites.length} branches
          </div>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('card')}  style={{ padding: '7px 12px', background: view === 'card'  ? '#2563eb' : '#fff', color: view === 'card'  ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
            <button onClick={() => setView('table')} style={{ padding: '7px 12px', background: view === 'table' ? '#2563eb' : '#fff', color: view === 'table' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load branches</div>
            <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={CARD}>
                <div style={{ height: 80, background: '#1e293b', borderRadius: '12px 12px 0 0' }} />
                <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && filtered.length === 0 && (
          <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏗</div>
            <Empty description={sites.length === 0 ? 'No branches yet — add your first branch!' : 'No branches match your filters.'} />
            {sites.length === 0 && (
              <button onClick={() => setAdd(true)} style={{ marginTop: 16, padding: '9px 20px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <PlusOutlined style={{ marginRight: 6 }} /> Add First Branch
              </button>
            )}
          </div>
        )}

        {/* Card view */}
        {!isLoading && !isError && filtered.length > 0 && view === 'card' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {filtered.map(site => {
              const sm = STATUS_META[site.status] ?? STATUS_META.INACTIVE;
              const { totalSpaces, availableSpaces } = getSiteStats(site);
              const occupancy = totalSpaces > 0 ? Math.round(((totalSpaces - availableSpaces) / totalSpaces) * 100) : 0;
              const occColor  = occupancy >= 80 ? '#22c55e' : occupancy >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <div
                  key={site.id}
                  style={{ ...CARD, overflow: 'hidden', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                >
                  {/* Card header */}
                  <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                        {site.code}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{site.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <EnvironmentOutlined style={{ fontSize: 10 }} /> {site.city}, {site.country}
                        </div>
                      </div>
                    </div>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                      {sm.label}
                    </span>
                  </div>

                  <div style={{ padding: '16px 20px' }}>
                    {/* Occupancy bar */}
                    {totalSpaces > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                          <span style={{ color: '#64748b' }}>Occupancy</span>
                          <span style={{ fontWeight: 700, color: occColor }}>{occupancy}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${occupancy}%`, height: '100%', background: occColor, borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                      {[
                        { label: 'Buildings', value: site.buildings?.length ?? 0, icon: '🏗' },
                        { label: 'Spaces',    value: totalSpaces,                  icon: '🏢' },
                        { label: 'Available', value: availableSpaces,              icon: '✅' },
                      ].map(st => (
                        <div key={st.label} style={{ background: '#f8fafc', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 14 }}>{st.icon}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{st.value}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{st.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Manager */}
                    {site.manager && (
                      <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {site.manager.first_name?.[0]}{site.manager.last_name?.[0]}
                        </div>
                        <span style={{ color: '#374151', fontWeight: 500 }}>{site.manager.first_name} {site.manager.last_name}</span>
                        <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Manager</span>
                      </div>
                    )}

                    {/* Meta */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>🕐 {site.timezone}</span>
                      <span>💱 {site.currency}</span>
                      <span>📅 {new Date(site.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>

                    <button
                      onClick={() => navigate(`/admin/sites/${site.id}`)}
                      style={{ width: '100%', padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table view */}
        {!isLoading && !isError && filtered.length > 0 && view === 'table' && (
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Branch</span><span>City</span><span>Status</span><span>Buildings</span><span>Spaces</span><span>Currency</span><span>Actions</span>
            </div>
            {filtered.map((site, i) => {
              const sm = STATUS_META[site.status] ?? STATUS_META.INACTIVE;
              const { totalSpaces } = getSiteStats(site);
              return (
                <div
                  key={site.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0 }}>{site.code}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{site.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{site.country}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#374151' }}>{site.city}</span>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{site.buildings?.length ?? 0}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{totalSpaces}</span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{site.currency}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => navigate(`/admin/sites/${site.id}`)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><EyeOutlined style={{ fontSize: 12 }} /></button>
                    <button onClick={() => setEditingSite(site)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #fbbf24', background: '#fffbeb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><EditOutlined style={{ fontSize: 12, color: '#f59e0b' }} /></button>
                    <button onClick={() => { if (window.confirm(`Delete ${site.name}?`)) deleteMut.mutate(site.id); }} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* FIX: EditSiteModal rendered as sibling inside the fragment, not outside the return */}
      {editingSite && (
        <EditSiteModal site={editingSite} onClose={() => setEditingSite(null)} />
      )}
    </>
  );
}