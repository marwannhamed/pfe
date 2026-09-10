import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, Skeleton, Badge, Empty } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, PlusOutlined,
  EnvironmentOutlined, TeamOutlined,
  ReloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Site, Space, SpaceStatus, SpaceType, Building, Floor } from '../../types';
import AddBuildingModal from './AddBuildingModal';
import AddFloorModal    from './AddFloorModal';
import { GoogleBusinessPanel } from '../../components/GoogleBusinessPanel';

// --- Helpers ------------------------------------------------------------------
const SPACE_STATUS_META: Record<SpaceStatus, { label: string; bg: string; color: string }> = {
  AVAILABLE:      { label: 'Available',      bg: '#dcfce7', color: '#15803d' },
  OCCUPIED:       { label: 'Occupied',       bg: '#dbeafe', color: '#1d4ed8' },
  RESERVED:       { label: 'Reserved',       bg: '#fef3c7', color: '#92400e' },
  MAINTENANCE:    { label: 'Maintenance',    bg: '#fee2e2', color: '#b91c1c' },
  OUT_OF_SERVICE: { label: 'Out of Service', bg: '#f1f5f9', color: '#475569' },
};

const SPACE_TYPE_LABEL: Record<SpaceType, string> = {
  DEDICATED_OFFICE: 'Dedicated Office',
  FLEXIBLE_DESK:    'Flexible Desk',
  HOT_DESK:         'Hot Desk',
  MEETING_ROOM:     'Meeting Room',
  CONFERENCE_ROOM:  'Conference Room',
  PHONE_BOOTH:      'Phone Booth',
  EVENT_SPACE:      'Event Space',
};

function formatPrice(space: Space): string {
  const sym = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';
  if (space.price_per_month) return `${sym}${parseFloat(space.price_per_month).toLocaleString()}/mo`;
  if (space.price_per_day)   return `${sym}${parseFloat(space.price_per_day).toLocaleString()}/day`;
  if (space.price_per_hour)  return `${sym}${parseFloat(space.price_per_hour).toLocaleString()}/hr`;
  return 'On request';
}

function getAllSpaces(site: Site): Space[] {
  const result: Space[] = [];
  site.buildings?.forEach((b: Building) => {
    b.floors?.forEach((f: Floor) => {
      f.spaces?.forEach((s: Space) => result.push(s));
    });
  });
  return result;
}

function loadChartJS(cb: (C: any) => void) {
  if ((window as any).Chart) { cb((window as any).Chart); return; }
  if (!document.getElementById('chartjs')) {
    const s = document.createElement('script');
    s.id  = 'chartjs';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
    s.onload = () => cb((window as any).Chart);
    document.head.appendChild(s);
  } else {
    const wait = () => (window as any).Chart ? cb((window as any).Chart) : setTimeout(wait, 80);
    wait();
  }
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// --- Page ---------------------------------------------------------------------
export default function SiteDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gmbReturn = searchParams.get('gmb');
  const { user } = useAuthStore();
  const isAdmin  = user?.role && ['SUPER_ADMIN', 'MANAGER'].includes(user.role);

  const chartRef  = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<any>(null);

  // -- Modal state --
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [addFloorFor,     setAddFloorFor]     = useState<{ id: string; name: string } | null>(null);

  // -- Fetch site --
  const { data: site, isLoading, isError, refetch } = useQuery({
    queryKey: ['site', id],
    queryFn:  () => siteApi.getOne(id!).then(r => r.data),
    enabled:  !!id,
  });

  // -- Fetch occupancy rate --
  const { data: occupancy } = useQuery({
    queryKey: ['site-occupancy', id],
    queryFn:  () => siteApi.getOccupancyRate(id!).then(r => r.data),
    enabled:  !!id,
  });

  // -- Draw doughnut chart --
  useEffect(() => {
    if (!site || !chartRef.current) return;
    const allSpaces = getAllSpaces(site);
    const counts = {
      Available:      allSpaces.filter(s => s.status === 'AVAILABLE').length,
      Occupied:       allSpaces.filter(s => s.status === 'OCCUPIED').length,
      Reserved:       allSpaces.filter(s => s.status === 'RESERVED').length,
      Maintenance:    allSpaces.filter(s => s.status === 'MAINTENANCE').length,
      'Out of Service': allSpaces.filter(s => s.status === 'OUT_OF_SERVICE').length,
    };
    loadChartJS(C => {
      chartInst.current?.destroy();
      chartInst.current = new C(chartRef.current!, {
        type: 'doughnut',
        data: {
          labels:   Object.keys(counts),
          datasets: [{
            data:            Object.values(counts),
            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8'],
            borderWidth:     0,
            hoverOffset:     6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8 },
          },
        },
      });
    });
    return () => { chartInst.current?.destroy(); };
  }, [site]);

  if (isLoading) return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 20 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );

  if (isError || !site) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <WarningOutlined style={{ fontSize: 40, color: '#d97706', display: 'block', margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load site</div>
      <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
        Retry
      </button>
    </div>
  );

  const allSpaces      = getAllSpaces(site);
  const availableCount = allSpaces.filter(s => s.status === 'AVAILABLE').length;
  const occupiedCount  = allSpaces.filter(s => s.status === 'OCCUPIED').length;
  const occRate        = allSpaces.length > 0 ? Math.round((occupiedCount / allSpaces.length) * 100) : 0;
  const occColor       = occRate >= 80 ? '#22c55e' : occRate >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ padding: 24, minHeight: '100%' }}>

      {/* -- Modals -- */}
      {showAddBuilding && (
        <AddBuildingModal
          siteId={site.id}
          siteName={site.name}
          onClose={() => setShowAddBuilding(false)}
        />
      )}
      {addFloorFor && (
        <AddFloorModal
          buildingId={addFloorFor.id}
          buildingName={addFloorFor.name}
          onClose={() => setAddFloorFor(null)}
        />
      )}

      {isAdmin && id && (
        <GoogleBusinessPanel siteId={id} oauthReturn={gmbReturn} />
      )}

      {/* -- Header -- */}
      <div style={{ ...CARD, padding: '18px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button
              onClick={() => navigate('/admin/sites')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 10 }}
            >
              <ArrowLeftOutlined /> Back to Branches
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                {site.code}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{site.name}</h2>
                  <span style={{ background: site.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: site.status === 'ACTIVE' ? '#15803d' : '#b91c1c', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                    {site.status}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <EnvironmentOutlined style={{ fontSize: 11 }} /> {site.city}, {site.country}
                  </span>
                  <span>?? {site.timezone}</span>
                  <span>?? {site.currency}</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            {isAdmin && (
              <>
                <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <EditOutlined /> Edit Branch
                </button>
                {/* ? WIRED UP */}
                <button
                  onClick={() => setShowAddBuilding(true)}
                  style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
                >
                  <PlusOutlined /> Add Building
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Occupancy Rate', value: `${occRate}%`,       sub: occupancy ? `${occupancy.occupied}/${occupancy.total} spaces` : `${occupiedCount}/${allSpaces.length}`, color: occColor, bg: '#f8fafc' },
            { label: 'Total Spaces',   value: allSpaces.length,    sub: `${site.buildings?.length ?? 0} buildings`, color: '#2563eb', bg: '#eff6ff' },
            { label: 'Available Now',  value: availableCount,      sub: 'Ready to book', color: '#059669', bg: '#f0fdf4' },
            { label: 'Site Manager',   value: site.manager ? `${site.manager.first_name} ${site.manager.last_name}` : 'Unassigned', sub: site.manager?.email ?? 'No manager assigned', color: '#7c3aed', bg: '#f5f3ff' },
          ].map(k => (
            <div key={k.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>{k.label}</p>
              <p style={{ margin: '0 0 2px', fontSize: typeof k.value === 'string' && k.value.length > 12 ? 13 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: k.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* -- Tabs -- */}
      <div style={CARD}>
        <Tabs
          defaultActiveKey="overview"
          style={{ padding: '0 24px' }}
          items={[

            // -- Overview ------------------------------------------
            {
              key: 'overview',
              label: 'Overview',
              children: (
                <div style={{ paddingBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

                    {/* Left: buildings */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                            Buildings ({site.buildings?.length ?? 0})
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => setShowAddBuilding(true)}
                              style={{ padding: '5px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              <PlusOutlined style={{ fontSize: 11 }} /> Add Building
                            </button>
                          )}
                        </div>

                        {!site.buildings?.length ? (
                          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>??</div>
                            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 500 }}>No buildings yet</p>
                            {isAdmin && (
                              <button
                                onClick={() => setShowAddBuilding(true)}
                                style={{ padding: '8px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Add First Building
                              </button>
                            )}
                          </div>
                        ) : site.buildings.map((b: Building) => {
                          const bSpaces   = b.floors?.flatMap((f: Floor) => f.spaces ?? []) ?? [];
                          const bAvail    = bSpaces.filter((s: Space) => s.status === 'AVAILABLE').length;
                          const bOcc      = bSpaces.filter((s: Space) => s.status === 'OCCUPIED').length;
                          const bOccRate  = bSpaces.length > 0 ? Math.round((bOcc / bSpaces.length) * 100) : 0;
                          const bOccColor = bOccRate >= 80 ? '#22c55e' : bOccRate >= 60 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={b.id} style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '14px', marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{b.name}</div>
                                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Code: {b.code} · {b.floors_count} floors · {parseFloat(b.total_area_sqm).toLocaleString()} m²
                                    {b.year_built && ` · Built ${b.year_built}`}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ background: b.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9', color: b.status === 'ACTIVE' ? '#15803d' : '#475569', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                                    {b.status}
                                  </span>
                                  {/* ? Add Floor button per building */}
                                  {isAdmin && (
                                    <button
                                      onClick={() => setAddFloorFor({ id: b.id, name: b.name })}
                                      style={{ padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#15803d', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <PlusOutlined style={{ fontSize: 10 }} /> Add Floor
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                                <span>?? {bSpaces.length} spaces</span>
                                <span style={{ color: '#15803d' }}>? {bAvail} available</span>
                                <span style={{ color: bOccColor }}>?? {bOccRate}% occupied</span>
                              </div>
                              {/* Floor pills */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {b.floors && b.floors.length > 0 ? b.floors.map((f: Floor) => (
                                  <span key={f.id} style={{ background: '#f1f5f9', color: '#374151', fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>
                                    Floor {f.floor_number} — {f.name} · {f.spaces?.length ?? 0} spaces
                                  </span>
                                )) : (
                                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                                    No floors yet — click "Add Floor" to get started
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Space type breakdown */}
                      {allSpaces.length > 0 && (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Space Types</div>
                          {(Object.entries(SPACE_TYPE_LABEL) as [SpaceType, string][]).map(([type, label]) => {
                            const count = allSpaces.filter(s => s.type === type).length;
                            if (!count) return null;
                            const pct = Math.round((count / allSpaces.length) * 100);
                            return (
                              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <span style={{ fontSize: 13, color: '#374151', minWidth: 150 }}>{label}</span>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', minWidth: 24, textAlign: 'right' }}>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: donut + site info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>Space Status</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{allSpaces.length} total spaces</div>
                        <div style={{ height: 160, position: 'relative', marginBottom: 14 }}>
                          <canvas ref={chartRef} />
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{occRate}%</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>Occupied</div>
                          </div>
                        </div>
                        {(Object.entries(SPACE_STATUS_META) as [SpaceStatus, any][]).map(([status, meta]) => {
                          const count = allSpaces.filter(s => s.status === status).length;
                          if (!count) return null;
                          return (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 13 }}>
                              <div style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, color: '#374151' }}>{meta.label}</span>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Site Information</div>
                        {[
                          ['Code',     site.code],
                          ['City',     site.city],
                          ['Country',  site.country],
                          ['Timezone', site.timezone],
                          ['Currency', site.currency],
                          ['Status',   site.status],
                          ['Created',  new Date(site.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>{k}</span>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },

            // -- All Spaces ----------------------------------------
            {
              key: 'spaces',
              label: <Badge count={allSpaces.length} size="small" color="#2563eb">All Spaces</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {allSpaces.length === 0 ? (
                    <Empty description="No spaces in this site yet" />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                      {allSpaces.map((space: Space) => {
                        const sm = SPACE_STATUS_META[space.status];
                        return (
                          <div
                            key={space.id}
                            style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                            onClick={() => navigate(`/admin/spaces/${space.id}`)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{space.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>#{space.code}</div>
                              </div>
                              <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, height: 'fit-content' }}>
                                {sm.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{SPACE_TYPE_LABEL[space.type]}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                              <span>?? {parseFloat(space.area_sqm).toFixed(0)} m²</span>
                              <span><TeamOutlined style={{ marginRight: 3, fontSize: 11 }} />{space.capacity}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{formatPrice(space)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },

            // -- Floor Plans ---------------------------------------
            {
              key: 'floors',
              label: 'Floor Plans',
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {!site.buildings?.length ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                      <Empty description="No buildings added yet" />
                      {isAdmin && (
                        <button
                          onClick={() => setShowAddBuilding(true)}
                          style={{ marginTop: 16, padding: '9px 20px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          <PlusOutlined style={{ marginRight: 6 }} />Add First Building
                        </button>
                      )}
                    </div>
                  ) : site.buildings.map((b: Building) => (
                    <div key={b.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>?? {b.name}</div>
                        {isAdmin && (
                          <button
                            onClick={() => setAddFloorFor({ id: b.id, name: b.name })}
                            style={{ padding: '6px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, color: '#15803d', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <PlusOutlined style={{ fontSize: 11 }} /> Add Floor
                          </button>
                        )}
                      </div>
                      {!b.floors?.length ? (
                        <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No floors yet.</p>
                      ) : b.floors.map((f: Floor) => (
                        <div key={f.id} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ background: '#1e293b', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 7 }}>
                              Floor {f.floor_number}
                            </span>
                            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{f.name}</span>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{parseFloat(f.area_sqm).toFixed(0)} m²</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{f.spaces?.length ?? 0} spaces</span>
                          </div>
                          {f.spaces && f.spaces.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
                              {f.spaces.map((space: Space) => {
                                const sm = SPACE_STATUS_META[space.status];
                                return (
                                  <div
                                    key={space.id}
                                    style={{ background: sm.bg, border: `1px solid ${sm.color}33`, borderRadius: 7, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    onClick={() => navigate(`/admin/spaces/${space.id}`)}
                                    title={`${space.name} — ${sm.label}`}
                                  >
                                    <div style={{ fontSize: 10, fontWeight: 700, color: sm.color }}>{space.code}</div>
                                    <div style={{ fontSize: 9, color: sm.color, marginTop: 1, opacity: 0.8 }}>{sm.label}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginLeft: 4 }}>No spaces on this floor yet.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}