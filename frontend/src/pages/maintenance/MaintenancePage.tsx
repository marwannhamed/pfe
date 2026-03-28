import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  ToolOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, UserOutlined, FilterOutlined,
} from '@ant-design/icons';
import { maintenanceApi, spaceApi, userApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { MaintenanceTicket, TicketStatus, TicketPriority, TicketCategory } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── New Ticket Modal ─────────────────────────────────────────────────────────
function NewTicketModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-all'],
    queryFn:  () => spaceApi.getAll().then(r => r.data),
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
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to create ticket';
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
      title={<div><div style={{ fontWeight: 700, fontSize: 17 }}>Submit Maintenance Request</div><div style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>Report an issue or request maintenance</div></div>}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Please describe the issue' }]}>
          <Input placeholder="e.g. AC not working in Office 201" />
        </Form.Item>
        <Form.Item label="Space" name="space_id" rules={[{ required: true, message: 'Please select a space' }]}>
          <Select
            showSearch
            placeholder="Select the affected space..."
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={(spaces as any[]).map(s => ({ value: s.id, label: `${s.name} (${s.code})` }))}
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
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Submitting...' : '+ Submit Ticket'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────
function TicketDetailModal({ ticket, onClose, isAdmin }: { ticket: MaintenanceTicket | null; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [assignUserId, setAssignUserId] = useState('');

  const { data: maintenanceUsers = [] } = useQuery({
    queryKey: ['users-maintenance'],
    queryFn:  () => userApi.getAll().then(r => r.data.filter((u: any) => u.role === 'MAINTENANCE')),
    enabled:  !!ticket && isAdmin,
  });

  const assignMut = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      maintenanceApi.assign(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket assigned'); onClose(); },
  });

  const startMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.start(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Work started'); onClose(); },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.resolve(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket resolved'); onClose(); },
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.close(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket closed'); onClose(); },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.cancel(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); message.success('Ticket cancelled'); onClose(); },
  });

  if (!ticket) return null;
  const sm = STATUS_META[ticket.status]   ?? STATUS_META.OPEN;
  const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META.NORMAL;

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
          ['Created by',  (ticket as any).createdBy ? `${(ticket as any).createdBy.first_name} ${(ticket as any).createdBy.last_name}` : '—'],
          ['Assigned to', (ticket as any).assignedTo ? `${(ticket as any).assignedTo.first_name} ${(ticket as any).assignedTo.last_name}` : 'Unassigned'],
          ['Reported',    formatDate(ticket.reported_at)],
          ['Resolved',    ticket.resolved_at ? formatDate(ticket.resolved_at) : '—'],
          ['Cost',        ticket.cost ? `$${parseFloat(ticket.cost).toLocaleString()}` : '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
          </div>
        ))}

        {/* Assign to maintenance user */}
        {isAdmin && ticket.status === 'OPEN' && (maintenanceUsers as any[]).length > 0 && (
          <div style={{ marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Assign to Technician</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none' }}
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
          {ticket.status === 'ASSIGNED' && (
            <button onClick={() => startMut.mutate(ticket.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#ede9fe', border: '1px solid #ddd6fe', color: '#6d28d9', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Start Work
            </button>
          )}
          {ticket.status === 'IN_PROGRESS' && (
            <button onClick={() => resolveMut.mutate(ticket.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Mark Resolved
            </button>
          )}
          {ticket.status === 'RESOLVED' && isAdmin && (
            <button onClick={() => closeMut.mutate(ticket.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Close Ticket
            </button>
          )}
          {!['CLOSED','CANCELLED','RESOLVED'].includes(ticket.status) && (
            <button
              onClick={() => Modal.confirm({ title: 'Cancel this ticket?', okType: 'danger', okText: 'Cancel Ticket', onOk: () => cancelMut.mutate(ticket.id) })}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const { user }      = useAuthStore();
  const userId        = user?.id ?? '';
  const isAdmin       = user?.role && ['SUPER_ADMIN','SITE_MANAGER','TENANT_ADMIN'].includes(user.role);
  const isMaintenance = user?.role === 'MAINTENANCE';

  const [q,          setQ]        = useState('');
  const [statusFilt, setStatus]   = useState('');
  const [prioFilt,   setPrio]     = useState('');
  const [catFilt,    setCat]      = useState('');
  const [newOpen,    setNew]      = useState(false);
  const [selected,   setSelected] = useState<MaintenanceTicket | null>(null);

  // ── Fetch tickets ──
  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['maintenance', statusFilt, prioFilt, catFilt, userId],
    queryFn:  () => maintenanceApi.getAll({
      ...(statusFilt    ? { status: statusFilt }      : {}),
      ...(prioFilt      ? { priority: prioFilt }      : {}),
      ...(catFilt       ? { category: catFilt }       : {}),
      ...(isMaintenance ? { assignedTo: userId }      : {}),
    }).then(r => r.data),
  });

  // ── Fetch stats ──
  const { data: stats } = useQuery({
    queryKey: ['maintenance-stats'],
    queryFn:  () => maintenanceApi.getStats().then(r => r.data),
  });

  // ── Filter client-side ──
  const filtered = (tickets as MaintenanceTicket[]).filter(t => {
    if (!q) return true;
    return t.title.toLowerCase().includes(q.toLowerCase()) ||
           t.ticket_number.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              {isMaintenance ? 'My Assigned Tickets' : 'Maintenance Management'}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              {isMaintenance ? 'View and manage your assigned maintenance tasks' : 'Track and manage all maintenance requests'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            <button onClick={() => setNew(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined /> Submit Ticket
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total',       value: stats?.total       ?? '—', sub: 'All tickets',     color: '#2563eb', bg: '#eff6ff', icon: '🎫' },
            { label: 'Open',        value: stats?.open        ?? '—', sub: 'Need attention',  color: '#d97706', bg: '#fffbeb', icon: '🔓' },
            { label: 'In Progress', value: stats?.in_progress ?? '—', sub: 'Being worked on', color: '#7c3aed', bg: '#f5f3ff', icon: '⚙️' },
            { label: 'Resolved',    value: stats?.resolved    ?? '—', sub: 'Pending close',   color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Total Cost',  value: stats?.total_cost !== undefined ? `$${Number(stats.total_cost).toLocaleString()}` : '—', sub: 'Closed tickets', color: '#0369a1', bg: '#f0f9ff', icon: '💰' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search by title or ticket #..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 240, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Status' }, ...Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))]}
        />
        <Select value={prioFilt || 'all'} onChange={v => setPrio(v === 'all' ? '' : v)} style={{ width: 150 }}
          options={[{ value: 'all', label: 'All Priority' }, ...Object.entries(PRIORITY_META).sort((a,b) => b[1].order - a[1].order).map(([v, m]) => ({ value: v, label: m.label }))]}
        />
        <Select value={catFilt || 'all'} onChange={v => setCat(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Categories' }, ...Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          <strong style={{ color: '#0f172a' }}>{isLoading ? '—' : filtered.length}</strong> of {(tickets as any[]).length}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load tickets</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 1fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            const assignee = (t as any).assignedTo;
            return (
              <div
                key={t.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{t.ticket_number}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{formatDate(t.reported_at)}</div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{(t as any).space?.name ?? 'Unknown space'}</div>
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
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {assignee.first_name[0]}{assignee.last_name[0]}
                      </div>
                      {assignee.first_name}
                    </>
                  ) : 'Unassigned'}
                </div>

                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setSelected(t)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EyeOutlined style={{ fontSize: 12, color: '#64748b' }} />
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Showing {filtered.length} of {(tickets as any[]).length} tickets</span>
            <span>{stats?.open ?? 0} open · {stats?.in_progress ?? 0} in progress</span>
          </div>
        </div>
      )}

      <NewTicketModal open={newOpen} onClose={() => setNew(false)} userId={userId} />
      <TicketDetailModal ticket={selected} onClose={() => setSelected(null)} isAdmin={!!isAdmin} />
    </div>
  );
}
