import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertFileRoutingSchema, aiConfigSchema } from "@shared/schema";
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

  // ── Legacy AI endpoint redirects (consolidated to /api/ai/*) ──

  app.get("/api/get-env-api-key", (req, res) => {
    res.redirect(307, '/api/ai/key-status');
  });

  app.post("/api/test-claude", (req, res) => {
    res.redirect(307, '/api/ai/test-connection');
  });

  app.post("/api/ai-routing", (req, res) => {
    res.redirect(307, '/api/ai/file-routing');
  });

}
