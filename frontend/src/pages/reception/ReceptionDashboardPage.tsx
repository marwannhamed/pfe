import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Empty, Skeleton } from 'antd';
import {
  PhoneOutlined, EnvironmentOutlined, FileTextOutlined,
  ReloadOutlined, CalendarOutlined, UserOutlined,
} from '@ant-design/icons';
import { bookingApi } from '../../api/services';
import { message } from '../../utils/feedback';
import { useAuthStore } from '../../store/authStore';
import { useAuthReady } from '../../hooks/useAuthReady';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import RoleDashboardHero from '../../components/RoleDashboardHero';

type QueueBooking = {
  id: string;
  booking_number: string;
  status: string;
  start_time: string;
  user?: { first_name?: string; last_name?: string; email?: string; phone_number?: string };
  tenant?: { name?: string; contact_email?: string };
  space?: { name?: string };
};

type TabKey = 'call' | 'visit' | 'docs';

function phoneDisplay(b: QueueBooking) {
  return b.user?.phone_number ?? '—';
}

function tenantName(b: QueueBooking) {
  const u = b.user;
  const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ');
  return name || b.tenant?.name || u?.email || 'Tenant';
}

function initials(b: QueueBooking) {
  return tenantName(b)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TN';
}

function BookingCard({
  booking,
  actions,
}: {
  booking: QueueBooking;
  actions?: ReactNode;
}) {
  const { card, t: th } = usePageTheme();
  const navigate = useNavigate();

  return (
    <div
      style={{
        ...card,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = card.boxShadow as string; }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, color: '#fff',
        }}>
          {initials(booking)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 2 }}>
            {booking.space?.name ?? 'Space'}
          </div>
          <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 8 }}>
            {booking.booking_number} · {tenantName(booking)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: '#dbeafe', color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <PhoneOutlined /> {phoneDisplay(booking)}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: th.tableHead, color: th.textSub, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <CalendarOutlined /> {new Date(booking.start_time).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {actions}
        <button
          type="button"
          onClick={() => navigate(`/admin/bookings/${booking.id}`)}
          style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`,
            background: th.cardBg, color: th.text, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: 'call',  label: 'To Call',                  icon: <PhoneOutlined /> },
  { key: 'visit', label: 'Awaiting Visit',           icon: <EnvironmentOutlined /> },
  { key: 'docs',  label: 'Awaiting Manager Upload',  icon: <FileTextOutlined /> },
];

export default function ReceptionDashboardPage() {
  const { card, btnPrimary, btnSecondary, t: th } = usePageTheme();
  const { user } = useAuthStore();
  const authReady = useAuthReady();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('call');

  const { data: queues, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['booking-workflow-queues'],
    queryFn: () => bookingApi.getWorkflowQueues().then((r) => (r as { data?: unknown })?.data ?? r),
    enabled: authReady,
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => bookingApi.confirmPhone(id),
    onSuccess: () => { message.success('Tenant confirmed — visit email sent'); qc.invalidateQueries({ queryKey: ['booking-workflow-queues'] }); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const unreachableMut = useMutation({
    mutationFn: (id: string) => bookingApi.phoneUnreachable(id, 'Could not reach tenant'),
    onSuccess: () => { message.success('Booking cancelled — space released'); qc.invalidateQueries({ queryKey: ['booking-workflow-queues'] }); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const visitDoneMut = useMutation({
    mutationFn: (id: string) => bookingApi.markDocumentsPending(id),
    onSuccess: () => { message.success('Moved to documents pending'); qc.invalidateQueries({ queryKey: ['booking-workflow-queues'] }); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const toCall = (queues as { toCall?: QueueBooking[] })?.toCall ?? [];
  const awaitingVisit = (queues as { awaitingVisit?: QueueBooking[] })?.awaitingVisit ?? [];
  const documentsPending = (queues as { documentsPending?: QueueBooking[] })?.documentsPending ?? [];

  const counts: Record<TabKey, number> = {
    call: toCall.length,
    visit: awaitingVisit.length,
    docs: documentsPending.length,
  };

  const emptyMessages: Record<TabKey, string> = {
    call: 'No bookings awaiting phone confirmation',
    visit: 'No visits scheduled',
    docs: 'No bookings awaiting document upload',
  };

  const renderList = () => {
    if (activeTab === 'call') {
      return toCall.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          actions={
            <>
              <button
                type="button"
                disabled={confirmMut.isPending}
                onClick={() => confirmMut.mutate(b.id)}
                style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}
              >
                Tenant Confirmed
              </button>
              <button
                type="button"
                disabled={unreachableMut.isPending}
                onClick={() => unreachableMut.mutate(b.id)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid #fecaca',
                  background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                Unreachable / Cancel
              </button>
            </>
          }
        />
      ));
    }
    if (activeTab === 'visit') {
      return awaitingVisit.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          actions={
            <button
              type="button"
              disabled={visitDoneMut.isPending}
              onClick={() => visitDoneMut.mutate(b.id)}
              style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <EnvironmentOutlined /> Visit complete
            </button>
          }
        />
      ));
    }
    return documentsPending.map((b) => (
      <BookingCard
        key={b.id}
        booking={b}
        actions={
          <button
            type="button"
            onClick={() => navigate(`/admin/bookings/${b.id}`)}
            style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12 }}
          >
            View booking
          </button>
        }
      />
    ));
  };

  return (
    <PageShell>
      <PageHeader
        title="Reception Dashboard"
        subtitle={`Welcome, ${user?.first_name ?? 'Reception'} · Phone calls, visits & document hand-off`}
        stats={[
          { label: 'To Call', value: counts.call, color: counts.call > 0 ? '#2563eb' : th.text, icon: <PhoneOutlined style={{ color: '#2563eb' }} /> },
          { label: 'Awaiting Visit', value: counts.visit, color: counts.visit > 0 ? '#d97706' : th.text, icon: <EnvironmentOutlined style={{ color: '#d97706' }} /> },
          { label: 'Awaiting Upload', value: counts.docs, color: counts.docs > 0 ? '#7c3aed' : th.text, icon: <FileTextOutlined style={{ color: '#7c3aed' }} /> },
          { label: 'Total in Queue', value: counts.call + counts.visit + counts.docs, icon: <UserOutlined style={{ color: th.textMuted }} /> },
        ]}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            style={{ ...btnSecondary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ReloadOutlined spin={isFetching} /> Refresh
          </button>
        }
      />

      <RoleDashboardHero role={user?.role} userName={user?.first_name} />

      {/* Tab pills — same pattern as Floors view toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: `1px solid ${active ? '#2563eb' : th.cardBorder}`,
                background: active ? (th.cardBg === '#fff' ? '#eff6ff' : 'rgba(37,99,235,0.15)') : th.cardBg,
                color: active ? '#2563eb' : th.textSub,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: active ? '0 2px 8px rgba(37,99,235,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                background: active ? '#2563eb' : th.tableHead,
                color: active ? '#fff' : th.textMuted,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ ...card, padding: 24 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : counts[activeTab] === 0 ? (
        <div style={{ ...card, padding: '64px 24px', textAlign: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: th.textMuted, fontSize: 14 }}>{emptyMessages[activeTab]}</span>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderList()}
        </div>
      )}
    </PageShell>
  );
}
