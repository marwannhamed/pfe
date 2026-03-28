import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { buildingApi, siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Building, Site } from '../../types';
import AddBuildingModal from '../sites/AddBuildingModal';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:             { bg: '#dcfce7', color: '#15803d' },
  INACTIVE:           { bg: '#f1f5f9', color: '#475569' },
  UNDER_CONSTRUCTION: { bg: '#fef3c7', color: '#92400e' },
};

export default function BuildingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin  = user?.role && ['SUPER_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const [q,            setQ]         = useState('');
  const [siteFilter,   setSiteFilter] = useState('');
  const [statusFilter, setStatus]    = useState('');
  const [view,         setView]      = useState<'card' | 'list'>('card');
  const [showAdd,      setShowAdd]   = useState(false);
  const [addForSite,   setAddForSite]= useState<{ id: string; name: string } | null>(null);

  const { data: sitesRaw } = useQuery({
    queryKey: ['sites-for-buildings'],
    queryFn:  () => siteApi.getAll().then(r => r.data),
  });
  const sites: Site[] = Array.isArray(sitesRaw) ? sitesRaw : [];

  const { data: buildingsRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ['buildings', siteFilter],
    queryFn:  () => buildingApi.getAll(siteFilter || undefined).then(r => r.data),
  });
  const buildings: Building[] = Array.isArray(buildingsRaw) ? buildingsRaw : [];

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
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ✅ Only render AddBuildingModal when we have a valid siteId */}
      {addForSite?.id && (
        <AddBuildingModal
          siteId={addForSite.id}
          siteName={addForSite.name}
          onClose={() => { setAddForSite(null); refetch(); }}
        />
      )}

      {/* ✅ PickSiteModal — always go here first */}
      {showAdd && !addForSite && (
        <PickSiteModal
          sites={sites}
          onPick={site => { setShowAdd(false); setAddForSite({ id: site.id, name: site.name }); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Buildings</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              {isLoading ? 'Loading...' : `${buildings.length} buildings across all sites`}
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
                <PlusOutlined /> Add Building
              </button>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total',        value: counts.total,        color: '#2563eb', bg: '#eff6ff', icon: '🏗' },
            { label: 'Active',       value: counts.active,       color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Inactive',     value: counts.inactive,     color: '#64748b', bg: '#f1f5f9', icon: '⏸' },
            { label: 'Construction', value: counts.construction, color: '#d97706', bg: '#fffbeb', icon: '🔨' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {isLoading ? '—' : s.value}
                  </p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters + content */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search by name or code..."
          value={q} onChange={e => setQ(e.target.value)}
          style={{ width: 220, borderRadius: 8 }}
        />
        <Select
          value={siteFilter || 'all'}
          onChange={v => setSiteFilter(v === 'all' ? '' : v)}
          style={{ width: 180 }}
          options={[{ value: 'all', label: 'All Sites' }, ...sites.map(s => ({ value: s.id, label: s.name }))]}
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
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {buildings.length}
        </div>
        <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('card')} style={{ padding: '7px 12px', background: view === 'card' ? '#2563eb' : '#fff', color: view === 'card' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
          <button onClick={() => setView('list')} style={{ padding: '7px 12px', background: view === 'list' ? '#2563eb' : '#fff', color: view === 'list' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...CARD, padding: 20 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load buildings</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: 60, textAlign: 'center' }}>
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
          {filtered.map(b => <BuildingCard key={b.id} building={b} sites={sites} onNavigate={() => navigate(`/admin/sites/${b.site_id}`)} />)}
        </div>
      )}

      {/* List view */}
      {!isLoading && !isError && filtered.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => <BuildingRow key={b.id} building={b} sites={sites} onNavigate={() => navigate(`/admin/sites/${b.site_id}`)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Building Card ────────────────────────────────────────────────────────────
function BuildingCard({ building: b, sites, onNavigate }: { building: Building; sites: Site[]; onNavigate: () => void }) {
  const ss  = STATUS_STYLE[b.status] ?? STATUS_STYLE.INACTIVE;
  const site = sites.find(s => s.id === b.site_id);
  return (
    <div
      style={{ ...CARD, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
      onClick={onNavigate}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏗</div>
        <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{b.status.replace('_', ' ')}</span>
      </div>
      <h3 style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{b.name}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>#{b.code}</p>
      {site && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#2563eb', fontWeight: 500 }}>📍 {site.name} — {site.city}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Floors',      value: b.floors_count },
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
      <button
        style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); onNavigate(); }}
      >
        View in Site →
      </button>
    </div>
  );
}

// ─── Building Row ─────────────────────────────────────────────────────────────
function BuildingRow({ building: b, sites, onNavigate }: { building: Building; sites: Site[]; onNavigate: () => void }) {
  const ss   = STATUS_STYLE[b.status] ?? STATUS_STYLE.INACTIVE;
  const site = sites.find(s => s.id === b.site_id);
  return (
    <div
      style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
      onClick={onNavigate}
    >
      <div style={{ width: 42, height: 42, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏗</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{b.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>#{b.code}</span>
          <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{b.status.replace('_', ' ')}</span>
        </div>
        {site && <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500, marginTop: 2 }}>📍 {site.name} — {site.city}</div>}
      </div>
      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b', flexShrink: 0 }}>
        <span>🏢 {b.floors_count} floors</span>
        <span>📐 {parseFloat(b.total_area_sqm).toLocaleString()} m²</span>
        {b.year_built && <span>📅 {b.year_built}</span>}
      </div>
      <button onClick={e => { e.stopPropagation(); onNavigate(); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
        View →
      </button>
    </div>
  );
}

// ─── Pick Site Modal ──────────────────────────────────────────────────────────
function PickSiteModal({ sites, onPick, onClose }: { sites: Site[]; onPick: (s: Site) => void; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Select a Site</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Which site will this building belong to?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sites.map(s => (
            <button key={s.id} onClick={() => onPick(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{s.code}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>📍 {s.city}, {s.country}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 14, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Cancel</button>
      </div>
    </div>
  );
}
