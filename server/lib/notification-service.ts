import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { logger } from './logger';

export interface Notification {
  id: string;
  userId: string; // User ID who should receive this notification
  type: 'deadline' | 'invoice' | 'budget' | 'communication' | 'onedrive' | 'info' | 'warning' | 'error' | 'task_assigned' | 'task_completed';
  title: string;
  message: string;
  timestamp: Date;
  projectId?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'normal';
  read: boolean;
  actionUrl?: string;
  data?: any; // Additional data for the notification
}

class NotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, string | null> = new Map(); // Map WebSocket to userId
  private notifications: Notification[] = [];
  private clientTimeouts: Map<WebSocket, NodeJS.Timeout> = new Map(); // Track inactivity timeouts
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  initialize(server?: Server) {
    if (!server) {
      logger.info('Notification service initialized without WebSocket (serverless mode)');
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket notification client connected');
      // Add client with null userId initially (will be set after auth message)
      this.clients.set(ws, null);
      
      // Set inactivity timeout - close connection after 30 minutes of inactivity
      this.resetInactivityTimeout(ws);

      ws.on('message', (data: string) => {
        try {
          // Reset inactivity timeout on every message
          this.resetInactivityTimeout(ws);
          
          const message = JSON.parse(data.toString());

          if (message.type === 'auth') {
            // Client sends userId to authenticate
            const userId = message.userId;
            this.clients.set(ws, userId);
            logger.info('WebSocket client authenticated', { userId });

            // Send existing unread notifications for this user
            const userNotifications = this.notifications.filter(n => n.userId === userId && !n.read);
            if (userNotifications.length > 0) {
              ws.send(JSON.stringify({
                type: 'initial',
                notifications: userNotifications
              }));
            }

            // Confirm auth
            ws.send(JSON.stringify({ type: 'auth_success' }));
          } else if (message.type === 'mark_read') {
            this.markAsRead(message.notificationId);
          } else if (message.type === 'mark_all_read') {
            this.markAllAsRead();
          } else if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          logger.error('Error processing WebSocket message', { error });
        }
      });

      ws.on('close', () => {
        const userId = this.clients.get(ws);
        logger.info('WebSocket notification client disconnected', { userId });
        this.clients.delete(ws);
        this.clearInactivityTimeout(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error });
        this.clients.delete(ws);
        this.clearInactivityTimeout(ws);
      });
    });

    logger.info('Notification WebSocket server initialized');
  }

  /**
   * Reset inactivity timeout for a WebSocket connection
   */
  private resetInactivityTimeout(ws: WebSocket) {
    // Clear existing timeout
    this.clearInactivityTimeout(ws);
    
    // Set new timeout - close connection after inactivity
    const timeout = setTimeout(() => {
      logger.info('Closing WebSocket due to inactivity (30+ minutes)');
      ws.close(1000, 'Inactivity timeout');
    }, this.INACTIVITY_TIMEOUT);
    
    this.clientTimeouts.set(ws, timeout);
  }

  /**
   * Clear inactivity timeout for a WebSocket connection
   */
  private clearInactivityTimeout(ws: WebSocket) {
    const timeout = this.clientTimeouts.get(ws);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(ws);
    }
  }

  /**
   * Send a notification to a specific user
   */
  sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.notifications.push(fullNotification);

    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(-100);
    }

    // Send to specific user only
    this.broadcast({
      type: 'notification',
      notification: fullNotification
    }, fullNotification.userId);

    logger.info('Notification sent', {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      priority: notification.priority
    });

    return fullNotification;
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.broadcast({
        type: 'notification_read',
        notificationId
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.broadcast({
      type: 'all_notifications_read'
    });
  }

  /**
   * Get notifications for a specific user
   */
  getNotifications(userId?: string, unreadOnly = false): Notification[] {
    let filtered = this.notifications;

    // Filter by userId if provided
    if (userId) {
      filtered = filtered.filter(n => n.userId === userId);
    }

    // Filter by read status if requested
    if (unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    return filtered;
  }

  /**
   * Clear old notifications (older than 7 days)
   */
  clearOldNotifications() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const initialCount = this.notifications.length;
    this.notifications = this.notifications.filter(
      n => n.timestamp > sevenDaysAgo || !n.read
    );

    const removed = initialCount - this.notifications.length;
    if (removed > 0) {
      logger.info(`Cleared ${removed} old notifications`);
    }
  }

  /**
   * Broadcast message to specific users or all connected clients
   */
  private broadcast(message: any, targetUserId?: string) {
    const messageStr = JSON.stringify(message);
    // Map.forEach passes (value, key), so it's (userId, client) for Map<WebSocket, string>
    this.clients.forEach((userId: string | null, client: WebSocket) => {
      // Skip if client is not authenticated
      if (!userId) return;

      // If targetUserId is specified, only send to that user
      if (targetUserId && userId !== targetUserId) return;

      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Generate unique ID for notifications
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Check deadlines and send notifications
   */
  async checkDeadlines(storage: any) {
    try {
      const deadlines = await storage.getAllDeadlines();
      const now = new Date();

      for (const deadline of deadlines) {
        // Skip completed deadlines or those without notification settings
        if (deadline.status === 'completed' || !deadline.notifyDaysBefore) continue;

        const deadlineDate = new Date(deadline.dueDate);
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Notify admins when deadline is approaching within notifyDaysBefore range
        if (daysUntil > 0 && daysUntil <= deadline.notifyDaysBefore) {
          const project = await storage.getProject(deadline.projectId);
          const users = await storage.getAllUsers();
          const admins = users.filter((u: any) => u.role === 'admin');

          for (const admin of admins) {
            this.sendNotification({
              userId: admin.id,
              type: 'deadline',
              title: `Scadenza in ${daysUntil} giorn${daysUntil === 1 ? 'o' : 'i'}`,
              message: `${deadline.title} - ${project?.code || 'Progetto'}`,
              priority: deadline.priority as any,
            });
          }
        }

        // Urgent notification for overdue deadlines
        if (daysUntil < 0 && deadline.status === 'pending') {
          const project = await storage.getProject(deadline.projectId);
          const users = await storage.getAllUsers();
          const admins = users.filter((u: any) => u.role === 'admin');

          for (const admin of admins) {
            this.sendNotification({
              userId: admin.id,
              type: 'deadline',
              title: 'Scadenza superata!',
              message: `${deadline.title} era prevista per ${deadlineDate.toLocaleDateString('it-IT')} - ${project?.code || 'Progetto'}`,
              priority: 'urgent' as any,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking deadlines', { error });
    }
  }

  /**
   * Helper: Check overdue invoices
   * TODO: Implement when storage methods are available
   */
  async checkInvoices(storage: any) {
    // Temporarily disabled - storage methods not yet implemented
    return;
  }

  /**
   * Helper: Check budget overruns
   * TODO: Implement when storage methods are available
   */
  async checkBudgets(storage: any) {
    // Temporarily disabled - storage methods not yet implemented
    return;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
