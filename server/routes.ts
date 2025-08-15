import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertClientSchema, insertFileRoutingSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero delle commesse" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero della commessa" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      
      // Check if code already exists
      const existing = await storage.getProjectByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ message: "Codice commessa già esistente" });
      }
      
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione della commessa" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData);
      
      if (!project) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }
      
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nell'aggiornamento della commessa" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }
      res.json({ message: "Commessa eliminata con successo" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'eliminazione della commessa" });
    }
  });

  // Clients
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero dei clienti" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione del cliente" });
    }
  });

  // File Routing
  app.post("/api/file-routing", async (req, res) => {
    try {
      const validatedData = insertFileRoutingSchema.parse(req.body);
      const routing = await storage.createFileRouting(validatedData);
      res.status(201).json(routing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione del routing" });
    }
  });

  app.get("/api/file-routing/:projectId", async (req, res) => {
    try {
      const routings = await storage.getFileRoutingsByProject(req.params.projectId);
      res.json(routings);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero dei routing" });
    }
  });

  // System Config
  app.get("/api/system-config/:key", async (req, res) => {
    try {
      const config = await storage.getSystemConfig(req.params.key);
      if (!config) {
        return res.status(404).json({ message: "Configurazione non trovata" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero della configurazione" });
    }
  });

  app.post("/api/system-config", async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ message: "Chiave richiesta" });
      }
      const config = await storage.setSystemConfig(key, value);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Errore nel salvataggio della configurazione" });
    }
  });

  // Bulk operations
  app.get("/api/export", async (req, res) => {
    try {
      const data = await storage.exportAllData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Errore nell'esportazione dei dati" });
    }
  });

  app.post("/api/import", async (req, res) => {
    try {
      await storage.importAllData(req.body);
      res.json({ message: "Dati importati con successo" });
    } catch (error) {
      res.status(500).json({ message: "Errore nell'importazione dei dati" });
    }
  });

  app.delete("/api/clear-all", async (req, res) => {
    try {
      await storage.clearAllData();
      res.json({ message: "Tutti i dati sono stati cancellati" });
    } catch (error) {
      res.status(500).json({ message: "Errore nella cancellazione dei dati" });
    }
  });

  // Generate project code
  app.post("/api/generate-code", async (req, res) => {
    try {
      const { client, city, year } = req.body;
      if (!client || !city || !year) {
        return res.status(400).json({ message: "Cliente, città e anno sono richiesti" });
      }
      
      const generateSafeAcronym = (text: string): string => {
        return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
      };
      
      const CLI = generateSafeAcronym(client);
      const CIT = generateSafeAcronym(city);
      const yearStr = String(year).padStart(2, '0');
      const prefix = `${yearStr}${CLI}${CIT}`;
      
      const allProjects = await storage.getAllProjects();
      const samePrefix = allProjects
        .filter(p => p.code.startsWith(prefix))
        .map(p => parseInt(p.code.slice(-2), 10))
        .sort((a, b) => a - b);
      
      let next = 1;
      while (samePrefix.includes(next)) {
        next++;
      }
      
      const code = `${prefix}${String(next).padStart(2, '0')}`;
      
      res.json({ code });
    } catch (error) {
      res.status(500).json({ message: "Errore nella generazione del codice" });
    }
  });

  // Claude AI test endpoint
  app.post("/api/test-claude", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API Key mancante" });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

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

      res.json({ success: true, message: "Connessione Claude API riuscita" });
    } catch (error) {
      console.error('Claude API test error:', error);
      res.status(500).json({ 
        message: "Errore nel test della connessione",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Claude AI routing endpoint
  app.post("/api/ai-routing", async (req, res) => {
    try {
      const { apiKey, prompt } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API Key mancante" });
      }
      if (!prompt) {
        return res.status(400).json({ message: "Prompt mancante" });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

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
      res.json({ content: data.content[0].text });
    } catch (error) {
      console.error('AI routing error:', error);
      res.status(500).json({ 
        message: "Errore nell'analisi AI",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
