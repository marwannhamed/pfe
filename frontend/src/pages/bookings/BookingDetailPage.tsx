import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Tag, Upload, Select, Spin, Typography, Alert, List } from 'antd';
import { PhoneOutlined, ArrowLeftOutlined, UploadOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { message } from '../../utils/feedback';
import type { Booking, BookingDocumentType } from '../../types';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const STATUS_COLORS: Record<string, string> = {
  PENDING_PHONE_CONFIRMATION: 'gold',
  AWAITING_PHYSICAL_VISIT: 'blue',
  DOCUMENTS_PENDING_UPLOAD: 'purple',
  ACTIVE: 'green',
  REFUSED: 'red',
  CONFIRMED: 'green',
};

const DOC_TYPES: { value: BookingDocumentType; label: string }[] = [
  { value: 'cr_copy', label: 'Commercial Registration (CR) copy' },
  { value: 'qid_copy', label: 'QID copy' },
  { value: 'trade_license', label: 'Trade License' },
  { value: 'signed_lease_contract', label: 'Signed Lease Contract' },
  { value: 'payment_proof', label: 'Payment Proof' },
];

function unwrap<T>(raw: unknown): T {
  return ((raw as { data?: T })?.data ?? raw) as T;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { t: th } = usePageTheme();
  const [docType, setDocType] = useState<BookingDocumentType>('signed_lease_contract');

  const role = user?.role ?? '';
  const isManager = role === 'SUPER_ADMIN' || role === 'CLIENT_ADMIN' || role === 'MANAGER';
  const isReceptionOnly = role === 'RECEPTIONIST';
  const isReception = isReceptionOnly || isManager;
  const canUploadDocs = isManager || isReceptionOnly;
  const canFinalize = isManager;

  const { data: bookingRaw, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingApi.getOne(id!).then(unwrap<Booking>),
    enabled: !!id,
  });

  const booking = bookingRaw as Booking & {
    start_time?: string;
    end_time?: string;
    total_amount?: number;
    documents?: { id: string; file_name: string; file_url: string; document_type: string; uploaded_at: string }[];
    application?: { guest_phone?: string };
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['booking-workflow-queues'] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const confirmMut = useMutation({
    mutationFn: () => bookingApi.confirmPhone(id!),
    onSuccess: () => { message.success('Tenant confirmed'); invalidate(); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const unreachableMut = useMutation({
    mutationFn: () => bookingApi.phoneUnreachable(id!, 'Unreachable'),
    onSuccess: () => { message.success('Booking refused'); invalidate(); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const visitMut = useMutation({
    mutationFn: () => bookingApi.markDocumentsPending(id!),
    onSuccess: () => { message.success('Ready for document upload'); invalidate(); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Failed'),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => bookingApi.uploadDocument(id!, file, docType),
    onSuccess: () => { message.success('Document uploaded'); invalidate(); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Upload failed'),
  });

  const removeDocMut = useMutation({
    mutationFn: (docId: string) => bookingApi.removeDocument(id!, docId),
    onSuccess: () => { message.success('Document removed'); invalidate(); },
  });

  const finalizeMut = useMutation({
    mutationFn: () => bookingApi.finalize(id!),
    onSuccess: () => { message.success('Booking finalized — tenant notified'); invalidate(); },
    onError: (e: { userMessage?: string }) => message.error(e?.userMessage ?? 'Cannot finalize'),
  });

  if (isLoading || !booking) {
    return (
      <PageShell maxWidth={900}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
      </PageShell>
    );
  }

  const phone =
    booking.user?.phone_number ??
    (booking as { application?: { guest_phone?: string } }).application?.guest_phone ??
    '—';

  const tenantLabel = [booking.user?.first_name, booking.user?.last_name].filter(Boolean).join(' ') || booking.user?.email || 'Tenant';
  const docs = booking.documents ?? [];
  const hasContract = docs.some((d) =>
    d.document_type === 'contract' || d.document_type === 'signed_lease_contract',
  );
  const start = booking.start_time ?? (booking as { start_datetime?: string }).start_datetime;

  return (
    <PageShell maxWidth={900}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        Back
      </Button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: th.text }}>{booking.space?.name ?? 'Booking'}</Title>
          <Text type="secondary">{booking.booking_number}</Text>
        </div>
        <Tag color={STATUS_COLORS[booking.status] ?? 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
          {booking.status.replace(/_/g, ' ')}
        </Tag>
      </div>

      <Card style={{ marginBottom: 20, borderRadius: 12, border: '2px solid #2563eb', background: '#eff6ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneOutlined style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Tenant phone — call this number</Text>
            <Title level={4} style={{ margin: 0, letterSpacing: 1 }}>{phone}</Title>
            <Text>{tenantLabel} · {booking.user?.email}</Text>
          </div>
        </div>
      </Card>

      <Card title="Booking details" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div><Text type="secondary">Start</Text><div>{start ? new Date(start).toLocaleString() : '—'}</div></div>
          <div><Text type="secondary">Total</Text><div>${Number(booking.total_amount ?? booking.total_price ?? 0).toLocaleString()}</div></div>
          <div><Text type="secondary">Space</Text><div>{booking.space?.name}</div></div>
          <div><Text type="secondary">Receptionist</Text><div>{booking.receptionist ? `${booking.receptionist.first_name ?? ''} ${booking.receptionist.last_name ?? ''}`.trim() || 'Assigned' : '—'}</div></div>
        </div>
      </Card>

      {isReception && booking.status === 'PENDING_PHONE_CONFIRMATION' && (
        <Card title="Phone confirmation" style={{ marginBottom: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button type="primary" loading={confirmMut.isPending} onClick={() => confirmMut.mutate()}>Tenant Confirmed</Button>
            <Button danger loading={unreachableMut.isPending} onClick={() => unreachableMut.mutate()}>Tenant Unreachable / Cancelled</Button>
          </div>
        </Card>
      )}

      {isReception && booking.status === 'AWAITING_PHYSICAL_VISIT' && (
        <Card title="Physical visit" style={{ marginBottom: 20, borderRadius: 12 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            After the tenant signs the contract and pays by cheque on site, mark the visit complete.
          </Text>
          <Button type="primary" loading={visitMut.isPending} onClick={() => visitMut.mutate()}>Visit complete — awaiting documents</Button>
        </Card>
      )}

      {canUploadDocs && (
        <Card
          title="Upload documents — CR, QID, trade license, contract, payment"
          style={{ marginBottom: 20, borderRadius: 12, border: booking.status === 'DOCUMENTS_PENDING_UPLOAD' ? '2px solid #7c3aed' : undefined }}
        >
          {isReceptionOnly && booking.status === 'DOCUMENTS_PENDING_UPLOAD' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Scan documents collected at the visit"
              description="Upload PDFs here (signed contract, cheque copy, ID). A manager will review and finalize the booking."
            />
          )}
          {booking.status !== 'DOCUMENTS_PENDING_UPLOAD' && booking.status !== 'ACTIVE' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Upload is available after the physical visit"
              description={
                booking.status === 'PENDING_PHONE_CONFIRMATION'
                  ? 'Reception must confirm the phone call first (Reception → To Call queue).'
                  : booking.status === 'AWAITING_PHYSICAL_VISIT'
                    ? 'After the tenant visits and signs on site, click “Visit complete” on the Reception page or below.'
                    : `Current status: ${booking.status.replace(/_/g, ' ')}`
              }
            />
          )}
          {booking.status === 'AWAITING_PHYSICAL_VISIT' && (
            <Button type="primary" loading={visitMut.isPending} onClick={() => visitMut.mutate()} style={{ marginBottom: 16 }}>
              Visit complete — enable document upload
            </Button>
          )}
          {docs.length >= 5 && (
            <Alert type="warning" message="Maximum 5 documents reached" style={{ marginBottom: 12 }} />
          )}
          {booking.status === 'DOCUMENTS_PENDING_UPLOAD' && (
            <>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                Upload the signed lease contract, CR copy, QID copy, trade license, and payment proof (PDF only, up to 5 files).
              </Text>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>Document type</Text>
                <Select style={{ width: 220 }} value={docType} onChange={setDocType} options={DOC_TYPES} />
              </div>
              <Dragger
                accept=".pdf,application/pdf"
                showUploadList={false}
                disabled={docs.length >= 5 || uploadMut.isPending}
                beforeUpload={(file) => { uploadMut.mutate(file); return false; }}
              >
                <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                <p><strong>Drag & drop a PDF here</strong>, or click to browse ({docs.length}/5)</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>Signed contract · Payment cheque · ID copy</p>
              </Dragger>
            </>
          )}
          <List
            style={{ marginTop: 16 }}
            dataSource={docs}
            locale={{ emptyText: 'No documents yet' }}
            renderItem={(doc) => (
              <List.Item
                actions={[
                  <a key="dl" href={doc.file_url} target="_blank" rel="noreferrer">Download</a>,
                  canUploadDocs && booking.status === 'DOCUMENTS_PENDING_UPLOAD' ? (
                    <Button key="rm" type="text" danger icon={<DeleteOutlined />} loading={removeDocMut.isPending} onClick={() => removeDocMut.mutate(doc.id)} />
                  ) : null,
                ]}
              >
                <List.Item.Meta title={doc.file_name} description={`${doc.document_type} · ${new Date(doc.uploaded_at).toLocaleString()}`} />
              </List.Item>
            )}
          />
          {canFinalize && booking.status === 'DOCUMENTS_PENDING_UPLOAD' && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              style={{ marginTop: 16 }}
              disabled={!hasContract}
              loading={finalizeMut.isPending}
              onClick={() => finalizeMut.mutate()}
            >
              Finalize booking
            </Button>
          )}
          {canFinalize && !hasContract && booking.status === 'DOCUMENTS_PENDING_UPLOAD' && (
            <Alert type="info" message="Upload the signed contract PDF before finalizing." style={{ marginTop: 12 }} />
          )}
          {isReceptionOnly && booking.status === 'DOCUMENTS_PENDING_UPLOAD' && hasContract && (
            <Alert type="success" message="Documents uploaded — waiting for a manager to finalize this booking." style={{ marginTop: 12 }} showIcon />
          )}
        </Card>
      )}

      {booking.status === 'ACTIVE' && hasContract && (
        <Alert type="success" message="Booking is active. Space removed from public map." showIcon />
      )}
    </PageShell>
  );
}
