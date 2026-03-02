import type { Express } from "express";
import { storage } from "../storage";
import { parsePaginationParams } from "@shared/pagination";

export function registerCommunicationRoutes(app: Express): void {
  // Communications
  app.get("/api/communications", async (req, res) => {
    try {
      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getCommunicationsPaginated({
          ...pagination,
          projectId: req.query.projectId as string | undefined,
          type: req.query.type as string | undefined,
          direction: req.query.direction as string | undefined,
          importantOnly: req.query.importantOnly === 'true',
        });
        return res.json(result);
      }

      const projectId = req.query.projectId as string | undefined;
      const communications = projectId
        ? await storage.getCommunicationsByProject(projectId)
        : await storage.getAllCommunications();
      res.json(communications);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero delle comunicazioni" });
    }
  });

  // Communications pending AI review - have aiSuggestions but no projectId assigned
  app.get("/api/communications/pending-review", async (req, res) => {
    try {
      const allCommunications = await storage.getAllCommunications();

      // Filter communications that need manual review:
      // - Have aiSuggestions (AI analysis completed) - even if no matches found
      // - Don't have a projectId assigned yet
      // - Haven't been dismissed (no aiSuggestionsStatus.action = 'dismissed')
      const pendingReview = allCommunications.filter((comm: any) => {
        const hasAiSuggestions = comm.aiSuggestions; // AI analysis completed (even with 0 matches)
        const noProjectAssigned = !comm.projectId;
        const notDismissed = !comm.aiSuggestionsStatus ||
                            comm.aiSuggestionsStatus.action !== 'dismissed';

        return hasAiSuggestions && noProjectAssigned && notDismissed;
      });

      // Sort by communication date (most recent first)
      pendingReview.sort((a: any, b: any) =>
        new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime()
      );

      res.json(pendingReview);
    } catch (error) {
      console.error('Error fetching pending review communications:', error);
      res.status(500).json({ message: "Errore nel recupero delle comunicazioni da rivedere" });
    }
  });

  // AI Suggested Tasks endpoints
  app.get("/api/ai/suggested-tasks", async (req, res) => {
    try {
      const allCommunications = await storage.getAllCommunications();

      // Filter communications with suggested tasks that haven't been processed yet
      const withSuggestedTasks = allCommunications.filter((comm: any) => {
        const hasSuggestedTasks = comm.aiSuggestions &&
                                 comm.aiSuggestions.suggestedTasks &&
                                 comm.aiSuggestions.suggestedTasks.length > 0;

        // Only show if there are tasks that haven't been approved/dismissed
        if (!hasSuggestedTasks) return false;

        const aiTasksStatus = comm.aiTasksStatus || {};
        const hasPendingTasks = comm.aiSuggestions.suggestedTasks.some((task: any, index: number) => {
          const taskStatus = aiTasksStatus[index];
          return !taskStatus || taskStatus.action === 'pending';
        });

        return hasPendingTasks;
      });

      // Sort by communication date (most recent first)
      withSuggestedTasks.sort((a: any, b: any) =>
        new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime()
      );

      res.json(withSuggestedTasks);
    } catch (error) {
      console.error('Error fetching suggested tasks:', error);
      res.status(500).json({ message: "Errore nel recupero dei task suggeriti" });
    }
  });

  app.post("/api/ai/suggested-tasks/approve", async (req, res) => {
    try {
      const { communicationId, taskIndex, assignedToId } = req.body;

      if (!communicationId || taskIndex === undefined) {
        return res.status(400).json({ message: "communicationId e taskIndex sono richiesti" });
      }

      // Get communication
      const communication = await storage.getCommunication(communicationId);
      if (!communication) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      const suggestedTask = (communication.aiSuggestions as any)?.suggestedTasks?.[taskIndex];
      if (!suggestedTask) {
        return res.status(404).json({ message: "Task suggerito non trovato" });
      }

      // Create the task
      const newTask = await storage.createTask({
        title: suggestedTask.title,
        description: suggestedTask.description || null,
        projectId: communication.projectId || null,
        assignedToId: assignedToId || null,
        createdById: req.session.userId!, // From session auth
        priority: suggestedTask.priority,
        status: 'pending',
        dueDate: suggestedTask.dueDate ? new Date(suggestedTask.dueDate) : null,
        notes: `Task suggerito dall'AI dalla comunicazione: ${communication.subject}\n\nRagionamento: ${suggestedTask.reasoning}`,
      });

      // Update communication with task approval status
      const aiTasksStatus = (communication.aiTasksStatus || {}) as Record<string, any>;
      aiTasksStatus[taskIndex] = {
        action: 'approved',
        taskId: newTask.id,
        approvedAt: new Date().toISOString(),
        approvedBy: req.session.userId!,
      };

      await storage.updateCommunication(communicationId, {
        aiTasksStatus: aiTasksStatus,
      });

      res.json({ task: newTask, message: "Task creato con successo" });
    } catch (error) {
      console.error('Error approving suggested task:', error);
      res.status(500).json({ message: "Errore nella creazione del task" });
    }
  });

  app.post("/api/ai/suggested-tasks/dismiss", async (req, res) => {
    try {
      const { communicationId, taskIndex } = req.body;

      if (!communicationId || taskIndex === undefined) {
        return res.status(400).json({ message: "communicationId e taskIndex sono richiesti" });
      }

      // Get communication
      const communication = await storage.getCommunication(communicationId);
      if (!communication) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      // Update communication with task dismissal status
      const aiTasksStatus = (communication.aiTasksStatus || {}) as Record<string, any>;
      aiTasksStatus[taskIndex] = {
        action: 'dismissed',
        dismissedAt: new Date().toISOString(),
        dismissedBy: req.session.userId!,
      };

      await storage.updateCommunication(communicationId, {
        aiTasksStatus: aiTasksStatus,
      });

      res.json({ message: "Task rifiutato" });
    } catch (error) {
      console.error('Error dismissing suggested task:', error);
      res.status(500).json({ message: "Errore nel rifiuto del task" });
    }
  });

  // AI Suggested Deadlines endpoints
  app.get("/api/ai/suggested-deadlines", async (req, res) => {
    try {
      const allCommunications = await storage.getAllCommunications();

      // Filter communications with suggested deadlines that haven't been processed yet
      const withSuggestedDeadlines = allCommunications.filter((comm: any) => {
        const hasSuggestedDeadlines = comm.aiSuggestions &&
                                     comm.aiSuggestions.suggestedDeadlines &&
                                     comm.aiSuggestions.suggestedDeadlines.length > 0;

        // Only show if there are deadlines that haven't been approved/dismissed
        if (!hasSuggestedDeadlines) return false;

        const aiDeadlinesStatus = comm.aiDeadlinesStatus || {};
        const hasPendingDeadlines = comm.aiSuggestions.suggestedDeadlines.some((deadline: any, index: number) => {
          const deadlineStatus = aiDeadlinesStatus[index];
          return !deadlineStatus || deadlineStatus.action === 'pending';
        });

        return hasPendingDeadlines;
      });

      // Sort by communication date (most recent first)
      withSuggestedDeadlines.sort((a: any, b: any) =>
        new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime()
      );

      res.json(withSuggestedDeadlines);
    } catch (error) {
      console.error('Error fetching suggested deadlines:', error);
      res.status(500).json({ message: "Errore nel recupero delle scadenze suggerite" });
    }
  });

  app.post("/api/ai/suggested-deadlines/approve", async (req, res) => {
    try {
      const { communicationId, deadlineIndex } = req.body;

      if (!communicationId || deadlineIndex === undefined) {
        return res.status(400).json({ message: "communicationId e deadlineIndex sono richiesti" });
      }

      // Get communication
      const communication = await storage.getCommunication(communicationId);
      if (!communication) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      const suggestedDeadline = (communication.aiSuggestions as any)?.suggestedDeadlines?.[deadlineIndex];
      if (!suggestedDeadline) {
        return res.status(404).json({ message: "Scadenza suggerita non trovata" });
      }

      // Create the deadline
      const newDeadline = await storage.createDeadline({
        projectId: communication.projectId!,
        title: suggestedDeadline.title,
        description: suggestedDeadline.description || null,
        dueDate: new Date(suggestedDeadline.dueDate),
        priority: suggestedDeadline.priority,
        type: suggestedDeadline.type,
        status: 'pending',
        notifyDaysBefore: suggestedDeadline.notifyDaysBefore || 7,
      });

      // Update communication with deadline approval status
      const aiDeadlinesStatus = (communication.aiDeadlinesStatus || {}) as Record<string, any>;
      aiDeadlinesStatus[deadlineIndex] = {
        action: 'approved',
        deadlineId: newDeadline.id,
        approvedAt: new Date().toISOString(),
        approvedBy: req.session.userId!,
      };

      await storage.updateCommunication(communicationId, {
        aiDeadlinesStatus: aiDeadlinesStatus,
      });

      res.json({ deadline: newDeadline, message: "Scadenza creata con successo" });
    } catch (error) {
      console.error('Error approving suggested deadline:', error);
      res.status(500).json({ message: "Errore nella creazione della scadenza" });
    }
  });

  app.post("/api/ai/suggested-deadlines/dismiss", async (req, res) => {
    try {
      const { communicationId, deadlineIndex } = req.body;

      if (!communicationId || deadlineIndex === undefined) {
        return res.status(400).json({ message: "communicationId e deadlineIndex sono richiesti" });
      }

      // Get communication
      const communication = await storage.getCommunication(communicationId);
      if (!communication) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      // Update communication with deadline dismissal status
      const aiDeadlinesStatus = (communication.aiDeadlinesStatus || {}) as Record<string, any>;
      aiDeadlinesStatus[deadlineIndex] = {
        action: 'dismissed',
        dismissedAt: new Date().toISOString(),
        dismissedBy: req.session.userId!,
      };

      await storage.updateCommunication(communicationId, {
        aiDeadlinesStatus: aiDeadlinesStatus,
      });

      res.json({ message: "Scadenza rifiutata" });
    } catch (error) {
      console.error('Error dismissing suggested deadline:', error);
      res.status(500).json({ message: "Errore nel rifiuto della scadenza" });
    }
  });

  app.post("/api/communications", async (req, res) => {
    try {
      const communication = await storage.createCommunication(req.body);
      res.status(201).json(communication);
    } catch (error) {
      console.error('❌ Error creating communication:', error);
      console.error('📋 Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Errore nella creazione della comunicazione" });
    }
  });

  app.patch("/api/communications/:id", async (req, res) => {
    try {
      const updated = await storage.updateCommunication(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Errore nell'aggiornamento della comunicazione" });
    }
  });

  app.delete("/api/communications/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCommunication(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }
      res.json({ message: "Comunicazione eliminata con successo" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'eliminazione della comunicazione" });
    }
  });

  // AI Suggestions - Select project from multiple matches
  app.post("/api/communications/:id/select-project", async (req, res) => {
    try {
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: "projectId è richiesto" });
      }

      // Update communication with selected project
      const updated = await storage.updateCommunication(req.params.id, {
        projectId: projectId,
        // Update aiSuggestionsStatus to mark as manually reviewed/selected
        aiSuggestionsStatus: {
          selectedAt: new Date(),
          selectedBy: req.session.username,
          selectedProjectId: projectId,
          action: 'project_selected'
        }
      });

      if (!updated) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      res.json({
        success: true,
        projectId: updated.projectId,
        message: "Progetto selezionato con successo"
      });
    } catch (error) {
      console.error('Error selecting project:', error);
      res.status(500).json({ message: "Errore nella selezione del progetto" });
    }
  });

  // AI Suggestions - Dismiss all suggestions
  app.post("/api/communications/:id/dismiss-suggestions", async (req, res) => {
    try {
      // Update aiSuggestionsStatus to mark as dismissed
      const updated = await storage.updateCommunication(req.params.id, {
        aiSuggestionsStatus: {
          dismissedAt: new Date(),
          dismissedBy: req.session.username,
          action: 'dismissed'
        }
      });

      if (!updated) {
        return res.status(404).json({ message: "Comunicazione non trovata" });
      }

      res.json({
        success: true,
        message: "Suggerimenti AI ignorati"
      });
    } catch (error) {
      console.error('Error dismissing suggestions:', error);
      res.status(500).json({ message: "Errore nell'operazione" });
    }
  });

  // Deadlines
  app.get("/api/deadlines", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const deadlines = projectId
        ? await storage.getDeadlinesByProject(projectId)
        : await storage.getAllDeadlines();
      res.json(deadlines);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero delle scadenze" });
    }
  });

  app.post("/api/deadlines", async (req, res) => {
    try {
      const deadline = await storage.createDeadline(req.body);
      res.status(201).json(deadline);
    } catch (error) {
      console.error('❌ Error creating deadline:', error);
      console.error('📋 Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Errore nella creazione della scadenza" });
    }
  });

  app.patch("/api/deadlines/:id", async (req, res) => {
    try {
      const data = { ...req.body };

      // Convert date strings to Date objects
      if (data.dueDate && typeof data.dueDate === 'string') {
        data.dueDate = new Date(data.dueDate);
      }
      if (data.completedAt && typeof data.completedAt === 'string') {
        data.completedAt = new Date(data.completedAt);
      }

      const updated = await storage.updateDeadline(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ message: "Scadenza non trovata" });
      }
      res.json(updated);
    } catch (error) {
      console.error('❌ Error updating deadline:', error);
      console.error('📋 Request params:', req.params);
      console.error('📋 Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Errore nell'aggiornamento della scadenza" });
    }
  });

  app.delete("/api/deadlines/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDeadline(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Scadenza non trovata" });
      }
      res.json({ message: "Scadenza eliminata con successo" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'eliminazione della scadenza" });
    }
  });
}
