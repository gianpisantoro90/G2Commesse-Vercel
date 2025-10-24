import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { logger } from './logger';

export interface Notification {
  id: string;
  type: 'deadline' | 'invoice' | 'budget' | 'communication' | 'onedrive' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  projectId?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string;
}

class NotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private notifications: Notification[] = [];

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket notification client connected');
      this.clients.add(ws);

      // Send existing unread notifications to newly connected client
      const unreadNotifications = this.notifications.filter(n => !n.read);
      if (unreadNotifications.length > 0) {
        ws.send(JSON.stringify({
          type: 'initial',
          notifications: unreadNotifications
        }));
      }

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'mark_read') {
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
        logger.info('WebSocket notification client disconnected');
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
   * Send a notification to all connected clients
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

    this.broadcast({
      type: 'notification',
      notification: fullNotification
    });

    logger.info('Notification sent', {
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
   * Get all notifications
   */
  getNotifications(unreadOnly = false): Notification[] {
    if (unreadOnly) {
      return this.notifications.filter(n => !n.read);
    }
    return this.notifications;
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
   * Broadcast message to all connected clients
   */
  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
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
      const deadlines = await storage.getProjectDeadlines();
      const now = new Date();

      for (const deadline of deadlines) {
        if (deadline.completed || !deadline.notifyDaysBefore) continue;

        const deadlineDate = new Date(deadline.dueDate);
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Send notification at configured intervals
        if (deadline.notifyDaysBefore.includes(daysUntil)) {
          const project = await storage.getProject(deadline.projectId);

          this.sendNotification({
            type: 'deadline',
            title: `Scadenza in ${daysUntil} giorni`,
            message: `${deadline.title} - ${project?.code || 'Progetto'}`,
            priority: deadline.priority,
            projectId: deadline.projectId,
            actionUrl: `/progetti/${deadline.projectId}?tab=scadenzario`
          });
        }

        // Urgent notification for overdue
        if (daysUntil < 0 && !deadline.lastNotified) {
          this.sendNotification({
            type: 'deadline',
            title: 'Scadenza superata!',
            message: `${deadline.title} era prevista per ${deadlineDate.toLocaleDateString('it-IT')}`,
            priority: 'urgent',
            projectId: deadline.projectId,
            actionUrl: `/progetti/${deadline.projectId}?tab=scadenzario`
          });
        }
      }
    } catch (error) {
      logger.error('Error checking deadlines', { error });
    }
  }

  /**
   * Helper: Check overdue invoices
   */
  async checkInvoices(storage: any) {
    try {
      const invoices = await storage.getProjectInvoices();
      const now = new Date();

      for (const invoice of invoices) {
        if (invoice.paymentStatus === 'pagata') continue;

        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
        if (dueDate && dueDate < now) {
          const project = await storage.getProject(invoice.projectId);
          const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          this.sendNotification({
            type: 'invoice',
            title: `Fattura scaduta da ${daysOverdue} giorni`,
            message: `Fattura ${invoice.invoiceNumber} - ${project?.code || 'Progetto'} - €${invoice.amount}`,
            priority: daysOverdue > 30 ? 'urgent' : 'high',
            projectId: invoice.projectId,
            actionUrl: `/progetti/${invoice.projectId}?tab=fatturazione`
          });
        }
      }
    } catch (error) {
      logger.error('Error checking invoices', { error });
    }
  }

  /**
   * Helper: Check budget overruns
   */
  async checkBudgets(storage: any) {
    try {
      const projects = await storage.getProjects();

      for (const project of projects) {
        if (project.status !== 'in_corso') continue;

        const budget = await storage.getProjectBudget(project.id);
        if (!budget || !budget.estimatedHours) continue;

        const actualHours = budget.actualHours || 0;
        const estimatedHours = budget.estimatedHours;
        const percentage = (actualHours / estimatedHours) * 100;

        // Alert at 80%, 90%, 100%, 110%
        const thresholds = [80, 90, 100, 110];
        for (const threshold of thresholds) {
          if (percentage >= threshold && percentage < threshold + 5) {
            this.sendNotification({
              type: 'budget',
              title: `Budget ore al ${Math.round(percentage)}%`,
              message: `${project.code} - ${actualHours}h su ${estimatedHours}h`,
              priority: percentage >= 100 ? 'urgent' : percentage >= 90 ? 'high' : 'medium',
              projectId: project.id,
              actionUrl: `/progetti/${project.id}?tab=budget`
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking budgets', { error });
    }
  }
}

// Singleton instance
export const notificationService = new NotificationService();
