import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import SpaceAddonPicker, { type SelectedAddon } from '../../components/spaces/SpaceAddonPicker';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Select, Button, Empty, Tag, Alert, Skeleton, Result, Input, InputNumber } from 'antd';
import { GlobalOutlined, ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { getPendingBookingSpace, clearPendingBookingSpace } from '../../utils/pendingBookingSpace';
import { usePageTheme } from '../../hooks/usePageTheme';
import { PUBLIC_MAP_PATH } from '../../constants/routes';
import { isClientOperatorRole } from '../../utils/propertyScope';
import { DOHA_CENTER, QATAR_ZONES, currencySymbol } from '../../constants/qatar';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type AddonSvc = {
  id: string;
  name: string;
  description?: string;
  price: number;
  billing_cycle: string;
  category?: string;
};

type MapSpace = {
  id: string;
  name: string;
  type: string;
  status: string;
  capacity?: number;
  area_sqm?: number;
  description?: string;
  currency?: string;
  price_per_month?: number;
  monthly_rate?: number;
  photos?: string[];
  virtual_tour_url?: string;
  map_lat: number;
  map_lng: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  transportation_notes?: string;
  features?: { name: string; description?: string }[];
  available_addons?: AddonSvc[];
};

function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: T[] })?.data)) return (raw as { data: T[] }).data;
  return [];
}

function formatPrice(s: MapSpace) {
  const amt = s.price_per_month ?? s.monthly_rate ?? 0;
  const sym = currencySymbol(s.currency ?? 'QAR');
  return `${sym}${Number(amt).toLocaleString()}/mo`;
}

export default function GuestMapPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const embedded = pathname.startsWith('/portal/') || pathname.startsWith('/admin/');
  const { t: th, btnPrimary, btnSecondary } = usePageTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<MapSpace | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [mediaTab, setMediaTab] = useState<'photo' | 'tour'>('photo');
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const { isAuthenticated, user } = useAuthStore();
  const isPublicGuestMap = pathname === PUBLIC_MAP_PATH;
  const isClientPortfolioMap =
    embedded && isClientOperatorRole(user?.role);

  const { data: spacesRaw = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['map-spaces', isClientPortfolioMap ? user?.tenant_id : 'public'],
    queryFn: async () => {
      if (isClientPortfolioMap) {
        const list = await spaceApi.getAll();
        return list.filter(
          (s) => s.is_published && s.map_lat != null && s.map_lng != null,
        );
      }
      return spaceApi.getPublishedMap();
    },
    retry: 1,
    retryDelay: 1500,
    staleTime: 60_000,
  });

  const spaces = useMemo(() => {
    const list = toArray<MapSpace>(spacesRaw).filter((s) => s.map_lat != null && s.map_lng != null);
    return list.filter((s) => {
      if (typeFilter && s.type !== typeFilter) return false;
      if (cityFilter && (s.city ?? '').toLowerCase() !== cityFilter.toLowerCase()) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const hay = `${s.name} ${s.city ?? ''} ${s.address ?? ''} ${s.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const price = Number(s.price_per_month ?? s.monthly_rate ?? 0);
      if (minPrice && price < Number(minPrice)) return false;
      if (minCapacity && (s.capacity ?? 0) < Number(minCapacity)) return false;
      return true;
    });
  }, [spacesRaw, typeFilter, cityFilter, searchQ, minPrice, minCapacity]);

  const allSpaces = useMemo(
    () => toArray<MapSpace>(spacesRaw).filter((s) => s.map_lat != null && s.map_lng != null),
    [spacesRaw],
  );

  const cities = useMemo(() => {
    const fromSpaces = [...new Set(allSpaces.map((s) => s.city).filter(Boolean))] as string[];
    const merged = [...new Set([...QATAR_ZONES, ...fromSpaces])];
    return merged.sort();
  }, [allSpaces]);

  const center = useMemo<[number, number]>(() => {
    if (spaces.length === 0) return [DOHA_CENTER.lat, DOHA_CENTER.lng];
    const lat = spaces.reduce((a, s) => a + Number(s.map_lat), 0) / spaces.length;
    const lng = spaces.reduce((a, s) => a + Number(s.map_lng), 0) / spaces.length;
    return [lat, lng];
  }, [spaces]);

  const types = useMemo(() => [...new Set(allSpaces.map((s) => s.type))].sort(), [allSpaces]);

  useEffect(() => {
    const spaceId = searchParams.get('space_id') ?? getPendingBookingSpace();
    const shouldApply = searchParams.get('apply') === '1';
    if (!spaceId) return;
    if (shouldApply) {
      clearPendingBookingSpace();
      setSearchParams({}, { replace: true });
      navigate(`/apply/${spaceId}`);
      return;
    }
    if (spaces.length === 0) return;
    const found = spaces.find((s) => s.id === spaceId);
    if (found) setSelected(found);
  }, [spaces, searchParams, navigate, setSearchParams]);

  useEffect(() => {
    setMediaTab('photo');
    setSelectedAddons([]);
  }, [selected?.id]);

  const goApply = (space: MapSpace) =>
    navigate(`/apply/${space.id}`, {
      state: selectedAddons.length ? { addons: selectedAddons } : undefined,
    });

  const pageHeight = embedded ? 'calc(100vh - 56px)' : 'calc(100vh - 66px)';

  const toolbar = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: embedded ? '12px 16px' : '10px 20px',
      background: th.cardBg, borderBottom: `1px solid ${th.cardBorder}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <EnvironmentOutlined style={{ color: '#fff', fontSize: 17 }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: th.text, lineHeight: 1.2 }}>
            {embedded ? 'Space Map' : 'Find your office'}
          </div>
          <div style={{ fontSize: 12, color: th.textMuted }}>
            {embedded ? 'Browse published spaces on the map' : 'Explore available office spaces near you'}
          </div>
        </div>
        {!isLoading && !isError && (
          <Tag color="blue" style={{ marginLeft: 4 }}>{spaces.length} spaces</Tag>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="Search name or address"
          style={{ width: 180 }}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Zone / District"
          style={{ width: 160 }}
          value={cityFilter || undefined}
          onChange={(v) => setCityFilter(v ?? '')}
          options={cities.map((c) => ({ value: c, label: c }))}
        />
        <Select
          allowClear
          placeholder="Filter by type"
          style={{ width: 160 }}
          value={typeFilter || undefined}
          onChange={(v) => setTypeFilter(v ?? '')}
          options={types.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
        />
        <InputNumber
          placeholder="Min QAR/mo"
          min={0}
          style={{ width: 110 }}
          value={minPrice ? Number(minPrice) : undefined}
          onChange={(v) => setMinPrice(v != null ? String(v) : '')}
        />
        <InputNumber
          placeholder="Min people"
          min={1}
          style={{ width: 110 }}
          value={minCapacity ? Number(minCapacity) : undefined}
          onChange={(v) => setMinCapacity(v != null ? String(v) : '')}
        />
        <button
          type="button"
          onClick={() => refetch()}
          style={{ ...btnSecondary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          disabled={isFetching}
        >
          <ReloadOutlined spin={isFetching} /> Refresh
        </button>
      </div>
    </div>
  );

  const mapArea = () => {
    if (isLoading) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Skeleton active paragraph={{ rows: 8 }} style={{ width: '100%', maxWidth: 900 }} />
        </div>
      );
    }
    if (isError) {
      const msg = (error as { message?: string })?.message ?? 'Could not load spaces';
      const isNetwork = msg.includes('Network') || msg.includes('ECONNREFUSED');
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Result
            status="warning"
            title="Map unavailable"
            subTitle={isNetwork
              ? 'The server is not responding. Make sure the backend is running, then try again.'
              : msg}
            extra={
              <button type="button" onClick={() => refetch()} style={btnPrimary}>
                <ReloadOutlined /> Retry
              </button>
            }
          />
        </div>
      );
    }
    if (spaces.length === 0) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ maxWidth: 360 }}>
                <div style={{ fontWeight: 600, color: th.text, marginBottom: 6 }}>No spaces on the map yet</div>
                <div style={{ fontSize: 13, color: th.textMuted }}>
                  {embedded
                    ? 'Publish spaces with latitude & longitude in the Spaces section to show them here.'
                    : 'Check back soon — new office spaces are added regularly.'}
                </div>
              </div>
            }
          >
            {embedded && (
              <Button type="primary" onClick={() => navigate('/admin/spaces')}>
                Manage spaces
              </Button>
            )}
          </Empty>
        </div>
      );
    }
    return (
      <MapContainer key={`${center[0]}-${center[1]}-${spaces.length}`} center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {spaces.map((s) => (
          <Marker
            key={s.id}
            position={[Number(s.map_lat), Number(s.map_lng)]}
            eventHandlers={{ click: () => setSelected(s) }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <strong>{s.name}</strong>
              <div style={{ fontSize: 11 }}>{formatPrice(s)}</div>
            </Tooltip>
            <Popup>
              <strong>{s.name}</strong>
              <div>{formatPrice(s)}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  };

  return (
    <div style={{
      height: pageHeight,
      display: 'flex',
      flexDirection: 'column',
      background: th.pageBg,
    }}>
      {toolbar}

      {!isAuthenticated && !embedded && (
        <Alert
          type="info"
          showIcon
          banner
          title="Browse as a guest — click a pin, then Apply. No account required."
          style={{ flexShrink: 0 }}
        />
      )}
      {isAuthenticated && embedded && (
        <Alert
          type="info"
          showIcon
          banner
          title={
            isClientPortfolioMap
              ? 'Your published spaces on the map — only listings from your portfolio.'
              : 'Click a pin to view space details and start a booking application.'
          }
          style={{ flexShrink: 0 }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {mapArea()}
        </div>

        {selected && (
          <aside style={{
            width: 380, background: th.cardBg,
            borderLeft: `1px solid ${th.cardBorder}`,
            overflowY: 'auto', padding: 20,
            boxShadow: embedded ? '-4px 0 24px rgba(0,0,0,0.06)' : undefined,
          }}>
            {selected.virtual_tour_url && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setMediaTab('photo')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: mediaTab === 'photo' ? '#2563eb' : th.tableHead,
                    color: mediaTab === 'photo' ? '#fff' : th.textMuted,
                  }}
                >
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => setMediaTab('tour')}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: mediaTab === 'tour' ? '#2563eb' : th.tableHead,
                    color: mediaTab === 'tour' ? '#fff' : th.textMuted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  <GlobalOutlined /> 3D Tour
                </button>
              </div>
            )}

            {mediaTab === 'tour' && selected.virtual_tour_url ? (
              <iframe
                title="3D tour"
                src={selected.virtual_tour_url}
                style={{ width: '100%', height: 200, border: 'none', borderRadius: 12, marginBottom: 14, background: '#0f172a' }}
                allow="fullscreen; xr-spatial-tracking"
              />
            ) : selected.photos?.[0] ? (
              <img src={selected.photos[0]} alt={selected.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
            ) : (
              <div style={{
                height: 160, background: th.tableHead, borderRadius: 12, marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: th.textMuted, fontSize: 13,
              }}>
                No photo yet
              </div>
            )}

            {mediaTab === 'photo' && selected.photos && selected.photos.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
                {selected.photos.slice(1, 5).map((url) => (
                  <img key={url} src={url} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ))}
              </div>
            )}

            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: th.text }}>{selected.name}</h2>
            <div style={{ fontSize: 13, color: th.textSub, marginBottom: 8 }}>
              {(selected.type ?? 'SPACE').replace(/_/g, ' ')} · {selected.capacity ?? '—'} people
              {selected.area_sqm != null && <> · {selected.area_sqm} m²</>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', marginBottom: 14 }}>{formatPrice(selected)}</div>

            {selected.description && (
              <p style={{ fontSize: 13, color: th.textSub, lineHeight: 1.55, marginBottom: 12 }}>{selected.description}</p>
            )}

            {(selected.address || selected.city) && (
              <p style={{ fontSize: 13, color: th.textSub, marginBottom: 12 }}>
                {[selected.address, selected.city, selected.state, selected.country].filter(Boolean).join(', ')}
              </p>
            )}

            {selected.transportation_notes && (
              <p style={{ fontSize: 12, color: th.textMuted, marginBottom: 12, padding: '8px 10px', background: th.tableHead, borderRadius: 8 }}>
                🚇 {selected.transportation_notes}
              </p>
            )}

            {selected.features && selected.features.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Features</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selected.features.map((f) => (
                    <span key={f.name} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: th.tableHead, color: th.text, fontWeight: 500 }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.available_addons && selected.available_addons.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Optional add-ons
                </div>
                <p style={{ fontSize: 11, color: th.textMuted, margin: '0 0 10px' }}>
                  Tick only what you need — you can also change this in the application form.
                </p>
                <SpaceAddonPicker
                  catalog={selected.available_addons}
                  allowedIds={selected.available_addons.map((a) => a.id)}
                  value={selectedAddons}
                  onChange={setSelectedAddons}
                  compact
                  currency={selected.currency ?? 'QAR'}
                />
              </div>
            )}

            <Button type="primary" block size="large" onClick={() => goApply(selected)}>
              {isAuthenticated ? 'Book this space' : 'Apply for this space'}
            </Button>
            <Button block style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Close</Button>
          </aside>
        )}
      </div>
    </div>
  );
}
