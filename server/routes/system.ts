import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertFileRoutingSchema, insertSystemConfigSchema, aiConfigSchema } from "@shared/schema";
import { requireAdmin } from "./middleware";

export function registerSystemRoutes(app: Express): void {
  // File Routings
  app.get("/api/file-routings/:projectId", async (req, res) => {
    try {
      const fileRoutings = await storage.getFileRoutingsByProject(req.params.projectId);
      res.json(fileRoutings);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero dei file routing" });
    }
  });

  app.post("/api/file-routings", async (req, res) => {
    try {
      const validatedData = insertFileRoutingSchema.parse(req.body);
      const fileRouting = await storage.createFileRouting(validatedData);
      res.status(201).json(fileRouting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione del file routing" });
    }
  });

  // System Config
  app.get("/api/system-config/:key", async (req, res) => {
    try {
      const config = await storage.getSystemConfig(req.params.key);
      if (!config) {
        return res.status(404).json({ message: "Configurazione non trovata" });
      }

      if (req.params.key === 'ai_config' && config.value && typeof config.value === 'object' && 'apiKey' in config.value) {
        const { apiKey, ...safeConfig } = config.value as any;
        return res.json({
          ...config,
          value: safeConfig,
        });
      }

      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero della configurazione" });
    }
  });

  app.post("/api/system-config", requireAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ message: "Chiave richiesta" });
      }

      if (key === 'ai_config') {
        try {
          const existingConfig = await storage.getSystemConfig('ai_config');
          const existingApiKey = (existingConfig?.value as any)?.apiKey;

          const configToValidate = {
            ...value,
            apiKey: value.apiKey || existingApiKey || '',
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

          const config = await storage.setSystemConfig(key, configWithProvider);

          const { apiKey, ...safeValue } = configWithProvider;
          return res.json({
            ...config,
            value: safeValue,
          });
        } catch (validationError) {
          return res.status(400).json({
            message: "Configurazione AI non valida",
            error: validationError instanceof Error ? validationError.message : 'Invalid config',
          });
        }
      }

      const config = await storage.setSystemConfig(key, value);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Errore nel salvataggio della configurazione" });
    }
  });

  // Bulk operations
  app.get("/api/export", requireAdmin, async (req, res) => {
    try {
      const data = await storage.exportAllData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Errore nell'esportazione dei dati" });
    }
  });

  app.post("/api/import", requireAdmin, async (req, res) => {
    try {
      const { mode, ...data } = req.body;
      const importMode = mode === 'merge' ? 'merge' : 'overwrite';

      const report = await storage.importAllData(data, importMode);

      res.json({ report });
    } catch (error: any) {
      console.error('❌ Errore durante importazione dati:', error);
      res.status(500).json({
        message: "Errore nell'importazione dei dati",
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      });
    }
  });

  app.delete("/api/clear-all", requireAdmin, async (req, res) => {
    try {
      await storage.clearAllData();
      res.json({ message: "Tutti i dati sono stati cancellati" });
    } catch (error) {
      res.status(500).json({ message: "Errore nella cancellazione dei dati" });
    }
  });

  // API key availability check (does NOT expose the key itself)
  app.get("/api/get-env-api-key", async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY ||
                    process.env.CLAUDE_API_KEY ||
                    process.env.AI_API_KEY;

      if (apiKey) {
        res.json({ available: true, message: "API Key configurata lato server" });
      } else {
        res.status(404).json({
          available: false,
          message: "API Key non trovata nelle variabili d'ambiente",
          suggestion: "Configura manualmente l'API Key nelle impostazioni AI"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Errore nel controllo API key" });
    }
  });

  // AI test endpoint (supports multiple providers)
  app.post("/api/test-claude", async (req, res) => {
    try {
      let { apiKey, model } = req.body;

      // Use server-side API key when client signals 'server-managed' or sends no key
      if (!apiKey || apiKey === 'server-managed') {
        // Check user-saved config in system_config table first, then env vars
        const aiConfig = await storage.getSystemConfig('ai_config');
        const savedKey = (aiConfig?.value as any)?.apiKey;
        apiKey = savedKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ message: "API Key non configurata sul server" });
        }
      }

      // Determine provider based on model or API key format
      const isDeepSeek = model?.includes('deepseek') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-'));

      let response;
      if (isDeepSeek && !apiKey.startsWith('sk-ant-')) {
        // DeepSeek API
        response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'deepseek-reasoner',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 10,
          }),
        });
      } else {
        // Claude API (default)
        const claudeModel = model?.startsWith('claude-') ? model : 'claude-sonnet-4-6';
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({
          message: "API Key non valida o servizio non disponibile",
          details: {
            status: response.status,
            error: errorText
          }
        });
      }

      const provider = isDeepSeek && !apiKey.startsWith('sk-ant-') ? 'DeepSeek' : 'Claude';
      res.json({ success: true, message: `Connessione ${provider} API riuscita` });
    } catch (error) {
      console.error('AI API test error:', error);
      res.status(500).json({
        message: "Errore nel test della connessione",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI routing endpoint (supports multiple providers)
  app.post("/api/ai-routing", async (req, res) => {
    try {
      let { apiKey, prompt, model } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt mancante" });
      }

      // Use server-side API key when client signals 'server-managed' or sends no key
      if (!apiKey || apiKey === 'server-managed') {
        const aiConfig = await storage.getSystemConfig('ai_config');
        const savedKey = (aiConfig?.value as any)?.apiKey;
        apiKey = savedKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ message: "API Key non configurata sul server" });
        }
      }

      // Determine provider based on model or API key format
      const isDeepSeek = model?.includes('deepseek') || (apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant-'));

      let response;
      if (isDeepSeek) {
        // DeepSeek API
        response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'deepseek-reasoner',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,
          }),
        });
      } else {
        // Claude API (default)
        const claudeModel = model?.startsWith('claude-') ? model : 'claude-sonnet-4-6';
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({
          message: "Errore nell'analisi AI del file",
          details: {
            status: response.status,
            error: errorText
          }
        });
      }

      const data = await response.json();

      // Handle different response formats
      let content;
      if (isDeepSeek) {
        content = data.choices?.[0]?.message?.content || '';
      } else {
        content = data.content?.[0]?.text || '';
      }

      res.json({ content });
    } catch (error) {
      console.error('AI routing error:', error);
      res.status(500).json({
        message: "Errore nell'analisi AI",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

}
