import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Form, InputNumber, Select, DatePicker, Switch, Skeleton, Empty } from 'antd';
import { message, modal } from '../../utils/feedback';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { pricePlanApi, siteApi } from '../../api/services';
import type { PricePlan, SpaceType, BillingCycle } from '../../types';
import dayjs from 'dayjs';

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  DEDICATED_OFFICE: 'Dedicated Office', FLEXIBLE_DESK: 'Flexible Desk',
  HOT_DESK: 'Hot Desk', MEETING_ROOM: 'Meeting Room',
  CONFERENCE_ROOM: 'Conference Room', PHONE_BOOTH: 'Phone Booth', EVENT_SPACE: 'Event Space',
};

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  HOURLY: 'Hourly', DAILY: 'Daily', WEEKLY: 'Weekly',
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly',
};

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function PlanModal({ open, onClose, editPlan }: { open: boolean; onClose: () => void; editPlan?: PricePlan }) {
  const [form] = Form.useForm();
  const qc     = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-all'],
    queryFn:  () => siteApi.getAll(),
    enabled:  open,
  });

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const v = form.getFieldsValue();
      const data = { ...v, valid_from: v.valid_from.toISOString(), valid_to: v.valid_to ? v.valid_to.toISOString() : undefined };
      if (editPlan) {
        await pricePlanApi.update(editPlan.id, data);
        message.success('Price plan updated');
      } else {
        await pricePlanApi.create(data);
        message.success('Price plan created');
      }
      qc.invalidateQueries({ queryKey: ['price-plans'] });
      onClose(); form.resetFields();
    } catch (e: unknown) {
      message.error((e as any)?.response?.data?.message ?? 'Error');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onCancel={() => { onClose(); form.resetFields(); }} footer={null} width={520}
      title={<div style={{ fontWeight: 700, fontSize: 17 }}>{editPlan ? 'Edit Price Plan' : 'New Price Plan'}</div>}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}
        initialValues={editPlan ? { ...editPlan, valid_from: dayjs(editPlan.valid_from), valid_to: editPlan.valid_to ? dayjs(editPlan.valid_to) : undefined } : { is_active: true, tax_rate: 0, currency: 'USD' }}
      >
        <Form.Item label="Site" name="site_id" rules={[{ required: true }]}>
          <Select options={(sites as any[]).map(s => ({ value: s.id, label: `${s.name} (${s.code})` }))} />
        </Form.Item>
        <Form.Item label="Plan Name" name="name" rules={[{ required: true }]}>
          <input placeholder="e.g. Standard Monthly" style={{ width: '100%', padding: '7px 11px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, outline: 'none' }} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Space Type" name="space_type" rules={[{ required: true }]}>
            <Select options={Object.entries(SPACE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
          <Form.Item label="Billing Cycle" name="billing_cycle" rules={[{ required: true }]}>
            <Select options={Object.entries(BILLING_CYCLE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item label="Price" name="price" rules={[{ required: true }]}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Currency" name="currency">
            <Select options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' }]} />
          </Form.Item>
          <Form.Item label="Tax Rate %" name="tax_rate">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Valid From" name="valid_from" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
          </Form.Item>
          <Form.Item label="Valid To (optional)" name="valid_to">
            <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
          </Form.Item>
        </div>
        <Form.Item label="Active" name="is_active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Saving...' : editPlan ? 'Save Changes' : '+ Create Plan'}
        </button>
      </div>
    </Modal>
  );
}

export default function PricePlansPage() {
  const qc = useQueryClient();
  const [modalOpen, setModal] = useState(false);
  const [editPlan,  setEdit]  = useState<PricePlan | undefined>();

  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ['price-plans'],
    queryFn:  () => pricePlanApi.getAll().then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => pricePlanApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['price-plans'] }); message.success('Plan deleted'); },
  });

  const all = plans as PricePlan[];

  return (
    <div style={{ padding: 24, minHeight: '100%' }}>
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Price Plans</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Configure pricing for different space types and billing cycles</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}><ReloadOutlined /></button>
            <button onClick={() => { setEdit(undefined); setModal(true); }} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined /> New Plan
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Total Plans',  value: all.length,                          color: '#2563eb', bg: '#eff6ff' },
            { label: 'Active Plans', value: all.filter(p => p.is_active).length, color: '#059669', bg: '#f0fdf4' },
            { label: 'Space Types',  value: new Set(all.map(p => p.space_type)).size, color: '#7c3aed', bg: '#f5f3ff' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: s.color }}>{isLoading ? '—' : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={CARD}>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? '1px solid #f8fafc' : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>
      ) : all.length === 0 ? (
        <div style={{ ...CARD, padding: '60px' }}><Empty description="No price plans yet." /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {all.map(plan => (
            <div key={plan.id} style={{ ...CARD, padding: '18px 20px', opacity: plan.is_active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{plan.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{SPACE_TYPE_LABELS[plan.space_type]}</div>
                </div>
                {plan.is_active
                  ? <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>Active</span>
                  : <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>Inactive</span>
                }
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>
                {plan.currency === 'EUR' ? '€' : plan.currency === 'GBP' ? '£' : '$'}{parseFloat(plan.price).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>per {BILLING_CYCLE_LABELS[plan.billing_cycle].toLowerCase()} · Tax {parseFloat(plan.tax_rate).toFixed(1)}%</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                Valid from {new Date(plan.valid_from).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {plan.valid_to && ` → ${new Date(plan.valid_to).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEdit(plan); setModal(true); }} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <EditOutlined /> Edit
                </button>
                <button onClick={() => modal.confirm({ title: 'Delete this plan?', okType: 'danger', okText: 'Delete', onOk: () => deleteMut.mutate(plan.id) })} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DeleteOutlined style={{ fontSize: 13, color: '#dc2626' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <PlanModal open={modalOpen} onClose={() => { setModal(false); setEdit(undefined); }} editPlan={editPlan} />
    </div>
  );
}
