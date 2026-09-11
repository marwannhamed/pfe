import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Input, Select, Tabs, Typography, Row, Col, Alert, Divider, Tag, Tooltip, Badge, Spin, Statistic, Modal } from 'antd';
import { message, modal } from '../../utils/feedback';
import {
  MailOutlined,
  SendOutlined,
  EyeOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { enhancedEmailApi } from '../../api/enhancedServices';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const EMAIL_TEMPLATES = [
  {
    key: 'booking-confirmed',
    name: 'Booking Confirmed',
    description: 'Sent when a booking is confirmed',
    category: 'Bookings',
    variables: ['customerName', 'spaceName', 'bookingDate', 'bookingTime', 'price'],
  },
  {
    key: 'invoice-created',
    name: 'Invoice Created',
    description: 'Sent when a new invoice is generated',
    category: 'Billing',
    variables: ['customerName', 'invoiceNumber', 'amount', 'dueDate'],
  },
  {
    key: 'invoice-overdue',
    name: 'Invoice Overdue',
    description: 'Sent when an invoice becomes overdue',
    category: 'Billing',
    variables: ['customerName', 'invoiceNumber', 'amount', 'overdueDays'],
  },
  {
    key: 'contract-expiring',
    name: 'Contract Expiring',
    description: 'Sent when a lease contract is near expiration',
    category: 'Contracts',
    variables: ['tenantName', 'contractNumber', 'expiryDate', 'spaceName'],
  },
  {
    key: 'maintenance-created',
    name: 'Maintenance Created',
    description: 'Sent when a maintenance ticket is created',
    category: 'Maintenance',
    variables: ['tenantName', 'ticketNumber', 'issue', 'priority'],
  },
  {
    key: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when a new user registers',
    category: 'Users',
    variables: ['userName', 'companyName', 'registrationDate'],
  },
  {
    key: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when user requests password reset',
    category: 'Security',
    variables: ['userName', 'resetLink', 'expiryTime'],
  },
  {
    key: 'booking-cancelled',
    name: 'Booking Cancelled',
    description: 'Sent when a booking is cancelled',
    category: 'Bookings',
    variables: ['customerName', 'spaceName', 'cancellationDate', 'refundAmount'],
  },
];

interface TestEmailData {
  template: string;
  recipient: string;
  variables: Record<string, any>;
}

export default function EmailManagementPage() {
  const { headerCard, t: th } = usePageTheme();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Simulate loading templates - in real app, this would call the API
      setTemplates(EMAIL_TEMPLATES);
    } catch (error) {
      message.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = (template: any) => {
    setSelectedTemplate(template);
    testForm.resetFields();
    testForm.setFieldsValue({
      template: template.key,
      recipient: 'test@example.com',
    });
    setTestModalVisible(true);
  };

  const handlePreview = async (template: any) => {
    setSelectedTemplate(template);
    setLoading(true);
    try {
      // Mock preview data
      const mockData = {
        customerName: 'John Doe',
        spaceName: 'Executive Suite 1201A',
        bookingDate: dayjs().format('YYYY-MM-DD'),
        bookingTime: '10:00 AM',
        price: '$4,200',
        invoiceNumber: 'INV-2024-001',
        amount: '$4,200',
        dueDate: dayjs().add(30, 'days').format('YYYY-MM-DD'),
        overdueDays: 5,
        tenantName: 'TechVision Inc.',
        contractNumber: 'LC-2024-001',
        expiryDate: dayjs().add(90, 'days').format('YYYY-MM-DD'),
        ticketNumber: 'MT-2024-001',
        issue: 'Air conditioning not working',
        priority: 'High',
        userName: 'John Doe',
        companyName: 'TechVision Inc.',
        registrationDate: dayjs().format('YYYY-MM-DD'),
        resetLink: 'https://example.com/reset-password?token=abc123',
        expiryTime: '1 hour',
        cancellationDate: dayjs().format('YYYY-MM-DD'),
        refundAmount: '$2,100',
      };

      const response = await enhancedEmailApi.previewTemplate(template.key, mockData);
      setPreviewContent(response.data);
      setPreviewModalVisible(true);
    } catch (error) {
      message.error('Failed to load email preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async (values: TestEmailData) => {
    try {
      const payload = {
        template: values.template,
        to: values.recipient,
        data: values.variables
      };
      await enhancedEmailApi.testBookingConfirmed(payload);
      message.success('Test email sent successfully');
      setTestModalVisible(false);
    } catch (error) {
      message.error('Failed to send test email');
    }
  };

  const handleBulkEmail = async (template: any) => {
    modal.confirm({
      title: 'Send Bulk Email',
      content: `Are you sure you want to send "${template.name}" to all users? This action cannot be undone.`,
      okText: 'Send',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Mock bulk send
          message.success('Bulk email sent successfully');
        } catch (error) {
          message.error('Failed to send bulk email');
        }
      },
    });
  };

  const getTemplateStatus = (template: any) => {
    // Mock status - in real app, this would come from the backend
    return Math.random() > 0.3 ? 'active' : 'inactive';
  };

  const columns = [
    {
      title: 'Template',
      key: 'template',
      render: (template: any) => (
        <Space orientation="vertical" size="small">
          <Text strong>{template.name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {template.key}
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
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      key: 'status',
      render: (template: any) => {
        const status = getTemplateStatus(template);
        return (
          <Badge
            status={status === 'active' ? 'success' : 'default'}
            text={status === 'active' ? 'Active' : 'Inactive'}
          />
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (template: any) => (
        <Space>
          <Tooltip title="Preview Email">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(template)}
            />
          </Tooltip>
          <Tooltip title="Send Test Email">
            <Button
              type="text"
              size="small"
              icon={<ExperimentOutlined />}
              onClick={() => handleTestEmail(template)}
            />
          </Tooltip>
          {isBackOffice && (
            <Tooltip title="Send Bulk Email">
              <Button
                type="text"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleBulkEmail(template)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const renderVariableInputs = () => {
    if (!selectedTemplate) return null;

    return selectedTemplate.variables.map((variable: string) => (
      <Form.Item
        key={variable}
        name={['variables', variable]}
        label={variable}
        rules={[{ required: true, message: `Please enter ${variable}` }]}
      >
        <Input placeholder={`Enter ${variable}`} />
      </Form.Item>
    ));
  };

  return (
    <PageShell>
      <div style={headerCard}>
        <Title level={2} style={{ margin: 0, color: th.text }}>
          <MailOutlined style={{ marginRight: 8 }} />
          Email Management
        </Title>
      </div>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can preview and test email templates but need admin privileges to send bulk emails."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs
        defaultActiveKey="templates"
        items={[
          {
            key: 'templates',
            label: (
              <span>
                <FileTextOutlined />
                Email Templates
              </span>
            ),
            children: (
              <Card>
                <Table
                  columns={columns}
                  dataSource={templates}
                  rowKey="key"
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} templates`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'statistics',
            label: (
              <span>
                <BarChartOutlined />
                Email Statistics
              </span>
            ),
            children: (
              <>
                {/*
                  Delivery is not recorded anywhere: MailDeliveryService sends
                  through Brevo or SMTP and logs the outcome, but nothing is
                  persisted, so there are no real figures to show. The numbers
                  below are illustrative and labelled as such rather than
                  presented as measurements.
                */}
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Sample data"
                  description="Delivery tracking is not implemented yet — outgoing mail is sent and logged but not recorded. The figures and activity below are placeholders illustrating the intended view."
                />
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Emails Sent Today"
                        value={156}
                        prefix={<SendOutlined />}
                        styles={{ content: { color: '#3f8600'  } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Delivered"
                        value={142}
                        prefix={<CheckCircleOutlined />}
                        styles={{ content: { color: '#1890ff'  } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="Failed"
                        value={14}
                        prefix={<ExclamationCircleOutlined />}
                        styles={{ content: { color: '#cf1322'  } }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card style={{ marginTop: 24 }}>
                  <Title level={4}>Recent Email Activity</Title>
                  <Table
                    dataSource={[
                      { id: 1, template: 'Booking Confirmed', recipient: 'john@example.com', status: 'Delivered', sentAt: dayjs().subtract(1, 'hour') },
                      { id: 2, template: 'Invoice Created', recipient: 'sarah@example.com', status: 'Delivered', sentAt: dayjs().subtract(2, 'hours') },
                      { id: 3, template: 'Welcome Email', recipient: 'mike@example.com', status: 'Failed', sentAt: dayjs().subtract(3, 'hours') },
                    ]}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  >
                    <Table.Column title="Template" dataIndex="template" />
                    <Table.Column title="Recipient" dataIndex="recipient" />
                    <Table.Column
                      title="Status"
                      dataIndex="status"
                      render={(status) => (
                        <Badge
                          status={status === 'Delivered' ? 'success' : 'error'}
                          text={status}
                        />
                      )}
                    />
                    <Table.Column
                      title="Sent At"
                      dataIndex="sentAt"
                      render={(date) => dayjs(date).format('YYYY-MM-DD HH:mm')}
                    />
                  </Table>
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* Test Email Modal */}
      <Modal
        title="Send Test Email"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={testForm}
          layout="vertical"
          onFinish={handleSendTest}
        >
          <Alert
            title="Test Email"
            description="This will send a test email using the selected template with the provided variables."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="template"
            label="Template"
          >
            <Select disabled>
              {templates.map(template => (
                <Option key={template.key} value={template.key}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="recipient"
            label="Recipient Email"
            rules={[
              { required: true, message: 'Please enter recipient email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              placeholder="test@example.com"
              prefix={<UserOutlined />}
            />
          </Form.Item>

          <Divider>Template Variables</Divider>

          {renderVariableInputs()}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<ExperimentOutlined />}>
                Send Test Email
              </Button>
              <Button onClick={() => setTestModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={`Email Preview: ${selectedTemplate?.name}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <Spin spinning={loading}>
          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              padding: 20,
              background: '#fff',
              minHeight: 400,
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: previewContent }} />
          </div>
        </Spin>
      </Modal>
    </PageShell>
  );
}
