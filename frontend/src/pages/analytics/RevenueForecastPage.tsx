import { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Statistic, Table, Typography } from 'antd';
import { message } from '../../utils/feedback';
import { LineChartOutlined } from '@ant-design/icons';
import { analyticsApi, tenantApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import { errorMessage } from '../../utils/errors';
import type { RevenueForecast, Tenant } from '../../types';

const { Title, Paragraph } = Typography;

export default function RevenueForecastPage() {
  const { t: th } = usePageTheme();
  const { user } = useAuthStore();
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [horizon, setHorizon] = useState(12);
  const [data, setData] = useState<RevenueForecast | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuper = user?.role === 'SUPER_ADMIN';
  const isFinance = user?.role === 'FINANCE';

  useEffect(() => {
    if (isSuper || isFinance) {
      tenantApi
        .getAll()
        .then((r) => {
          const list = Array.isArray(r.data) ? r.data : (r.data as { data?: Tenant[] })?.data ?? [];
          setTenants(list.map((t) => ({ id: t.id, name: t.name })));
        })
        .catch(() => setTenants([]));
    }
  }, [isSuper, isFinance]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.getRevenueForecast({
        tenantId: tenantId || undefined,
        horizonMonths: horizon,
      });
      setData(((res as { data?: RevenueForecast })?.data ?? res) as RevenueForecast);
    } catch (e) {
      message.error(errorMessage(e, 'Failed to load forecast'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change
  }, [tenantId, horizon]);

  const monthly = (data?.monthly ?? []) as { month: string; activeMrr: number; expiringMrr: number }[];

  return (
    <PageShell>
      <SpaceWithIcon th={th} />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Active MRR (current)"
              value={data?.summary?.activeMonthlyRecurring ?? 0}
              prefix="$"
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Contracts expiring ≤90d"
              value={data?.summary?.expiringNext90DaysContracts ?? 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            {(isSuper || isFinance) && (
              <div style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary">Tenant filter</Typography.Text>
                <Select
                  allowClear
                  placeholder="All tenants"
                  style={{ width: '100%', marginTop: 4 }}
                  value={tenantId}
                  onChange={setTenantId}
                  options={tenants.map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
            )}
            <Typography.Text type="secondary">Horizon (months)</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              value={horizon}
              onChange={setHorizon}
              options={[6, 12, 24, 36].map((m) => ({ value: m, label: String(m) }))}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Monthly recurring vs expiring MRR" loading={loading}>
        <Table
          size="small"
          rowKey="month"
          dataSource={monthly}
          pagination={false}
          columns={[
            { title: 'Month', dataIndex: 'month' },
            { title: 'Active MRR', dataIndex: 'activeMrr', render: (v: number) => `$${v.toLocaleString()}` },
            { title: 'Expiring MRR', dataIndex: 'expiringMrr', render: (v: number) => `$${v.toLocaleString()}` },
          ]}
        />
      </Card>

      <Card title="Contracts expiring soon" style={{ marginTop: 16 }} loading={loading}>
        <Table
          size="small"
          rowKey="id"
          dataSource={data?.expiringSoon ?? []}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Contract', dataIndex: 'contract_number' },
            { title: 'End', dataIndex: 'end_date', render: (d: string) => new Date(d).toLocaleDateString() },
            { title: 'Monthly rent', dataIndex: 'monthly_rent', render: (v: number) => `$${v}` },
            { title: 'Status', dataIndex: 'status' },
          ]}
        />
      </Card>
    </PageShell>
  );
}

function SpaceWithIcon({ th }: { th: ReturnType<typeof usePageTheme>['t'] }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <LineChartOutlined style={{ fontSize: 28, color: 'var(--ant-color-primary)' }} />
      <div>
        <Title level={3} style={{ margin: 0, color: th.text }}>
          Revenue forecasting
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 760 }}>
          Heuristic cashflow view from lease end dates and active monthly rent — not audited financials.
        </Paragraph>
      </div>
    </div>
  );
}
