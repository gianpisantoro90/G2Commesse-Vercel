import type { Express } from "express";
import { notificationService } from "../lib/notification-service";
import { requireAdmin } from "./middleware";

export function registerNotificationRoutes(app: Express): void {
  app.get("/api/notifications", async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      // Filter notifications by current user's ID
      const userId = req.session.userId;
      const notifications = notificationService.getNotifications(userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero delle notifiche" });
    }
  });

  app.post("/api/notifications/mark-read/:id", async (req, res) => {
    try {
      notificationService.markAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'aggiornamento della notifica" });
    }
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      const userId = req.session.userId;
      notificationService.markAllAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'aggiornamento delle notifiche" });
    }
  });

  app.post("/api/notifications/send", requireAdmin, async (req, res) => {
    try {
      const { userId, type, title, message, priority, projectId, actionUrl } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ message: "userId, title e message sono obbligatori" });
      }
      const notification = notificationService.sendNotification({
        userId, type: type || 'info', title, message,
        priority: priority || 'normal', projectId, actionUrl
      });
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Errore nell'invio della notifica" });
    }
  });
}
