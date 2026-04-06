import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import {
  SearchOutlined, FilterOutlined, HeartOutlined,
  AppstoreOutlined, UnorderedListOutlined, PlusOutlined,
  TeamOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CloseOutlined,
} from '@ant-design/icons';
import { spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Space, SpaceStatus, SpaceType } from '../../types';
import  AddSpaceModal  from '../../pages/spaces/AddSpaceModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<SpaceStatus, string> = {
  AVAILABLE:      'Available',
  OCCUPIED:       'Occupied',
  RESERVED:       'Reserved',
  MAINTENANCE:    'Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
};

const STATUS_STYLE: Record<SpaceStatus, { bg: string; color: string }> = {
  AVAILABLE:      { bg: '#dcfce7', color: '#15803d' },
  OCCUPIED:       { bg: '#dbeafe', color: '#1d4ed8' },
  RESERVED:       { bg: '#fef3c7', color: '#92400e' },
  MAINTENANCE:    { bg: '#fee2e2', color: '#b91c1c' },
  OUT_OF_SERVICE: { bg: '#f1f5f9', color: '#475569' },
};

const TYPE_LABEL: Record<SpaceType, string> = {
  DEDICATED_OFFICE: 'Dedicated Office',
  FLEXIBLE_DESK:    'Flexible Desk',
  HOT_DESK:         'Hot Desk',
  MEETING_ROOM:     'Meeting Room',
  CONFERENCE_ROOM:  'Conference Room',
  PHONE_BOOTH:      'Phone Booth',
  EVENT_SPACE:      'Event Space',
};

const TYPE_ICON: Record<SpaceType, string> = {
  DEDICATED_OFFICE: '🏢',
  FLEXIBLE_DESK:    '🪑',
  HOT_DESK:         '💻',
  MEETING_ROOM:     '📋',
  CONFERENCE_ROOM:  '🎯',
  PHONE_BOOTH:      '📞',
  EVENT_SPACE:      '🎪',
};

function formatPrice(space: Space): string {
  const sym = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';
  if (space.price_per_month) return `${sym}${parseFloat(space.price_per_month).toLocaleString()}/mo`;
  if (space.price_per_day)   return `${sym}${parseFloat(space.price_per_day).toLocaleString()}/day`;
  if (space.price_per_hour)  return `${sym}${parseFloat(space.price_per_hour).toLocaleString()}/hr`;
  return 'Price on request';
}

function getSpaceImage(type: SpaceType): string {
  const IMAGES: Partial<Record<SpaceType, string>> = {
    DEDICATED_OFFICE: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/d0aeb9ee80-deaa17ab9c213523c203.png',
    MEETING_ROOM:     'https://storage.googleapis.com/uxpilot-auth.appspot.com/003f0a7ed6-51e10a5837f3a2b32d90.png',
    CONFERENCE_ROOM:  'https://storage.googleapis.com/uxpilot-auth.appspot.com/6dda684c29-c0b8088cdd8ac699d9dd.png',
    HOT_DESK:         'https://storage.googleapis.com/uxpilot-auth.appspot.com/0254182f08-a6d9808c18964b46ecef.png',
  };
  return IMAGES[type] ?? 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a2849fd28e-3c00d2788db35a7064dc.png';
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SpaceSkeleton() {
  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      <Skeleton.Image active style={{ width: '100%', height: 180, borderRadius: 0 }} />
      <div style={{ padding: '14px 16px' }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    </div>
  );
}

// ─── Space Card ───────────────────────────────────────────────────────────────
function SpaceCard({ space, onClick }: { space: Space; onClick: () => void }) {
  const [liked, setLiked] = useState(false);
  const ss = STATUS_STYLE[space.status];

  return (
    <div
      style={{ ...CARD, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
      onClick={onClick}
    >
      <div style={{ position: 'relative', height: 180, overflow: 'hidden', background: '#f1f5f9' }}>
        <img
          src={getSpaceImage(space.type)}
          alt={space.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x180/1e293b/white?text=Office'; }}
        />
        <span style={{ position: 'absolute', top: 10, left: 10, background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
          {STATUS_LABEL[space.status]}
        </span>
        <span style={{ position: 'absolute', top: 10, right: 42, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>
          {TYPE_LABEL[space.type]}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
          style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <HeartOutlined style={{ color: liked ? '#ef4444' : '#94a3b8', fontSize: 14 }} />
        </button>
        {space.requires_approval && (
          <span style={{ position: 'absolute', bottom: 8, left: 10, background: 'rgba(245,158,11,0.9)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
            Requires Approval
          </span>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{space.name}</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>#{space.code}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{formatPrice(space)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 12, color: '#64748b' }}>
          <span>📐 {parseFloat(space.area_sqm).toFixed(0)} m²</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <TeamOutlined style={{ fontSize: 11 }} /> {space.capacity} {space.capacity === 1 ? 'person' : 'people'}
          </span>
        </div>

        {(space.features?.filter(f => f.is_available).length ?? 0) > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {space.features!.filter(f => f.is_available).slice(0, 3).map(f => (
              <span key={f.id} style={{ background: '#f8fafc', color: '#64748b', fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid #f1f5f9' }}>
                {f.feature_name}
              </span>
            ))}
            {space.features!.filter(f => f.is_available).length > 3 && (
              <span style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 10, padding: '2px 7px', borderRadius: 5 }}>
                +{space.features!.filter(f => f.is_available).length - 3}
              </span>
            )}
          </div>
        )}

        <button
          style={{ width: '100%', padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onClick(); }}
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SpacesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const isAdmin = !!(user?.role && ['SUPER_ADMIN', 'SITE_MANAGER'].includes(user.role));

  const [view,         setView]      = useState<'card' | 'list'>('card');
  const [typeFilter,   setType]      = useState('');
  const [statusFilter, setStatus]    = useState('');
  const [q,            setQ]         = useState('');
  const [showAddModal, setShowAdd]   = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);

  const { data: spaces = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['spaces', typeFilter, statusFilter],
    queryFn:  () => spaceApi.getAll({
      ...(typeFilter   && { type:   typeFilter   }),
      ...(statusFilter && { status: statusFilter }),
    }).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => spaceApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['spaces'] }); refetch(); },
    onError:    () => alert('Failed to delete space'),
  });

  const filtered = (spaces as Space[]).filter(s =>
    !q ||
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.code.toLowerCase().includes(q.toLowerCase())
  );

  const counts = {
    total:       spaces.length,
    available:   spaces.filter((s: Space) => s.status === 'AVAILABLE').length,
    occupied:    spaces.filter((s: Space) => s.status === 'OCCUPIED').length,
    reserved:    spaces.filter((s: Space) => s.status === 'RESERVED').length,
    maintenance: spaces.filter((s: Space) => s.status === 'MAINTENANCE').length,
  };

  const handleSpaceClick = (id: string) => {
    if (isAdmin)              navigate(`/admin/spaces/${id}`);
    else if (isAuthenticated) navigate(`/portal/spaces/${id}`);
    else                      navigate(`/spaces/${id}`);
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ✅ Add Space Modal */}
      {showAddModal && (
        <AddSpaceModal onClose={() => setShowAdd(false)} />
      )}
      {editingSpace && (
        <EditSpaceModal space={editingSpace} onClose={() => setEditingSpace(null)} />
      )}

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Office Directory</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              {isLoading ? 'Loading...' : `${spaces.length} spaces across all locations`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
              <ReloadOutlined /> Refresh
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)} // ✅ NOW WORKS
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
              >
                <PlusOutlined /> Add Space
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: 'Total',       value: counts.total,       color: '#2563eb', bg: '#eff6ff', icon: '🏢' },
            { label: 'Available',   value: counts.available,   color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Occupied',    value: counts.occupied,    color: '#d97706', bg: '#fffbeb', icon: '👥' },
            { label: 'Reserved',    value: counts.reserved,    color: '#7c3aed', bg: '#f5f3ff', icon: '📌' },
            { label: 'Maintenance', value: counts.maintenance, color: '#dc2626', bg: '#fef2f2', icon: '🔧' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Filters */}
        <div style={{ ...CARD, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}><FilterOutlined /> Filters</span>
            <button onClick={() => { setType(''); setStatus(''); setQ(''); }} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Clear</button>
          </div>

          <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 5 }}>Space Type</label>
          <Select
            value={typeFilter || 'all'}
            onChange={v => setType(v === 'all' ? '' : v)}
            style={{ width: '100%', marginBottom: 14 }}
            options={[
              { value: 'all', label: 'All Types' },
              ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: `${TYPE_ICON[v as SpaceType]} ${l}` })),
            ]}
          />

          <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 5 }}>Status</label>
          <Select
            value={statusFilter || 'all'}
            onChange={v => setStatus(v === 'all' ? '' : v)}
            style={{ width: '100%', marginBottom: 14 }}
            options={[
              { value: 'all', label: 'All Status' },
              ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />

          <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{isLoading ? '...' : filtered.length}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>spaces match</div>
          </div>
        </div>

        {/* Content */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by name or code..."
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: 220, borderRadius: 8 }}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setView('card')} style={{ padding: '7px 12px', background: view === 'card' ? '#2563eb' : '#fff', color: view === 'card' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><AppstoreOutlined /></button>
              <button onClick={() => setView('list')} style={{ padding: '7px 12px', background: view === 'list' ? '#2563eb' : '#fff', color: view === 'list' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer' }}><UnorderedListOutlined /></button>
            </div>
          </div>

          {!isLoading && (
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {spaces.length} spaces
            </div>
          )}

          {isError && (
            <div style={{ ...CARD, padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load spaces</div>
              <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Try Again</button>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <SpaceSkeleton key={i} />)}
            </div>
          )}

          {!isLoading && !isError && view === 'card' && (
            filtered.length === 0 ? (
              <div style={{ ...CARD, padding: '60px' }}>
                <Empty description="No spaces match your filters" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {filtered.map((space: Space) => (
                  <SpaceCard key={space.id} space={space} onClick={() => handleSpaceClick(space.id)} />
                ))}
              </div>
            )
          )}

          {!isLoading && !isError && view === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((space: Space) => {
                const ss = STATUS_STYLE[space.status];
                return (
                  <div
                    key={space.id}
                    style={{ ...CARD, display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
                    onClick={() => handleSpaceClick(space.id)}
                  >
                    <div style={{ position: 'relative', overflow: 'hidden', background: '#f1f5f9' }}>
                      <img src={getSpaceImage(space.type)} alt={space.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x120/1e293b/white?text=Space'; }} />
                      <span style={{ position: 'absolute', top: 8, left: 8, background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{STATUS_LABEL[space.status]}</span>
                    </div>
                    <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{space.name}</h3>
                        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>#{space.code} · {TYPE_LABEL[space.type]}</p>
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b' }}>
                          <span>📐 {parseFloat(space.area_sqm).toFixed(0)} m²</span>
                          <span><TeamOutlined style={{ marginRight: 3 }} />{space.capacity} people</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{formatPrice(space)}</div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={e => { e.stopPropagation(); handleSpaceClick(space.id); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            View Details
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={e => { e.stopPropagation(); setEditingSpace(space); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                <EditOutlined />
                              </button>
                              <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete ${space.name}?`)) deleteMut.mutate(space.id); }} style={{ padding: '7px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                <DeleteOutlined />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Space Modal ───────────────────────────────────────────────────────────
function EditSpaceModal({ space, onClose }: { space: Space; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: space.name,
    code: space.code,
    type: space.type,
    area_sqm: space.area_sqm.toString(),
    capacity: space.capacity.toString(),
    price_per_month: space.price_per_month,
    currency: space.currency,
    status: space.status,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const mutation = useMutation({
    mutationFn: (d: any) => spaceApi.update(space.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spaces'] }); onClose(); },
    onError:   (err: any) => { const msg = err?.response?.data?.message ?? 'Failed'; alert(Array.isArray(msg) ? msg.join(', ') : msg); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.code.trim()) e.code = 'Required';
    if (!form.type) e.type = 'Required';
    if (!form.area_sqm || parseFloat(form.area_sqm) <= 0) e.area_sqm = 'Valid area required';
    if (!form.capacity || parseInt(form.capacity) <= 0) e.capacity = 'Valid capacity required';
    if (!form.price_per_month || parseFloat(form.price_per_month) <= 0) e.price_per_month = 'Valid price required';
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      ...form,
      area_sqm: parseFloat(form.area_sqm),
      capacity: parseInt(form.capacity),
      price_per_month: parseFloat(form.price_per_month || '0'),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Edit Space</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Update space information</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <CloseOutlined />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Space Name *</label>
              <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.name} onChange={e => setF('name', e.target.value)} />
              {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Space Code *</label>
              <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.code ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.code} onChange={e => setF('code', e.target.value)} />
              {errors.code && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.code}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Type *</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.type ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.type} onChange={e => setF('type', e.target.value)}>
                <option value="OFFICE">Office</option>
                <option value="MEETING_ROOM">Meeting Room</option>
                <option value="COWORKING">Coworking</option>
                <option value="DESK">Desk</option>
                <option value="STORAGE">Storage</option>
              </select>
              {errors.type && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.type}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Status</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} value={form.status} onChange={e => setF('status', e.target.value)}>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="RESERVED">Reserved</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Area (m²) *</label>
              <input type="number" step="0.01" min="0" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.area_sqm ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.area_sqm} onChange={e => setF('area_sqm', e.target.value)} />
              {errors.area_sqm && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.area_sqm}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Capacity *</label>
              <input type="number" min="1" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.capacity ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.capacity} onChange={e => setF('capacity', e.target.value)} />
              {errors.capacity && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.capacity}</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Price/Month *</label>
              <input type="number" step="0.01" min="0" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.price_per_month ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.price_per_month} onChange={e => setF('price_per_month', e.target.value)} />
              {errors.price_per_month && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.price_per_month}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Currency</label>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} value={form.currency} onChange={e => setF('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AED">AED</option>
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
