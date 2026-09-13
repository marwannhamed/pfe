import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Form, Input, InputNumber, Select, DatePicker, Typography, Row, Col, Statistic, Alert, Tag, Tooltip, Divider, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { contractApi } from '../../api/services';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Mock data - in real app, this would come from API
const mockContractItems = [
  {
    id: '1',
    contractId: 'LC-2024-001',
    itemName: 'Office Space Rental',
    description: 'Monthly rental for executive suite',
    itemType: 'RENT',
    quantity: 1,
    unitPrice: 4200,
    totalPrice: 4200,
    billingCycle: 'MONTHLY',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: '2',
    contractId: 'LC-2024-001',
    itemName: 'Security Deposit',
    description: 'Refundable security deposit',
    itemType: 'DEPOSIT',
    quantity: 1,
    unitPrice: 4200,
    totalPrice: 4200,
    billingCycle: 'ONE_TIME',
    startDate: '2024-01-01',
    endDate: null,
    isActive: true,
  },
  {
    id: '3',
    contractId: 'LC-2024-002',
    itemName: 'Parking Space',
    description: 'Reserved parking spot for 2 vehicles',
    itemType: 'PARKING',
    quantity: 2,
    unitPrice: 150,
    totalPrice: 300,
    billingCycle: 'MONTHLY',
    startDate: '2024-02-01',
    endDate: '2024-12-31',
    isActive: true,
  },
];

const mockDeposits = [
  {
    id: '1',
    contractId: 'LC-2024-001',
    depositType: 'SECURITY',
    amount: 4200,
    status: 'HELD',
    paidDate: '2024-01-01',
    refundDate: null,
    refundConditions: 'Returned at contract end, minus any damages',
    isActive: true,
  },
  {
    id: '2',
    contractId: 'LC-2024-002',
    depositType: 'UTILITY',
    amount: 500,
    status: 'HELD',
    paidDate: '2024-02-01',
    refundDate: null,
    refundConditions: 'Returned after final utility bill settlement',
    isActive: true,
  },
];

const ITEM_TYPES = [
  'RENT', 'DEPOSIT', 'PARKING', 'UTILITIES', 'MAINTENANCE', 'INSURANCE', 'OTHER'
];

const BILLING_CYCLES = [
  'ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL'
];

const DEPOSIT_TYPES = [
  'SECURITY', 'UTILITY', 'KEY', 'EQUIPMENT', 'OTHER'
];

const DEPOSIT_STATUSES = [
  'PAID', 'HELD', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FORFEITED'
];

export default function ContractItemsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [contractItems, setContractItems] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingDeposit, setEditingDeposit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('items');
  const [itemForm] = Form.useForm();
  const [depositForm] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role || '');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const contractsRaw = await contractApi.getAll().then((r) => r.data);
      const contracts = Array.isArray(contractsRaw) ? contractsRaw : [];

      const items = contracts.flatMap((contract: any) => {
        const rawItems =
          (Array.isArray(contract?.items) && contract.items) ||
          (Array.isArray(contract?.contract_items) && contract.contract_items) ||
          [];
        return rawItems.map((item: any) => ({
          id: item.id,
          contractId: contract.id,
          contractNumber: contract.contract_number,
          itemName: item.description || item.item_type || 'Contract Item',
          description: item.description || '',
          itemType: item.item_type || 'OTHER',
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unit_price ?? 0),
          totalPrice: Number(item.total_price ?? Number(item.unit_price ?? 0) * Number(item.quantity ?? 1)),
          billingCycle: 'ONE_TIME',
          startDate: contract.start_date,
          endDate: contract.end_date,
          isActive: true,
        }));
      });

      const depositRows = contracts.flatMap((contract: any) => {
        const deposit = contract?.deposit;
        if (!deposit) return [];
        return [
          {
            id: deposit.id,
            contractId: contract.id,
            contractNumber: contract.contract_number,
            depositType: 'SECURITY',
            amount: Number(deposit.amount ?? 0),
            status: deposit.status || 'HELD',
            paidDate: deposit.paid_at,
            refundDate: deposit.refunded_at,
            refundConditions: deposit.notes || '',
            isActive: true,
          },
        ];
      });

      setContractItems(items.length > 0 ? items : mockContractItems);
      setDeposits(depositRows.length > 0 ? depositRows : mockDeposits);
    } catch {
      message.error('Failed to load contract data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = () => {
    setEditingItem(null);
    itemForm.resetFields();
    setItemModalVisible(true);
  };

  const handleEditItem = (record: any) => {
    message.info('Edit is not available yet for contract items');
  };

  const handleSubmitItem = async (values: any) => {
    try {
      const payload = {
        ...values,
        startDate: values.startDate?.toISOString?.() ?? values.startDate,
        endDate: values.endDate?.toISOString?.() ?? values.endDate,
        totalPrice: values.quantity * values.unitPrice,
      };

      if (editingItem) {
        message.info('Edit is not available yet for contract items');
      } else {
        await contractApi.addItem(payload.contractId, {
          item_type: payload.itemType,
          description: payload.description || payload.itemName,
          quantity: payload.quantity,
          unit_price: payload.unitPrice,
          currency: 'USD',
        });
        message.success('Contract item created successfully');
      }

      setItemModalVisible(false);
      loadData();
    } catch {
      message.error('Failed to save contract item');
    }
  };

  const handleCreateDeposit = () => {
    setEditingDeposit(null);
    depositForm.resetFields();
    setDepositModalVisible(true);
  };

  const handleEditDeposit = (record: any) => {
    message.info('Edit is not available yet for deposits');
  };

  const handleSubmitDeposit = async (values: any) => {
    try {
      const payload = {
        ...values,
        paidDate: values.paidDate?.toISOString?.() ?? values.paidDate,
        refundDate: values.refundDate?.toISOString?.() ?? values.refundDate,
      };

      if (editingDeposit) {
        message.info('Edit is not available yet for deposits');
      } else {
        await contractApi.createDeposit(payload.contractId, {
          amount: payload.amount,
          paid_at: payload.paidDate,
          notes: payload.refundConditions,
          currency: 'USD',
        });
        message.success('Deposit created successfully');
      }

      setDepositModalVisible(false);
      loadData();
    } catch {
      message.error('Failed to save deposit');
    }
  };

  const handleDelete = async (id: string, type: 'item' | 'deposit') => {
    try {
      if (type === 'item') {
        const target = contractItems.find((item) => item.id === id);
        if (!target?.contractId) {
          message.error('Missing contract ID for this item');
          return;
        }
        await contractApi.removeItem(target.contractId, id);
        message.success('Contract item deleted successfully');
      } else {
        const target = deposits.find((deposit) => deposit.id === id);
        if (!target?.contractId) {
          message.error('Missing contract ID for this deposit');
          return;
        }
        if (target.status === 'REFUNDED') {
          message.info('This deposit is already refunded');
          return;
        }
        await contractApi.refundDeposit(target.contractId, {
          refunded_amount: Number(target.amount ?? 0),
          notes: 'Refunded from Contract Items page',
        });
        message.success('Deposit refunded successfully');
      }
      loadData();
    } catch {
      message.error('Failed to delete');
    }
  };

  const getItemTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      RENT: 'blue',
      DEPOSIT: 'green',
      PARKING: 'orange',
      UTILITIES: 'purple',
      MAINTENANCE: 'red',
      INSURANCE: 'cyan',
      OTHER: 'default',
    };
    return colors[type] || 'default';
  };

  const getDepositStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PAID: 'green',
      HELD: 'blue',
      REFUNDED: 'default',
      PARTIALLY_REFUNDED: 'orange',
      FORFEITED: 'red',
    };
    return colors[status] || 'default';
  };

  const itemColumns = [
    {
      title: 'Contract',
      dataIndex: 'contractId',
      key: 'contractId',
      render: (id: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>{id}</Text>
      ),
    },
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      key: 'itemName',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'itemType',
      key: 'itemType',
      render: (type: string) => (
        <Tag color={getItemTypeColor(type)}>{type}</Tag>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price: number) => `$${price.toLocaleString()}`,
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price: number) => (
        <Text strong>${price.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Billing Cycle',
      dataIndex: 'billingCycle',
      key: 'billingCycle',
      render: (cycle: string) => (
        <Tag>{cycle.replace('_', ' ')}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
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
                  onClick={() => handleEditItem(record)}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id, 'item')}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const depositColumns = [
    {
      title: 'Contract',
      dataIndex: 'contractId',
      key: 'contractId',
      render: (id: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>{id}</Text>
      ),
    },
    {
      title: 'Deposit Type',
      dataIndex: 'depositType',
      key: 'depositType',
      render: (type: string) => (
        <Tag color={getItemTypeColor(type)}>{type}</Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <Text strong>${amount.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getDepositStatusColor(status)}>
          {status.replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: 'Paid Date',
      dataIndex: 'paidDate',
      key: 'paidDate',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Refund Date',
      dataIndex: 'refundDate',
      key: 'refundDate',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
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
                  onClick={() => handleEditDeposit(record)}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id, 'deposit')}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const totalMonthlyRevenue = contractItems
    .filter(item => item.billingCycle === 'MONTHLY' && item.isActive)
    .reduce((sum, item) => sum + item.totalPrice, 0);

  const totalDepositsHeld = deposits
    .filter(deposit => deposit.status === 'HELD')
    .reduce((sum, deposit) => sum + deposit.amount, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Contract Items & Deposits
        </Title>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Contract Items"
              value={contractItems.length}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#3f8600'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={totalMonthlyRevenue}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Deposits"
              value={deposits.length}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#722ed1'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Deposits Held"
              value={totalDepositsHeld}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#fa8c16'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view contract items and deposits but need admin privileges to create or edit them."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button
              type={activeTab === 'items' ? 'primary' : 'default'}
              onClick={() => setActiveTab('items')}
              style={{ marginRight: 8 }}
            >
              Contract Items
            </Button>
            <Button
              type={activeTab === 'deposits' ? 'primary' : 'default'}
              onClick={() => setActiveTab('deposits')}
            >
              Deposits
            </Button>
          </div>
          {isBackOffice && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={activeTab === 'items' ? handleCreateItem : handleCreateDeposit}
            >
              Create {activeTab === 'items' ? 'Item' : 'Deposit'}
            </Button>
          )}
        </div>

        {activeTab === 'items' ? (
          <Table
            columns={itemColumns}
            dataSource={contractItems}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} items`,
            }}
          />
        ) : (
          <Table
            columns={depositColumns}
            dataSource={deposits}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} deposits`,
            }}
          />
        )}
      </Card>

      {/* Contract Item Modal */}
      <Modal
        title={editingItem ? 'Edit Contract Item' : 'Create Contract Item'}
        open={itemModalVisible}
        onCancel={() => setItemModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={handleSubmitItem}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractId"
                label="Contract ID"
                rules={[{ required: true, message: 'Please enter contract ID' }]}
              >
                <Input placeholder="e.g., LC-2024-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="itemType"
                label="Item Type"
                rules={[{ required: true, message: 'Please select item type' }]}
              >
                <Select placeholder="Select type">
                  {ITEM_TYPES.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="itemName"
            label="Item Name"
            rules={[{ required: true, message: 'Please enter item name' }]}
          >
            <Input placeholder="e.g., Office Space Rental" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Detailed description..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[{ required: true, message: 'Please enter quantity' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="unitPrice"
                label="Unit Price ($)"
                rules={[{ required: true, message: 'Please enter unit price' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="billingCycle"
                label="Billing Cycle"
                rules={[{ required: true, message: 'Please select billing cycle' }]}
              >
                <Select placeholder="Select cycle">
                  {BILLING_CYCLES.map(cycle => (
                    <Option key={cycle} value={cycle}>{cycle.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="End Date"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingItem ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setItemModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Deposit Modal */}
      <Modal
        title={editingDeposit ? 'Edit Deposit' : 'Create Deposit'}
        open={depositModalVisible}
        onCancel={() => setDepositModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={depositForm}
          layout="vertical"
          onFinish={handleSubmitDeposit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractId"
                label="Contract ID"
                rules={[{ required: true, message: 'Please enter contract ID' }]}
              >
                <Input placeholder="e.g., LC-2024-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="depositType"
                label="Deposit Type"
                rules={[{ required: true, message: 'Please select deposit type' }]}
              >
                <Select placeholder="Select type">
                  {DEPOSIT_TYPES.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="amount"
            label="Amount ($)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  {DEPOSIT_STATUSES.map(status => (
                    <Option key={status} value={status}>{status.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paidDate"
                label="Paid Date"
                rules={[{ required: true, message: 'Please select paid date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="refundDate"
            label="Refund Date"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="refundConditions"
            label="Refund Conditions"
          >
            <TextArea rows={3} placeholder="Conditions for refund..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingDeposit ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setDepositModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
