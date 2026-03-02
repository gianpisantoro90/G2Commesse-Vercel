import type { Express } from "express";
import { storage } from "../storage";
import { aiAutoApprovalSchema } from "@shared/schema";
import { logger } from "../lib/logger";
import { requireAdmin } from "./middleware";

export function registerAIRoutes(app: Express): void {
  // Get per-feature AI configuration
  app.get("/api/ai/feature-configs", async (req, res) => {
    try {
      const config = await storage.getSystemConfig('ai_feature_configs');
      res.json(config?.value || []);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero configurazioni AI per feature" });
    }
  });

  // Save per-feature AI configuration
  app.post("/api/ai/feature-configs", requireAdmin, async (req, res) => {
    try {
      const { configs } = req.body;
      if (!Array.isArray(configs)) {
        return res.status(400).json({ message: "Configurazioni non valide" });
      }
      const config = await storage.setSystemConfig('ai_feature_configs', configs);
      res.json(config.value);
    } catch (error) {
      res.status(500).json({ message: "Errore nel salvataggio configurazioni AI" });
    }
  });

  // Get auto-approval configuration
  app.get("/api/ai/auto-approval", async (req, res) => {
    try {
      const config = await storage.getSystemConfig('ai_auto_approval');
      res.json(config?.value || {
        enabled: false,
        emailAssignmentThreshold: 0.95,
        taskCreationThreshold: 0.90,
        deadlineCreationThreshold: 0.90,
      });
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero configurazione auto-approvazione" });
    }
  });

  // Save auto-approval configuration
  app.post("/api/ai/auto-approval", requireAdmin, async (req, res) => {
    try {
      const validated = aiAutoApprovalSchema.parse(req.body);
      const config = await storage.setSystemConfig('ai_auto_approval', validated);
      res.json(config.value);
    } catch (error) {
      res.status(400).json({ message: "Configurazione auto-approvazione non valida" });
    }
  });

  // AI Chat - Send message
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Messaggio mancante" });
      }

      const { processChat, generateConversationTitle } = await import("../lib/ai-assistant");

      // Load AI configuration
      const aiConfigData = await storage.getSystemConfig('ai_config');
      const globalConfig = aiConfigData?.value as any;
      const featureConfigsData = await storage.getSystemConfig('ai_feature_configs');
      const featureConfigs = (featureConfigsData?.value || []) as any[];

      // Load or create conversation
      let conversationHistory: any[] = [];
      let existingConversation: any = null;

      if (conversationId) {
        const convData = await storage.getSystemConfig(`ai_conversation_${conversationId}`);
        if (convData?.value) {
          existingConversation = convData.value;
          conversationHistory = existingConversation.messages || [];
        }
      }

      // Process message with AI
      const response = await processChat(
        message,
        conversationHistory,
        storage,
        globalConfig,
        featureConfigs,
      );

      // Update conversation
      const now = new Date().toISOString();
      const newMessages = [
        ...conversationHistory,
        { role: 'user', content: message, timestamp: now },
        { role: 'assistant', content: response, timestamp: now },
      ];

      const convId = conversationId || `conv_${Date.now()}`;
      let title = existingConversation?.title;
      if (!title && conversationHistory.length === 0) {
        title = await generateConversationTitle(message, globalConfig, featureConfigs);
      }

      await storage.setSystemConfig(`ai_conversation_${convId}`, {
        id: convId,
        title: title || 'Nuova conversazione',
        messages: newMessages,
        userId: (req.session as any).userId,
        updatedAt: now,
      });

      res.json({
        response,
        conversationId: convId,
        title,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      logger.error('AI chat error', { error: msg });
      res.status(500).json({ message: `Errore nell'elaborazione AI: ${msg}` });
    }
  });

  // AI Chat - Get conversation history
  app.get("/api/ai/conversations", async (req, res) => {
    try {
      // We store conversations in system_config with key pattern ai_conversation_*
      // For now, return a simple list from system config
      const allConfigs = await storage.getSystemConfig('ai_conversations_index');
      res.json(allConfigs?.value || []);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero conversazioni" });
    }
  });

  // AI Chat - Get single conversation
  app.get("/api/ai/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const convData = await storage.getSystemConfig(`ai_conversation_${id}`);
      if (!convData?.value) {
        return res.status(404).json({ message: "Conversazione non trovata" });
      }
      res.json(convData.value);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero conversazione" });
    }
  });

  // AI Chat - Delete conversation
  app.delete("/api/ai/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.setSystemConfig(`ai_conversation_${id}`, null);
      res.json({ message: "Conversazione eliminata" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'eliminazione conversazione" });
    }
  });

  // AI Feedback - Record user feedback on AI suggestions
  app.post("/api/ai/feedback", async (req, res) => {
    try {
      const { communicationId, feedbackType, action, aiSuggestion, userCorrection, aiConfidence } = req.body;
      if (!feedbackType || !action) {
        return res.status(400).json({ message: "Tipo feedback e azione richiesti" });
      }

      // Store feedback in system config (accumulate array)
      const existingData = await storage.getSystemConfig('ai_feedback_log');
      const feedbackLog = Array.isArray(existingData?.value) ? existingData.value : [];

      feedbackLog.push({
        id: `fb_${Date.now()}`,
        communicationId,
        feedbackType,
        action,
        aiSuggestion,
        userCorrection,
        aiConfidence,
        userId: (req.session as any).userId,
        createdAt: new Date().toISOString(),
      });

      // Keep last 500 feedback entries
      const trimmed = feedbackLog.slice(-500);
      await storage.setSystemConfig('ai_feedback_log', trimmed);

      res.json({ message: "Feedback registrato" });
    } catch (error) {
      res.status(500).json({ message: "Errore nel salvataggio feedback" });
    }
  });

  // AI Feedback - Get feedback stats for learning mode
  app.get("/api/ai/feedback-stats", async (req, res) => {
    try {
      const existingData = await storage.getSystemConfig('ai_feedback_log');
      const feedbackLog = Array.isArray(existingData?.value) ? existingData.value : [];

      const totalFeedback = feedbackLog.length;
      const approved = feedbackLog.filter((f: any) => f.action === 'approved').length;
      const dismissed = feedbackLog.filter((f: any) => f.action === 'dismissed').length;
      const corrected = feedbackLog.filter((f: any) => f.action === 'corrected').length;

      const avgConfidenceApproved = feedbackLog
        .filter((f: any) => f.action === 'approved' && f.aiConfidence)
        .reduce((sum: number, f: any, _: any, arr: any[]) => sum + f.aiConfidence / arr.length, 0);

      const byType: Record<string, { approved: number; dismissed: number; corrected: number }> = {};
      for (const f of feedbackLog) {
        const type = (f as any).feedbackType || 'unknown';
        if (!byType[type]) byType[type] = { approved: 0, dismissed: 0, corrected: 0 };
        if ((f as any).action === 'approved') byType[type].approved++;
        else if ((f as any).action === 'dismissed') byType[type].dismissed++;
        else if ((f as any).action === 'corrected') byType[type].corrected++;
      }

      res.json({
        totalFeedback,
        approved,
        dismissed,
        corrected,
        approvalRate: totalFeedback > 0 ? (approved / totalFeedback * 100).toFixed(1) : 0,
        avgConfidenceApproved: avgConfidenceApproved.toFixed(2),
        byType,
        recentFeedback: feedbackLog.slice(-10),
      });
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero statistiche feedback" });
    }
  });

  // ============================================
  // PROJECT HEALTH & PROACTIVE INSIGHTS
  // ============================================

  // Get health for all active projects
  app.get("/api/ai/project-health", async (req, res) => {
    try {
      const { calculateAllProjectsHealth } = await import("../lib/ai-project-health");
      const summary = await calculateAllProjectsHealth(storage);
      res.json(summary);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      logger.error('Project health calculation error', { error: msg });
      res.status(500).json({ message: `Errore nel calcolo salute progetti: ${msg}` });
    }
  });

  // Get health for a single project
  app.get("/api/ai/project-health/:id", async (req, res) => {
    try {
      const { calculateProjectHealth } = await import("../lib/ai-project-health");
      const health = await calculateProjectHealth(req.params.id, storage);
      res.json(health);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      res.status(500).json({ message: `Errore nel calcolo salute progetto: ${msg}` });
    }
  });

  // Generate AI insights for health summary (requires AI API call)
  app.post("/api/ai/project-health/insights", async (req, res) => {
    try {
      const { calculateAllProjectsHealth, generateHealthInsights } = await import("../lib/ai-project-health");
      const summary = await calculateAllProjectsHealth(storage);

      const aiConfigData = await storage.getSystemConfig('ai_config');
      const globalConfig = aiConfigData?.value as any;
      const featureConfigsData = await storage.getSystemConfig('ai_feature_configs');
      const featureConfigs = (featureConfigsData?.value || []) as any[];

      const insights = await generateHealthInsights(summary, storage, globalConfig, featureConfigs);
      res.json({ summary, insights });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      logger.error('AI health insights error', { error: msg });
      res.status(500).json({ message: `Errore nella generazione insights AI: ${msg}` });
    }
  });

  // Get proactive insights (from cache or generate fresh)
  app.get("/api/ai/insights", async (req, res) => {
    try {
      const cached = await storage.getSystemConfig('ai_proactive_insights');
      const data = cached?.value as any;

      // Return cached if fresh (less than 1 hour old)
      if (data?.generatedAt) {
        const age = Date.now() - new Date(data.generatedAt).getTime();
        if (age < 3600000) { // 1 hour
          return res.json(data);
        }
      }

      // Generate fresh
      const { refreshInsights } = await import("../lib/ai-proactive-alerts");
      const insights = await refreshInsights(storage);
      const result = {
        insights: insights.slice(0, 50),
        generatedAt: new Date().toISOString(),
        totalActive: insights.length,
      };
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      logger.error('Proactive insights error', { error: msg });
      res.status(500).json({ message: `Errore nella generazione insights: ${msg}` });
    }
  });

  // Manually refresh proactive insights
  app.post("/api/ai/insights/refresh", async (req, res) => {
    try {
      const { refreshInsights } = await import("../lib/ai-proactive-alerts");
      const insights = await refreshInsights(storage);
      res.json({
        insights: insights.slice(0, 50),
        generatedAt: new Date().toISOString(),
        totalActive: insights.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Errore nel refresh degli insights" });
    }
  });

  // Dismiss an insight
  app.post("/api/ai/insights/:id/dismiss", async (req, res) => {
    try {
      const { id } = req.params;
      const cached = await storage.getSystemConfig('ai_proactive_insights');
      const data = cached?.value as any;
      if (data?.insights) {
        data.insights = data.insights.filter((i: any) => i.id !== id);
        await storage.setSystemConfig('ai_proactive_insights', data);
      }
      res.json({ message: "Insight archiviato" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'archiviazione insight" });
    }
  });

  // ============================================
  // CASH FLOW FORECAST
  // ============================================

  // Get cash flow forecast
  app.get("/api/ai/cashflow-forecast", async (req, res) => {
    try {
      const months = parseInt(req.query.months as string) || 6;
      const { generateCashFlowForecast } = await import("../lib/ai-cashflow-forecast");
      const forecast = await generateCashFlowForecast(storage, Math.min(months, 12));
      res.json(forecast);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      logger.error('Cash flow forecast error', { error: msg });
      res.status(500).json({ message: `Errore nella previsione cash flow: ${msg}` });
    }
  });
}
