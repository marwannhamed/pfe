import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty, message } from 'antd';
import { SearchOutlined, PlusOutlined, ReloadOutlined, AppstoreOutlined, UnorderedListOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { floorApi, buildingApi, siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Floor, Building, Site } from '../../types';
import AddFloorModal from '../sites/AddFloorModal';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:           { bg: '#dcfce7', color: '#15803d' },
  INACTIVE:         { bg: '#f1f5f9', color: '#475569' },
  UNDER_RENOVATION: { bg: '#fef3c7', color: '#92400e' },
};

export default function FloorsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin  = user?.role && ['SUPER_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const [q,              setQ]           = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [statusFilter,   setStatus]      = useState('');
  const [view,           setView]        = useState<'card' | 'list'>('card');
  const [showAdd,        setShowAdd]     = useState(false);
  const [addForBuilding, setAddForBuilding] = useState<{ id: string; name: string } | null>(null);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  // Fetch sites for context labels
  const { data: sitesRaw } = useQuery({
    queryKey: ['sites-for-floors'],
    queryFn:  () => siteApi.getAll().then(r => r.data),
  });
  const sites: Site[] = Array.isArray(sitesRaw) ? sitesRaw : [];

  // Fetch buildings for filter dropdown
  const { data: buildingsRaw } = useQuery({
    queryKey: ['buildings-for-floors'],
    queryFn:  () => buildingApi.getAll().then(r => r.data),
  });
  const buildings: Building[] = Array.isArray(buildingsRaw) ? buildingsRaw : [];

  // Fetch floors
  const { data: floorsRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ['floors-page', buildingFilter],
    queryFn:  () => floorApi.getAll(buildingFilter || undefined).then(r => r.data),
  });
  const floors: Floor[] = Array.isArray(floorsRaw) ? floorsRaw : [];

  const qc = useQueryClient();

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => floorApi.remove(id),
    onSuccess: () => {
      message.success('Floor deleted successfully');
      qc.invalidateQueries({ queryKey: ['floors-page'] });
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to delete floor';
      message.error(msg);
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMut.mutate(id);
    }
  };

  const filtered = floors.filter(f => {
    const matchQ      = !q || f.name.toLowerCase().includes(q.toLowerCase());
    const matchStatus = !statusFilter || f.status === statusFilter;
    return matchQ && matchStatus;
  });

  const counts = {
    total:       floors.length,
    active:      floors.filter(f => f.status === 'ACTIVE').length,
    inactive:    floors.filter(f => f.status === 'INACTIVE').length,
    renovation:  floors.filter(f => f.status === 'UNDER_RENOVATION').length,
    totalSpaces: floors.reduce((acc, f) => acc + (f.spaces?.length ?? 0), 0),
  };

  // ✅ FIXED: always go through PickBuildingModal
  const openAdd = () => setShowAdd(true);

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ✅ Only render AddFloorModal when we have a valid buildingId */}
      {addForBuilding?.id && (
        <AddFloorModal
          buildingId={addForBuilding.id}
          buildingName={addForBuilding.name}
          onClose={() => { setAddForBuilding(null); refetch(); }}
        />
      )}

      {editingFloor && (
        <EditFloorModal
          floor={editingFloor}
          buildings={buildings}
          onClose={() => { setEditingFloor(null); refetch(); }}
        />
      )}

      {/* ✅ PickBuildingModal — always go here first, hide once building picked */}
      {showAdd && !addForBuilding && (
        <PickBuildingModal
          buildings={buildings}
          sites={sites}
          onPick={b => { setShowAdd(false); setAddForBuilding({ id: b.id, name: b.name }); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Floors</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              {isLoading ? 'Loading...' : `${floors.length} floors across all buildings`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
              <ReloadOutlined /> Refresh
            </button>
            {isAdmin && (
              <button
                onClick={openAdd}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
              >
                <PlusOutlined /> Add Floor
              </button>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: 'Total Floors',  value: counts.total,       color: '#2563eb', bg: '#eff6ff', icon: '🏢' },
            { label: 'Active',        value: counts.active,      color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Inactive',      value: counts.inactive,    color: '#64748b', bg: '#f1f5f9', icon: '⏸' },
            { label: 'Renovation',    value: counts.renovation,  color: '#d97706', bg: '#fffbeb', icon: '🔨' },
            { label: 'Total Spaces',  value: counts.totalSpaces, color: '#7c3aed', bg: '#f5f3ff', icon: '🏠' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {isLoading ? '—' : s.value}
                  </p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search by floor name..."
          value={q} onChange={e => setQ(e.target.value)}
          style={{ width: 220, borderRadius: 8 }}
        />
        <Select
          value={buildingFilter || 'all'}
          onChange={v => setBuildingFilter(v === 'all' ? '' : v)}
          style={{ width: 200 }}
          options={[{ value: 'all', label: 'All Buildings' }, ...buildings.map(b => ({ value: b.id, label: b.name }))]}
        />
        <Select
          value={statusFilter || 'all'}
          onChange={v => setStatus(v === 'all' ? '' : v)}
          style={{ width: 160 }}
          options={[
            { value: 'all',             label: 'All Status'    },
            { value: 'ACTIVE',          label: '✅ Active'      },
            { value: 'INACTIVE',        label: '⏸ Inactive'    },
            { value: 'UNDER_RENOVATION',label: '🔨 Renovation'  },
          ]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {floors.length}
        </div>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('card')} style={{ padding: '7px 12px', background: view === 'card' ? '#2563eb' : '#fff', color: view === 'card' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', background: view === 'list' ? '#2563eb' : '#fff', color: view === 'list' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...CARD, padding: 20 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
          ))}
        </div>
      )}

      {isError && (
        <div style={{ ...CARD, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load floors</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <Empty description={floors.length === 0 ? 'No floors yet — add your first floor' : 'No floors match your filters'} />
          {isAdmin && floors.length === 0 && (
            <button onClick={openAdd} style={{ marginTop: 16, padding: '9px 20px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <PlusOutlined style={{ marginRight: 6 }} /> Add First Floor
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {filtered.map(f => <FloorCard key={f.id} floor={f} buildings={buildings} sites={sites} onNavigate={() => { const b = buildings.find(b => b.id === f.building_id); if (b) navigate(`/admin/sites/${b.site_id}`); }} onEdit={() => setEditingFloor(f)} onDelete={() => handleDelete(f.id, f.name)} />)}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(f => <FloorRow key={f.id} floor={f} buildings={buildings} sites={sites} onNavigate={() => { const b = buildings.find(b => b.id === f.building_id); if (b) navigate(`/admin/sites/${b.site_id}`); }} onEdit={() => setEditingFloor(f)} onDelete={() => handleDelete(f.id, f.name)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Floor Card ───────────────────────────────────────────────────────────────
function FloorCard({ floor: f, buildings, sites, onNavigate, onEdit, onDelete }: { floor: Floor; buildings: Building[]; sites: Site[]; onNavigate: () => void; onEdit: () => void; onDelete: () => void }) {
  const ss       = STATUS_STYLE[f.status] ?? STATUS_STYLE.INACTIVE;
  const building = buildings.find(b => b.id === f.building_id);
  const site     = building ? sites.find(s => s.id === building.site_id) : undefined;
  const spaceCount = f.spaces?.length ?? 0;

  return (
    <div
      style={{ ...CARD, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
      onClick={onNavigate}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#60a5fa' }}>
          F{f.floor_number}
        </div>
        <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
          {f.status.replace('_', ' ')}
        </span>
      </div>

      <h3 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{f.name}</h3>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>Floor {f.floor_number}</p>
      {building && <p style={{ margin: '0 0 3px', fontSize: 12, color: '#7c3aed', fontWeight: 500 }}>🏗 {building.name}</p>}
      {site     && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#2563eb', fontWeight: 500 }}>📍 {site.name}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Area</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{parseFloat(f.area_sqm).toFixed(0)} m²</div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Spaces</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{spaceCount}</div>
        </div>
      </div>

      {/* Space status mini bar */}
      {spaceCount > 0 && f.spaces && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' }}>
            {[
              { status: 'AVAILABLE', color: '#22c55e' },
              { status: 'OCCUPIED',  color: '#3b82f6' },
              { status: 'RESERVED',  color: '#f59e0b' },
              { status: 'MAINTENANCE', color: '#ef4444' },
            ].map(({ status, color }) => {
              const count = f.spaces!.filter((s: any) => s.status === status).length;
              const pct   = (count / spaceCount) * 100;
              if (!pct) return null;
              return <div key={status} style={{ width: `${pct}%`, background: color, borderRadius: 3 }} title={`${status}: ${count}`} />;
            })}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Space occupancy breakdown</div>
        </div>
      )}

      {f.floor_plan_url && (
        <a href={f.floor_plan_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#2563eb', display: 'block', marginBottom: 10 }}>
          🗺 View Floor Plan
        </a>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onNavigate(); }}
        >
          View in Site →
        </button>
        <button
          style={{ padding: '9px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="Edit floor"
        >
          <EditOutlined />
        </button>
        <button
          style={{ padding: '9px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete floor"
        >
          <DeleteOutlined />
        </button>
      </div>
    </div>
  );
}

// ─── Floor Row ────────────────────────────────────────────────────────────────
function FloorRow({ floor: f, buildings, sites, onNavigate, onEdit, onDelete }: { floor: Floor; buildings: Building[]; sites: Site[]; onNavigate: () => void; onEdit: () => void; onDelete: () => void }) {
  const ss       = STATUS_STYLE[f.status] ?? STATUS_STYLE.INACTIVE;
  const building = buildings.find(b => b.id === f.building_id);
  const site     = building ? sites.find(s => s.id === building.site_id) : undefined;

  return (
    <div
      style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
      onClick={onNavigate}
    >
      <div style={{ width: 42, height: 42, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#60a5fa', flexShrink: 0 }}>
        F{f.floor_number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{f.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Floor {f.floor_number}</span>
          <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{f.status.replace('_', ' ')}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {building && <span style={{ color: '#7c3aed', fontWeight: 500 }}>🏗 {building.name}</span>}
          {site     && <span style={{ color: '#2563eb', fontWeight: 500 }}>📍 {site.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b', flexShrink: 0 }}>
        <span>📐 {parseFloat(f.area_sqm).toFixed(0)} m²</span>
        <span>🏠 {f.spaces?.length ?? 0} spaces</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="Edit floor">
          <EditOutlined />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="Delete floor">
          <DeleteOutlined />
        </button>
        <button onClick={e => { e.stopPropagation(); onNavigate(); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          View →
        </button>
      </div>
    </div>
  );
}

// ─── Pick Building Modal ──────────────────────────────────────────────────────
function PickBuildingModal({ buildings, sites, onPick, onClose }: { buildings: Building[]; sites: Site[]; onPick: (b: Building) => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Select a Building</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Which building will this floor belong to?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {buildings.map(b => {
            const site = sites.find(s => s.id === b.site_id);
            return (
              <button key={b.id} onClick={() => onPick(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏗</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{site ? `📍 ${site.name}` : b.code} · {b.floors_count} floors</div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Edit Floor Modal ────────────────────────────────────────────────────────────
function EditFloorModal({ floor, buildings, onClose }: { floor: Floor; buildings: Building[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: floor.name,
    floor_number: floor.floor_number.toString(),
    area_sqm: floor.area_sqm.toString(),
    status: floor.status,
    building_id: floor.building_id,
    floor_plan_url: floor.floor_plan_url || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMut = useMutation({
    mutationFn: (data: any) => floorApi.update(floor.id, data),
    onSuccess: () => {
      message.success('Floor updated successfully');
      qc.invalidateQueries({ queryKey: ['floors-page'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to update floor';
      message.error(msg);
    },
  });

  const handleSubmit = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.floor_number || Number(form.floor_number) < 1) e.floor_number = 'Valid floor number is required';
    if (!form.area_sqm || Number(form.area_sqm) <= 0) e.area_sqm = 'Valid area is required';
    
    if (Object.keys(e).length) { setErrors(e); return; }

    setLoading(true);
    updateMut.mutate({
      name: form.name.trim(),
      floor_number: parseInt(form.floor_number),
      area_sqm: parseFloat(form.area_sqm),
      status: form.status,
      building_id: form.building_id,
      floor_plan_url: form.floor_plan_url.trim() || null,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Edit Floor</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Update floor information</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Floor Name *</label>
            <input
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(e => { const n = { ...e }; delete n.name; return n; }); }}
              placeholder="e.g. First Floor"
            />
            {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Floor Number *</label>
              <input
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.floor_number ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}
                type="number"
                min="1"
                value={form.floor_number}
                onChange={e => { setForm(f => ({ ...f, floor_number: e.target.value })); setErrors(e => { const n = { ...e }; delete n.floor_number; return n; }); }}
                placeholder="e.g. 1"
              />
              {errors.floor_number && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.floor_number}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Area (m²) *</label>
              <input
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.area_sqm ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }}
                type="number"
                min="0"
                step="0.1"
                value={form.area_sqm}
                onChange={e => { setForm(f => ({ ...f, area_sqm: e.target.value })); setErrors(e => { const n = { ...e }; delete n.area_sqm; return n; }); }}
                placeholder="e.g. 500"
              />
              {errors.area_sqm && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.area_sqm}</div>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Building</label>
            <select
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
              value={form.building_id}
              onChange={e => setForm(f => ({ ...f, building_id: e.target.value }))}
            >
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
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
              <option value="UNDER_RENOVATION">🔨 Under Renovation</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Floor Plan URL</label>
            <input
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }}
              value={form.floor_plan_url}
              onChange={e => setForm(f => ({ ...f, floor_plan_url: e.target.value }))}
              placeholder="https://example.com/floor-plan.pdf"
            />
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
