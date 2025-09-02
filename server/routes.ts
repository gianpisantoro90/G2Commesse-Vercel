import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertClientSchema, insertFileRoutingSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate project code
  app.post("/api/generate-code", async (req, res) => {
    try {
      console.log('Generate code request body:', req.body);
      const { year, client, city } = req.body;
      
      if (!year || !client || !city) {
        console.log('Missing required fields - year:', year, 'client:', client, 'city:', city);
        return res.status(400).json({ message: "Anno, cliente e città sono obbligatori" });
      }
      
      // Generate safe acronyms from text
      const generateSafeAcronym = (text: string): string => {
        return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
      };
      
      const clientSigla = generateSafeAcronym(client);
      const citySigla = generateSafeAcronym(city);
      console.log('Generated siglas - client:', clientSigla, 'city:', citySigla);
      
      // Get current year as 2-digit string
      const yearStr = year.toString().slice(-2).padStart(2, '0');
      console.log('Year string:', yearStr, 'from year:', year);
      
      // Create pattern: YY + CLIENT(3) + CITY(3) + NNN
      const prefix = `${yearStr}${clientSigla}${citySigla}`;
      console.log('Generated prefix:', prefix);
      
      // Find highest existing code for this pattern
      const allProjects = await storage.getAllProjects();
      console.log('Total projects found:', allProjects.length);
      
      const existingCodes = allProjects
        .map(p => p.code)
        .filter(code => code.startsWith(prefix))
        .map(code => {
          const match = code.match(/(\d{2})$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => !isNaN(num));
      
      console.log('Existing codes for pattern', `${prefix}*:`, existingCodes);
      
      const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
      const paddedNumber = nextNumber.toString().padStart(2, '0');
      const newCode = `${prefix}${paddedNumber}`;
      
      console.log('Generated new code:', newCode);
      res.json({ code: newCode });
    } catch (error) {
      console.error('Code generation error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Errore nella generazione del codice" });
    }
  });

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

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Cliente non trovato" });
      }
      res.json({ message: "Cliente eliminato con successo" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Errore nell'eliminazione del cliente" });
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



  // Get environment API key
  app.get("/api/get-env-api-key", async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        res.json({ apiKey });
      } else {
        res.status(404).json({ message: "API Key non trovata nelle variabili d'ambiente" });
      }
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero API key" });
    }
  });

  // AI test endpoint (supports multiple providers)
  app.post("/api/test-claude", async (req, res) => {
    try {
      const { apiKey, model } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API Key mancante" });
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
        const claudeModel = model?.startsWith('claude-') ? model : 'claude-sonnet-4-20250514';
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
      const { apiKey, prompt, model } = req.body;
      if (!apiKey) {
        return res.status(400).json({ message: "API Key mancante" });
      }
      if (!prompt) {
        return res.status(400).json({ message: "Prompt mancante" });
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
        const claudeModel = model?.startsWith('claude-') ? model : 'claude-sonnet-4-20250514';
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

  const httpServer = createServer(app);
  return httpServer;
}
