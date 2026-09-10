import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, Skeleton } from 'antd';
import { message } from '../../utils/feedback';
import {
  ReloadOutlined, SaveOutlined, InfoCircleOutlined,
  CalendarOutlined, CloseOutlined, LoadingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { floorApi, buildingApi, spaceApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import { api } from '../../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MapSpace {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  capacity: number;
  area_sqm: number;
  price_per_hour?: number;
  price_per_day?: number;
  price_per_month?: number;
  currency: string;
  requires_approval: boolean;
  floor_id: string;
  map_x?: number | null;
  map_y?: number | null;
  map_w?: number | null;
  map_h?: number | null;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  AVAILABLE:      { label: 'Available',      fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' },
  OCCUPIED:       { label: 'Occupied',       fill: '#dbeafe', stroke: '#2563eb', text: '#1d4ed8' },
  RESERVED:       { label: 'Reserved',       fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  MAINTENANCE:    { label: 'Maintenance',    fill: '#fee2e2', stroke: '#dc2626', text: '#b91c1c' },
  OUT_OF_SERVICE: { label: 'Out of Service', fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
} as const;

const TYPE_ICON: Record<string, string> = {
  DEDICATED_OFFICE: '🏢', FLEXIBLE_DESK: '🪑', HOT_DESK: '💻',
  MEETING_ROOM: '📋', CONFERENCE_ROOM: '🎯', PHONE_BOOTH: '📞', EVENT_SPACE: '🎪',
};

const CANVAS_W = 900;
const CANVAS_H = 580;

// ─── Book Panel ───────────────────────────────────────────────────────────────
function BookPanel({ space, tenantId, userId, onClose, onSuccess }: {
  space: MapSpace; tenantId: string; userId: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const qc    = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate,   setEndDate]   = useState('');
  const [endTime,   setEndTime]   = useState('10:00');
  const [attendees, setAttendees] = useState('1');

  const currSym = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';

  const calcPrice = () => {
    if (!startDate || !endDate) return 0;
    const diff = new Date(`${endDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime();
    if (diff <= 0) return 0;
    const hours = diff / 3600000;
    const days  = diff / 86400000;
    if (space.price_per_month && days >= 28) return Number(space.price_per_month) * (days / 30);
    if (space.price_per_day)  return Number(space.price_per_day) * Math.ceil(days);
    if (space.price_per_hour) return Number(space.price_per_hour) * hours;
    return 0;
  };

  const price = calcPrice();

  const mut = useMutation({
    mutationFn: (d: any) => bookingApi.create(d),
    onSuccess: () => {
      message.success('Booking created!');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['spaces'] });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const INPUT: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb',
    borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: 12 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 340, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#2563eb)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
              {TYPE_ICON[space.type]} {space.name}
            </div>
            <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>
              #{space.code} · Cap: {space.capacity} · {space.area_sqm}m²
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseOutlined style={{ fontSize: 11 }} />
          </button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {space.requires_approval && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 12px', fontSize: 11, color: '#92400e', display: 'flex', gap: 6 }}>
              <WarningOutlined /> Requires approval after booking
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>Start Date *</div>
              <input style={INPUT} type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>Start Time</div>
              <input style={INPUT} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>End Date *</div>
              <input style={INPUT} type="date" min={startDate || today} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>End Time</div>
              <input style={INPUT} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>Attendees (max {space.capacity})</div>
            <input style={{ ...INPUT, width: '50%' }} type="number" min="1" max={space.capacity} value={attendees} onChange={e => setAttendees(e.target.value)} />
          </div>

          {/* Pricing */}
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {space.price_per_hour  && <div>{currSym}{Number(space.price_per_hour).toLocaleString()}/hr</div>}
              {space.price_per_day   && <div>{currSym}{Number(space.price_per_day).toLocaleString()}/day</div>}
              {space.price_per_month && <div>{currSym}{Number(space.price_per_month).toLocaleString()}/mo</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: price > 0 ? '#15803d' : '#94a3b8' }}>
                {price > 0 ? `${currSym}${price.toFixed(2)}` : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>estimated total</div>
            </div>
          </div>

          <button
            disabled={!startDate || !endDate || mut.isPending}
            onClick={() => {
              if (!startDate || !endDate) { message.warning('Please select dates'); return; }
              mut.mutate({
                tenant_id:          tenantId,
                space_id:           space.id,
                created_by_user_id: userId,
                start_datetime:     new Date(`${startDate}T${startTime}`).toISOString(),
                end_datetime:       new Date(`${endDate}T${endTime}`).toISOString(),
                total_price:        price,
                attendee_count:     Number(attendees),
                currency:           space.currency,
              });
            }}
            style={{ width: '100%', padding: '11px', borderRadius: 8, background: (!startDate || !endDate || mut.isPending) ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {mut.isPending ? <><LoadingOutlined /> Booking...</> : <><CalendarOutlined /> Confirm Booking</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Space Tooltip ────────────────────────────────────────────────────────────
function SpaceTooltip({ space }: { space: MapSpace }) {
  const sc = STATUS[space.status as keyof typeof STATUS] ?? STATUS.AVAILABLE;
  const currSym = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{TYPE_ICON[space.type] ?? '🏢'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{space.name}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>#{space.code}</div>
        </div>
      </div>
      <span style={{ background: sc.fill, color: sc.text, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{sc.label}</span>
      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#374151' }}>
        <div>👥 {space.capacity} people</div>
        <div>📐 {Number(space.area_sqm).toFixed(0)}m²</div>
        {space.price_per_month && <div>💰 {currSym}{Number(space.price_per_month).toLocaleString()}/mo</div>}
        {space.price_per_day   && <div>💰 {currSym}{Number(space.price_per_day).toLocaleString()}/day</div>}
      </div>
      {space.status === 'AVAILABLE' && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>Click to book →</div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FloorMapPage() {
  const { card: CARD, headerCard, btnSecondary, t: th } = usePageTheme();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const isAdmin  = !!(user?.role && ['SUPER_ADMIN', 'MANAGER'].includes(user.role));
  const isTenant = !!(user?.role && ['TENANT_ADMIN', 'TENANT_EMPLOYEE'].includes(user.role));
  const tenantId = (user as any)?.tenant_id ?? '';
  const userId   = user?.id ?? '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [tooltip, setTooltip]   = useState<{ space: MapSpace; x: number; y: number } | null>(null);
  const [booking, setBooking]   = useState<MapSpace | null>(null);
  const [bookingDone, setBookingDone] = useState(false);

  // Admin drag state
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging]   = useState<{ id: string; offX: number; offY: number } | null>(null);
  const [unsaved, setUnsaved]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: buildingsRaw } = useQuery({ queryKey: ['buildings-map'], queryFn: () => buildingApi.getAll() });
  const { data: floorsRaw }    = useQuery({ queryKey: ['floors-map'],    queryFn: () => floorApi.getAll() });
  const { data: spacesRaw, isLoading: spacesLoading, refetch } = useQuery({
    queryKey: ['spaces-map', selectedFloorId],
    queryFn: () => spaceApi.getAll(selectedFloorId ? { floorId: selectedFloorId } : undefined).then(r => r.data),
    enabled: true,
  });

  const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : (buildingsRaw as any)?.data ?? [];
  const floors    = Array.isArray(floorsRaw)    ? floorsRaw    : (floorsRaw as any)?.data    ?? [];
  const spaces: MapSpace[] = Array.isArray(spacesRaw) ? spacesRaw : (spacesRaw as any)?.data ?? [];

  // Set default floor
  useEffect(() => {
    if (floors.length > 0 && !selectedFloorId) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors]);

  // Sync positions from DB
  useEffect(() => {
    const newPos: Record<string, { x: number; y: number }> = {};
    spaces.forEach(s => {
      if (s.map_x != null && s.map_y != null) {
        newPos[s.id] = { x: s.map_x, y: s.map_y };
      }
    });
    setPositions(newPos);
    setUnsaved(false);
  }, [spaces]);

  const placedSpaces   = spaces.filter(s => positions[s.id] != null);
  const unplacedSpaces = spaces.filter(s => positions[s.id] == null);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<SVGGElement>, spaceId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const pos = positions[spaceId] ?? { x: 50, y: 50 };
    setDragging({
      id: spaceId,
      offX: (e.clientX - rect.left) * scaleX - pos.x,
      offY: (e.clientY - rect.top)  * scaleY - pos.y,
    });
    setTooltip(null);
  }, [isAdmin, positions]);

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const space  = spaces.find(s => s.id === dragging.id);
    const w = space?.map_w ?? 120;
    const h = space?.map_h ?? 80;
    const newX = Math.max(0, Math.min(CANVAS_W - w, (e.clientX - rect.left) * scaleX - dragging.offX));
    const newY = Math.max(0, Math.min(CANVAS_H - h, (e.clientY - rect.top)  * scaleY - dragging.offY));
    setPositions(prev => ({ ...prev, [dragging.id]: { x: newX, y: newY } }));
    setUnsaved(true);
  }, [dragging, spaces]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Drop from sidebar
  const onDropFromSidebar = useCallback((e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const spaceId = e.dataTransfer.getData('spaceId');
    if (!spaceId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const space  = spaces.find(s => s.id === spaceId);
    const w = space?.map_w ?? 120;
    const h = space?.map_h ?? 80;
    const x = Math.max(0, Math.min(CANVAS_W - w, (e.clientX - rect.left) * scaleX - w / 2));
    const y = Math.max(0, Math.min(CANVAS_H - h, (e.clientY - rect.top)  * scaleY - h / 2));
    setPositions(prev => ({ ...prev, [spaceId]: { x, y } }));
    setUnsaved(true);
  }, [spaces]);

  // ── Save layout ────────────────────────────────────────────────────────────
  const saveLayout = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(positions).map(([id, pos]) =>
          api.patch(`/spaces/${id}/map-position`, { map_x: pos.x, map_y: pos.y })
        )
      );
      setUnsaved(false);
      message.success('Layout saved!');
      qc.invalidateQueries({ queryKey: ['spaces-map'] });
    } catch {
      message.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  // ── Floor options ──────────────────────────────────────────────────────────
  const floorOptions = buildings.flatMap((b: any) => {
    const bFloors = floors.filter((f: any) => f.building_id === b.id);
    return bFloors.map((f: any) => ({
      value: f.id,
      label: `${b.name} — Floor ${f.floor_number} (${f.name})`,
    }));
  });

  const selectedFloor = floors.find((f: any) => f.id === selectedFloorId);

  return (
    <PageShell>

      {/* ── Header ── */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>🗺️ Floor Map</h2>
            <p style={{ margin: 0, fontSize: 14, color: th.textSub }}>
              {isAdmin ? 'Drag & drop spaces to arrange the floor layout' : 'View real-time space availability and book'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => refetch()} style={{ ...btnSecondary, padding: '8px 12px', color: th.textSub }}>
              <ReloadOutlined />
            </button>
            {isAdmin && unsaved && (
              <button onClick={saveLayout} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: 8, background: saving ? '#93c5fd' : 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <><LoadingOutlined /> Saving...</> : <><SaveOutlined /> Save Layout</>}
              </button>
            )}
          </div>
        </div>

        {/* Floor selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>Floor:</span>
          <Select
            value={selectedFloorId || undefined}
            onChange={v => { setSelectedFloorId(v); setBooking(null); }}
            placeholder="Select a floor..."
            style={{ width: 320 }}
            options={floorOptions}
          />
          {selectedFloor && (
            <span style={{ fontSize: 12, color: th.textSub }}>
              {placedSpaces.length} placed · {unplacedSpaces.length} unplaced · {spaces.length} total spaces
            </span>
          )}
        </div>
      </div>

      {/* ── Booking success banner ── */}
      {bookingDone && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          ✅ <strong style={{ color: '#15803d' }}>Booking submitted!</strong>
          <button onClick={() => setBookingDone(false)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>

        {/* ── Sidebar (admin only: unplaced spaces) ── */}
        {isAdmin && (
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ ...CARD, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: th.text, marginBottom: 10 }}>
                📦 Unplaced Spaces ({unplacedSpaces.length})
              </div>
              {unplacedSpaces.length === 0 ? (
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
                  All spaces placed! ✅
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {unplacedSpaces.map(s => {
                    const sc = STATUS[s.status as keyof typeof STATUS] ?? STATUS.AVAILABLE;
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('spaceId', s.id)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: `1px dashed ${sc.stroke}`, background: sc.fill, cursor: 'grab', fontSize: 11 }}
                      >
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{TYPE_ICON[s.type]} {s.name}</div>
                        <div style={{ color: '#64748b', fontSize: 10 }}>#{s.code} · Cap: {s.capacity}</div>
                        <div style={{ fontSize: 10, color: sc.text, marginTop: 2 }}>{sc.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {isAdmin && (
                <div style={{ marginTop: 12, padding: '8px 10px', background: '#eff6ff', borderRadius: 8, fontSize: 10, color: '#1d4ed8' }}>
                  💡 Drag spaces from here onto the map
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Map Canvas ── */}
        <div style={{ flex: 1 }}>
          <div style={{ ...CARD, overflow: 'hidden', position: 'relative' }}>

            {/* Booking overlay */}
            {booking && (
              <BookPanel
                space={booking}
                tenantId={tenantId}
                userId={userId}
                onClose={() => setBooking(null)}
                onSuccess={() => { setBooking(null); setBookingDone(true); refetch(); }}
              />
            )}

            {spacesLoading ? (
              <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : !selectedFloorId ? (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 40 }}>🏢</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Select a floor to view the map</div>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                style={{ width: '100%', display: 'block', userSelect: 'none', background: '#fafafa', cursor: dragging ? 'grabbing' : 'default' }}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onDragOver={e => e.preventDefault()}
                onDrop={onDropFromSidebar}
              >
                {/* Grid pattern */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" opacity="0.5" />
                  </pattern>
                </defs>
                <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

                {/* Floor label */}
                <text x="20" y="30" fontSize="13" fontWeight="600" fill="#94a3b8" fontFamily="system-ui">
                  {selectedFloor?.name ?? 'Floor'} — Floor {selectedFloor?.floor_number}
                </text>

                {/* Empty state */}
                {placedSpaces.length === 0 && (
                  <g>
                    <text x={CANVAS_W / 2} y={CANVAS_H / 2 - 20} textAnchor="middle" fontSize="14" fill="#94a3b8" fontFamily="system-ui">
                      {isAdmin ? 'Drag spaces from the sidebar to place them on the map' : 'No spaces placed on this floor yet'}
                    </text>
                    <text x={CANVAS_W / 2} y={CANVAS_H / 2 + 10} textAnchor="middle" fontSize="12" fill="#cbd5e1" fontFamily="system-ui">
                      {unplacedSpaces.length > 0 ? `${unplacedSpaces.length} unplaced space${unplacedSpaces.length > 1 ? 's' : ''} in sidebar` : ''}
                    </text>
                  </g>
                )}

                {/* Placed spaces */}
                {placedSpaces.map(space => {
                  const pos  = positions[space.id] ?? { x: 0, y: 0 };
                  const w    = space.map_w ?? 120;
                  const h    = space.map_h ?? 80;
                  const sc   = STATUS[space.status as keyof typeof STATUS] ?? STATUS.AVAILABLE;
                  const isDraggingThis = dragging?.id === space.id;
                  const currSym = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';
                  const canBook = space.status === 'AVAILABLE' && isTenant;

                  return (
                    <g
                      key={space.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: isAdmin ? 'grab' : canBook ? 'pointer' : 'default' }}
                      onMouseDown={e => isAdmin && onMouseDown(e, space.id)}
                      onMouseEnter={e => {
                        if (dragging) return;
                        const svg = svgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        const scaleX = CANVAS_W / rect.width;
                        const scaleY = CANVAS_H / rect.height;
                        setTooltip({ space, x: pos.x / scaleX + rect.left + w / scaleX / 2, y: pos.y / scaleY + rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (isAdmin || dragging) return;
                        if (canBook) setBooking(space);
                      }}
                    >
                      {/* Shadow */}
                      <rect x="2" y="2" width={w} height={h} rx="8" fill="rgba(0,0,0,0.06)" />
                      {/* Main rect */}
                      <rect
                        width={w} height={h} rx="8"
                        fill={sc.fill}
                        stroke={isDraggingThis ? '#2563eb' : sc.stroke}
                        strokeWidth={isDraggingThis ? 2 : 1}
                        opacity={isDraggingThis ? 0.85 : 1}
                      />

                      {/* Status bar at top */}
                      <rect width={w} height={4} rx="2" fill={sc.stroke} opacity="0.7" />

                      {/* Icon */}
                      <text x={10} y={22} fontSize="14" fontFamily="system-ui">{TYPE_ICON[space.type] ?? '🏢'}</text>

                      {/* Space name */}
                      <text x={w / 2} y={30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="system-ui">
                        {space.name.length > 14 ? space.name.slice(0, 13) + '…' : space.name}
                      </text>

                      {/* Code */}
                      <text x={w / 2} y={44} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">
                        #{space.code}
                      </text>

                      {/* Capacity */}
                      <text x={10} y={h - 10} fontSize="9" fill="#374151" fontFamily="system-ui">
                        👥 {space.capacity}
                      </text>

                      {/* Price */}
                      {(space.price_per_month || space.price_per_day) && (
                        <text x={w - 8} y={h - 10} textAnchor="end" fontSize="9" fill={sc.text} fontWeight="600" fontFamily="system-ui">
                          {currSym}{space.price_per_month
                            ? `${Math.round(Number(space.price_per_month)).toLocaleString()}/mo`
                            : `${Math.round(Number(space.price_per_day)).toLocaleString()}/d`
                          }
                        </text>
                      )}

                      {/* Book hint for tenant */}
                      {canBook && !isAdmin && (
                        <text x={w / 2} y={h - 10} textAnchor="middle" fontSize="9" fill="#2563eb" fontWeight="700" fontFamily="system-ui">
                          Tap to book
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Tooltip */}
            {tooltip && !booking && (
              <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%,-100%)', zIndex: 200, pointerEvents: 'none' }}>
                <SpaceTooltip space={tooltip.space} />
              </div>
            )}
          </div>

          {/* ── Legend ── */}
          <div style={{ ...CARD, padding: '12px 16px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: th.text }}>Legend:</span>
            {Object.entries(STATUS).map(([key, sc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: sc.fill, border: `1.5px solid ${sc.stroke}` }} />
                <span style={{ color: th.textSub }}>{sc.label}</span>
              </div>
            ))}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px dashed #94a3b8', background: '#f8fafc' }} />
                <span style={{ color: '#374151' }}>Unplaced (sidebar)</span>
              </div>
            )}
            {isTenant && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                💡 Click green spaces to book
              </span>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}