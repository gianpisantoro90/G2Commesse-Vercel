import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertTaskSchema } from "@shared/schema";
import { parsePaginationParams } from "@shared/pagination";
import { notificationService } from "../lib/notification-service";
import { requireAdmin } from "./middleware";

export function registerTaskRoutes(app: Express): void {
  // Get all tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const { projectId, assignedTo, createdBy } = req.query;

      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getTasksPaginated({
          ...pagination,
          projectId: projectId as string | undefined,
          assignedTo: assignedTo as string | undefined,
          createdBy: createdBy as string | undefined,
          status: req.query.status as string | undefined,
        });
        return res.json(result);
      }

      let tasks;
      if (projectId) {
        tasks = await storage.getTasksByProject(projectId as string);
      } else if (assignedTo) {
        tasks = await storage.getTasksByAssignee(assignedTo as string);
      } else if (createdBy) {
        tasks = await storage.getTasksByCreator(createdBy as string);
      } else {
        tasks = await storage.getAllTasks();
      }

      return res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ message: "Errore nel recupero delle task" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTaskById(id);

      if (!task) {
        return res.status(404).json({ message: "Task non trovata" });
      }

      return res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      return res.status(500).json({ message: "Errore nel recupero della task" });
    }
  });

  // Create new task
  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const isAdmin = req.session.role === 'admin';

      // Set createdById to current user if not provided
      const dataToInsert = {
        ...taskData,
        createdById: taskData.createdById || req.session.userId!
      };

      // Non-admin users can only assign tasks to themselves
      if (!isAdmin && dataToInsert.assignedToId && dataToInsert.assignedToId !== req.session.userId) {
        return res.status(403).json({
          message: "Gli utenti standard possono assegnare task solo a se stessi."
        });
      }

      const newTask = await storage.createTask(dataToInsert);

      // Send notification if task is assigned to someone
      if (newTask.assignedToId && newTask.assignedToId !== req.session.userId) {
        const assignedUser = await storage.getUserById(newTask.assignedToId);
        if (assignedUser) {
          await notificationService.sendNotification({
            userId: assignedUser.id,
            type: 'task_assigned',
            title: 'Nuova task assegnata',
            message: `Ti è stata assegnata una nuova task: ${newTask.title}`,
            data: { taskId: newTask.id },
            priority: newTask.priority === 'high' ? 'high' : 'normal'
          });
        }
      }

      return res.status(201).json(newTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error('Error creating task:', error);
      return res.status(500).json({ message: "Errore nella creazione della task" });
    }
  });

  // Update task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const isAdmin = req.session.role === 'admin';

      // Get the task first to check permissions
      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ message: "Task non trovata" });
      }

      // Non-admin users can only modify tasks assigned to them
      if (!isAdmin && task.assignedToId !== req.session.userId) {
        return res.status(403).json({
          message: "Puoi modificare solo le task assegnate a te."
        });
      }

      // Fields that regular users can update
      const allowedFields = ['status', 'notes'];

      // Check if non-admin user is trying to update restricted fields
      if (!isAdmin) {
        const updateKeys = Object.keys(updates);
        const restrictedFields = updateKeys.filter(key => !allowedFields.includes(key));

        if (restrictedFields.length > 0) {
          return res.status(403).json({
            message: "Non hai i permessi per modificare questi campi. Gli utenti standard possono solo modificare lo stato e le note.",
            restrictedFields
          });
        }
      }

      const updatedTask = await storage.updateTask(id, updates);
      if (!updatedTask) {
        return res.status(404).json({ message: "Task non trovata" });
      }

      // Send notification if task was completed
      if (updates.status === 'completed' && updatedTask.createdById !== req.session.userId) {
        const creator = await storage.getUserById(updatedTask.createdById);
        if (creator) {
          await notificationService.sendNotification({
            userId: creator.id,
            type: 'task_completed',
            title: 'Task completata',
            message: `La task "${updatedTask.title}" è stata completata`,
            data: { taskId: updatedTask.id },
            priority: 'normal'
          });
        }
      }

      return res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ message: "Errore nell'aggiornamento della task" });
    }
  });

  // Delete task (admin only)
  app.delete("/api/tasks/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = await storage.deleteTask(id);
      if (!deleted) {
        return res.status(404).json({ message: "Task non trovata" });
      }

      return res.json({ success: true, message: "Task eliminata con successo" });
    } catch (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ message: "Errore nell'eliminazione della task" });
    }
  });
}
