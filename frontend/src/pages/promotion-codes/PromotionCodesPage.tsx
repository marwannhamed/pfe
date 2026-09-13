import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Form, Input, InputNumber, Select, DatePicker, Switch, Popconfirm, Tooltip, Typography, Row, Col, Statistic, Alert, Divider, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  GiftOutlined,
  PercentageOutlined,
  DollarOutlined,
  CalendarOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { promotionCodeApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';
import type { PromotionCode, PromotionCodeStats } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

export default function PromotionCodesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [promotionCodes, setPromotionCodes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCode, setEditingCode] = useState<PromotionCode | null>(null);
  const [usageStatsModal, setUsageStatsModal] = useState(false);
  const [selectedCodeStats, setSelectedCodeStats] = useState<PromotionCodeStats | null>(null);
  const [form] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role || '');

  useEffect(() => {
    loadPromotionCodes();
  }, []);

  const loadPromotionCodes = async () => {
    setLoading(true);
    try {
      const response = await promotionCodeApi.getAll();
      setPromotionCodes(response.data || []);
    } catch {
      message.error('Failed to load promotion codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCode(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingCode(record);
    form.setFieldsValue({
      ...record,
      valid_from: record.valid_from ? dayjs(record.valid_from) : null,
      valid_until: record.valid_until ? dayjs(record.valid_until) : null,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        valid_from: values.valid_from?.toISOString(),
        valid_until: values.valid_until?.toISOString(),
      };

      if (editingCode) {
        await promotionCodeApi.update(editingCode.id, payload);
        message.success('Promotion code updated successfully');
      } else {
        await promotionCodeApi.create(payload);
        message.success('Promotion code created successfully');
      }

      setModalVisible(false);
      loadPromotionCodes();
    } catch {
      message.error('Failed to save promotion code');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promotionCodeApi.remove(id);
      message.success('Promotion code deleted successfully');
      loadPromotionCodes();
    } catch {
      message.error('Failed to delete promotion code');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success('Code copied to clipboard');
  };

  const handleViewStats = async (_codeId: string) => {
    try {
      // Mock stats for now - would need to implement getUsageStats in promotionCodeApi
      const stats = { data: { totalUses: 0, totalSavings: 0 } };
      setSelectedCodeStats(stats.data);
      setUsageStatsModal(true);
    } catch {
      message.error('Failed to load usage statistics');
    }
  };

  const getDiscountDisplay = (record) => {
    if (record.type === 'PERCENTAGE') {
      return `${record.discount}%`;
    } else {
      return `$${record.discount}`;
    }
  };

  const getStatusColor = (record) => {
    if (!record.is_active) return 'default';
    if (record.valid_until && dayjs().isAfter(record.valid_until)) return 'error';
    if (record.valid_from && dayjs().isBefore(record.valid_from)) return 'warning';
    if (record.max_uses && record.used_count >= record.max_uses) return 'error';
    return 'success';
  };

  const getStatusText = (record) => {
    if (!record.is_active) return 'Inactive';
    if (record.valid_until && dayjs().isAfter(record.valid_until)) return 'Expired';
    if (record.valid_from && dayjs().isBefore(record.valid_from)) return 'Upcoming';
    if (record.max_uses && record.used_count >= record.max_uses) return 'Fully Used';
    return 'Active';
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Space>
          <Text strong style={{ fontFamily: 'monospace' }}>{code}</Text>
          <Tooltip title="Copy code">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyCode(code)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Discount',
      key: 'discount',
      render: (record) => (
        <Space>
          {record.type === 'PERCENTAGE' ? 
            <PercentageOutlined /> : <DollarOutlined />}
          <Text strong>{getDiscountDisplay(record)}</Text>
        </Space>
      ),
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (record) => (
        <Text>
          {record.used_count || 0} / {record.max_uses || '∞'}
        </Text>
      ),
    },
    {
      title: 'Validity',
      key: 'validity',
      render: (record) => (
        <Space orientation="vertical" size="small">
          {record.valid_from && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              From: {dayjs(record.valid_from).format('YYYY-MM-DD')}
            </Text>
          )}
          {record.valid_until && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              To: {dayjs(record.valid_until).format('YYYY-MM-DD')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record) => (
        <Tag color={getStatusColor(record)}>
          {getStatusText(record)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          <Tooltip title="View Statistics">
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => handleViewStats(record.id)}
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
              <Popconfirm
                title="Are you sure you want to delete this promotion code?"
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const activeCodes = promotionCodes.filter(code => 
    code.is_active && 
    (!code.valid_until || dayjs().isBefore(code.valid_until)) &&
    (!code.valid_from || dayjs().isAfter(code.valid_from))
  );


  const totalUsage = promotionCodes.reduce((sum, code) => sum + (code.used_count || 0), 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <GiftOutlined style={{ marginRight: 8 }} />
          Promotion Codes
        </Title>
        {isBackOffice && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Create Promotion Code
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Codes"
              value={promotionCodes.length}
              prefix={<GiftOutlined />}
              styles={{ content: { color: '#3f8600'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Codes"
              value={activeCodes.length}
              prefix={<PercentageOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Usage"
              value={totalUsage}
              prefix={<BarChartOutlined />}
              styles={{ content: { color: '#722ed1'  } }}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view promotion codes but need admin privileges to create or edit them."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={promotionCodes}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} promotion codes`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingCode ? 'Edit Promotion Code' : 'Create Promotion Code'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="code"
            label="Promotion Code"
            rules={[
              { required: true, message: 'Please enter promotion code' },
              { pattern: /^[A-Z0-9_-]+$/, message: 'Code must contain only uppercase letters, numbers, underscores, and hyphens' },
            ]}
          >
            <Input
              placeholder="e.g., SUMMER2024"
              style={{ fontFamily: 'monospace' }}
              addonBefore={<GiftOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea
              placeholder="Describe the promotion..."
              rows={2}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Discount Type"
                rules={[{ required: true, message: 'Please select discount type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="PERCENTAGE">
                    <Space><PercentageOutlined /> Percentage</Space>
                  </Option>
                  <Option value="FIXED_AMOUNT">
                    <Space><DollarOutlined /> Fixed Amount</Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="discount"
                label="Discount Value"
                rules={[{ required: true, message: 'Please enter discount value' }]}
              >
                <InputNumber
                  placeholder="0"
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value || 0}%`}
                  parser={(value) => {
                    const parsed = value?.replace('%', '');
                    const num = parsed ? Math.min(100, Math.max(0, Number(parsed))) : 0;
                    return num as any;
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="valid_from"
                label="Valid From"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Start date"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="valid_until"
                label="Valid To"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="End date"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_uses"
                label="Maximum Uses"
              >
                <InputNumber
                  placeholder="Unlimited"
                  min={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="min_booking_amount"
                label="Min Booking Amount"
              >
                <InputNumber
                  placeholder="0"
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value || 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => {
                    const parsed = value?.replace(/\$\s?|(,*)/g, '');
                    const num = parsed ? Math.max(0, Number(parsed)) : 0;
                    return num as any;
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label="Active"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCode ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Usage Statistics Modal */}
      <Modal
        title="Usage Statistics"
        open={usageStatsModal}
        onCancel={() => setUsageStatsModal(false)}
        footer={[
          <Button key="close" onClick={() => setUsageStatsModal(false)}>
            Close
          </Button>
        ]}
      >
        {selectedCodeStats && (
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Total Uses"
                  value={selectedCodeStats.totalUses}
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Total Savings"
                  value={selectedCodeStats.totalSavings}
                  prefix={<DollarOutlined />}
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Average Savings"
                  value={selectedCodeStats.averageSavings}
                  prefix={<DollarOutlined />}
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Last Used"
                  value={selectedCodeStats.lastUsed ? 
                    dayjs(selectedCodeStats.lastUsed).format('YYYY-MM-DD') : 
                    'Never'
                  }
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}
