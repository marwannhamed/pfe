import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Table, Button, Modal, Form, Input, Tag, Typography } from 'antd';
import { PlusOutlined, PhoneOutlined } from '@ant-design/icons';
import { userApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { message } from '../../utils/feedback';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { asApiError } from '../../utils/errors';

const { Title, Text } = Typography;
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

const EMPTY_LIST: readonly unknown[] = [];

function toArray<T>(raw: unknown): T[] {
  if (!raw) return EMPTY_LIST as unknown as T[];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: T[] })?.data)) return (raw as { data: T[] }).data;
  return EMPTY_LIST as unknown as T[];
}

export default function ReceptionStaffPage() {
  const { headerCard, t: th } = usePageTheme();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const tenantId = user?.tenant_id;

  const { data: staffRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ['reception-staff', tenantId],
    queryFn: async () => {
      const res = await userApi.getAll(tenantId, 'RECEPTIONIST');
      return toArray(res);
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: (values: Record<string, string>) =>
      userApi.create({
        tenant_id: tenantId,
        role: 'RECEPTIONIST',
        managed_by_id: user?.id,
        ...values,
      }),
    onSuccess: () => {
      message.success('Receptionist created');
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['reception-staff'] });
      qc.invalidateQueries({ queryKey: ['client-onboarding-reception'] });
    },
    onError: (e: { userMessage?: string; response?: { data?: { message?: string } } }) => {
      message.error(e?.userMessage ?? asApiError(e).response?.data?.message ?? 'Failed to create');
    },
  });

  const staff = staffRaw ?? [];

  return (
    <PageShell>
      <div style={headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: th.text }}>Manage Reception Staff</Title>
          <Text style={{ color: th.textSub }}>Create receptionist accounts for phone confirmation and visit workflow</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add receptionist</Button>
        </div>
      </div>

      <Card style={{ borderRadius: 12 }}>
        {isError ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Text type="danger">Could not load reception staff.</Text>
            <br />
            <Button type="link" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={staff}
          pagination={false}
          columns={[
            { title: 'Name', render: (_, r: { first_name?: string; last_name?: string; email: string }) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email },
            { title: 'Email', dataIndex: 'email' },
            {
              title: 'Phone',
              dataIndex: 'phone_number',
              render: (p: string) => p ? <Tag icon={<PhoneOutlined />}>{p}</Tag> : '—',
            },
            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : 'default'}>{s}</Tag> },
          ]}
        />
        )}
      </Card>

      <Modal title="New receptionist" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="first_name" label="First name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone_number"
            label="Phone"
            rules={[
              { required: true },
              { pattern: PHONE_PATTERN, message: 'Use international format e.g. +21612345678' },
            ]}
          >
            <Input placeholder="+21612345678" />
          </Form.Item>
          <Form.Item name="password" label="Temporary password" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={createMut.isPending}>Create account</Button>
        </Form>
      </Modal>
    </PageShell>
  );
}
