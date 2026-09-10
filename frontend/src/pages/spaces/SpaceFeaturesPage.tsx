import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Input, Select, Switch, Typography, Row, Col, Statistic, Alert, Tag, Tooltip, Upload, Image, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  WifiOutlined,
  CarOutlined,
  CoffeeOutlined,
  MonitorOutlined,
  GlobalOutlined,
  SecurityScanOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  UploadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { spaceFeatureApi } from '../../api/services';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CATEGORIES = [
  'CONNECTIVITY', 'PARKING', 'AMENITY', 'EQUIPMENT', 'SECURITY', 'UTILITY', 'OTHER'
];

const ICON_OPTIONS = [
  { value: 'wifi', label: 'WiFi', icon: <WifiOutlined /> },
  { value: 'car', label: 'Parking', icon: <CarOutlined /> },
  { value: 'coffee', label: 'Coffee', icon: <CoffeeOutlined /> },
  { value: 'monitor', label: 'Equipment', icon: <MonitorOutlined /> },
  { value: 'global', label: 'Internet', icon: <GlobalOutlined /> },
  { value: 'security', label: 'Security', icon: <SecurityScanOutlined /> },
  { value: 'thunderbolt', label: 'Power', icon: <ThunderboltOutlined /> },
];

export default function SpaceFeaturesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [spaceFeatures, setSpaceFeatures] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFeature, setEditingFeature] = useState<any>(null);
  const [form] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    loadSpaceFeatures();
  }, []);

  const loadSpaceFeatures = async () => {
    setLoading(true);
    try {
      const response = await spaceFeatureApi.getAll();
      setSpaceFeatures(response.data || []);
    } catch (error) {
      message.error('Failed to load space features');
      setSpaceFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingFeature(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingFeature(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingFeature) {
        await spaceFeatureApi.update(editingFeature.id, values);
        message.success('Space feature updated successfully');
      } else {
        await spaceFeatureApi.create(values);
        message.success('Space feature created successfully');
      }

      setModalVisible(false);
      loadSpaceFeatures();
    } catch (error) {
      message.error('Failed to save space feature');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await spaceFeatureApi.remove(id);
      message.success('Space feature deleted successfully');
      loadSpaceFeatures();
    } catch (error) {
      message.error('Failed to delete space feature');
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      wifi: <WifiOutlined />,
      car: <CarOutlined />,
      coffee: <CoffeeOutlined />,
      monitor: <MonitorOutlined />,
      global: <GlobalOutlined />,
      security: <SecurityScanOutlined />,
      thunderbolt: <ThunderboltOutlined />,
    };
    return iconMap[iconName] || <MonitorOutlined />;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      CONNECTIVITY: 'blue',
      PARKING: 'green',
      AMENITY: 'orange',
      EQUIPMENT: 'purple',
      SECURITY: 'red',
      UTILITY: 'cyan',
      OTHER: 'default',
    };
    return colors[category] || 'default';
  };

  const columns = [
    {
      title: 'Feature',
      key: 'feature',
      render: (record: any) => (
        <Space>
          <div style={{ fontSize: '18px', color: '#1890ff' }}>
            {getIconComponent(record.icon)}
          </div>
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
    },
    {
      title: 'Availability',
      dataIndex: 'isAvailable',
      key: 'isAvailable',
      render: (isAvailable: boolean) => (
        <Tag color={isAvailable ? 'success' : 'default'}>
          {isAvailable ? 'Available' : 'Unavailable'}
        </Tag>
      ),
    },
    {
      title: 'Spaces',
      dataIndex: 'spaces',
      key: 'spaces',
      render: (spaces: string[]) => (
        <div>
          <Text strong>{spaces.length} spaces</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {spaces.slice(0, 2).join(', ')}
            {spaces.length > 2 && ` +${spaces.length - 2} more`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Sites',
      dataIndex: 'sites',
      key: 'sites',
      render: (sites: string[]) => (
        <Space wrap>
          {sites.map(site => (
            <Tag key={site}>{site}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
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

  const availableFeatures = spaceFeatures.filter(f => f.isAvailable).length;
  const totalSpaces = [...new Set(spaceFeatures.flatMap(f => f.spaces))].length;
  const categoriesCovered = [...new Set(spaceFeatures.map(f => f.category))].length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <MonitorOutlined style={{ marginRight: 8 }} />
          Space Features Management
        </Title>
        {isBackOffice && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Add Feature
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Features"
              value={spaceFeatures.length}
              prefix={<MonitorOutlined />}
              styles={{ content: { color: '#3f8600'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Available Features"
              value={availableFeatures}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Categories Covered"
              value={categoriesCovered}
              prefix={<GlobalOutlined />}
              styles={{ content: { color: '#722ed1'  } }}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view space features but need admin privileges to create or edit them."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={spaceFeatures}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} features`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingFeature ? 'Edit Space Feature' : 'Create Space Feature'}
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
            name="name"
            label="Feature Name"
            rules={[{ required: true, message: 'Please enter feature name' }]}
          >
            <Input placeholder="e.g., High-Speed WiFi" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={3} placeholder="Detailed description of the feature..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  {CATEGORIES.map(category => (
                    <Option key={category} value={category}>{category}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="icon"
                label="Icon"
                rules={[{ required: true, message: 'Please select icon' }]}
              >
                <Select placeholder="Select icon">
                  {ICON_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                      <Space>
                        {option.icon}
                        {option.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isAvailable"
            label="Available"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="sites"
            label="Sites"
            rules={[{ required: true, message: 'Please select at least one site' }]}
          >
            <Select mode="multiple" placeholder="Select sites">
              <Option value="Main Building">Main Building</Option>
              <Option value="Annex">Annex</Option>
              <Option value="Remote Location">Remote Location</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="spaces"
            label="Spaces"
            rules={[{ required: true, message: 'Please select at least one space' }]}
          >
            <Select mode="multiple" placeholder="Select spaces">
              <Option value="Executive Suite 1201A">Executive Suite 1201A</Option>
              <Option value="Conference Room B">Conference Room B</Option>
              <Option value="Office 301">Office 301</Option>
              <Option value="Meeting Room A">Meeting Room A</Option>
              <Option value="Office 205">Office 205</Option>
              <Option value="Server Room">Server Room</Option>
              <Option value="All Spaces">All Spaces</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingFeature ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
