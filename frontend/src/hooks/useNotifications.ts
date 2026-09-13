import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { App } from 'antd';
import { useAuthStore } from '../store/authStore';
import { notificationApi } from '../api/services';
import { API_BASE_URL } from '../api/client';

interface Notification {
  id: string;
  type: 'BOOKING' | 'MAINTENANCE' | 'PAYMENT' | 'SYSTEM' | 'CONTRACT' | 'INVOICE';
  title: string;
  message: string;
  data?: any;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  timestamp: string;
  read: boolean;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Array<{ type: string; count: number }>;
}

export const useNotifications = () => {
  const { message } = App.useApp();
  const { user, access_token } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // ─── FIX: stable refs so useEffect deps never change ──────────────────────
  // Storing user in a ref prevents loadNotifications/loadStats from being
  // recreated on every render, which was causing the useEffect below to
  // re-fire and hammer the API (→ 429s).
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ─── WebSocket connection ──────────────────────────────────────────────────
  // FIX: added access_token to deps (was missing) and kept user.id stable via ref.
  useEffect(() => {
    if (!user?.id || !access_token) return;

    const socketBase = API_BASE_URL || window.location.origin;
    const socket = io(`${socketBase}/notifications`, {
      auth: { token: access_token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('authenticated', () => {
      const currentUser = userRef.current;
      if (!currentUser) return;

      socket.emit('join-room', { room: `user_${currentUser.id}` });
      if (currentUser.tenant_id) {
        socket.emit('join-room', { room: `tenant_${currentUser.tenant_id}` });
      }
      socket.emit('join-room', { room: `role_${currentUser.role}` });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
        });
      }

      if (notification.priority === 'HIGH' || notification.priority === 'URGENT') {
        const msgType = notification.priority === 'URGENT' ? 'error' : 'warning';
        message[msgType](notification.title);
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, access_token, message]); // FIX: depend on user.id (primitive) not the whole user object

  // ─── Load notifications ────────────────────────────────────────────────────
  // FIX: removed `user` from useCallback deps — access via ref instead.
  // This keeps the function reference stable across renders so it never
  // triggers the initialization useEffect below more than once.
  const loadNotifications = useCallback(async (options?: {
    unread?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!userRef.current) return;

    setLoading(true);
    try {
      const response = await notificationApi.getAll(options);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      message.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [message]); // otherwise stable — App.useApp()'s message never changes

  // ─── Load stats ───────────────────────────────────────────────────────────
  // FIX: same pattern — use ref, empty dep array keeps reference stable.
  const loadStats = useCallback(async () => {
    if (!userRef.current) return;

    try {
      const response = await notificationApi.getStats();
      setStats(response.data);
      setUnreadCount(response.data.unread || 0);
    } catch (error) {
      console.error('Failed to load notification stats:', error);
    }
  }, []); // stable — no deps needed

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationApi.markRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      socketRef.current?.emit('mark-read', { notificationId });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      message.error('Failed to mark notification as read');
    }
  }, [message]);

  // ─── Mark all as read ─────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead(userRef.current?.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      message.error('Failed to mark all notifications as read');
    }
  }, [message]); // FIX: was [user?.id] — now reads from ref, keeping reference stable

  // ─── Delete notification ──────────────────────────────────────────────────
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationApi.remove(notificationId);
      setNotifications(prev => {
        const target = prev.find(n => n.id === notificationId);
        if (target && !target.read) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== notificationId);
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      message.error('Failed to delete notification');
    }
  }, [message]); // FIX: was [notifications] — caused new fn ref on every list change

  // ─── Room helpers ─────────────────────────────────────────────────────────
  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit('join-room', { room });
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit('leave-room', { room });
  }, []);

  // ─── Initialization ───────────────────────────────────────────────────────
  // FIX: was [user, loadNotifications, loadStats].
  // loadNotifications and loadStats are now stable (empty dep arrays), so
  // including them was harmless but misleading. The real problem was that
  // previously they depended on `user`, got recreated whenever user changed,
  // and triggered this effect repeatedly — causing a flood of API requests.
  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      loadStats();
    }
  }, [user?.id, loadNotifications, loadStats]); // only re-runs when the user's identity actually changes

  return {
    notifications,
    unreadCount,
    stats,
    isConnected,
    loading,
    loadNotifications,
    loadStats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    joinRoom,
    leaveRoom,
  };
};