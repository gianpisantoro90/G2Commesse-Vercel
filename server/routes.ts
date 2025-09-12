import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertClientSchema, insertFileRoutingSchema, insertOneDriveMappingSchema, insertSystemConfigSchema, insertFilesIndexSchema } from "@shared/schema";
import serverOneDriveService from "./lib/onedrive-service";
import { z } from "zod";

// OneDrive endpoint validation schemas
const setRootFolderSchema = z.object({
  folderPath: z.string().min(1, "Folder path is required"),
  folderId: z.string().optional(),
});

const createProjectFolderSchema = z.object({
  projectCode: z.string().min(1, "Project code is required"),
  template: z.enum(["LUNGO", "BREVE"], { required_error: "Template must be LUNGO or BREVE" }),
  object: z.string().optional(), // Project description for folder naming
});

const scanFilesSchema = z.object({
  folderPath: z.string().min(1, "Folder path is required"),
  projectCode: z.string().optional(),
  includeSubfolders: z.boolean().default(true),
});

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
      // First get project details before deletion
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // Delete the project
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // Also delete any associated OneDrive mapping
      try {
        await storage.deleteOneDriveMapping(project.code);
        console.log(`🗑️ Deleted OneDrive mapping for project: ${project.code}`);
      } catch (mappingError) {
        console.warn(`⚠️ Could not delete OneDrive mapping for project ${project.code}:`, mappingError);
        // Don't fail the entire operation if mapping deletion fails
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



  // Get environment API key with enhanced local development support
  app.get("/api/get-env-api-key", async (req, res) => {
    try {
      // Check multiple possible environment variables for flexibility
      const apiKey = process.env.ANTHROPIC_API_KEY || 
                    process.env.CLAUDE_API_KEY || 
                    process.env.AI_API_KEY;
      
      if (apiKey) {
        console.log('✅ Environment API key found, providing fallback support');
        res.json({ apiKey });
      } else {
        console.log('⚠️ No environment API key found - user must configure manually');
        res.status(404).json({ 
          message: "API Key non trovata nelle variabili d'ambiente", 
          suggestion: "Configura manualmente l'API Key nelle impostazioni AI" 
        });
      }
    } catch (error) {
      console.error('❌ Error retrieving environment API key:', error);
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

  // OneDrive integration endpoints
  app.get("/api/onedrive/test", async (req, res) => {
    try {
      const isConnected = await serverOneDriveService.testConnection();
      res.json({ connected: isConnected });
    } catch (error) {
      console.error('OneDrive test failed:', error);
      res.status(500).json({ error: 'Failed to test OneDrive connection' });
    }
  });

  app.get("/api/onedrive/user", async (req, res) => {
    try {
      const userInfo = await serverOneDriveService.getUserInfo();
      res.json(userInfo);
    } catch (error) {
      console.error('OneDrive user info failed:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  app.get("/api/onedrive/files", async (req, res) => {
    try {
      const folderPath = req.query.path as string || '/G2_Progetti';
      
      // Input validation
      if (typeof folderPath !== 'string' || folderPath.length > 500) {
        return res.status(400).json({ error: 'Invalid folder path parameter' });
      }
      
      const files = await serverOneDriveService.listFiles(folderPath);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive list files failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const statusCode = isAuthError ? 401 : 500;
      const errorMessage = isAuthError ? 'OneDrive access denied or expired' : 'Failed to list files';
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.post("/api/onedrive/sync-project", async (req, res) => {
    try {
      const { projectCode, projectDescription } = req.body;
      
      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const success = await serverOneDriveService.syncProjectFolder(projectCode, projectDescription || '');
      
      // If sync was successful, create or update the mapping
      if (success) {
        try {
          const rootConfig = await serverOneDriveService.getRootFolderPath();
          const rootPath = rootConfig || '/G2_Progetti';
          const folderPath = `${rootPath}/${projectCode}`;
          
          // Check if mapping already exists
          const existingMapping = await storage.getOneDriveMapping(projectCode);
          
          if (!existingMapping) {
            // Create new mapping
            await storage.createOneDriveMapping({
              projectCode,
              oneDriveFolderId: '', // Will be populated when we have the folder ID
              oneDriveFolderPath: folderPath,
              oneDriveFolderName: projectCode,
              syncStatus: 'synced',
              lastSyncAt: new Date()
            });
            console.log(`✅ Created OneDrive mapping for project: ${projectCode}`);
          }
        } catch (mappingError) {
          console.warn(`⚠️ Could not create OneDrive mapping for project ${projectCode}:`, mappingError);
          // Don't fail the sync operation if mapping creation fails
        }
      }
      
      res.json({ success });
    } catch (error) {
      console.error('OneDrive sync project failed:', error);
      res.status(500).json({ error: 'Failed to sync project folder' });
    }
  });

  // OneDrive Mappings Management API
  app.get("/api/onedrive/mappings", async (req, res) => {
    try {
      const mappings = await storage.getAllOneDriveMappings();
      res.json(mappings);
    } catch (error) {
      console.error('Failed to get OneDrive mappings:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mappings' });
    }
  });

  app.get("/api/onedrive/mappings/:projectCode", async (req, res) => {
    try {
      const { projectCode } = req.params;
      
      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const mapping = await storage.getOneDriveMapping(projectCode);
      
      if (!mapping) {
        return res.status(404).json({ error: 'OneDrive mapping not found for this project' });
      }

      res.json(mapping);
    } catch (error) {
      console.error('Failed to get OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mapping' });
    }
  });

  app.post("/api/onedrive/mappings", async (req, res) => {
    try {
      const validatedData = insertOneDriveMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existingMapping = await storage.getOneDriveMapping(validatedData.projectCode);
      if (existingMapping) {
        return res.status(400).json({ error: 'OneDrive mapping already exists for this project' });
      }

      const mapping = await storage.createOneDriveMapping(validatedData);
      res.status(201).json(mapping);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Failed to create OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to create OneDrive mapping' });
    }
  });

  app.delete("/api/onedrive/mappings/:projectCode", async (req, res) => {
    try {
      const { projectCode } = req.params;
      
      if (!projectCode) {
        return res.status(400).json({ error: 'Project code is required' });
      }

      const success = await storage.deleteOneDriveMapping(projectCode);
      
      if (!success) {
        return res.status(404).json({ error: 'OneDrive mapping not found for this project' });
      }

      res.json({ message: 'OneDrive mapping deleted successfully' });
    } catch (error) {
      console.error('Failed to delete OneDrive mapping:', error);
      res.status(500).json({ error: 'Failed to delete OneDrive mapping' });
    }
  });

  app.get("/api/onedrive/download/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      // Input validation
      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'File ID is required and must be a string' });
      }
      
      if (fileId.length > 200) {
        return res.status(400).json({ error: 'File ID too long' });
      }
      
      const fileBuffer = await serverOneDriveService.downloadFile(fileId);
      
      if (!fileBuffer) {
        return res.status(404).json({ error: 'File not found or could not be downloaded' });
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('OneDrive download failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('invalid characters');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : (isBadRequest ? 400 : 500));
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'File not found' : (isBadRequest ? 'Invalid file ID' : 'Failed to download file'));
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  // Extended OneDrive API for full navigation
  app.get("/api/onedrive/browse", async (req, res) => {
    try {
      const folderPath = req.query.path as string || '/';
      
      // Input validation
      if (typeof folderPath !== 'string' || folderPath.length > 500) {
        return res.status(400).json({ error: 'Invalid folder path parameter' });
      }
      
      const files = await serverOneDriveService.listFiles(folderPath);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive browse failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : 500);
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'Folder not found' : 'Failed to browse OneDrive');
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.get("/api/onedrive/hierarchy", async (req, res) => {
    try {
      const folders = await serverOneDriveService.getFolderHierarchy();
      res.json(folders);
    } catch (error) {
      console.error('OneDrive hierarchy failed:', error);
      res.status(500).json({ error: 'Failed to get folder hierarchy' });
    }
  });

  app.get("/api/onedrive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      // Input validation
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required and must be a string' });
      }
      
      if (query.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }
      
      if (query.length > 255) {
        return res.status(400).json({ error: 'Search query too long (max 255 characters)' });
      }
      
      const files = await serverOneDriveService.searchFiles(query);
      res.json(files);
    } catch (error: any) {
      console.error('OneDrive search failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('too long');
      const statusCode = isAuthError ? 401 : (isBadRequest ? 400 : 500);
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isBadRequest ? 'Invalid search request' : 'Failed to search OneDrive');
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.get("/api/onedrive/content/:fileId", async (req, res) => {
    try {
      const fileId = req.params.fileId;
      
      // Input validation
      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'File ID is required and must be a string' });
      }
      
      if (fileId.length > 200) {
        return res.status(400).json({ error: 'File ID too long' });
      }
      
      const content = await serverOneDriveService.getFileContent(fileId);
      
      if (content === null) {
        return res.status(422).json({ error: 'File content not available (binary or unsupported type)' });
      }
      
      res.json({ content });
    } catch (error: any) {
      console.error('OneDrive file content failed:', error);
      const isAuthError = error.message?.includes('401') || error.message?.includes('403');
      const isNotFound = error.message?.includes('404') || error.message?.includes('not found');
      const isBadRequest = error.message?.includes('Invalid') || error.message?.includes('invalid characters');
      const statusCode = isAuthError ? 401 : (isNotFound ? 404 : (isBadRequest ? 400 : 500));
      const errorMessage = isAuthError ? 'OneDrive access denied' : (isNotFound ? 'File not found' : (isBadRequest ? 'Invalid file ID' : 'Failed to get file content'));
      res.status(statusCode).json({ error: errorMessage, details: error.message });
    }
  });

  app.post("/api/onedrive/link-project", async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = insertOneDriveMappingSchema.parse(req.body);
      const { projectCode, oneDriveFolderId, oneDriveFolderName, oneDriveFolderPath } = validatedData;
      
      // Check if project exists
      const project = await storage.getProjectByCode(projectCode);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check if mapping already exists
      const existingMapping = await storage.getOneDriveMapping(projectCode);
      if (existingMapping) {
        return res.status(409).json({ error: 'Project is already linked to a OneDrive folder' });
      }
      
      // Validate OneDrive folder exists and save mapping
      const success = await serverOneDriveService.linkProjectToFolder(projectCode, oneDriveFolderId, oneDriveFolderName, oneDriveFolderPath);
      
      if (success) {
        // Save mapping to database
        const mapping = await storage.createOneDriveMapping(validatedData);
        console.log('✅ Created OneDrive mapping:', mapping.id);
        res.json({ success: true, mapping });
      } else {
        res.status(400).json({ error: 'Failed to validate OneDrive folder' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('OneDrive project link failed:', error);
      res.status(500).json({ error: 'Failed to link project to OneDrive folder' });
    }
  });

  // OneDrive-centric system endpoints
  app.post("/api/onedrive/set-root-folder", async (req, res) => {
    try {
      const validatedData = setRootFolderSchema.parse(req.body);
      const { folderPath, folderId } = validatedData;

      // Validate folder exists on OneDrive
      const isValid = await serverOneDriveService.validateFolder(folderId || folderPath);
      if (!isValid) {
        return res.status(400).json({ error: 'OneDrive folder not found or inaccessible' });
      }

      // Extract folder name from path
      const folderName = folderPath.split('/').pop() || 'Root';

      // Save root folder configuration with correct field names
      const configData = {
        folderPath: folderPath,
        folderId: folderId || null,
        folderName: folderName,
        lastUpdated: new Date().toISOString()
      };
      
      const config = await storage.setSystemConfig('onedrive_root_folder', configData);

      console.log('✅ OneDrive root folder configured:', folderPath);
      res.json({ success: true, config: { ...config, value: configData } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error('Set root folder failed:', error);
      res.status(500).json({ error: 'Failed to set OneDrive root folder' });
    }
  });

  app.get("/api/onedrive/root-folder", async (req, res) => {
    try {
      const systemConfig = await storage.getSystemConfig('onedrive_root_folder');
      
      if (systemConfig && systemConfig.value) {
        const rawConfig = systemConfig.value;
        
        // Transform the data to match frontend interface format
        const transformedConfig = {
          folderPath: rawConfig.folderPath || rawConfig.path || '',
          folderId: rawConfig.folderId || '',
          folderName: rawConfig.folderName || (rawConfig.folderPath || rawConfig.path || '').split('/').pop() || 'Root',
          lastUpdated: rawConfig.lastUpdated || rawConfig.configuredAt || new Date().toISOString()
        };
        
        res.json({ 
          config: transformedConfig,
          configured: true 
        });
      } else {
        res.json({ configured: false });
      }
    } catch (error) {
      console.error('Get root folder failed:', error);
      res.status(500).json({ error: 'Failed to get root folder configuration' });
    }
  });

  // OneDrive Mappings CRUD endpoints
  app.get("/api/onedrive-mappings", async (req, res) => {
    try {
      const mappings = await storage.getAllOneDriveMappings();
      res.json(mappings);
    } catch (error) {
      console.error('Get OneDrive mappings failed:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mappings' });
    }
  });

  app.get("/api/onedrive-mappings/:projectCode", async (req, res) => {
    try {
      const mapping = await storage.getOneDriveMapping(req.params.projectCode);
      if (!mapping) {
        return res.status(404).json({ error: 'OneDrive mapping not found' });
      }
      res.json(mapping);
    } catch (error) {
      console.error('Get OneDrive mapping failed:', error);
      res.status(500).json({ error: 'Failed to retrieve OneDrive mapping' });
    }
  });

  app.delete("/api/onedrive-mappings/:projectCode", async (req, res) => {
    try {
      const deleted = await storage.deleteOneDriveMapping(req.params.projectCode);
      if (!deleted) {
        return res.status(404).json({ error: 'OneDrive mapping not found' });
      }
      res.json({ message: 'OneDrive mapping deleted successfully' });
    } catch (error) {
      console.error('Delete OneDrive mapping failed:', error);
      res.status(500).json({ error: 'Failed to delete OneDrive mapping' });
    }
  });

  app.post("/api/onedrive/validate-folder", async (req, res) => {
    try {
      const { folderIdOrPath } = req.body;
      if (!folderIdOrPath) {
        return res.status(400).json({ error: 'Folder ID or path is required' });
      }
      
      const isValid = await serverOneDriveService.validateFolder(folderIdOrPath);
      res.json({ valid: isValid });
    } catch (error) {
      console.error('OneDrive folder validation failed:', error);
      res.status(500).json({ error: 'Failed to validate OneDrive folder' });
    }
  });

  app.post("/api/onedrive/create-project-folder", async (req, res) => {
    try {
      console.log('🚀 Starting OneDrive project folder creation...');
      const validatedData = createProjectFolderSchema.parse(req.body);
      const { projectCode, template } = validatedData;
      
      console.log(`📋 Request details: projectCode=${projectCode}, template=${template}`);

      // Get root folder configuration
      const rootConfig = await storage.getSystemConfig('onedrive_root_folder');
      if (!rootConfig || !rootConfig.value || !(rootConfig.value as any).folderPath) {
        console.error('❌ OneDrive root folder not configured');
        return res.status(400).json({ 
          success: false,
          error: 'OneDrive root folder not configured. Please configure the root folder in system settings.' 
        });
      }

      const rootPath = (rootConfig.value as any).folderPath;
      console.log(`📁 Using root path: ${rootPath}`);

      // Create project folder with template
      console.log(`🔄 Creating project folder: ${rootPath}/${projectCode} with ${template} template`);
      const folderInfo = await serverOneDriveService.createProjectWithTemplate(
        rootPath, 
        projectCode, 
        template,
        req.body.object // Pass project object (description) for folder naming
      );

      if (folderInfo) {
        console.log(`✅ OneDrive folder created successfully: ${folderInfo.path}`);
        
        // Save OneDrive mapping
        const mapping = await storage.createOneDriveMapping({
          projectCode,
          oneDriveFolderId: folderInfo.id,
          oneDriveFolderName: folderInfo.name,
          oneDriveFolderPath: folderInfo.path
        });

        console.log('📝 OneDrive mapping saved to database:', folderInfo.path);
        res.json({ 
          success: true, 
          folder: folderInfo, 
          mapping,
          message: `Project folder created successfully at ${folderInfo.path}`
        });
      } else {
        console.error('❌ OneDrive folder creation returned null');
        res.status(500).json({ 
          success: false,
          error: 'Failed to create OneDrive project folder. Check server logs for details.' 
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation error:', error.errors);
        return res.status(400).json({ 
          success: false,
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error('❌ Create project folder failed:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        statusCode: error.statusCode,
        requestId: error.requestId
      });
      
      // Enhanced error classification based on Microsoft Graph errors
      let statusCode = 500;
      let errorMessage = 'Failed to create project folder on OneDrive';
      let errorCode = 'FOLDER_CREATION_FAILED';
      
      const errorText = (error.message || '').toLowerCase();
      
      // Microsoft Graph specific errors
      if (errorText.includes('status: 400')) {
        statusCode = 400;
        if (errorText.includes('invalidrequest') || errorText.includes('badrequest')) {
          errorMessage = 'Invalid folder name or path. Please use only letters, numbers, hyphens, and underscores.';
          errorCode = 'INVALID_FOLDER_NAME';
        } else if (errorText.includes('conflictingitemname') || errorText.includes('nameconflict')) {
          errorMessage = 'A folder with this name already exists. Please choose a different project code.';
          errorCode = 'FOLDER_EXISTS';
        } else if (errorText.includes('quotaexceeded') || errorText.includes('insufficientstorage')) {
          errorMessage = 'OneDrive storage quota exceeded. Please free up space or contact administrator.';
          errorCode = 'STORAGE_QUOTA_EXCEEDED';
        } else {
          errorMessage = 'Invalid request to OneDrive. Please check the project code and try again.';
          errorCode = 'BAD_REQUEST';
        }
      } else if (errorText.includes('status: 401') || errorText.includes('authentication')) {
        statusCode = 401;
        errorMessage = 'OneDrive authentication expired. Please reconnect OneDrive in system settings.';
        errorCode = 'AUTHENTICATION_FAILED';
      } else if (errorText.includes('status: 403') || errorText.includes('forbidden')) {
        statusCode = 403;
        errorMessage = 'Insufficient permissions to create folders in OneDrive. Please check OneDrive permissions.';
        errorCode = 'PERMISSIONS_DENIED';
      } else if (errorText.includes('status: 404') || errorText.includes('not found')) {
        statusCode = 404;
        errorMessage = 'OneDrive root folder not found. Please reconfigure the OneDrive root folder.';
        errorCode = 'ROOT_FOLDER_NOT_FOUND';
      } else if (errorText.includes('status: 429') || errorText.includes('throttled')) {
        statusCode = 429;
        errorMessage = 'OneDrive API rate limit exceeded. Please wait a moment and try again.';
        errorCode = 'RATE_LIMITED';
      } else if (errorText.includes('template structure creation failed')) {
        errorMessage = 'Project folder created but template structure failed. Some subfolders may be missing.';
        errorCode = 'TEMPLATE_STRUCTURE_FAILED';
      } else if (errorText.includes('invalid characters')) {
        statusCode = 400;
        errorMessage = 'Project code contains invalid characters. Please use only letters, numbers, hyphens, and underscores.';
        errorCode = 'INVALID_PROJECT_CODE';
      } else if (errorText.includes('root folder') && errorText.includes('not configured')) {
        statusCode = 400;
        errorMessage = 'OneDrive root folder not configured. Please configure it in system settings.';
        errorCode = 'ROOT_FOLDER_NOT_CONFIGURED';
      }
      
      res.status(statusCode).json({ 
        success: false,
        error: errorMessage,
        code: errorCode,
        details: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post("/api/onedrive/scan-files", async (req, res) => {
    try {
      const validatedData = scanFilesSchema.parse(req.body);
      const { folderPath, projectCode, includeSubfolders } = validatedData;

      // Scan OneDrive folder
      const files = await serverOneDriveService.scanFolderRecursive(folderPath, {
        includeSubfolders,
        maxDepth: includeSubfolders ? 5 : 1
      });

      // Index files in database
      const indexed = [];
      for (const file of files) {
        try {
          const fileIndex = await storage.createOrUpdateFileIndex({
            driveItemId: file.id,
            name: file.name,
            path: file.path || folderPath + '/' + file.name,
            size: file.size || 0,
            mimeType: file.mimeType || 'application/octet-stream',
            lastModified: file.lastModified ? new Date(file.lastModified) : new Date(),
            projectCode: projectCode || null,
            parentFolderId: file.parentFolderId || null,
            isFolder: file.folder || false,
            webUrl: file.webUrl || null,
            downloadUrl: file.downloadUrl || null
          });
          indexed.push(fileIndex);
        } catch (indexError) {
          console.error('Failed to index file:', file.name, indexError);
        }
      }

      console.log(`✅ Scanned and indexed ${indexed.length} files from ${folderPath}`);
      res.json({ 
        success: true, 
        scanned: files.length, 
        indexed: indexed.length,
        files: indexed 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error('Scan files failed:', error);
      res.status(500).json({ error: 'Failed to scan OneDrive files' });
    }
  });

  app.post("/api/onedrive/move-file", async (req, res) => {
    try {
      const { fileId, targetFolderId, targetPath } = req.body;
      
      if (!fileId || (!targetFolderId && !targetPath)) {
        return res.status(400).json({ error: 'File ID and target folder ID or path required' });
      }

      // Move file on OneDrive
      const result = await serverOneDriveService.moveFile(fileId, targetFolderId || targetPath);
      
      if (result) {
        // Update file index
        const updated = await storage.updateFileIndex(fileId, {
          path: result.path,
          parentFolderId: result.parentFolderId
        });

        console.log('✅ Moved OneDrive file:', result.name);
        res.json({ success: true, file: result, updated });
      } else {
        res.status(400).json({ error: 'Failed to move file on OneDrive' });
      }
    } catch (error) {
      console.error('Move file failed:', error);
      res.status(500).json({ error: 'Failed to move OneDrive file' });
    }
  });

  // OneDrive reconciliation endpoint
  app.post("/api/onedrive/reconcile", async (req, res) => {
    try {
      console.log('🔄 Starting OneDrive reconciliation...');
      
      // Get orphaned projects (projects without OneDrive mappings)
      const orphanedProjects = await storage.getOrphanedProjects();
      console.log(`📋 Found ${orphanedProjects.length} orphaned projects`);
      
      if (orphanedProjects.length === 0) {
        return res.json({ 
          success: true, 
          message: 'No orphaned projects found. All projects have OneDrive mappings.',
          processed: 0,
          results: []
        });
      }

      // Get root folder configuration
      const rootConfig = await storage.getSystemConfig('onedrive_root_folder');
      if (!rootConfig || !rootConfig.value || !(rootConfig.value as any).folderPath) {
        console.error('❌ OneDrive root folder not configured');
        return res.status(400).json({ 
          success: false,
          error: 'OneDrive root folder not configured. Please configure the root folder in system settings.' 
        });
      }

      const rootPath = (rootConfig.value as any).folderPath;
      console.log(`📁 Using root path: ${rootPath}`);

      const results = [];
      
      for (const project of orphanedProjects) {
        console.log(`🔍 Processing project: ${project.code}`);
        
        try {
          // Try to find existing OneDrive folder for this project
          const folderPath = `${rootPath}/${project.code}`;
          const existingFolder = await serverOneDriveService.findFolderByPath(folderPath);
          
          if (existingFolder) {
            // Folder exists - create mapping
            console.log(`✅ Found existing folder for ${project.code}, creating mapping`);
            const mapping = await storage.createOneDriveMapping({
              projectCode: project.code,
              oneDriveFolderId: existingFolder.id,
              oneDriveFolderName: existingFolder.name,
              oneDriveFolderPath: folderPath
            });
            
            results.push({
              projectCode: project.code,
              status: 'mapped_existing',
              message: `Mapped to existing folder: ${folderPath}`,
              folderId: existingFolder.id
            });
          } else {
            // Folder doesn't exist - create it with template
            console.log(`📁 Creating new OneDrive folder for ${project.code} with ${project.template} template`);
            const folderInfo = await serverOneDriveService.createProjectWithTemplate(
              rootPath, 
              project.code, 
              project.template,
              project.object // Pass project object (description) for folder naming
            );

            if (folderInfo) {
              // Create mapping for new folder
              const mapping = await storage.createOneDriveMapping({
                projectCode: project.code,
                oneDriveFolderId: folderInfo.id,
                oneDriveFolderName: folderInfo.name,
                oneDriveFolderPath: folderInfo.path
              });

              results.push({
                projectCode: project.code,
                status: 'created_new',
                message: `Created new folder with ${project.template} template: ${folderInfo.path}`,
                folderId: folderInfo.id
              });
            } else {
              results.push({
                projectCode: project.code,
                status: 'error',
                message: 'Failed to create OneDrive folder'
              });
            }
          }
        } catch (error: any) {
          console.error(`❌ Error processing project ${project.code}:`, error);
          results.push({
            projectCode: project.code,
            status: 'error',
            message: error.message || 'Unknown error occurred'
          });
        }
      }

      const successCount = results.filter(r => r.status !== 'error').length;
      console.log(`✅ Reconciliation completed: ${successCount}/${results.length} projects processed successfully`);

      res.json({ 
        success: true, 
        message: `Reconciliation completed: ${successCount}/${results.length} projects processed successfully`,
        processed: results.length,
        results
      });
    } catch (error: any) {
      console.error('❌ OneDrive reconciliation failed:', error);
      res.status(500).json({ 
        success: false,
        error: 'Reconciliation failed. Check server logs for details.',
        details: error.message
      });
    }
  });

  // Files Index management
  app.get("/api/files-index", async (req, res) => {
    try {
      const { projectCode, path, limit = 100 } = req.query;
      const files = await storage.getFilesIndex({
        projectCode: projectCode as string,
        path: path as string,
        limit: parseInt(limit as string) || 100
      });
      res.json(files);
    } catch (error) {
      console.error('Get files index failed:', error);
      res.status(500).json({ error: 'Failed to get files index' });
    }
  });

  app.delete("/api/files-index/:driveItemId", async (req, res) => {
    try {
      const { driveItemId } = req.params;
      const deleted = await storage.deleteFileIndex(driveItemId);
      res.json({ success: !!deleted, deleted });
    } catch (error) {
      console.error('Delete file index failed:', error);
      res.status(500).json({ error: 'Failed to delete file index' });
    }
  });

  // OneDrive Integration Setup endpoint
  app.post("/api/integration/setup-onedrive", async (req, res) => {
    try {
      // Check if OneDrive is already configured (handle errors gracefully)
      let isConfigured = false;
      try {
        isConfigured = await serverOneDriveService.testConnection();
      } catch (connectionError) {
        // Expected when OneDrive is not configured - not an error for setup
        console.log('OneDrive not configured (expected for setup):', connectionError.message);
        isConfigured = false;
      }
      
      if (isConfigured) {
        return res.json({ 
          success: true, 
          message: "OneDrive is already configured and connected",
          alreadyConfigured: true 
        });
      }

      // Return instructions for manual setup
      res.json({
        success: true,
        message: "OneDrive setup instructions",
        alreadyConfigured: false,
        instructions: {
          title: "Configura OneDrive",
          steps: [
            "1. Vai nelle impostazioni del progetto Replit",
            "2. Nella sezione 'Integrations', cerca e attiva 'OneDrive'", 
            "3. Autorizza l'accesso al tuo account Microsoft quando richiesto",
            "4. Torna qui e clicca 'Ricarica Dati' per verificare la connessione"
          ],
          setupUrl: `${process.env.REPL_SLUG ? `https://replit.com/@${process.env.REPL_OWNER}/${process.env.REPL_SLUG}` : ''}/settings/integrations`,
          note: "L'integrazione OneDrive permette di sincronizzare automaticamente i tuoi progetti con il cloud storage Microsoft."
        }
      });
    } catch (error) {
      console.error('OneDrive setup endpoint failed:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to check OneDrive integration status' 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
