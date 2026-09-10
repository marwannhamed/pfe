import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Select,
  DatePicker,
  Spin,
  Alert,
  Table,
  Progress,
  Tag,
  Space,
  Tooltip,
  Button,
  Dropdown,
  Menu,
} from 'antd';
import {
  LineChart,
  Line,
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
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  HomeOutlined,
  ToolOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FilterOutlined,
  BarChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { analyticsApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

export default function AnalyticsDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [overview, setOverview] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [bookingsTrend, setBookingsTrend] = useState<any[]>([]);
  const [bookingStatus, setBookingStatus] = useState<any[]>([]);
  const [spaceUtilization, setSpaceUtilization] = useState<any[]>([]);
  const [topSpaces, setTopSpaces] = useState<any[]>([]);
  const [revenueByTenant, setRevenueByTenant] = useState<any[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<any>(null);

  const isAdmin = ['SUPER_ADMIN', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [from, to] = dateRange;
      const fromStr = from.toISOString();
      const toStr = to.toISOString();

      const [
        overviewData,
        revenueData,
        bookingsData,
        statusData,
        utilizationData,
        topSpacesData,
        tenantRevenueData,
        maintenanceData,
      ] = await Promise.all([
        analyticsApi.getOverview(fromStr, toStr),
        analyticsApi.getRevenueTrend(fromStr, toStr),
        analyticsApi.getBookingsTrend(fromStr, toStr),
        analyticsApi.getBookingStatus(fromStr, toStr),
        analyticsApi.getSpaceUtil(),
        analyticsApi.getTopSpaces(fromStr, toStr),
        analyticsApi.getRevenueByTenant(fromStr, toStr),
        analyticsApi.getMaintenance(fromStr, toStr),
      ]);

      setOverview(overviewData.data);
      setRevenueTrend(revenueData.data || []);
      setBookingsTrend(bookingsData.data || []);
      setBookingStatus(statusData.data || []);
      setSpaceUtilization(utilizationData.data || []);
      setTopSpaces(topSpacesData.data || []);
      setRevenueByTenant(tenantRevenueData.data || []);
      setMaintenanceStats(maintenanceData.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? (
      <ArrowUpOutlined style={{ color: '#52c41a' }} />
    ) : (
      <ArrowDownOutlined style={{ color: '#f5222d' }} />
    );
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? '#52c41a' : '#f5222d';
  };

  const handleExport = (type: string) => {
    // Implementation for exporting data
    console.log(`Exporting ${type} data`);
  };

  const exportMenuItems = [
    {
      key: 'excel',
      icon: <DownloadOutlined />,
      label: 'Export to Excel',
      onClick: () => handleExport('excel'),
    },
    {
      key: 'pdf',
      icon: <DownloadOutlined />,
      label: 'Export to PDF',
      onClick: () => handleExport('pdf'),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>
          <Text>Loading analytics data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Analytics Dashboard
          </Title>
          <Text type="secondary">
            Comprehensive insights into your office lease management platform
          </Text>
        </div>
        <Space>
          <RangePicker
            value={dateRange as [dayjs.Dayjs, dayjs.Dayjs]}
            onChange={setDateRange}
            format="YYYY-MM-DD"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAnalytics}
            loading={loading}
          >
            Refresh
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button icon={<DownloadOutlined />}>
              Export
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={overview?.revenue?.current || 0}
              precision={2}
              prefix={<DollarOutlined />}
              formatter={(value) => formatCurrency(Number(value))}
              suffix={
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getChangeIcon(overview?.revenue?.change || 0)}
                  <Text style={{ color: getChangeColor(overview?.revenue?.change || 0) }}>
                    {Math.abs(overview?.revenue?.change || 0)}%
                  </Text>
                </div>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Bookings"
              value={overview?.bookings?.current || 0}
              prefix={<CalendarOutlined />}
              suffix={
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getChangeIcon(overview?.bookings?.change || 0)}
                  <Text style={{ color: getChangeColor(overview?.bookings?.change || 0) }}>
                    {Math.abs(overview?.bookings?.change || 0)}%
                  </Text>
                </div>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Tenants"
              value={overview?.activeTenants || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Occupancy Rate"
              value={overview?.occupancyRate?.current || 0}
              precision={1}
              suffix="%"
              prefix={<HomeOutlined />}
            />
            <Progress
              percent={overview?.occupancyRate?.current || 0}
              showInfo={false}
              strokeColor="#1890ff"
              style={{ marginTop: '8px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue Trend" extra={<BarChartOutlined />}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Bookings Trend" extra={<BarChartOutlined />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#52c41a"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Booking Status Distribution" extra={<PieChartOutlined />}>
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
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Space Utilization by Type">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={spaceUtilization}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="occupied" stackId="a" fill="#52c41a" />
                <Bar dataKey="available" stackId="a" fill="#1890ff" />
                <Bar dataKey="maintenance" stackId="a" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Tables Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Spaces" extra={<Text type="secondary">By bookings</Text>}>
            <Table
              rowKey={(row) => row.id ?? row.spaceId ?? `${row.name ?? 'space'}-${row.count ?? 0}`}
              dataSource={topSpaces}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Space Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Type',
                  dataIndex: 'type',
                  key: 'type',
                  render: (type: string) => (
                    <Tag color="blue">{type}</Tag>
                  ),
                },
                {
                  title: 'Bookings',
                  dataIndex: 'count',
                  key: 'count',
                  sorter: (a, b) => a.count - b.count,
                },
                {
                  title: 'Revenue',
                  dataIndex: 'revenue',
                  key: 'revenue',
                  render: (revenue: number) => formatCurrency(revenue),
                  sorter: (a, b) => a.revenue - b.revenue,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Revenue by Tenant" extra={<Text type="secondary">Top performers</Text>}>
            <Table
              rowKey={(row) => row.id ?? row.tenantId ?? `${row.name ?? 'tenant'}-${row.revenue ?? 0}`}
              dataSource={revenueByTenant}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Tenant Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Revenue',
                  dataIndex: 'revenue',
                  key: 'revenue',
                  render: (revenue: number) => formatCurrency(revenue),
                  sorter: (a, b) => a.revenue - b.revenue,
                },
                {
                  title: 'Performance',
                  key: 'performance',
                  render: (_, record) => {
                    const maxRevenue = Math.max(...revenueByTenant.map(t => t.revenue));
                    const percentage = (record.revenue / maxRevenue) * 100;
                    return <Progress percent={percentage} showInfo={false} />;
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Maintenance Stats */}
      {isAdmin && maintenanceStats && (
        <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
          <Col xs={24}>
            <Card title="Maintenance Statistics" extra={<ToolOutlined />}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total Tickets"
                    value={maintenanceStats.total}
                    prefix={<ToolOutlined />}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Open Tickets"
                    value={maintenanceStats.byStatus?.find((s: any) => s.status === 'OPEN')?.count || 0}
                    styles={{ content: { color: '#faad14' } }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Avg Resolution Time"
                    value={maintenanceStats.avgResolutionHours}
                    suffix="hours"
                    precision={1}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
