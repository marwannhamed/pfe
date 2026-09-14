import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Tag, Input, Modal, Empty, Select, Avatar, Badge } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { message, modal } from '../../utils/feedback';
import { bookingApplicationApi } from '../../api/services';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { asApiError } from '../../utils/errors';

const EMPTY_LIST: readonly unknown[] = [];

function toArray<T>(raw: unknown): T[] {
  if (!raw) return EMPTY_LIST as unknown as T[];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: T[] })?.data)) return (raw as { data: T[] }).data;
  return EMPTY_LIST as unknown as T[];
}

type Row = {
  id: string;
  status: string;
  start_date: string;
  duration_months: number;
  headcount: number;
  intended_use: string;
  message?: string;
  created_at: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  applicant_type?: string;
  company_name?: string;
  space?: { name: string; type?: string; city?: string };
  user?: { first_name?: string; last_name?: string; email: string; tenant?: { name: string } };
  addOns?: { quantity: number; unit_price: number; addonService?: { name: string } }[];
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'gold',
  ACCEPTED: 'green',
  REFUSED: 'red',
};

function applicantName(r: Row) {
  if (r.applicant_type === 'COMPANY' && r.company_name) return r.company_name;
  return r.guest_name || [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') || '—';
}

function ApplicationCard({
  row,
  th,
  isDark,
  onAccept,
  onRefuse,
  acceptLoading,
}: {
  row: Row;
  th: ReturnType<typeof usePageTheme>['t'];
  isDark: boolean;
  onAccept: () => void;
  onRefuse: () => void;
  acceptLoading: boolean;
}) {
  const isGuest = !!row.guest_email && !row.user;
  const initials = applicantName(row)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${th.cardBorder}`,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
          <Avatar size={48} style={{ background: isGuest ? '#dbeafe' : '#ede9fe', color: isGuest ? '#2563eb' : '#7c3aed', fontWeight: 700, flexShrink: 0 }}>
            {initials || <UserOutlined />}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: th.text }}>{applicantName(row)}</span>
              {isGuest && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>Guest</Tag>}
              <Tag color={STATUS_COLORS[row.status] ?? 'default'} style={{ margin: 0 }}>{row.status}</Tag>
            </div>
            <div style={{ fontSize: 12, color: th.textMuted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MailOutlined /> {row.guest_email || row.user?.email}
            </div>
            {row.guest_phone && (
              <div style={{ fontSize: 12, color: th.textSub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <PhoneOutlined /> {row.guest_phone}
              </div>
            )}
            {row.user?.tenant?.name && (
              <div style={{ fontSize: 12, color: th.textSub, marginTop: 2 }}>{row.user.tenant.name}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: th.textMuted, whiteSpace: 'nowrap' }}>
          {new Date(row.created_at).toLocaleDateString()}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          padding: '14px 16px',
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          borderRadius: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            <EnvironmentOutlined /> Space
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.space?.name ?? '—'}</div>
          {row.space?.city && <div style={{ fontSize: 11, color: th.textSub }}>{row.space.city}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            <CalendarOutlined /> Start
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{new Date(row.start_date).toLocaleDateString()}</div>
          <div style={{ fontSize: 11, color: th.textSub }}>{row.duration_months} months</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            <TeamOutlined /> Team
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.headcount} people</div>
          <div style={{ fontSize: 11, color: th.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.intended_use}</div>
        </div>
      </div>

      {row.message && (
        <div style={{ fontSize: 13, color: th.textSub, fontStyle: 'italic', padding: '10px 14px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fffbeb', borderRadius: 8, border: `1px solid ${isDark ? th.cardBorder : '#fde68a'}` }}>
          "{row.message}"
        </div>
      )}

      {row.addOns && row.addOns.length > 0 && (
        <div style={{ fontSize: 12, color: th.textSub }}>
          <span style={{ fontWeight: 700, color: th.textMuted }}>Add-ons: </span>
          {row.addOns.map((a, i) => (
            <span key={i}>
              {a.addonService?.name ?? 'Service'} ×{a.quantity}
              {i < row.addOns!.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      {row.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={acceptLoading}
            onClick={onAccept}
            style={{ flex: 1, height: 40, borderRadius: 8, fontWeight: 600 }}
          >
            Accept & create booking
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={onRefuse}
            style={{ height: 40, borderRadius: 8, fontWeight: 600 }}
          >
            Refuse
          </Button>
        </div>
      )}
    </div>
  );
}

export default function BookingApplicationsPage() {
  const { card: CARD, headerCard, t: th, isDark } = usePageTheme();
  const qc = useQueryClient();
  const [statusFilt, setStatusFilt] = useState('PENDING');
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState('');

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['booking-applications', statusFilt],
    queryFn: () =>
      bookingApplicationApi.getAll(statusFilt ? { status: statusFilt } : undefined).then((r) => toArray<Row>(r)),
  });

  const pendingCount = rows.filter((r) => r.status === 'PENDING').length;

  const acceptMut = useMutation({
    mutationFn: (id: string) => bookingApplicationApi.accept(id),
    onSuccess: () => {
      message.success('Application accepted — booking created and space reserved');
      qc.invalidateQueries({ queryKey: ['booking-applications'] });
      qc.invalidateQueries({ queryKey: ['public-map-spaces'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(asApiError(e).response?.data?.message ?? 'Failed'),
  });

  const refuseMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      bookingApplicationApi.refuse(id, { reason }),
    onSuccess: () => {
      message.success('Application refused — applicant notified');
      setRefuseId(null);
      setRefuseReason('');
      qc.invalidateQueries({ queryKey: ['booking-applications'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(asApiError(e).response?.data?.message ?? 'Failed'),
  });

  return (
    <PageShell maxWidth={1100}>
      <div style={headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Booking Applications</h2>
              {statusFilt === 'PENDING' && pendingCount > 0 && (
                <Badge count={pendingCount} style={{ background: '#f59e0b' }} />
              )}
            </div>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14, maxWidth: 520 }}>
              Review applications from the public map. Accepting starts the phone confirmation workflow and reserves the space on the map.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              value={statusFilt}
              onChange={setStatusFilt}
              style={{ width: 140 }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'ACCEPTED', label: 'Accepted' },
                { value: 'REFUSED', label: 'Refused' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ ...CARD, padding: 48, textAlign: 'center', color: th.textMuted }}>Loading applications…</div>
      ) : rows.length === 0 ? (
        <div style={{ ...CARD, padding: 64 }}>
          <Empty description="No booking applications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((row) => (
            <ApplicationCard
              key={row.id}
              row={row}
              th={th}
              isDark={isDark}
              acceptLoading={acceptMut.isPending}
              onAccept={() =>
                modal.confirm({
                  title: 'Accept this application?',
                  content: 'The booking will move to "To Call" for reception, and the space will be reserved (hidden from the public map until finalized or refused).',
                  okText: 'Accept',
                  onOk: () => acceptMut.mutateAsync(row.id),
                })
              }
              onRefuse={() => setRefuseId(row.id)}
            />
          ))}
        </div>
      )}

      <Modal
        title="Refuse application"
        open={!!refuseId}
        onCancel={() => { setRefuseId(null); setRefuseReason(''); }}
        onOk={() => refuseId && refuseMut.mutate({ id: refuseId, reason: refuseReason })}
        confirmLoading={refuseMut.isPending}
        okText="Send refusal"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: th.textSub, marginBottom: 12 }}>The applicant will receive an email with your message.</p>
        <Input.TextArea
          rows={4}
          value={refuseReason}
          onChange={(e) => setRefuseReason(e.target.value)}
          placeholder="Reason for refusal (optional but recommended)"
        />
      </Modal>
    </PageShell>
  );
}
