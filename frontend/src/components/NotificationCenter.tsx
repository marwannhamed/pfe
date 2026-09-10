import React, { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Dropdown,
  List,
  Typography,
  Space,
  Tag,
  Empty,
  Spin,
  Divider,
  Tooltip,
  Switch,
  Select,
  Card,
  Avatar,
  Row,
  Col,
  Statistic,
} from 'antd';
import type { DropdownProps } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  SettingOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  ToolOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNotifications } from '../hooks/useNotifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

interface NotificationCenterProps {
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const {
    notifications,
    unreadCount,
    stats,
    isConnected,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread' && notification.read) return false;
    if (filter === 'read' && !notification.read) return false;
    if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
    return true;
  });

  const getNotificationIcon = (type: string, priority?: string) => {
    const iconProps = {
      style: {
        color: priority === 'URGENT' ? '#f5222d' : 
               priority === 'HIGH' ? '#faad14' : 
               priority === 'LOW' ? '#52c41a' : '#1890ff',
      },
    };

    switch (type) {
      case 'BOOKING':
        return <CalendarOutlined {...iconProps} />;
      case 'MAINTENANCE':
        return <ToolOutlined {...iconProps} />;
      case 'PAYMENT':
        return <DollarOutlined {...iconProps} />;
      case 'CONTRACT':
        return <FileTextOutlined {...iconProps} />;
      case 'INVOICE':
        return <FileTextOutlined {...iconProps} />;
      default:
        return <InfoCircleOutlined {...iconProps} />;
    }
  };

  const getPriorityTag = (priority?: string) => {
    if (!priority || priority === 'MEDIUM') return null;
    
    const colors = {
      LOW: 'green',
      HIGH: 'orange',
      URGENT: 'red',
    };

    return <Tag color={colors[priority as keyof typeof colors]}>{priority}</Tag>;
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const notificationContent = (
    <div style={{ width: 400, maxHeight: 500, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Title level={5} style={{ margin: 0 }}>
                Notifications
              </Title>
              <Badge count={unreadCount} size="small" />
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title="Settings">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => setShowSettings(!showSettings)}
                />
              </Tooltip>
              <Tooltip title="Mark all as read">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Select
                value={filter}
                onChange={setFilter}
                size="small"
                style={{ width: '100%' }}
              >
                <Option value="all">All</Option>
                <Option value="unread">Unread</Option>
                <Option value="read">Read</Option>
              </Select>
            </Col>
            <Col span={12}>
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                size="small"
                style={{ width: '100%' }}
              >
                <Option value="all">All Types</Option>
                <Option value="BOOKING">Bookings</Option>
                <Option value="MAINTENANCE">Maintenance</Option>
                <Option value="PAYMENT">Payments</Option>
                <Option value="SYSTEM">System</Option>
              </Select>
            </Col>
          </Row>
        </div>
      )}

      {/* Connection Status */}
      {!isConnected && (
        <div style={{ padding: '8px 16px', background: '#fff2f0', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
            <Text type="danger" style={{ fontSize: '12px' }}>
              Connection lost. Reconnecting...
            </Text>
          </Space>
        </div>
      )}

      {/* Notification List */}
      <div style={{ maxHeight: 350, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications"
            style={{ padding: '20px' }}
          />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={(notification) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  background: notification.read ? 'transparent' : '#f6ffed',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onClick={() => !notification.read && markAsRead(notification.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read ? 'transparent' : '#f6ffed';
                }}
                actions={[
                  !notification.read && (
                    <Tooltip title="Mark as read">
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                      />
                    </Tooltip>
                  ),
                  <Tooltip title="Delete">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => handleDelete(notification.id, e)}
                    />
                  </Tooltip>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      icon={getNotificationIcon(notification.type, notification.priority)}
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #d9d9d9',
                      }}
                    />
                  }
                  title={
                    <Space>
                      <Text strong={!notification.read}>
                        {notification.title}
                      </Text>
                      {getPriorityTag(notification.priority)}
                      {!notification.read && (
                        <Badge status="processing" />
                      )}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary">{notification.message}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {dayjs(notification.timestamp).fromNow()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <Button
            type="link"
            size="small"
            onClick={() => loadNotifications({ limit: 50 })}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      menu={{ items: [{
        key: 'notifications',
        label: notificationContent,
      }] }}
      trigger={['click']}
      placement="bottomRight"
      className={className}
    >
      <Badge count={unreadCount} size="small">
        <Button
          type="text"
          icon={
            <BellOutlined
              style={{
                fontSize: '16px',
                color: isConnected ? undefined : '#f5222d',
              }}
            />
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '32px',
            width: '32px',
          }}
        />
      </Badge>
    </Dropdown>
  );
};

// Notification Settings Panel Component
export const NotificationSettings: React.FC = () => {
  const { stats } = useNotifications();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  return (
    <Card title="Notification Settings" size="small">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Title level={5}>Statistics</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Total"
                value={stats?.total || 0}
                prefix={<BellOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Unread"
                value={stats?.unread || 0}
                styles={{ content: { color: '#f5222d'  } }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Read Rate"
                value={stats?.total ? Math.round(((stats.total - stats.unread) / stats.total) * 100) : 0}
                suffix="%"
                prefix={<CheckCircleOutlined />}
              />
            </Col>
          </Row>
        </Col>
        
        <Col span={24}>
          <Divider />
          <Title level={5}>Preferences</Title>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Email Notifications</Text>
              <Switch
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Push Notifications</Text>
              <Switch
                checked={pushNotifications}
                onChange={setPushNotifications}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Sound Effects</Text>
              <Switch
                checked={soundEnabled}
                onChange={setSoundEnabled}
              />
            </div>
          </Space>
        </Col>

        {stats?.byType && stats.byType.length > 0 && (
          <Col span={24}>
            <Divider />
            <Title level={5}>By Type</Title>
            <Space wrap>
              {stats.byType.map((item) => (
                <Tag key={item.type} color="blue">
                  {item.type}: {item.count}
                </Tag>
              ))}
            </Space>
          </Col>
        )}
      </Row>
    </Card>
  );
};
