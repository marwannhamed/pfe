import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Input, Select, DatePicker, Typography, Row, Col, Statistic, Alert, Tag, Tooltip, Descriptions, Timeline, Upload, Badge, Progress, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ToolOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { maintenanceApi } from '../../api/services';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Mock data - in real app, this would come from API
const mockTickets = [
  {
    id: '1',
    ticketNumber: 'MT-2024-001',
    title: 'Air conditioning not working',
    description: 'The AC unit in conference room B is not cooling properly',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'HVAC',
    reportedBy: 'John Doe',
    assignedTo: 'Mike Wilson',
    space: 'Conference Room B',
    site: 'Main Building',
    reportedAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    estimatedCost: 500,
    actualCost: null,
    estimatedCompletion: '2024-01-17',
    attachments: ['ac-photo1.jpg', 'ac-photo2.jpg'],
  },
  {
    id: '2',
    ticketNumber: 'MT-2024-002',
    title: 'Leaking faucet in restroom',
    description: 'Faucet in men\'s restroom on 2nd floor is constantly dripping',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    category: 'Plumbing',
    reportedBy: 'Sarah Smith',
    assignedTo: 'Tom Brown',
    space: 'Men\'s Restroom - 2F',
    site: 'Main Building',
    reportedAt: '2024-01-14T14:30:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    estimatedCost: 200,
    actualCost: 150,
    estimatedCompletion: '2024-01-16',
    attachments: ['faucet-leak.jpg'],
  },
  {
    id: '3',
    ticketNumber: 'MT-2024-003',
    title: 'Broken window in office 301',
    description: 'Window cracked due to storm damage',
    priority: 'LOW',
    status: 'COMPLETED',
    category: 'General',
    reportedBy: 'Mike Johnson',
    assignedTo: 'James Davis',
    space: 'Office 301',
    site: 'Main Building',
    reportedAt: '2024-01-13T16:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    estimatedCost: 300,
    actualCost: 280,
    estimatedCompletion: '2024-01-15',
    attachments: [],
  },
];

const CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'General', 'Security', 'Cleaning', 'IT', 'Other'
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function MaintenanceManagementPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState(mockTickets);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [form] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'MAINTENANCE'].includes(user?.role || '');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await maintenanceApi.getAll();
      setTickets(response.data || []);
    } catch {
      message.error('Failed to load maintenance tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTicket(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingTicket(record);
    form.setFieldsValue({
      ...record,
      reportedAt: dayjs(record.reportedAt),
      estimatedCompletion: record.estimatedCompletion ? dayjs(record.estimatedCompletion) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        reportedAt: values.reportedAt?.toISOString(),
        estimatedCompletion: values.estimatedCompletion?.toISOString(),
      };

      if (editingTicket) {
        await maintenanceApi.update(editingTicket.id, payload);
        message.success('Maintenance ticket updated successfully');
      } else {
        await maintenanceApi.create(payload);
        message.success('Maintenance ticket created successfully');
      }

      setModalVisible(false);
      loadTickets();
    } catch {
      message.error('Failed to save maintenance ticket');
    }
  };

  const handleViewDetails = (record: any) => {
    setSelectedTicket(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await maintenanceApi.remove(id);
      message.success('Maintenance ticket deleted successfully');
      loadTickets();
    } catch {
      message.error('Failed to delete maintenance ticket');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'gold';
      case 'LOW': return 'green';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'red';
      case 'ASSIGNED': return 'orange';
      case 'IN_PROGRESS': return 'blue';
      case 'COMPLETED': return 'green';
      case 'CANCELLED': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return <ExclamationCircleOutlined />;
      case 'ASSIGNED': return <UserOutlined />;
      case 'IN_PROGRESS': return <ClockCircleOutlined />;
      case 'COMPLETED': return <CheckCircleOutlined />;
      default: return <ToolOutlined />;
    }
  };

  const columns = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (number: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>{number}</Text>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{priority}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status.replace('_', ' ')}
        />
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
      title: 'Space',
      dataIndex: 'space',
      key: 'space',
    },
    {
      title: 'Reported',
      dataIndex: 'reportedAt',
      key: 'reportedAt',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {isBackOffice && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const openTickets = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressTickets = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const completedTickets = tickets.filter(t => t.status === 'COMPLETED').length;
  const highPriorityTickets = tickets.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <ToolOutlined style={{ marginRight: 8 }} />
          Maintenance Management
        </Title>
        <Space>
          {isBackOffice && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Create Ticket
            </Button>
          )}
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Open Tickets"
              value={openTickets}
              prefix={<ExclamationCircleOutlined />}
              styles={{ content: { color: '#cf1322'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="In Progress"
              value={inProgressTickets}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Completed"
              value={completedTickets}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="High Priority"
              value={highPriorityTickets}
              prefix={<ToolOutlined />}
              styles={{ content: { color: '#fa8c16'  } }}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view maintenance tickets but need admin privileges to create or edit them."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={tickets}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} tickets`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingTicket ? 'Edit Maintenance Ticket' : 'Create Maintenance Ticket'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Title"
                rules={[{ required: true, message: 'Please enter ticket title' }]}
              >
                <Input placeholder="Brief description of the issue" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  {CATEGORIES.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea
              placeholder="Detailed description of the maintenance issue"
              rows={4}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="Priority"
                rules={[{ required: true, message: 'Please select priority' }]}
              >
                <Select placeholder="Select priority">
                  {PRIORITIES.map(priority => (
                    <Option key={priority} value={priority}>
                      <Tag color={getPriorityColor(priority)}>{priority}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="space"
                label="Space/Location"
                rules={[{ required: true, message: 'Please enter space/location' }]}
              >
                <Input placeholder="e.g., Conference Room B" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="site"
                label="Site"
                rules={[{ required: true, message: 'Please select site' }]}
              >
                <Select placeholder="Select site">
                  <Option value="Main Building">Main Building</Option>
                  <Option value="Annex">Annex</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="estimatedCost"
                label="Estimated Cost ($)"
              >
                <Input
                  type="number"
                  placeholder="0.00"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="estimatedCompletion"
                label="Estimated Completion"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="assignedTo"
                label="Assigned To"
              >
                <Select placeholder="Select technician">
                  <Option value="Mike Wilson">Mike Wilson</Option>
                  <Option value="Tom Brown">Tom Brown</Option>
                  <Option value="James Davis">James Davis</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="status"
            label="Status"
            initialValue="OPEN"
          >
            <Select>
              {STATUSES.map(status => (
                <Option key={status} value={status}>
                  <Space>
                    {getStatusIcon(status)}
                    {status.replace('_', ' ')}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTicket ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Details Modal */}
      <Modal
        title={`Ticket Details: ${selectedTicket?.ticketNumber}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedTicket && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Ticket Number">
                <Text strong style={{ fontFamily: 'monospace' }}>
                  {selectedTicket.ticketNumber}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge
                  status={getStatusColor(selectedTicket.status) as any}
                  text={selectedTicket.status.replace('_', ' ')}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(selectedTicket.priority)}>
                  {selectedTicket.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag color="blue">{selectedTicket.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Reported By">
                {selectedTicket.reportedBy}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To">
                {selectedTicket.assignedTo || 'Unassigned'}
              </Descriptions.Item>
              <Descriptions.Item label="Space">
                {selectedTicket.space}
              </Descriptions.Item>
              <Descriptions.Item label="Site">
                {selectedTicket.site}
              </Descriptions.Item>
              <Descriptions.Item label="Reported At">
                {dayjs(selectedTicket.reportedAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {dayjs(selectedTicket.updatedAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Estimated Cost">
                ${selectedTicket.estimatedCost || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Actual Cost">
                ${selectedTicket.actualCost || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Est. Completion">
                {selectedTicket.estimatedCompletion || 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Title level={5}>Description</Title>
              <Text>{selectedTicket.description}</Text>
            </div>

            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>Attachments</Title>
                <Space>
                  {selectedTicket.attachments.map((file: string, index: number) => (
                    <Tag key={index} icon={<FileTextOutlined />}>
                      {file}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
