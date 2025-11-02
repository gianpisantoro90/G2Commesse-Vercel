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

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket notification client connected');
      // Add client with null userId initially (will be set after auth message)
      this.clients.set(ws, null);

      ws.on('message', (data: string) => {
        try {
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
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error });
        this.clients.delete(ws);
      });
    });

    logger.info('Notification WebSocket server initialized');
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

        // TODO: Send notification at configured interval
        // Need to determine which user(s) should receive deadline notifications (project manager, admins, etc.)
        // if (deadline.notifyDaysBefore === daysUntil && daysUntil > 0) {
        //   const project = await storage.getProject(deadline.projectId);
        //
        //   this.sendNotification({
        //     userId: '<project-manager-or-admin-id>',
        //     type: 'deadline',
        //     title: `Scadenza in ${daysUntil} giorni`,
        //     message: `${deadline.title} - ${project?.code || 'Progetto'}`,
        //     priority: deadline.priority as any,
        //     projectId: parseInt(deadline.projectId),
        //     actionUrl: `/progetti/${deadline.projectId}?tab=scadenzario`
        //   });
        // }

        // TODO: Urgent notification for overdue
        // if (daysUntil < 0 && deadline.status === 'pending') {
        //   this.sendNotification({
        //     userId: '<project-manager-or-admin-id>',
        //     type: 'deadline',
        //     title: 'Scadenza superata!',
        //     message: `${deadline.title} era prevista per ${deadlineDate.toLocaleDateString('it-IT')}`,
        //     priority: 'urgent',
        //     projectId: parseInt(deadline.projectId),
        //     actionUrl: `/progetti/${deadline.projectId}?tab=scadenzario`
        //   });
        // }
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
