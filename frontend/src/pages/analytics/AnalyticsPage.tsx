import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Table,
  Progress,
  Tag,
  Typography,
  Space,
  Button,
  Divider,
  Alert,
  Spin,
  Empty,
} from 'antd';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarOutlined,
  CalendarOutlined,
  HomeOutlined,
  ToolOutlined,
  TrophyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { analyticsApi, exportApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import { AnalyticsOverview, BookingsTrend, RevenueTrend, BookingStatusData, SpaceUtilization, AnalyticsMaintenance, TopSpace, RevenueByTenant } from '../../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** /analytics/maintenance reports counts per status rather than named fields. */
function countByStatus(stats: AnalyticsMaintenance, status: string): number {
  return stats.byStatus.find((s) => s.status === status)?.count ?? 0;
}

export default function AnalyticsPage() {
  const { t: th } = usePageTheme();
  const { user } = useAuthStore();
  const isPortalTenant = user?.role === 'TENANT_ADMIN' || user?.role === 'TENANT_EMPLOYEE';
  const tenantScope = isPortalTenant ? user?.tenant_id : undefined;
  const showLandlordCharts = !isPortalTenant;
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([]);
  const [bookingStatus, setBookingStatus] = useState<BookingStatusData[]>([]);
  const [spaceUtilization, setSpaceUtilization] = useState<SpaceUtilization[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<AnalyticsMaintenance | null>(null);
  const [topSpaces, setTopSpaces] = useState<TopSpace[]>([]);
  const [revenueByTenant, setRevenueByTenant] = useState<RevenueByTenant[]>([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [from, to] = dateRange;
      const fromStr = from.format('YYYY-MM-DD');
      const toStr = to.format('YYYY-MM-DD');

      const [
        overviewRes,
        revenueRes,
        bookingRes,
        utilizationRes,
        maintenanceRes,
        topSpacesRes,
        revenueTenantRes,
      ] = await Promise.all([
        analyticsApi.getOverview(fromStr, toStr, tenantScope),
        analyticsApi.getRevenueTrend(fromStr, toStr, tenantScope),
        analyticsApi.getBookingStatus(fromStr, toStr, tenantScope),
        showLandlordCharts ? analyticsApi.getSpaceUtil() : Promise.resolve({ data: [] }),
        analyticsApi.getMaintenance(fromStr, toStr, tenantScope),
        analyticsApi.getTopSpaces(fromStr, toStr, tenantScope),
        showLandlordCharts
          ? analyticsApi.getRevenueByTenant(fromStr, toStr)
          : Promise.resolve({ data: [] }),
      ]);

      setOverview(overviewRes.data);
      setRevenueTrend(revenueRes.data);
      setBookingStatus(bookingRes.data);
      setSpaceUtilization(utilizationRes.data ?? []);
      setMaintenanceStats(maintenanceRes.data);
      setTopSpaces(topSpacesRes.data);
      setRevenueByTenant(revenueTenantRes.data ?? []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, showLandlordCharts, tenantScope]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = async (type: string, format: 'xlsx' | 'csv') => {
    try {
      const [from, to] = dateRange;
      const params = {
        from: from.format('YYYY-MM-DD'),
        to: to.format('YYYY-MM-DD'),
      };

      let response;
      switch (type) {
        case 'bookings':
          response = await exportApi.bookings(format, params);
          break;
        case 'invoices':
          response = await exportApi.invoices(format, params);
          break;
        case 'spaces':
          response = await exportApi.spaces(format);
          break;
        case 'maintenance':
          response = await exportApi.maintenance(format, params);
          break;
        default:
          return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-analytics.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'MAINTENANCE'].includes(user?.role || '');

  const bookingStatusColumns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          CONFIRMED: 'green',
          PENDING_APPROVAL: 'orange',
          CANCELLED: 'red',
          COMPLETED: 'blue',
        };
        return <Tag color={colorMap[status] || 'default'}>{status.replace('_', ' ')}</Tag>;
      },
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text strong>{count}</Text>,
    },
    {
      title: 'Percentage',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => (
        <Progress percent={percentage} size="small" />
      ),
    },
  ];

  const topSpacesColumns = [
    {
      // The endpoint groups by space name and returns `count`, not
      // spaceName/bookings — both columns rendered blank before.
      title: 'Space',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Bookings',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Text strong>{count}</Text>,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: string) => <Text strong>${revenue}</Text>,
    },
  ];

  if (loading && !overview) {
    return (
      <PageShell>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Spin size="large" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0, color: th.text }}>
          <RiseOutlined style={{ marginRight: 8 }} />
          Analytics Dashboard
        </Title>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates)}
            format="YYYY-MM-DD"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAnalytics}
            loading={loading}
          >
            Refresh
          </Button>
          {isBackOffice && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleExport('bookings', 'xlsx')}
            >
              Export Data
            </Button>
          )}
        </Space>
      </div>

      {!overview ? (
        <Card>
          <Empty description="No analytics data available" />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Revenue"
                  value={overview.revenue?.current ?? 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  styles={{ content: { color: '#3f8600'  } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Bookings"
                  value={overview.bookings?.current ?? 0}
                  prefix={<CalendarOutlined />}
                  styles={{ content: { color: '#1890ff'  } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Active Spaces"
                  value={overview.occupancyRate?.total ?? 0}
                  prefix={<HomeOutlined />}
                  styles={{ content: { color: '#722ed1'  } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Occupancy Rate"
                  value={overview.occupancyRate?.current ?? 0}
                  suffix="%"
                  prefix={<TrophyOutlined />}
                  styles={{ content: { color: '#eb2f96'  } }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={16}>
              <Card title="Revenue Trend" extra={<Text type="secondary">Last 30 days</Text>}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Booking Status">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={bookingStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {bookingStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="Booking Status Breakdown">
                <Table
                  columns={bookingStatusColumns}
                  dataSource={bookingStatus}
                  rowKey={(row) => `${row.status}-${row.count ?? 0}`}
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Top Performing Spaces">
                <Table
                  columns={topSpacesColumns}
                  dataSource={topSpaces}
                  rowKey={(row) => row.name}
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Space Utilization" extra={<ToolOutlined />}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={spaceUtilization.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`, 'Utilization']} />
                    <Bar dataKey="rate" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Maintenance Statistics">
                {maintenanceStats && (
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Statistic
                        title="Open Tickets"
                        value={countByStatus(maintenanceStats, 'OPEN')}
                        styles={{ content: { color: '#cf1322'  } }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="Resolved"
                        value={countByStatus(maintenanceStats, 'RESOLVED')}
                        styles={{ content: { color: '#3f8600'  } }}
                      />
                    </Col>
                    <Col span={24}>
                      <Text type="secondary">
                        Avg. Resolution Time: {maintenanceStats.avgResolutionHours}h
                      </Text>
                    </Col>
                  </Row>
                )}
              </Card>
            </Col>
          </Row>

          {isBackOffice && revenueByTenant.length > 0 && (
            <>
              <Divider />
              <Card title="Revenue by Tenant">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueByTenant}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </>
      )}

      {!isBackOffice && (
        <Alert
          title="Limited Analytics View"
          description="Contact your administrator for access to comprehensive analytics and export features."
          type="info"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}
    </PageShell>
  );
}
