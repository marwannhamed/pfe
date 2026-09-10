import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { Input, Select, Modal, Form, Skeleton, Empty } from 'antd';
import { message, modal } from '../../utils/feedback';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  ToolOutlined, EyeOutlined, DeleteOutlined, CheckOutlined,
} from '@ant-design/icons';
import { maintenanceApi, userApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { MaintenanceTicket, TicketStatus, TicketPriority, TicketCategory } from '../../types';
import UserAvatar from '../../components/UserAvatar';
import { formatUserName } from '../../utils/user';

// --- Helpers ------------------------------------------------------------------
const STATUS_META: Record<TicketStatus, { label: string; bg: string; color: string }> = {
  OPEN:        { label: 'Open',        bg: '#fef3c7', color: '#92400e' },
  ASSIGNED:    { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'In Progress', bg: '#ede9fe', color: '#6d28d9' },
  RESOLVED:    { label: 'Resolved',    bg: '#dcfce7', color: '#15803d' },
  CLOSED:      { label: 'Closed',      bg: '#f1f5f9', color: '#475569' },
  CANCELLED:   { label: 'Cancelled',   bg: '#fee2e2', color: '#b91c1c' },
};

const PRIORITY_META: Record<TicketPriority, { label: string; bg: string; color: string; order: number }> = {
  EMERGENCY: { label: 'Emergency', bg: '#fee2e2', color: '#991b1b', order: 5 },
  URGENT:    { label: 'Urgent',    bg: '#fee2e2', color: '#dc2626', order: 4 },
  HIGH:      { label: 'High',      bg: '#fef3c7', color: '#d97706', order: 3 },
  NORMAL:    { label: 'Normal',    bg: '#dbeafe', color: '#2563eb', order: 2 },
  LOW:       { label: 'Low',       bg: '#f1f5f9', color: '#475569', order: 1 },
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  PLUMBING:     'Plumbing',
  ELECTRICAL:   'Electrical',
  HVAC:         'HVAC',
  CLEANING:     'Cleaning',
  FURNITURE:    'Furniture',
  IT_EQUIPMENT: 'IT Equipment',
  OTHER:        'Other',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAssignee(ticket: MaintenanceTicket | null | undefined) {
  if (!ticket) return null;
  return (ticket as any).assignedTo ?? (ticket as any).assignee ?? null;
}

function canAcceptTicket(ticket: MaintenanceTicket, isMaintenance: boolean) {
  if (!isMaintenance) return false;
  if (['CLOSED', 'CANCELLED', 'RESOLVED'].includes(ticket.status)) return false;
  return !getAssignee(ticket);
}

function isMyTicket(ticket: MaintenanceTicket, userId: string) {
  const a = getAssignee(ticket);
  return !!a && a.id === userId;
}

// --- New Ticket Modal ---------------------------------------------------------
function NewTicketModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const { t: th } = usePageTheme();
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: spaces = [], isLoading: spacesLoading, isError: spacesError } = useQuery({
    queryKey: ['maintenance-accessible-spaces'],
    queryFn:  async () => {
      const res = await maintenanceApi.getAccessibleSpaces();
      const list = Array.isArray(res) ? res : (res as { data?: unknown[] })?.data;
      return Array.isArray(list) ? list : [];
    },
    enabled:  open,
  });

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const v = form.getFieldsValue();
      await maintenanceApi.create({
        space_id:           v.space_id,
        created_by_user_id: userId,
        title:              v.title,
        category:           v.category,
        priority:           v.priority ?? 'NORMAL',
      });
      message.success('Ticket created successfully');
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      onClose();
      form.resetFields();
    } catch (e: unknown) {
      const err = e as { userMessage?: string; response?: { data?: { message?: string | string[] } } };
      const msg = err?.userMessage ?? err?.response?.data?.message ?? 'Failed to create ticket';
      message.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); form.resetFields(); }}
      footer={null}
      width={520}
      title={<div><div style={{ fontWeight: 700, fontSize: 17 }}>Submit Maintenance Request</div><div style={{ fontSize: 13, color: th.textSub, fontWeight: 400 }}>Report an issue or request maintenance</div></div>}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Please describe the issue' }]}>
          <Input placeholder="e.g. AC not working in Office 201" />
        </Form.Item>
        <Form.Item label="Space" name="space_id" rules={[{ required: true, message: 'Please select a space' }]}>
          <Select
            showSearch
            loading={spacesLoading}
            placeholder={
              (spaces as any[]).length === 0 && !spacesLoading
                ? 'Book a space first � only your booked spaces appear here'
                : 'Select the affected space...'
            }
            notFoundContent={
              spacesLoading
                ? 'Loading...'
                : spacesError
                  ? 'Could not load spaces � refresh and try again'
                  : 'No spaces � create a booking for a space first'
            }
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={(spaces as any[]).map(s => ({ value: s.id, label: `${s.name} (${s.slug ?? s.type})` }))}
          />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Select options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item label="Priority" name="priority" initialValue="NORMAL">
            <Select options={Object.entries(PRIORITY_META).map(([v, m]) => ({ value: v, label: m.label }))} />
          </Form.Item>
        </div>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Submitting...' : '+ Submit Ticket'}
        </button>
      </div>
    </Modal>
  );
}

// --- Ticket Detail Modal ------------------------------------------------------
function TicketDetailModal({
  ticket,
  onClose,
  canManage,
  isMaintenance,
  userId,
}: {
  ticket: MaintenanceTicket | null;
  onClose: () => void;
  canManage: boolean;
  isMaintenance: boolean;
  userId: string;
}) {
  const { t: th } = usePageTheme();
  const qc = useQueryClient();
  const [assignUserId, setAssignUserId] = useState('');

  const { data: maintenanceUsers = [] } = useQuery({
    queryKey: ['users-maintenance'],
    queryFn:  () => userApi.getAll().then(r => r.data.filter((u: any) => u.role === 'MAINTENANCE')),
    enabled:  !!ticket && canManage,
  });

  const onActionError = (e: unknown) => {
    const err = e as { userMessage?: string; response?: { data?: { message?: string | string[] } } };
    const m = err?.userMessage ?? err?.response?.data?.message ?? 'Action failed';
    message.error(Array.isArray(m) ? m[0] : m);
  };

  const assignMut = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      maintenanceApi.assign(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket assigned'); onClose(); },
    onError: onActionError,
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-stats'] });
      message.success('You accepted this ticket');
      onClose();
    },
    onError: onActionError,
  });

  const startMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.start(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Work started'); onClose(); },
    onError: onActionError,
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.resolve(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket resolved'); onClose(); },
    onError: onActionError,
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.close(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket closed'); onClose(); },
    onError: onActionError,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.cancel(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket cancelled'); onClose(); },
    onError: onActionError,
  });

  if (!ticket) return null;
  const sm = STATUS_META[ticket.status]   ?? STATUS_META.OPEN;
  const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META.NORMAL;
  const assignee = getAssignee(ticket);
  const showAccept = canAcceptTicket(ticket, isMaintenance);
  const canWork = isMaintenance ? isMyTicket(ticket, userId) : canManage;

  return (
    <Modal
      open={!!ticket}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Ticket Details</span>
          <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{sm.label}</span>
          <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{pm.label}</span>
        </div>
      }
    >
      <div style={{ marginTop: 16 }}>
        {[
          ['Ticket #',    ticket.ticket_number],
          ['Title',       ticket.title],
          ['Category',    CATEGORY_LABELS[ticket.category] ?? ticket.category],
          ['Space',       (ticket as any).space?.name ?? ticket.space_id.substring(0, 8)],
          ['Created by',  (ticket as any).createdBy ? `${(ticket as any).createdBy.first_name} ${(ticket as any).createdBy.last_name}` : '�'],
          ['Assigned to', assignee ? `${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim() || assignee.email : 'Unassigned � waiting for a technician'],
          ['Reported',    formatDate(ticket.reported_at)],
          ['Resolved',    ticket.resolved_at ? formatDate(ticket.resolved_at) : '�'],
          ['Cost',        ticket.cost ? `$${parseFloat(ticket.cost).toLocaleString()}` : '�'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${th.divider}`, fontSize: 13 }}>
            <span style={{ color: th.textSub }}>{k}</span>
            <span style={{ fontWeight: 600, color: th.text, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
          </div>
        ))}

        {showAccept && (
          <div style={{ marginTop: 16, padding: '12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>Accept this job?</div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569' }}>
              Claim this ticket to add it to your workload. Other technicians will no longer be able to accept it.
            </p>
            <button
              onClick={() => acceptMut.mutate(ticket.id)}
              disabled={acceptMut.isPending}
              style={{ padding: '9px 18px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {acceptMut.isPending ? 'Accepting...' : '? Accept Ticket'}
            </button>
          </div>
        )}

        {/* Assign to maintenance user (managers) */}
        {canManage && !isMaintenance && ticket.status === 'OPEN' && (maintenanceUsers as any[]).length > 0 && (
          <div style={{ marginTop: 16, padding: '12px', background: th.tableHead, borderRadius: 8, border: `1px solid ${th.cardBorder}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.text, marginBottom: 8 }}>Assign to Technician</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: `1px solid ${th.cardBorder}`, borderRadius: 7, fontSize: 13, outline: 'none' }}
              >
                <option value="">Select technician...</option>
                {(maintenanceUsers as any[]).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
              <button
                onClick={() => assignUserId && assignMut.mutate({ id: ticket.id, userId: assignUserId })}
                disabled={!assignUserId}
                style={{ padding: '7px 14px', borderRadius: 7, background: assignUserId ? '#2563eb' : '#e5e7eb', border: 'none', color: assignUserId ? '#fff' : '#94a3b8', cursor: assignUserId ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}
              >
                Assign
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {canWork && ticket.status === 'ASSIGNED' && (
            <button onClick={() => startMut.mutate(ticket.id)} disabled={startMut.isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#ede9fe', border: '1px solid #ddd6fe', color: '#6d28d9', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Start Work
            </button>
          )}
          {canWork && ['ASSIGNED', 'IN_PROGRESS'].includes(ticket.status) && (
            <button onClick={() => resolveMut.mutate(ticket.id)} disabled={resolveMut.isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Mark Resolved
            </button>
          )}
          {ticket.status === 'RESOLVED' && canWork && (
            <button onClick={() => closeMut.mutate(ticket.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#f1f5f9', border: `1px solid ${th.cardBorder}`, color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Close Ticket
            </button>
          )}
          {!['CLOSED','CANCELLED','RESOLVED'].includes(ticket.status) && (
            <button
              onClick={() => modal.confirm({ title: 'Cancel this ticket?', okType: 'danger', okText: 'Cancel Ticket', onOk: () => cancelMut.mutate(ticket.id) })}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, background: th.cardBg, border: `1px solid ${th.cardBorder}`, fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// --- Page ---------------------------------------------------------------------
export default function MaintenancePage() {
  const { card: CARD, headerCard, t: th } = usePageTheme();
  const qc            = useQueryClient();
  const { user }      = useAuthStore();
  const userId        = user?.id ?? '';
  const isPortalTenant = user?.role === 'TENANT_ADMIN' || user?.role === 'TENANT_EMPLOYEE';
  const isAdmin       = user?.role && ['SUPER_ADMIN','MANAGER'].includes(user.role);
  const isMaintenance = user?.role === 'MAINTENANCE';
  const canManage     = isAdmin || isMaintenance;
  const canSubmit     = isPortalTenant || isAdmin;

  const [q,          setQ]        = useState('');
  const [statusFilt, setStatus]   = useState('');
  const [prioFilt,   setPrio]     = useState('');
  const [catFilt,    setCat]      = useState('');
  const [newOpen,    setNew]      = useState(false);
  const [selected,   setSelected] = useState<MaintenanceTicket | null>(null);
  const [viewTab,    setViewTab]  = useState<'all' | 'available' | 'mine'>('all');

  const acceptListMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-stats'] });
      message.success('Ticket accepted � it is now on your list');
    },
    onError: (e: unknown) => {
      const err = e as { userMessage?: string; response?: { data?: { message?: string | string[] } } };
      const m = err?.userMessage ?? err?.response?.data?.message ?? 'Could not accept ticket';
      message.error(Array.isArray(m) ? m[0] : m);
    },
  });

  // -- Fetch tickets --
  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance', statusFilt, prioFilt, catFilt, viewTab, isMaintenance],
    queryFn:  () => maintenanceApi.getAll({
      ...(statusFilt    ? { status: statusFilt }      : {}),
      ...(prioFilt      ? { priority: prioFilt }      : {}),
      ...(catFilt       ? { category: catFilt }       : {}),
      ...(isMaintenance ? { view: viewTab }           : {}),
    }).then(r => r.data),
  });

  // -- Fetch stats --
  const { data: stats } = useQuery({
    queryKey: ['maintenance-stats'],
    queryFn:  () => maintenanceApi.getStats().then(r => r.data),
  });

  // -- Delete mutation --
  const deleteMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket deleted'); },
    onError: () => message.error('Failed to delete ticket'),
  });

  // -- Filter client-side --
  const filtered = (tickets as MaintenanceTicket[]).filter(t => {
    if (!q) return true;
    return t.title.toLowerCase().includes(q.toLowerCase()) ||
           t.ticket_number.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <PageShell>

      {/* Header */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>
              {isMaintenance ? 'Maintenance Queue' : 'Maintenance Management'}
            </h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>
              {isMaintenance
                ? 'Accept open requests from the queue, then work and resolve your tickets'
                : 'Track and manage all maintenance requests'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', color: th.textSub }}>
              <ReloadOutlined />
            </button>
            {canSubmit && (
              <button onClick={() => setNew(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlusOutlined /> Submit Ticket
              </button>
            )}
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total',       value: stats?.total       ?? '�', sub: 'All tickets',     color: '#2563eb', bg: '#eff6ff', icon: '??' },
            { label: 'Open',        value: stats?.open        ?? '�', sub: 'Need attention',  color: '#d97706', bg: '#fffbeb', icon: '??' },
            { label: 'In Progress', value: stats?.in_progress ?? '�', sub: 'Being worked on', color: '#7c3aed', bg: '#f5f3ff', icon: '??' },
            { label: 'Resolved',    value: stats?.resolved    ?? '�', sub: 'Pending close',   color: '#059669', bg: '#f0fdf4', icon: '?' },
            { label: 'Total Cost',  value: stats?.total_cost !== undefined ? `$${Number(stats.total_cost).toLocaleString()}` : '�', sub: 'Closed tickets', color: '#0369a1', bg: '#f0f9ff', icon: '??' },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: th.textSub, fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800, color: th.text, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isMaintenance && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([
            { key: 'all' as const, label: 'All visible' },
            { key: 'available' as const, label: 'Open queue' },
            { key: 'mine' as const, label: 'My jobs' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${viewTab === tab.key ? '#2563eb' : th.cardBorder}`,
                background: viewTab === tab.key ? '#eff6ff' : th.cardBg,
                color: viewTab === tab.key ? '#1d4ed8' : th.textSub,
                fontWeight: viewTab === tab.key ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: th.textMuted }} />} placeholder="Search by title or ticket #..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 240, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Status' }, ...Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))]}
        />
        <Select value={prioFilt || 'all'} onChange={v => setPrio(v === 'all' ? '' : v)} style={{ width: 150 }}
          options={[{ value: 'all', label: 'All Priority' }, ...Object.entries(PRIORITY_META).sort((a,b) => b[1].order - a[1].order).map(([v, m]) => ({ value: v, label: m.label }))]}
        />
        <Select value={catFilt || 'all'} onChange={v => setCat(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Categories' }, ...Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textSub }}>
          <strong style={{ color: th.text }}>{isLoading ? '�' : filtered.length}</strong> of {(tickets as any[]).length}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>??</div>
          <div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load tickets</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? `1px solid ${th.divider}` : 'none' }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
          <ToolOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={tickets.length === 0 ? 'No tickets yet. Submit your first maintenance request!' : 'No tickets match your filters.'} />
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 1fr', padding: '11px 20px', background: th.tableHead, borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Ticket #</span>
            <span>Title</span>
            <span>Category</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Assigned To</span>
            <span>Actions</span>
          </div>

          {filtered.map((t: MaintenanceTicket, i: number) => {
            const sm = STATUS_META[t.status]    ?? STATUS_META.OPEN;
            const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.NORMAL;
            const assignee = getAssignee(t);
            const showAcceptBtn = canAcceptTicket(t, !!isMaintenance);
            const mine = isMyTicket(t, userId);
            return (
              <div
                key={t.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{t.ticket_number}</div>
                  <div style={{ fontSize: 10, color: th.textMuted }}>{formatDate(t.reported_at)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: th.textMuted }}>{(t as any).space?.name ?? 'Unknown space'}</div>
                </div>

                <span style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                  {CATEGORY_LABELS[t.category] ?? t.category}
                </span>

                <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>
                  {pm.label}
                </span>

                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>
                  {sm.label}
                </span>

                <div style={{ fontSize: 12, color: assignee ? '#374151' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {assignee ? (
                    <>
                      <UserAvatar
                        firstName={assignee.first_name}
                        lastName={assignee.last_name}
                        email={assignee.email}
                        size={22}
                      />
                      {formatUserName(assignee.first_name, assignee.last_name, assignee.email)}
                    </>
                  ) : 'Unassigned'}
                </div>

                <div style={{ display: 'flex', gap: 5 }}>
                  {showAcceptBtn && (
                    <button
                      title="Accept ticket"
                      onClick={() => acceptListMut.mutate(t.id)}
                      disabled={acceptListMut.isPending}
                      style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}
                    >
                      <CheckOutlined style={{ fontSize: 11 }} /> Accept
                    </button>
                  )}
                  {isMaintenance && mine && !showAcceptBtn && (
                    <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, padding: '4px 8px', background: '#ecfdf5', borderRadius: 6 }}>Yours</span>
                  )}
                  <button onClick={() => setSelected(t)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EyeOutlined style={{ fontSize: 12, color: th.textSub }} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => { if (window.confirm(`Delete ticket ${t.ticket_number}? This action cannot be undone.`)) deleteMut.mutate(t.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: th.textMuted }}>
            <span>Showing {filtered.length} of {(tickets as any[]).length} tickets</span>
            <span>{stats?.open ?? 0} open � {stats?.in_progress ?? 0} in progress</span>
          </div>
        </div>
      )}

      <NewTicketModal open={newOpen} onClose={() => setNew(false)} userId={userId} />
      <TicketDetailModal
        ticket={selected}
        onClose={() => setSelected(null)}
        canManage={!!canManage}
        isMaintenance={!!isMaintenance}
        userId={userId}
      />
    </PageShell>
  );
}
