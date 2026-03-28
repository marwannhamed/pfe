import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty, Modal, Form } from 'antd';
import {
  SearchOutlined, PlusOutlined, DownloadOutlined,
  AppstoreOutlined, UnorderedListOutlined, EnvironmentOutlined,
  ReloadOutlined, EyeOutlined, EditOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Site, SiteStatus } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<SiteStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:   { label: 'Active',    bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined /> },
  INACTIVE: { label: 'Inactive',  bg: '#f1f5f9', color: '#475569', icon: <ExclamationCircleOutlined /> },
  CLOSED:   { label: 'Closed',    bg: '#fee2e2', color: '#b91c1c', icon: <ExclamationCircleOutlined /> },
};

function getSiteStats(site: Site) {
  let totalSpaces = 0;
  let availableSpaces = 0;
  site.buildings?.forEach(b => {
    b.floors?.forEach(f => {
      f.spaces?.forEach(s => {
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

// ─── Add Site Modal ───────────────────────────────────────────────────────────
function AddSiteModal({ open, onClose, tenantId }: { open: boolean; onClose: () => void; tenantId: string }) {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      await form.validateFields();
      if (step < 2) { setStep(s => s + 1); return; }
      setLoading(true);
      const values = form.getFieldsValue(true);
      await siteApi.create({ ...values, tenant_id: tenantId });
      onClose();
      form.resetFields();
      setStep(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={<div><div style={{ fontWeight: 700, fontSize: 17 }}>Add New Branch</div><div style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>Step {step + 1} of 3</div></div>}
      onCancel={() => { onClose(); form.resetFields(); setStep(0); }}
      footer={null}
      width={580}
    >
      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {['Basic Info', 'Location', 'Settings'].map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#2563eb' : '#e5e7eb', transition: 'background 0.2s' }} />
        ))}
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {step === 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Branch Name" name="name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Manhattan Downtown" />
              </Form.Item>
              <Form.Item label="Branch Code" name="code" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. NYC" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </div>
            <Form.Item label="Status" name="status" initialValue="ACTIVE">
              <Select options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
            </Form.Item>
          </>
        )}
        {step === 1 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="City" name="city" rules={[{ required: true }]}>
                <Input placeholder="e.g. New York" />
              </Form.Item>
              <Form.Item label="Country" name="country" rules={[{ required: true }]}>
                <Input placeholder="e.g. USA" />
              </Form.Item>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item label="Timezone" name="timezone" initialValue="UTC">
                <Select options={[
                  { value: 'UTC', label: 'UTC' },
                  { value: 'America/New_York', label: 'New York (EST)' },
                  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
                  { value: 'Europe/London', label: 'London (GMT)' },
                  { value: 'Europe/Paris', label: 'Paris (CET)' },
                  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
                  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
                ]} />
              </Form.Item>
              <Form.Item label="Currency" name="currency" initialValue="USD">
                <Select options={[
                  { value: 'USD', label: 'USD — US Dollar' },
                  { value: 'EUR', label: 'EUR — Euro' },
                  { value: 'GBP', label: 'GBP — British Pound' },
                  { value: 'JPY', label: 'JPY — Japanese Yen' },
                  { value: 'AUD', label: 'AUD — Australian Dollar' },
                  { value: 'AED', label: 'AED — UAE Dirham' },
                  { value: 'TND', label: 'TND — Tunisian Dinar' },
                ]} />
              </Form.Item>
            </div>
          </>
        )}
      </Form>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { if (step > 0) setStep(s => s - 1); else onClose(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>
          {step > 0 ? '← Back' : 'Cancel'}
        </button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {step < 2 ? 'Continue →' : loading ? 'Creating...' : '✓ Create Branch'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SitesPage() {
  const navigate      = useNavigate();
  const { user }      = useAuthStore();
  const tenantId      = user?.tenant_id ?? '';

  const [view,   setView]   = useState<'card' | 'table'>('card');
  const [status, setStatus] = useState('');
  const [q,      setQ]      = useState('');
  const [addOpen, setAdd]   = useState(false);

  // ── Fetch real sites from API ──
  const { data: sites = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sites', tenantId],
    queryFn:  () => siteApi.getAll(tenantId || undefined).then(r => r.data),
  });

  const filtered = sites.filter(s => {
    if (status && s.status !== status) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.city.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Real stats
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
    { label: 'Total Branches',    value: sites.length,    sub: `${filtered.length} shown`,         color: '#2563eb', bg: '#eff6ff' },
    { label: 'Average Occupancy', value: `${avgOccupancy}%`, sub: avgOccupancy >= 75 ? '↑ Above target' : '↓ Below target', color: '#059669', bg: '#f0fdf4' },
    { label: 'Available Offices', value: totalAvailable,  sub: 'Ready for occupancy',              color: '#d97706', bg: '#fffbeb' },
    { label: 'Active Sites',      value: sites.filter(s => s.status === 'ACTIVE').length, sub: 'Fully operational', color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

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
            <button onClick={() => setAdd(true)} style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            { value: 'all',      label: 'All Status'  },
            { value: 'ACTIVE',   label: 'Active'      },
            { value: 'INACTIVE', label: 'Inactive'    },
            { value: 'CLOSED',   label: 'Closed'      },
          ]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('card')}  style={{ padding: '7px 12px', background: view === 'card' ? '#2563eb' : '#fff', color: view === 'card' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
          <button onClick={() => setView('table')} style={{ padding: '7px 12px', background: view === 'table' ? '#2563eb' : '#fff', color: view === 'table' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
        </div>
      </div>

      {!isLoading && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
          Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {sites.length} branches
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load branches</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={CARD}>
              <div style={{ height: 80, background: '#1e293b', borderRadius: '12px 12px 0 0' }} />
              <div style={{ padding: '16px' }}><Skeleton active paragraph={{ rows: 3 }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px' }}>
          <Empty description={sites.length === 0 ? 'No branches yet. Add your first branch!' : 'No branches match your filters.'} />
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
                style={{ ...CARD, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {sm.icon} {sm.label}
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

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'Buildings', value: site.buildings?.length ?? 0, icon: '🏗' },
                      { label: 'Spaces',    value: totalSpaces,                 icon: '🏢' },
                      { label: 'Available', value: availableSpaces,             icon: '✅' },
                    ].map(st => (
                      <div key={st.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
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
                        {site.manager.first_name[0]}{site.manager.last_name[0]}
                      </div>
                      <span style={{ color: '#374151', fontWeight: 500 }}>{site.manager.first_name} {site.manager.last_name}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>Manager</span>
                    </div>
                  )}

                  {/* Meta */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, fontSize: 11, color: '#94a3b8' }}>
                    <span>🕐 {site.timezone}</span>
                    <span>💱 {site.currency}</span>
                    <span>📅 {new Date(site.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>

                  <button
                    onClick={() => navigate(`/admin/sites/${site.id}`)}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Branch</span><span>City</span><span>Status</span><span>Buildings</span><span>Spaces</span><span>Currency</span><span>Actions</span>
          </div>
          {filtered.map((site, i) => {
            const sm = STATUS_META[site.status] ?? STATUS_META.INACTIVE;
            const { totalSpaces } = getSiteStats(site);
            return (
              <div
                key={site.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
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
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}>{sm.icon} {sm.label}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{site.buildings?.length ?? 0}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{totalSpaces}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>{site.currency}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => navigate(`/admin/sites/${site.id}`)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><EyeOutlined style={{ fontSize: 12 }} /></button>
                  <button style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><EditOutlined style={{ fontSize: 12 }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddSiteModal open={addOpen} onClose={() => { setAdd(false); refetch(); }} tenantId={tenantId} />
    </div>
  );
}
