import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../api/client';
import { message } from '../utils/feedback';
import type { Notification } from '../types';

/**
 * Keeps the notification bell live.
 *
 * The bell owns its data through TanStack Query; this hook does not hold a
 * second copy of it. A pushed notification simply invalidates those queries,
 * so one code path renders the list whether it arrived by poll or by socket.
 *
 * Returns the connection state so the UI can say whether it is live. Polling
 * stays on as a slower fallback: if the socket is down, the bell still updates.
 */
export function useNotificationSocket() {
  const qc = useQueryClient();
  const { user, access_token } = useAuthStore();
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId || !access_token) return;

    // Empty API_BASE_URL means same-origin (the Docker/nginx setup), where the
    // socket rides the page's own origin.
    const base = API_BASE_URL || window.location.origin;
    const socket = io(`${base}/notifications`, {
      auth: { token: access_token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-preview'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('connect', () => setIsLive(true));
    socket.on('disconnect', () => setIsLive(false));
    socket.on('connect_error', () => setIsLive(false));

    socket.on('notification', (n: Partial<Notification>) => {
      refresh();
      // Only interrupt for things that actually need attention; everything
      // else is visible on the bell without a popup.
      if (n?.priority === 'URGENT' || n?.priority === 'HIGH') {
        const notify = n.priority === 'URGENT' ? message.error : message.warning;
        notify(n.title ?? 'New notification');
      }
    });

    // Another device (or tab) marked something read — recount here too.
    socket.on('notification-read', refresh);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsLive(false);
    };
    // access_token changes on refresh, which must rebuild the authenticated
    // socket; qc is stable from the provider.
  }, [userId, access_token, qc]);

  return { isLive };
}
