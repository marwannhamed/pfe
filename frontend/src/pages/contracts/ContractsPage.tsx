import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, DatePicker, InputNumber, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  FileTextOutlined, CheckCircleOutlined, StopOutlined,
  EyeOutlined, DownloadOutlined, WarningOutlined,
  CalendarOutlined, DollarOutlined,
} from '@ant-design/icons';
import { contractApi, spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { LeaseContract, ContractStatus } from '../../types';
import dayjs from 'dayjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<ContractStatus, { label: string; bg: string; color: string }> = {
  DRAFT:      { label: 'Draft',       bg: '#f1f5f9', color: '#475569' },
  ACTIVE:     { label: 'Active',      bg: '#dcfce7', color: '#15803d' },
  EXPIRED:    { label: 'Expired',     bg: '#fee2e2', color: '#b91c1c' },
  TERMINATED: { label: 'Terminated',  bg: '#fee2e2', color: '#b91c1c' },
  RENEWED:    { label: 'Renewed',     bg: '#dbeafe', color: '#1d4ed8' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysLeft(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── New Contract Modal ───────────────────────────────────────────────────────
function NewContractModal({ open, onClose, tenantId, userId }: {
  open: boolean; onClose: () => void; tenantId: string; userId: string;
}) {
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
      await contractApi.create({
        tenant_id:          tenantId,
        created_by_user_id: userId,
        start_date:         v.start_date.toISOString(),
        end_date:           v.end_date.toISOString(),
        monthly_rent:       v.monthly_rent,
        deposit_amount:     v.deposit_amount,
        currency:           v.currency ?? 'USD',
        payment_due_day:    v.payment_due_day ?? 1,
        auto_renew:         v.auto_renew ?? false,
      });
      message.success('Contract created successfully');
      qc.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
      form.resetFields();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to create contract';
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
      width={580}
      title={<div><div style={{ fontWeight: 700, fontSize: 17 }}>New Lease Contract</div><div style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>Create a new lease agreement</div></div>}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Start Date" name="start_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
          </Form.Item>
          <Form.Item label="End Date" name="end_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Monthly Rent" name="monthly_rent" rules={[{ required: true }]}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Security Deposit" name="deposit_amount" rules={[{ required: true }]}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Currency" name="currency" initialValue="USD">
            <Select options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' }, { value: 'TND', label: 'TND' }]} />
          </Form.Item>
          <Form.Item label="Payment Due Day" name="payment_due_day" initialValue={1}>
            <InputNumber min={1} max={28} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item label="Auto Renew" name="auto_renew" initialValue={false}>
          <Select options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Creating...' : '+ Create Contract'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Contract Detail Modal ────────────────────────────────────────────────────
function ContractDetailModal({ contract, onClose }: { contract: LeaseContract | null; onClose: () => void }) {
  const qc = useQueryClient();

  const signMut = useMutation({
    mutationFn: (id: string) => contractApi.sign(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Contract signed — now ACTIVE'); onClose(); },
    onError:    () => message.error('Failed to sign contract'),
  });

  const terminateMut = useMutation({
    mutationFn: (id: string) => contractApi.terminate(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Contract terminated'); onClose(); },
    onError:    () => message.error('Failed to terminate contract'),
  });

  if (!contract) return null;
  const sm = STATUS_META[contract.status] ?? STATUS_META.DRAFT;
  const daysLeft = getDaysLeft(contract.end_date);

  return (
    <Modal
      open={!!contract}
      onCancel={onClose}
      footer={null}
      width={540}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Contract Details</span>
          <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
        </div>
      }
    >
      <div style={{ marginTop: 16 }}>
        {daysLeft > 0 && daysLeft <= 30 && contract.status === 'ACTIVE' && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <WarningOutlined style={{ color: '#d97706' }} />
            <span style={{ color: '#92400e', fontWeight: 500 }}>Expires in {daysLeft} days</span>
          </div>
        )}

        {[
          ['Contract #',     contract.contract_number],
          ['Status',         contract.status],
          ['Start Date',     formatDate(contract.start_date)],
          ['End Date',       formatDate(contract.end_date)],
          ['Monthly Rent',   `${contract.currency} ${parseFloat(contract.monthly_rent).toLocaleString()}`],
          ['Deposit',        `${contract.currency} ${parseFloat(contract.deposit_amount).toLocaleString()}`],
          ['Payment Due',    `Day ${contract.payment_due_day} of each month`],
          ['Auto Renew',     contract.auto_renew ? 'Yes' : 'No'],
          ['Signed At',      contract.signed_at ? formatDate(contract.signed_at) : 'Not signed yet'],
          ['Created',        formatDate(contract.created_at)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {contract.status === 'DRAFT' && (
            <button
              onClick={() => signMut.mutate(contract.id)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <CheckCircleOutlined /> Sign Contract
            </button>
          )}
          {contract.status === 'ACTIVE' && (
            <button
              onClick={() => Modal.confirm({
                title: 'Terminate this contract?',
                content: 'This action cannot be undone.',
                okText: 'Terminate',
                okType: 'danger',
                onOk: () => terminateMut.mutate(contract.id),
              })}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Terminate
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ContractsPage() {
  const qc           = useQueryClient();
  const { user }     = useAuthStore();
  const tenantId     = user?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [q,         setQ]        = useState('');
  const [statusFilt,setStatus]   = useState('');
  const [newOpen,   setNew]      = useState(false);
  const [selected,  setSelected] = useState<LeaseContract | null>(null);

  // ── Fetch contracts ──
  const { data: contracts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', tenantId, statusFilt],
    queryFn:  () => contractApi.getAll({
      ...(tenantId && !isSuperAdmin ? { tenantId } : {}),
      ...(statusFilt ? { status: statusFilt } : {}),
    }).then(r => r.data),
  });

  // ── Fetch expiring contracts ──
  const { data: expiring = [] } = useQuery({
    queryKey: ['contracts-expiring'],
    queryFn:  () => contractApi.getExpiring(30).then(r => r.data),
  });

  // ── Filter ──
  const filtered = (contracts as LeaseContract[]).filter(c => {
    if (!q) return true;
    return c.contract_number.toLowerCase().includes(q.toLowerCase());
  });

  // ── Stats ──
  const all       = contracts as LeaseContract[];
  const active    = all.filter(c => c.status === 'ACTIVE').length;
  const draft     = all.filter(c => c.status === 'DRAFT').length;
  const expiredC  = all.filter(c => c.status === 'EXPIRED' || c.status === 'TERMINATED').length;
  const totalRent = all.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + parseFloat(c.monthly_rent), 0);

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Lease Contracts</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Manage all lease agreements and their lifecycle</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined />
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DownloadOutlined /> Export
            </button>
            <button onClick={() => setNew(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined /> New Contract
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total',       value: all.length,                  sub: 'All contracts',       color: '#2563eb', bg: '#eff6ff', icon: '📋' },
            { label: 'Active',      value: active,                      sub: 'Signed & running',    color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Draft',       value: draft,                       sub: 'Pending signature',   color: '#d97706', bg: '#fffbeb', icon: '✏️' },
            { label: 'Closed',      value: expiredC,                    sub: 'Expired/Terminated',  color: '#dc2626', bg: '#fef2f2', icon: '🔒' },
            { label: 'Monthly Rent',value: `$${totalRent.toLocaleString()}`, sub: 'From active contracts', color: '#7c3aed', bg: '#f5f3ff', icon: '💰' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: typeof s.value === 'string' ? 16 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expiring soon alert */}
      {(expiring as any[]).length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <WarningOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <div>
            <span style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>{(expiring as any[]).length} contract{(expiring as any[]).length > 1 ? 's' : ''} expiring within 30 days</span>
            <span style={{ color: '#92400e', fontSize: 13, marginLeft: 8 }}>Review and renew before they expire.</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search by contract #..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 240, borderRadius: 8 }}
        />
        <Select
          value={statusFilt || 'all'}
          onChange={v => setStatus(v === 'all' ? '' : v)}
          style={{ width: 170 }}
          options={[
            { value: 'all',        label: 'All Status'  },
            { value: 'DRAFT',      label: 'Draft'       },
            { value: 'ACTIVE',     label: 'Active'      },
            { value: 'EXPIRED',    label: 'Expired'     },
            { value: 'TERMINATED', label: 'Terminated'  },
            { value: 'RENEWED',    label: 'Renewed'     },
          ]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          Showing <strong style={{ color: '#0f172a' }}>{isLoading ? '—' : filtered.length}</strong> of {all.length}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load contracts</div>
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
          <FileTextOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={all.length === 0 ? 'No contracts yet. Create your first lease agreement!' : 'No contracts match your filters.'} />
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Contract #</span>
            <span>Start Date</span>
            <span>End Date</span>
            <span>Monthly Rent</span>
            <span>Deposit</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {filtered.map((c: LeaseContract, i: number) => {
            const sm = STATUS_META[c.status] ?? STATUS_META.DRAFT;
            const daysLeft = getDaysLeft(c.end_date);
            const isExpiringSoon = c.status === 'ACTIVE' && daysLeft > 0 && daysLeft <= 30;

            return (
              <div
                key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s', background: isExpiringSoon ? '#fffbeb' : '' }}
                onMouseEnter={e => (e.currentTarget.style.background = isExpiringSoon ? '#fef9c3' : '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = isExpiringSoon ? '#fffbeb' : '')}
              >
                {/* Contract # */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{c.contract_number}</div>
                  {isExpiringSoon && <div style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>⚠ Expires in {daysLeft} days</div>}
                  {c.auto_renew && <div style={{ fontSize: 10, color: '#059669' }}>↻ Auto-renew</div>}
                </div>

                <div style={{ fontSize: 12, color: '#374151' }}>{formatDate(c.start_date)}</div>
                <div style={{ fontSize: 12, color: daysLeft < 0 ? '#dc2626' : '#374151', fontWeight: daysLeft < 30 && daysLeft > 0 ? 600 : 400 }}>{formatDate(c.end_date)}</div>

                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {c.currency} {parseFloat(c.monthly_rent).toLocaleString()}
                </div>

                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {c.currency} {parseFloat(c.deposit_amount).toLocaleString()}
                </div>

                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>

                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setSelected(c)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View">
                    <EyeOutlined style={{ fontSize: 12, color: '#64748b' }} />
                  </button>
                  {c.status === 'DRAFT' && (
                    <button
                      onClick={() => contractApi.sign(c.id).then(() => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Contract signed!'); })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sign"
                    >
                      <CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} />
                    </button>
                  )}
                  {c.status === 'ACTIVE' && (
                    <button
                      onClick={() => Modal.confirm({ title: 'Terminate contract?', okType: 'danger', okText: 'Terminate', onOk: () => contractApi.terminate(c.id).then(() => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Terminated'); }) })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Terminate"
                    >
                      <StopOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Showing {filtered.length} of {all.length} contracts</span>
            <span>{active} active · {draft} pending signature</span>
          </div>
        </div>
      )}

      <NewContractModal open={newOpen} onClose={() => setNew(false)} tenantId={tenantId} userId={userId} />
      <ContractDetailModal contract={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
