import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Select, DatePicker, Typography, Row, Col, Statistic, Alert, Divider, Tag, Tooltip, Input, Switch, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  BarChartOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { enhancedReportApi } from '../../api/enhancedServices';
import { useAuthStore } from '../../store/authStore';
import { Report } from '../../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const REPORT_TEMPLATES = [
  {
    key: 'booking-summary',
    name: 'Booking Summary Report',
    description: 'Comprehensive overview of all bookings within a date range',
    category: 'Bookings',
    formats: ['PDF', 'Excel', 'CSV'],
    parameters: [
      { name: 'dateRange', type: 'dateRange', required: true, label: 'Date Range' },
      { name: 'siteId', type: 'select', required: false, label: 'Site' },
      { name: 'status', type: 'select', required: false, label: 'Booking Status' },
    ],
  },
  {
    key: 'financial-summary',
    name: 'Financial Summary Report',
    description: 'Detailed financial analysis including revenue, expenses, and profit',
    category: 'Finance',
    formats: ['PDF', 'Excel'],
    parameters: [
      { name: 'dateRange', type: 'dateRange', required: true, label: 'Date Range' },
      { name: 'includeInvoices', type: 'switch', required: false, label: 'Include Invoice Details' },
      { name: 'groupBy', type: 'select', required: false, label: 'Group By' },
    ],
  },
  {
    key: 'occupancy-analysis',
    name: 'Occupancy Analysis Report',
    description: 'Space utilization and occupancy trends analysis',
    category: 'Analytics',
    formats: ['PDF', 'Excel'],
    parameters: [
      { name: 'dateRange', type: 'dateRange', required: true, label: 'Date Range' },
      { name: 'siteId', type: 'select', required: false, label: 'Site' },
      { name: 'groupBy', type: 'select', required: false, label: 'Group By' },
    ],
  },
];

/**
 * The list endpoint has been seen returning either naming convention, which is
 * why loadReports reads each field twice. The rows held in state are the
 * normalised result, not the shared Report entity.
 */
type RawReport = Record<string, unknown> & {
  title?: string;      name?: string;
  created_at?: string; createdAt?: string;
  type?: string;       reportType?: string;
  format?: string;     status?: string;
};

type ReportRow = RawReport & {
  name?: string;
  createdAt?: string;
  reportType?: string;
};

interface ReportRequest {
  type: string;
  parameters: Record<string, unknown>;
  format: string;
}

export default function ReportGenerationPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<(typeof REPORT_TEMPLATES)[number] | null>(null);
  const [form] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role || '');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const list = await enhancedReportApi.getAll();
      const normalized = ((Array.isArray(list) ? list : []) as RawReport[]).map((r) => ({
        ...r,
        name: r.title ?? r.name,
        createdAt: r.created_at ?? r.createdAt,
        reportType: r.type ?? r.reportType,
      }));
      setReports(normalized);
    } catch {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (template) => {
    setSelectedTemplate(template);
    form.resetFields();
    form.setFieldsValue({
      type: template.key,
      format: template.formats[0],
    });
    setGenerateModalVisible(true);
  };

  const handleSubmitGenerate = async (values: ReportRequest) => {
    try {
      setLoading(true);
      await enhancedReportApi.generate(values);
      message.success('Report generation started successfully');
      setGenerateModalVisible(false);
      loadReports();
    } catch {
      message.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId: string) => {
    try {
      const blob = await enhancedReportApi.download(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Report downloaded successfully');
    } catch {
      message.error('Failed to download report');
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await enhancedReportApi.remove(reportId);
      message.success('Report deleted successfully');
      loadReports();
    } catch {
      message.error('Failed to delete report');
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': return 'processing';
      case 'FAILED': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf': return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'excel': return <FileExcelOutlined style={{ color: '#52c41a' }} />;
      case 'csv': return <FileTextOutlined style={{ color: '#1890ff' }} />;
      default: return <FileTextOutlined />;
    }
  };

  const renderParameterInputs = () => {
    if (!selectedTemplate) return null;

    return selectedTemplate.parameters.map((param) => {
      switch (param.type) {
        case 'dateRange':
          return (
            <Form.Item
              key={param.name}
              name={['parameters', param.name]}
              label={param.label}
              rules={param.required ? [{ required: true, message: `Please select ${param.label}` }] : []}
            >
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          );
        case 'select':
          return (
            <Form.Item
              key={param.name}
              name={['parameters', param.name]}
              label={param.label}
            >
              <Select placeholder={`Select ${param.label}`}>
                <Option value="all">All</Option>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
              </Select>
            </Form.Item>
          );
        case 'switch':
          return (
            <Form.Item
              key={param.name}
              name={['parameters', param.name]}
              label={param.label}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          );
        default:
          return (
            <Form.Item
              key={param.name}
              name={['parameters', param.name]}
              label={param.label}
            >
              <Input />
            </Form.Item>
          );
      }
    });
  };

  const templateColumns = [
    {
      title: 'Template',
      key: 'template',
      render: (template) => (
        <Space orientation="vertical" size="small">
          <Text strong>{template.name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {template.description}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="blue">{category}</Tag>
      ),
    },
    {
      title: 'Formats',
      key: 'formats',
      render: (template) => (
        <Space>
          {template.formats.map((format: string) => (
            <Tooltip key={format} title={format}>
              {getFormatIcon(format)}
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (template) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleGenerateReport(template)}
          disabled={!isBackOffice}
        >
          Generate
        </Button>
      ),
    },
  ];

  const reportColumns = [
    {
      title: 'Report Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ReportRow) => (
        <Space orientation="vertical" size="small">
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.reportType || 'N/A'} • {record.format || 'PDF'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getReportStatusColor(status || 'PENDING')}>
          {status || 'PENDING'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          {record.status === 'COMPLETED' && (
            <Tooltip title="Download">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record.id)}
              />
            </Tooltip>
          )}
          {isBackOffice && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const completedReports = reports.filter(r => r.status === 'COMPLETED').length;
  const processingReports = reports.filter(r => r.status === 'PROCESSING').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Report Generation
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadReports}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view and download reports but need admin privileges to generate new reports."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Reports"
              value={reports.length}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#3f8600'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed"
              value={completedReports}
              prefix={<DownloadOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Processing"
              value={processingReports}
              prefix={<ReloadOutlined />}
              styles={{ content: { color: '#722ed1'  } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Report Templates" style={{ height: '100%' }}>
            <Table
              columns={templateColumns}
              dataSource={REPORT_TEMPLATES}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Reports" style={{ height: '100%' }}>
            <Table
              columns={reportColumns}
              dataSource={reports.slice(0, 5)}
              rowKey={(row: { id?: string; title?: string; created_at?: string }) =>
                row.id ?? `${row.title ?? 'report'}-${row.created_at ?? ''}`}
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* Generate Report Modal */}
      <Modal
        title={`Generate Report: ${selectedTemplate?.name}`}
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitGenerate}
        >
          <Alert
            title="Report Generation"
            description="Configure the report parameters below. The report will be generated in the background."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="type"
            label="Report Type"
          >
            <Select disabled>
              {REPORT_TEMPLATES.map(template => (
                <Option key={template.key} value={template.key}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="format"
            label="Output Format"
            rules={[{ required: true, message: 'Please select output format' }]}
          >
            <Select>
              {selectedTemplate?.formats.map((format: string) => (
                <Option key={format} value={format}>
                  <Space>
                    {getFormatIcon(format)}
                    {format}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Report Parameters</Divider>

          {renderParameterInputs()}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Generate Report
              </Button>
              <Button onClick={() => setGenerateModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
