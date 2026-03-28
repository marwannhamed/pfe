import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, Skeleton, Badge } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, CalendarOutlined,
  EnvironmentOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Space, SpaceStatus, SpaceType, SpaceFeature } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<SpaceStatus, { label: string; bg: string; color: string }> = {
  AVAILABLE:      { label: 'Available',      bg: '#dcfce7', color: '#15803d' },
  OCCUPIED:       { label: 'Occupied',       bg: '#dbeafe', color: '#1d4ed8' },
  RESERVED:       { label: 'Reserved',       bg: '#fef3c7', color: '#92400e' },
  MAINTENANCE:    { label: 'Maintenance',    bg: '#fee2e2', color: '#b91c1c' },
  OUT_OF_SERVICE: { label: 'Out of Service', bg: '#f1f5f9', color: '#475569' },
};

const TYPE_META: Record<SpaceType, { label: string; icon: string }> = {
  DEDICATED_OFFICE: { label: 'Dedicated Office', icon: '🏢' },
  FLEXIBLE_DESK:    { label: 'Flexible Desk',    icon: '🪑' },
  HOT_DESK:         { label: 'Hot Desk',          icon: '💻' },
  MEETING_ROOM:     { label: 'Meeting Room',      icon: '📋' },
  CONFERENCE_ROOM:  { label: 'Conference Room',   icon: '🎯' },
  PHONE_BOOTH:      { label: 'Phone Booth',       icon: '📞' },
  EVENT_SPACE:      { label: 'Event Space',       icon: '🎪' },
};

const SPACE_IMAGES: Partial<Record<SpaceType, string>> = {
  DEDICATED_OFFICE: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/d0aeb9ee80-deaa17ab9c213523c203.png',
  MEETING_ROOM:     'https://storage.googleapis.com/uxpilot-auth.appspot.com/003f0a7ed6-51e10a5837f3a2b32d90.png',
  CONFERENCE_ROOM:  'https://storage.googleapis.com/uxpilot-auth.appspot.com/6dda684c29-c0b8088cdd8ac699d9dd.png',
  HOT_DESK:         'https://storage.googleapis.com/uxpilot-auth.appspot.com/0254182f08-a6d9808c18964b46ecef.png',
};

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SpaceDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const isAdmin  = !!(user?.role && ['SUPER_ADMIN', 'SITE_MANAGER'].includes(user.role));
  const backPath = isAdmin ? '/admin/spaces' : isAuthenticated ? '/portal/spaces' : '/spaces';
  const bookPath = isAuthenticated ? '/portal/bookings' : '/register';

  const { data: space, isLoading, isError, refetch } = useQuery({
    queryKey: ['space', id],
    queryFn:  () => spaceApi.getOne(id!).then(r => r.data),
    enabled:  !!id,
  });

  if (isLoading) return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );

  if (isError || !space) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <WarningOutlined style={{ fontSize: 40, color: '#d97706', display: 'block', margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load space</div>
      <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
        Retry
      </button>
    </div>
  );

  const sm                 = STATUS_META[space.status as SpaceStatus] ?? STATUS_META.AVAILABLE;
  const tm                 = TYPE_META[space.type as SpaceType]       ?? TYPE_META.DEDICATED_OFFICE;
  const allFeatures        = (space.features ?? []) as SpaceFeature[];
  const availableFeatures  = allFeatures.filter(f => f.is_available);
  const currSym            = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '18px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button
              onClick={() => navigate(backPath)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 10 }}
            >
              <ArrowLeftOutlined /> Back to Spaces
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {tm.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{space.name}</h2>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
                  {space.requires_approval && (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                      Requires Approval
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace' }}>#{space.code}</span>
                  <span>· {tm.label}</span>
                  {space.floor && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <EnvironmentOutlined style={{ fontSize: 11 }} />
                      Floor {space.floor.floor_number} — {space.floor.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            {isAdmin && (
              <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                <EditOutlined /> Edit
              </button>
            )}
            {space.status === 'AVAILABLE' && (
              <button
                onClick={() => navigate(bookPath)}
                style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                <CalendarOutlined /> {isAuthenticated ? 'Book This Space' : 'Register to Book'}
              </button>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Monthly Rent', value: space.price_per_month ? `${currSym}${parseFloat(space.price_per_month).toLocaleString()}` : '—', sub: 'Per month',         color: '#2563eb', bg: '#eff6ff' },
            { label: 'Area',         value: `${parseFloat(space.area_sqm).toFixed(0)} m²`,                                                    sub: 'Square meters',    color: '#059669', bg: '#f0fdf4' },
            { label: 'Capacity',     value: space.capacity,                                                                                    sub: `${space.capacity === 1 ? 'person' : 'people'} max`, color: '#d97706', bg: '#fffbeb' },
            { label: 'Features',     value: availableFeatures.length,                                                                          sub: 'Available features',color: '#7c3aed', bg: '#f5f3ff' },
          ].map(k => (
            <div key={k.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>{k.label}</p>
              <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: k.color }}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={CARD}>
        <Tabs
          defaultActiveKey="overview"
          style={{ padding: '0 24px' }}
          items={[

            // ── Overview ──────────────────────────────────────────
            {
              key: 'overview',
              label: 'Overview',
              children: (
                <div style={{ paddingBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ borderRadius: 12, overflow: 'hidden', height: 220 }}>
                        <img
                          src={SPACE_IMAGES[space.type as SpaceType] ?? 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a2849fd28e-3c00d2788db35a7064dc.png'}
                          alt={space.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x220/1e293b/white?text=Office'; }}
                        />
                      </div>

                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>
                          Features & Amenities ({availableFeatures.length})
                        </div>
                        {availableFeatures.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No features listed.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {availableFeatures.map((f: SpaceFeature) => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                                <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 13, flexShrink: 0 }} />
                                <span>{f.feature_name}</span>
                                {f.quantity > 1 && <span style={{ color: '#94a3b8', fontSize: 11 }}>×{f.quantity}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Space Details</div>
                        {([
                          ['Code',     space.code],
                          ['Type',     tm.label],
                          ['Area',     `${parseFloat(space.area_sqm).toFixed(2)} m²`],
                          ['Capacity', `${space.capacity} people`],
                          ['Currency', space.currency],
                          ['Approval', space.requires_approval ? 'Required' : 'Not required'],
                          ['Floor',    space.floor ? `Floor ${space.floor.floor_number} — ${space.floor.name}` : 'N/A'],
                          ['Building', (space.floor as any)?.building?.name ?? 'N/A'],
                          ['Created',  new Date(space.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>{k}</span>
                            <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Pricing</div>
                        {([
                          ['Hourly Rate',  space.price_per_hour  ? `${currSym}${parseFloat(space.price_per_hour).toLocaleString()}`  : '—'],
                          ['Daily Rate',   space.price_per_day   ? `${currSym}${parseFloat(space.price_per_day).toLocaleString()}`   : '—'],
                          ['Monthly Rate', space.price_per_month ? `${currSym}${parseFloat(space.price_per_month).toLocaleString()}` : '—'],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>{k}</span>
                            <span style={{ fontWeight: 700, color: v === '—' ? '#94a3b8' : '#0f172a', fontSize: v === '—' ? 13 : 16 }}>{v}</span>
                          </div>
                        ))}

                        <div style={{ marginTop: 14 }}>
                          {space.status === 'AVAILABLE' ? (
                            <button
                              onClick={() => navigate(bookPath)}
                              style={{ width: '100%', padding: '12px', borderRadius: 9, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                            >
                              <CalendarOutlined style={{ marginRight: 6 }} />
                              {isAuthenticated ? 'Book This Space' : 'Register to Book'}
                            </button>
                          ) : (
                            <div style={{ padding: '10px 14px', background: sm.bg, borderRadius: 8, border: `1px solid ${sm.color}44`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <WarningOutlined style={{ color: sm.color }} />
                              <span style={{ fontWeight: 500, color: sm.color }}>Currently {sm.label} — not available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },

            // ── Features tab ──────────────────────────────────────
            {
              key: 'features',
              label: <Badge count={availableFeatures.length} size="small" color="#059669">Features</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {allFeatures.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                      <CheckCircleOutlined style={{ fontSize: 36, display: 'block', margin: '0 auto 12px', color: '#e5e7eb' }} />
                      <p style={{ margin: 0, fontSize: 14 }}>No features added yet.</p>
                    </div>
                  ) : (
                    Array.from(new Set(allFeatures.map(f => f.feature_type))).map(featureType => {
                      const items = allFeatures.filter(f => f.feature_type === featureType);
                      return (
                        <div key={featureType} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12, textTransform: 'capitalize' }}>
                            {featureType.replace(/_/g, ' ').toLowerCase()}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                            {items.map((f: SpaceFeature) => (
                              <div
                                key={f.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: f.is_available ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${f.is_available ? '#bbf7d0' : '#e5e7eb'}` }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {f.is_available
                                    ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13 }} />
                                    : <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
                                  }
                                  <span style={{ fontSize: 13, color: f.is_available ? '#0f172a' : '#94a3b8', fontWeight: 500 }}>
                                    {f.feature_name}
                                  </span>
                                </div>
                                {f.quantity > 1 && (
                                  <span style={{ fontSize: 11, background: '#e5e7eb', color: '#64748b', padding: '1px 6px', borderRadius: 10 }}>
                                    ×{f.quantity}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
