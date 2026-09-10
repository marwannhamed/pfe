import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select } from 'antd';
import { message } from '../utils/feedback';
import { GoogleOutlined, LinkOutlined, SyncOutlined, DisconnectOutlined } from '@ant-design/icons';
import { siteApi } from '../api/services';
import { usePageTheme } from '../hooks/usePageTheme';

type GmbStatus = {
  oauthConfigured: boolean;
  connected: boolean;
  locationMapped: boolean;
  gmb_account_id: string | null;
  gmb_location_id: string | null;
};

interface Props {
  siteId: string;
  oauthReturn?: string | null;
}

export function GoogleBusinessPanel({ siteId, oauthReturn }: Props) {
  const { card: CARD, t: th } = usePageTheme();
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState('');

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['gmb-status', siteId],
    queryFn: () => siteApi.gmbStatus(siteId).then(r => r.data as GmbStatus),
  });

  const { data: locationsRaw, refetch: refetchLocations } = useQuery({
    queryKey: ['gmb-locations', siteId],
    queryFn: () =>
      siteApi.gmbLocations(siteId).then(r => r.data as { locations: { name: string; title?: string }[] }),
    enabled: !!status?.connected,
  });

  const locations = locationsRaw?.locations ?? [];

  useEffect(() => {
    if (status?.gmb_location_id) setLocationId(status.gmb_location_id);
  }, [status?.gmb_location_id]);

  useEffect(() => {
    if (oauthReturn === 'connected') {
      message.success('Google Business Profile connected. Select a location and sync.');
      void refetch();
      void refetchLocations();
    }
  }, [oauthReturn, refetch, refetchLocations]);

  const connectMut = useMutation({
    mutationFn: () => siteApi.gmbOAuthUrl(siteId).then(r => r.data as { url: string }),
    onSuccess: d => { if (d?.url) window.location.href = d.url; },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Could not start Google OAuth'),
  });

  const setLocationMut = useMutation({
    mutationFn: (gmb_location_id: string | null) => siteApi.gmbSetLocation(siteId, { gmb_location_id }),
    onSuccess: () => {
      message.success('Business Profile location saved');
      void qc.invalidateQueries({ queryKey: ['gmb-status', siteId] });
      void refetch();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to save location'),
  });

  const syncMut = useMutation({
    mutationFn: () => siteApi.gmbSync(siteId),
    onSuccess: () => message.success('Synced to Google Business Profile'),
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Sync failed'),
  });

  const disconnectMut = useMutation({
    mutationFn: () => siteApi.gmbDisconnect(siteId),
    onSuccess: () => {
      message.success('Disconnected from Google');
      setLocationId('');
      void qc.invalidateQueries({ queryKey: ['gmb-status', siteId] });
      void refetch();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Disconnect failed'),
  });

  if (isLoading) return null;
  const st = status;

  return (
    <div style={{ ...CARD, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <GoogleOutlined style={{ fontSize: 18, color: '#4285f4' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: th.text }}>Google Business Profile</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: th.textSub, maxWidth: 520 }}>
            Connect this branch to Google so hours, description, and availability sync to your public listing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!st?.connected ? (
            <button
              type="button"
              disabled={!st?.oauthConfigured || connectMut.isPending}
              onClick={() => connectMut.mutate()}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: st?.oauthConfigured ? '#2563eb' : '#94a3b8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: st?.oauthConfigured ? 'pointer' : 'not-allowed' }}
            >
              <LinkOutlined /> Connect Google
            </button>
          ) : (
            <>
              <button type="button" disabled={!st.locationMapped || syncMut.isPending} onClick={() => syncMut.mutate()} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: th.text }}>
                <SyncOutlined spin={syncMut.isPending} /> Sync now
              </button>
              <button type="button" disabled={disconnectMut.isPending} onClick={() => disconnectMut.mutate()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#b91c1c' }}>
                <DisconnectOutlined /> Disconnect
              </button>
            </>
          )}
        </div>
      </div>
      {!st?.oauthConfigured && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#d97706' }}>
          Set GOOGLE_GMB_CLIENT_ID and GOOGLE_GMB_CLIENT_SECRET in backend .env
        </p>
      )}
      {st?.connected && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: th.textSub }}>
            Status: <strong style={{ color: th.text }}>Connected</strong>
            {st.locationMapped ? ' · Location mapped' : ' · Pick a location'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select style={{ minWidth: 280, flex: 1 }} placeholder="Select Google Business location" value={locationId || undefined} onChange={v => setLocationId(v)} options={locations.map(l => ({ value: l.name, label: l.title || l.name }))} notFoundContent="No locations found" />
            <button type="button" disabled={!locationId || setLocationMut.isPending} onClick={() => setLocationMut.mutate(locationId)} style={{ padding: '8px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save location</button>
            <button type="button" onClick={() => refetchLocations()} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, fontSize: 12, cursor: 'pointer', color: th.textSub }}>Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}

