import { useEffect, useState } from 'react';
import { Card, Select, Space, Table, Tag, Typography, Button } from 'antd';
import { message } from '../../utils/feedback';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import { analyticsApi, siteApi } from '../../api/services';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import { errorMessage } from '../../utils/errors';
import type { PredictiveMaintenanceTicket } from '../../types';

const { Title, Paragraph } = Typography;

export default function PredictiveMaintenancePage() {
  const { t: th } = usePageTheme();
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState<string | undefined>();
  const [rows, setRows] = useState<PredictiveMaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    siteApi
      .getAll()
      .then((list) => {
        const sites = Array.isArray(list) ? list : [];
        setSites(sites.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => setSites([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.getPredictiveMaintenance({
        siteId: siteId || undefined,
      });
      const body = res.data as { tickets?: PredictiveMaintenanceTicket[] };
      setRows(body.tickets ?? []);
    } catch (e) {
      message.error(errorMessage(e, 'Failed to load'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <PageShell>
      <Space align="start" style={{ marginBottom: 16 }}>
        <WarningOutlined style={{ fontSize: 28, color: 'var(--ant-color-primary)' }} />
        <div>
          <Title level={3} style={{ margin: 0, color: th.text }}>
            Predictive maintenance
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 780 }}>
            Heuristic risk scores from ticket recurrence, priority, and optional equipment age / usage fields
            on tickets. Tune by setting <Typography.Text code>equipment_installed_at</Typography.Text> and{' '}
            <Typography.Text code>usage_hours_estimate</Typography.Text> via maintenance API or admin tools.
          </Paragraph>
        </div>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="All sites (tenant scope)"
            style={{ minWidth: 240 }}
            value={siteId}
            onChange={setSiteId}
            options={sites.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Space>
      </Card>

      <Table
        rowKey={(row) => row.ticketId ?? `${row.title}-${row.category}`}
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 12 }}
        columns={[
          { title: 'Ticket', dataIndex: 'title', ellipsis: true },
          { title: 'Category', dataIndex: 'category', width: 120 },
          { title: 'Priority', dataIndex: 'priority', width: 110 },
          {
            title: 'Risk',
            dataIndex: 'riskScore',
            width: 90,
            render: (v: number) => <Tag color={v >= 70 ? 'red' : v >= 45 ? 'orange' : 'green'}>{v}</Tag>,
          },
          { title: 'Band', dataIndex: 'band', width: 100 },
          {
            title: 'Hints',
            dataIndex: 'hints',
            render: (h: string[]) => (h || []).join(' · '),
          },
        ]}
      />
    </PageShell>
  );
}
