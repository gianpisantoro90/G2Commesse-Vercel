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
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const connect = useCallback(async () => {
    // Get current user ID from auth API
    let userId: string | null = null;
    try {
      const authResponse = await fetch('/api/auth/status');
      const authData = await authResponse.json();
      userId = authData.user?.id;
    } catch (error) {
      console.error('Failed to get user ID:', error);
    }

    // Determine WebSocket URL based on current window location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket notification connected');
        setConnected(true);

        // Send authentication message with userId
        if (userId) {
          ws.send(JSON.stringify({ type: 'auth', userId }));
        }

        // OPTIMIZED: Send ping every 60 seconds to keep connection alive (was 30s, reduced for Replit compute savings)
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 60000);

        // Store interval in ws object for cleanup
        (ws as any).pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'auth_success':
              // Authentication confirmed
              console.log('WebSocket authentication successful');
              break;

            case 'initial':
              // Initial notifications on connect
              setNotifications(data.notifications.map((n: any) => ({
                ...n,
                timestamp: new Date(n.timestamp)
              })));
              break;

            case 'notification':
              const newNotification = {
                ...data.notification,
                timestamp: new Date(data.notification.timestamp)
              };

              setNotifications(prev => [newNotification, ...prev]);

              // Show toast for high/urgent priority
              if (newNotification.priority === 'high' || newNotification.priority === 'urgent') {
                toast({
                  title: newNotification.title,
                  description: newNotification.message,
                  variant: newNotification.type === 'error' ? 'destructive' : 'default',
                });
              }

              // Browser notification if permission granted
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(newNotification.title, {
                  body: newNotification.message,
                  icon: '/logo.png',
                  tag: newNotification.id,
                });
              }
              break;

            case 'notification_read':
              setNotifications(prev =>
                prev.map(n => n.id === data.notificationId ? { ...n, read: true } : n)
              );
              break;

            case 'all_notifications_read':
              setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
              );
              break;

            case 'pong':
              // Heartbeat response
              break;
          }
        } catch (error) {
          console.error('Error processing notification message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket notification disconnected');
        setConnected(false);

        // Clear ping interval
        if ((ws as any).pingInterval) {
          clearInterval((ws as any).pingInterval);
        }

        // Attempt reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);

      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [toast]);

  useEffect(() => {
    // Request browser notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Connect WebSocket
    connect();

    // Fetch initial notifications from API
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        })));
      })
      .catch(error => {
        console.error('Failed to fetch initial notifications:', error);
      });

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        if ((wsRef.current as any).pingInterval) {
          clearInterval((wsRef.current as any).pingInterval);
        }
        wsRef.current.close();
      }
    };
  }, [connect]);

  const markAsRead = useCallback((notificationId: string) => {
    // Send to server
    fetch(`/api/notifications/mark-read/${notificationId}`, {
      method: 'POST'
    }).catch(error => {
      console.error('Failed to mark notification as read:', error);
    });

    // Send via WebSocket for real-time update
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        notificationId
      }));
    }

    // Update local state immediately
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    // Send to server
    fetch('/api/notifications/mark-all-read', {
      method: 'POST'
    }).catch(error => {
      console.error('Failed to mark all notifications as read:', error);
    });

    // Send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_all_read'
      }));
    }

    // Update local state immediately
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
