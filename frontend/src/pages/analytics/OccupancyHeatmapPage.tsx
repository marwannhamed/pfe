import { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import { message } from '../../utils/feedback';
import { GlobalOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { analyticsApi, siteApi } from '../../api/services';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

type Row = {
  spaceId: string;
  name: string;
  type: string;
  utilization: number;
  heat: string;
  bookedHours: number;
  potentialDeskHours: number;
};

export default function OccupancyHeatmapPage() {
  const { t: th } = usePageTheme();
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState<string>();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    siteApi
      .getAll()
      .then((list) => {
        const sites = Array.isArray(list) ? list : [];
        setSites(sites.map((s: any) => ({ id: s.id, name: s.name })));
        if (!siteId && sites.length === 1) setSiteId(sites[0].id);
      })
      .catch(() => setSites([]));
  }, []);

  const load = async () => {
    if (!siteId) {
      message.warning('Select a site');
      return;
    }
    setLoading(true);
    try {
      const from = range[0].startOf('day').toISOString();
      const to = range[1].endOf('day').toISOString();
      const res = await analyticsApi.getOccupancyHeatmap(siteId, from, to);
      const data = res.data as { spaces?: Row[] };
      setRows(data.spaces ?? []);
    } catch (e: any) {
      message.error(e?.userMessage || e?.message || 'Failed to load heatmap');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const heatColor = (h: string) =>
    h === 'high' ? '#ef4444' : h === 'medium' ? '#f59e0b' : '#22c55e';

  const columns = [
    { title: 'Space', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 140 },
    {
      title: 'Utilization',
      dataIndex: 'utilization',
      key: 'u',
      render: (u: number, r: Row) => (
        <Space>
          <div
            style={{
              width: 120,
              height: 8,
              borderRadius: 4,
              background: '#e5e7eb',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, u * 100)}%`,
                height: '100%',
                background: heatColor(r.heat),
              }}
            />
          </div>
          <Text>{Math.round(u * 100)}%</Text>
          <Tag color={r.heat === 'high' ? 'red' : r.heat === 'medium' ? 'orange' : 'green'}>
            {r.heat}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Booked h / potential',
      key: 'h',
      render: (_: unknown, r: Row) => (
        <Text type="secondary">
          {r.bookedHours} / {r.potentialDeskHours}
        </Text>
      ),
    },
  ];

  return (
    <PageShell>
      <Space align="start" style={{ marginBottom: 16 }}>
        <GlobalOutlined style={{ fontSize: 28, color: 'var(--ant-color-primary)' }} />
        <div>
          <Title level={3} style={{ margin: 0, color: th.text }}>
            Occupancy heatmap
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 760 }}>
            Uses confirmed bookings vs seat capacity over the selected window. Low utilization highlights
            underused desks or rooms; combine with floor map positions for spatial heat (map fields optional).
          </Paragraph>
        </div>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Site"
            style={{ minWidth: 220 }}
            value={siteId}
            onChange={setSiteId}
            options={sites.map((s) => ({ value: s.id, label: s.name }))}
          />
          <RangePicker value={range} onChange={(v) => v && setRange(v as [Dayjs, Dayjs])} />
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={load}>
            Load
          </Button>
        </Space>
      </Card>

      <Table<Row> rowKey="spaceId" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 15 }} />
    </PageShell>
  );
}
