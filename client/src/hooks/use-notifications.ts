import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

export interface Notification {
  id: string;
  userId?: string;
  type: 'deadline' | 'invoice' | 'budget' | 'communication' | 'onedrive' | 'info' | 'warning' | 'error' | 'task_assigned' | 'task_completed';
  title: string;
  message: string;
  timestamp: Date;
  projectId?: number;
  priority: 'low' | 'normal' | 'medium' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string;
  data?: any;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(true);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) {
        setConnected(false);
        return;
      }
      setConnected(true);
      const data = await res.json();
      const parsed: Notification[] = data.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));

      // Detect new notifications for toast
      for (const n of parsed) {
        if (!previousIdsRef.current.has(n.id) && !n.read) {
          if (n.priority === 'high' || n.priority === 'urgent') {
            toast({
              title: n.title,
              description: n.message,
              variant: n.type === 'error' ? 'destructive' : 'default',
            });

            // Browser notification if permission granted
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(n.title, {
                body: n.message,
                icon: '/logo.png',
                tag: n.id,
              });
            }
          }
        }
      }
      previousIdsRef.current = new Set(parsed.map(n => n.id));
      setNotifications(parsed);
    } catch (error) {
      setConnected(false);
      console.error('Failed to fetch notifications:', error);
    }
  }, [toast]);

  useEffect(() => {
    // Request browser notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback((notificationId: string) => {
    fetch(`/api/notifications/mark-read/${notificationId}`, {
      method: 'POST',
      credentials: 'include',
    }).catch(console.error);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      credentials: 'include',
    }).catch(console.error);

    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    markAllAsRead
  };
}
