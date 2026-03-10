import type { Express } from "express";
import { storage } from "../storage";
import { aiAutoApprovalSchema, aiConfigSchema } from "@shared/schema";
import { logger } from "../lib/logger";
import { requireAdmin } from "./middleware";
import { aiComplete } from "../lib/ai-provider";

export function registerAIRoutes(app: Express): void {

  // ============================================
  // AI CONFIG (consolidated from system.ts)
  // ============================================

  // Get global AI config (without API key)
  app.get("/api/ai/config", async (req, res) => {
    try {
      const config = await storage.getSystemConfig('ai_config');
      if (!config) {
        return res.status(404).json({ message: "Configurazione non trovata" });
      }
      if (config.value && typeof config.value === 'object' && 'apiKey' in config.value) {
        const { apiKey, ...safeConfig } = config.value as any;
        return res.json({ ...config, value: safeConfig });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero della configurazione AI" });
    }
  });

  // Save global AI config
  app.post("/api/ai/config", requireAdmin, async (req, res) => {
    try {
      const { value } = req.body;
      if (!value) {
        return res.status(400).json({ message: "Configurazione mancante" });
      }

      const existingConfig = await storage.getSystemConfig('ai_config');
      const existingApiKey = (existingConfig?.value as any)?.apiKey;

      // Resolve API key: provided > existing DB > env var sentinel
      const resolvedApiKey = value.apiKey || existingApiKey || '';
      const hasEnvKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY);

      const configToValidate = {
        ...value,
        apiKey: resolvedApiKey || (hasEnvKey ? 'env-managed' : ''),
      };

      const validatedConfig = aiConfigSchema.parse(configToValidate);
      const modelToProvider: Record<string, 'anthropic' | 'deepseek'> = {
        'claude-opus-4-6': 'anthropic',
        'claude-sonnet-4-6': 'anthropic',
        'claude-haiku-4-5-20251001': 'anthropic',
        'claude-sonnet-4-20250514': 'anthropic',
        'deepseek-reasoner': 'deepseek',
        'deepseek-chat': 'deepseek',
      };

      const configWithProvider = {
        ...validatedConfig,
        provider: modelToProvider[validatedConfig.model] || 'anthropic',
      };

      const config = await storage.setSystemConfig('ai_config', configWithProvider);
      const { apiKey, ...safeValue } = configWithProvider;
      res.json({ ...config, value: safeValue });
    } catch (validationError) {
      res.status(400).json({
        message: "Configurazione AI non valida",
        error: validationError instanceof Error ? validationError.message : 'Invalid config',
      });
    }
  });

  // Check API key availability (does NOT expose the key itself)
  app.get("/api/ai/key-status", async (req, res) => {
    try {
      const anthropicKey = process.env.ANTHROPIC_API_KEY ||
                          process.env.CLAUDE_API_KEY ||
                          process.env.AI_API_KEY;
      const deepseekKey = process.env.DEEPSEEK_API_KEY;

      // Also check stored config
      const aiConfig = await storage.getSystemConfig('ai_config');
      const storedKey = (aiConfig?.value as any)?.apiKey;

      // Check if stored key belongs to a specific provider
      const storedProvider = (aiConfig?.value as any)?.provider;
      const storedKeyForAnthropic = storedKey && storedProvider === 'anthropic';
      const storedKeyForDeepseek = storedKey && storedProvider === 'deepseek';

      const available = !!(anthropicKey || deepseekKey || storedKey);

      if (available) {
        res.json({
          available: true,
          message: "API Key configurata",
          providers: {
            anthropic: !!(anthropicKey || storedKeyForAnthropic),
            deepseek: !!(deepseekKey || storedKeyForDeepseek),
          },
        });
      } else {
        res.status(404).json({
          available: false,
          message: "Nessuna API Key configurata",
          suggestion: "Configura l'API Key nelle impostazioni AI",
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Errore nel controllo API key" });
    }
  });

  // Test AI connection (uses unified ai-provider)
  app.post("/api/ai/test-connection", async (req, res) => {
    try {
      let { apiKey, model } = req.body;

      // Resolve API key: use provided key, or fall back to stored/env
      if (!apiKey || apiKey === 'server-managed') {
        const aiConfig = await storage.getSystemConfig('ai_config');
        const savedKey = (aiConfig?.value as any)?.apiKey;
        const isDeepSeekModel = model?.includes('deepseek');
        if (isDeepSeekModel) {
          apiKey = savedKey || process.env.DEEPSEEK_API_KEY;
        } else {
          apiKey = savedKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.AI_API_KEY;
        }
        if (!apiKey) {
          return res.status(400).json({ message: "API Key non configurata sul server" });
        }
      }

      // Determine provider from model
      const isDeepSeek = model?.includes('deepseek');
      const provider = isDeepSeek ? 'DeepSeek' : 'Claude';

      // Use the unified ai-provider for the test call
      const globalConfig = { apiKey, model: model || 'claude-sonnet-4-6', provider: isDeepSeek ? 'deepseek' as const : 'anthropic' as const, autoRouting: true, contentAnalysis: true, learningMode: true };
      await aiComplete('chat_assistant', {
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 10,
      }, globalConfig);

      res.json({ success: true, message: `Connessione ${provider} API riuscita` });
    } catch (error) {
      logger.error('AI API test error', { error: error instanceof Error ? error.message : 'Unknown' });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('API error')) {
        return res.status(400).json({ message: "API Key non valida o servizio non disponibile" });
      }
      res.status(500).json({ message: "Errore nel test della connessione" });
    }
  });

  // AI file routing for OneDrive uploads (uses unified ai-provider)
  app.post("/api/ai/file-routing", async (req, res) => {
    try {
      const { prompt, model } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt mancante" });
      }

      // Load AI config
      const aiConfigData = await storage.getSystemConfig('ai_config');
      const globalConfig = aiConfigData?.value as any;
      const featureConfigsData = await storage.getSystemConfig('ai_feature_configs');
      const featureConfigs = (featureConfigsData?.value || []) as any[];

      // Override model if specified in request
      const effectiveConfig = model ? { ...globalConfig, model } : globalConfig;

      const result = await aiComplete('email_analysis', {
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
      }, effectiveConfig, featureConfigs);

      res.json({ content: result.content });
    } catch (error) {
      logger.error('AI file routing error', { error: error instanceof Error ? error.message : 'Unknown' });
      res.status(500).json({ message: "Errore nell'analisi AI del file" });
    }
  });

  // ============================================
  // FEATURE CONFIGS & AUTO-APPROVAL
  // ============================================

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

      const finalTitle = title || 'Nuova conversazione';
      await storage.setSystemConfig(`ai_conversation_${convId}`, {
        id: convId,
        title: finalTitle,
        messages: newMessages,
        userId: (req.session as any).userId,
        updatedAt: now,
      });

      // Update conversations index
      const indexData = await storage.getSystemConfig('ai_conversations_index');
      const index: any[] = Array.isArray(indexData?.value) ? indexData.value : [];
      const existingIdx = index.findIndex((c: any) => c.id === convId);
      const entry = { id: convId, title: finalTitle, updatedAt: now, userId: (req.session as any).userId };
      if (existingIdx >= 0) {
        index[existingIdx] = entry;
      } else {
        index.unshift(entry);
      }
      // Keep max 50 conversations in the index
      const trimmedIndex = index.slice(0, 50);
      await storage.setSystemConfig('ai_conversations_index', trimmedIndex);

      res.json({
        response,
        conversationId: convId,
        title: finalTitle,
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

      // Remove from conversations index
      const indexData = await storage.getSystemConfig('ai_conversations_index');
      const index: any[] = Array.isArray(indexData?.value) ? indexData.value : [];
      const filtered = index.filter((c: any) => c.id !== id);
      if (filtered.length !== index.length) {
        await storage.setSystemConfig('ai_conversations_index', filtered);
      }

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
