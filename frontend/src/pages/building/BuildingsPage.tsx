import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import { message } from '../../utils/feedback';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  AppstoreOutlined, UnorderedListOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { buildingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Building } from '../../types';
import AddBuildingModal from '../sites/AddBuildingModal';
import PageHeader from '../../components/ui/PageHeader';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { isClientOperatorRole, visibleClientBuildings } from '../../utils/propertyScope';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:             { bg: '#dcfce7', color: '#15803d' },
  INACTIVE:           { bg: '#f1f5f9', color: '#475569' },
  UNDER_CONSTRUCTION: { bg: '#fef3c7', color: '#92400e' },
};

export default function BuildingsPage() {
  const { card, btnIcon, btnPrimary, t: th } = usePageTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin  = user?.role && ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'].includes(user.role);
  const isClientOps = isClientOperatorRole(user?.role);

  const [q,            setQ]         = useState('');
  const [statusFilter, setStatus]    = useState('');
  const [view,         setView]      = useState<'card' | 'list'>('card');
  const [showAdd,      setShowAdd]   = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const { data: buildingsRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ['buildings', isClientOps ? user?.tenant_id : 'all'],
    queryFn:  () => buildingApi.getAll(isClientOps ? user?.tenant_id : undefined),
    enabled:  !!user,
  });
  const buildings: Building[] = useMemo(
    () => visibleClientBuildings(Array.isArray(buildingsRaw) ? buildingsRaw : []),
    [buildingsRaw],
  );

  const qc = useQueryClient();

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => buildingApi.remove(id),
    onSuccess: () => {
      message.success('Building deleted successfully');
      qc.invalidateQueries({ queryKey: ['buildings'] });
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['floors'] });
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to delete building';
      message.error(msg);
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMut.mutate(id);
    }
  };

  const filtered = buildings.filter(b => {
    const matchQ      = !q || b.name.toLowerCase().includes(q.toLowerCase()) || b.code.toLowerCase().includes(q.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchQ && matchStatus;
  });

  const counts = {
    total:       buildings.length,
    active:      buildings.filter(b => b.status === 'ACTIVE').length,
    inactive:    buildings.filter(b => b.status === 'INACTIVE').length,
    construction:buildings.filter(b => b.status === 'UNDER_CONSTRUCTION').length,
  };

  // ✅ FIXED: always go through PickSiteModal — no more "smart" shortcuts
  // that fail when site data hasn't loaded yet
  const openAdd = () => setShowAdd(true);

  return (
    <PageShell>

      {showAdd && (
        <AddBuildingModal onClose={() => { setShowAdd(false); refetch(); }} />
      )}

      {editingBuilding && (
        <EditBuildingModal
          building={editingBuilding}
          onClose={() => { setEditingBuilding(null); refetch(); }}
        />
      )}

      <PageHeader
        title="Buildings"
        subtitle={isLoading ? 'Loading...' : `${buildings.length} buildings`}
        actions={
          <>
            <button type="button" onClick={() => refetch()} style={btnIcon}>
              <ReloadOutlined /> Refresh
            </button>
            {isAdmin && (
              <button type="button" onClick={openAdd} style={btnPrimary}>
                <PlusOutlined /> Add Building
              </button>
            )}
          </>
        }
        stats={[
          { label: 'Total', value: isLoading ? '—' : counts.total, color: '#2563eb' },
          { label: 'Active', value: isLoading ? '—' : counts.active, color: '#059669' },
          { label: 'Inactive', value: isLoading ? '—' : counts.inactive, color: th.textSub },
          { label: 'Construction', value: isLoading ? '—' : counts.construction, color: '#d97706' },
        ]}
      />

      {/* Filters + content */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search by name or code..."
          value={q} onChange={e => setQ(e.target.value)}
          style={{ width: 220, borderRadius: 8 }}
        />
        <Select
          value={statusFilter || 'all'}
          onChange={v => setStatus(v === 'all' ? '' : v)}
          style={{ width: 150 }}
          options={[
            { value: 'all',              label: 'All Status'     },
            { value: 'ACTIVE',           label: '✅ Active'       },
            { value: 'INACTIVE',         label: '⏸ Inactive'     },
            { value: 'UNDER_CONSTRUCTION', label: '🔨 Construction'},
          ]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textSub }}>
          Showing <strong style={{ color: th.text }}>{filtered.length}</strong> of {buildings.length}
        </div>
        <div style={{ display: 'flex', border: `1px solid ${th.cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('card')} style={{ padding: '7px 12px', background: view === 'card' ? '#2563eb' : th.cardBg, color: view === 'card' ? '#fff' : th.textSub, border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', background: view === 'list' ? '#2563eb' : th.cardBg, color: view === 'list' ? '#fff' : th.textSub, border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...card, padding: 20 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load buildings</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏗</div>
          <Empty description={buildings.length === 0 ? 'No buildings yet — add your first building' : 'No buildings match your filters'} />
          {isAdmin && buildings.length === 0 && (
            <button onClick={openAdd} style={{ marginTop: 16, padding: '9px 20px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <PlusOutlined style={{ marginRight: 6 }} /> Add First Building
            </button>
          )}
        </div>
      )}

      {/* Card view */}
      {!isLoading && !isError && filtered.length > 0 && view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {filtered.map(b => <BuildingCard key={b.id} building={b} onNavigate={() => navigate('/admin/floors')} onEdit={() => setEditingBuilding(b)} onDelete={() => handleDelete(b.id, b.name)} />)}
        </div>
      )}

      {/* List view */}
      {!isLoading && !isError && filtered.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => <BuildingRow key={b.id} building={b} onNavigate={() => navigate('/admin/floors')} onEdit={() => setEditingBuilding(b)} onDelete={() => handleDelete(b.id, b.name)} />)}
        </div>
      )}
    </PageShell>
  );
}

// ─── Building Card ────────────────────────────────────────────────────────────
function BuildingCard({ building: b, onNavigate, onEdit, onDelete }: { building: Building; onNavigate: () => void; onEdit: () => void; onDelete: () => void }) {
  const { card, t: th } = usePageTheme();
  const ss  = STATUS_STYLE[b.status] ?? STATUS_STYLE.INACTIVE;
  return (
    <div
      style={{ ...card, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
      onClick={onNavigate}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏗</div>
        <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{b.status.replace('_', ' ')}</span>
      </div>
      <h3 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, color: th.text }}>{b.name}</h3>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: th.textSub, fontFamily: 'monospace' }}>#{b.code}</p>
      {b.address && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: th.textSub }}>📍 {b.address}</p>
      )}
      {!b.address && <div style={{ marginBottom: 12 }} />}
      {b.total_floors_in_building != null && b.total_floors_in_building > 0 && (
        <p style={{ margin: '0 0 12px', fontSize: 11, color: th.textSub }}>
          Building has {b.total_floors_in_building} floors total · you manage {b.floors_count}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Floors you manage', value: b.floors_count },
          { label: 'Area',        value: `${parseFloat(b.total_area_sqm).toLocaleString()} m²` },
          { label: 'Year Built',  value: b.year_built ?? '—' },
          { label: 'Spaces',      value: b.floors?.reduce((acc, f) => acc + (f.spaces?.length ?? 0), 0) ?? '—' },
        ].map(item => (
          <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{item.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onNavigate(); }}
        >
          View Floors →
        </button>
        <button
          style={{ padding: '9px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="Edit building"
        >
          <EditOutlined />
        </button>
        <button
          style={{ padding: '9px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete building"
        >
          <DeleteOutlined />
        </button>
      </div>
    </div>
  );
}

// ─── Building Row ─────────────────────────────────────────────────────────────
function BuildingRow({ building: b, onNavigate, onEdit, onDelete }: { building: Building; onNavigate: () => void; onEdit: () => void; onDelete: () => void }) {
  const { card, t: th } = usePageTheme();
  const ss   = STATUS_STYLE[b.status] ?? STATUS_STYLE.INACTIVE;
  return (
    <div
      style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
      onClick={onNavigate}
    >
      <div style={{ width: 42, height: 42, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏗</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: th.text }}>{b.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>#{b.code}</span>
          <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{b.status.replace('_', ' ')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: th.textSub, flexShrink: 0 }}>
        <span>🏢 {b.floors_count} floors</span>
        <span>📐 {parseFloat(b.total_area_sqm).toLocaleString()} m²</span>
        {b.year_built && <span>📅 {b.year_built}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="Edit building">
          <EditOutlined />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="Delete building">
          <DeleteOutlined />
        </button>
        <button onClick={e => { e.stopPropagation(); onNavigate(); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          View →
        </button>
      </div>
    </div>
  );
}

// ─── Edit Building Modal ────────────────────────────────────────────────────────
function EditBuildingModal({ building, onClose }: { building: Building; onClose: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: building.name,
    code: building.code,
    address: building.address ?? '',
    total_area_sqm: building.total_area_sqm.toString(),
    year_built: building.year_built?.toString() || '',
    status: building.status,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMut = useMutation({
    mutationFn: (data: unknown) => buildingApi.update(building.id, data),
    onSuccess: () => {
      message.success('Building updated successfully');
      qc.invalidateQueries({ queryKey: ['buildings'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to update building';
      message.error(msg);
    },
  });

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.code.trim()) e.code = 'Code is required';
    if (!form.total_area_sqm || Number(form.total_area_sqm) <= 0) e.total_area_sqm = 'Valid area is required';
    
    if (Object.keys(e).length) { setErrors(e); return; }

    setLoading(true);
    updateMut.mutate({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim() || null,
      total_area_sqm: parseFloat(form.total_area_sqm),
      year_built: form.year_built ? parseInt(form.year_built) : null,
      status: form.status,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Edit Building</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Update building information</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Building Name *</label>
            <input
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(e => { const n = { ...e }; delete n.name; return n; }); }}
              placeholder="e.g. Tower A"
            />
            {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Building Code *</label>
            <input
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.code ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, fontFamily: 'monospace', textTransform: 'uppercase' }}
              value={form.code}
              onChange={e => { setForm(f => ({ ...f, code: e.target.value })); setErrors(e => { const n = { ...e }; delete n.code; return n; }); }}
              placeholder="e.g. TWR-A"
            />
            {errors.code && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.code}</div>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Address</label>
            <input
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. West Bay, Doha"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Total Area (m²) *</label>
              <input
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.total_area_sqm ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}
                type="number"
                min="0"
                step="0.1"
                value={form.total_area_sqm}
                onChange={e => { setForm(f => ({ ...f, total_area_sqm: e.target.value })); setErrors(e => { const n = { ...e }; delete n.total_area_sqm; return n; }); }}
                placeholder="e.g. 1500"
              />
              {errors.total_area_sqm && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.total_area_sqm}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Year Built</label>
              <input
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={form.year_built}
                onChange={e => setForm(f => ({ ...f, year_built: e.target.value }))}
                placeholder="e.g. 2020"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Status</label>
            <select
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              <option value="ACTIVE">✅ Active</option>
              <option value="INACTIVE">⏸ Inactive</option>
              <option value="UNDER_CONSTRUCTION">🔨 Under Construction</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ flex: 1, padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 1, padding: '9px 20px', borderRadius: 8, background: loading ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
