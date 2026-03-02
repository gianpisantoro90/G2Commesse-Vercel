import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertProjectSchema, prestazioniSchema } from "@shared/schema";
import { parsePaginationParams } from "@shared/pagination";
import serverOneDriveService, { ONEDRIVE_DEFAULT_FOLDERS } from "../lib/onedrive-service";
import { billingAutomationService } from "../lib/billing-automation";
import { requireAdmin } from "./middleware";

export function registerProjectRoutes(app: Express): void {
  // Admin endpoint to reset all projects to "in corso" status (POST only, admin protected)
  app.post("/api/admin/reset-all-projects-to-in-corso", requireAdmin, async (req, res) => {
    try {
      const allProjects = await storage.getAllProjects();

      let updatedCount = 0;
      let sospesaCount = 0;

      for (const project of allProjects) {
        if (project.status === 'sospesa') {
          sospesaCount++;
        }
        const updated = await storage.updateProject(project.id, { status: 'in corso' });
        if (updated) {
          updatedCount++;
        }
      }

      const message = `Reset complete: ${updatedCount} projects updated (${sospesaCount} were sospesa)`;
      res.json({ message, updatedCount, sospesaCount, totalProjects: allProjects.length });
    } catch (error) {
      console.error('❌ [RESET] Error resetting projects:', error);
      res.status(500).json({ message: "Errore nel reset dei progetti" });
    }
  });

  // Generate project code
  app.post("/api/generate-code", async (req, res) => {
    try {
      const { year, client, city } = req.body;

      if (!year || !client || !city) {
        return res.status(400).json({ message: "Anno, cliente e città sono obbligatori" });
      }

      // Generate safe acronyms from text (fallback)
      const generateSafeAcronym = (text: string): string => {
        return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
      };

      // Cerca il cliente nell'archivio per usare la sigla registrata
      let clientSigla: string;
      const allClients = await storage.getAllClients();
      const matchedClient = allClients.find(c =>
        c.name.toLowerCase() === client.toLowerCase() ||
        c.sigla.toLowerCase() === client.toLowerCase()
      );

      if (matchedClient && matchedClient.sigla) {
        // Usa la sigla del cliente dall'archivio (primi 3 caratteri)
        clientSigla = matchedClient.sigla.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
      } else {
        // Fallback: genera acronimo dal nome
        clientSigla = generateSafeAcronym(client);
      }

      const citySigla = generateSafeAcronym(city);

      // Get current year as 2-digit string
      const yearStr = year.toString().slice(-2).padStart(2, '0');

      // Create pattern: YY + CLIENT(3) + CITY(3) + NNN
      const prefix = `${yearStr}${clientSigla}${citySigla}`;

      // Find highest existing code for this pattern
      const allProjects = await storage.getAllProjects();

      const existingCodes = allProjects
        .map(p => p.code)
        .filter(code => code.startsWith(prefix))
        .map(code => {
          const match = code.match(/(\d{2})$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => !isNaN(num));


      const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
      const paddedNumber = nextNumber.toString().padStart(2, '0');
      const newCode = `${prefix}${paddedNumber}`;

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
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getProjectsPaginated({
          ...pagination,
          status: req.query.status as string | undefined,
          year: req.query.year as string | undefined,
          creFilter: req.query.creFilter as string | undefined,
        });
        return res.json(result);
      }

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

      // AUTO: Imposta data inizio commessa automaticamente
      await billingAutomationService.setAutoDataInizio(project.id);

      // AUTO: Sincronizza prestazioni da metadata (crea record nella tabella)
      const projectMetadata = (validatedData.metadata || {}) as Record<string, unknown>;
      if (projectMetadata.prestazioni && Array.isArray(projectMetadata.prestazioni) && projectMetadata.prestazioni.length > 0) {
        await billingAutomationService.syncPrestazioniFromMetadata(project.id, projectMetadata);
      }

      // Restituisci il progetto aggiornato
      const updatedProject = await storage.getProject(project.id);
      res.status(201).json(updatedProject || project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione della commessa" });
    }
  });

  // Support both PUT and PATCH for updates
  const updateProjectHandler = async (req: Request, res: Response) => {
    try {
      // Get the original project to check for status change
      const originalProject = await storage.getProject(req.params.id);
      if (!originalProject) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // Convert date strings to Date objects for validation
      const bodyWithDates = { ...req.body };
      if (bodyWithDates.dataFattura && typeof bodyWithDates.dataFattura === 'string') {
        bodyWithDates.dataFattura = new Date(bodyWithDates.dataFattura);
      }
      if (bodyWithDates.dataPagamento && typeof bodyWithDates.dataPagamento === 'string') {
        bodyWithDates.dataPagamento = new Date(bodyWithDates.dataPagamento);
      }

      const validatedData = insertProjectSchema.partial().parse(bodyWithDates);

      const project = await storage.updateProject(req.params.id, validatedData);

      if (!project) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // AUTO: Sincronizza prestazioni da metadata se presenti
      const updatedMetadata = (project.metadata || {}) as Record<string, unknown>;
      if (updatedMetadata.prestazioni && Array.isArray(updatedMetadata.prestazioni) && updatedMetadata.prestazioni.length > 0) {
        await billingAutomationService.syncPrestazioniFromMetadata(req.params.id, updatedMetadata);
      }

      // Handle OneDrive folder move if status changed to conclusa or sospesa
      const oldStatus = originalProject.status;
      const newStatus = project.status;
      const statusChanged = oldStatus !== newStatus && (newStatus === 'conclusa' || newStatus === 'sospesa');

      if (statusChanged) {
        try {
          // Retrieve the OneDrive mapping to get the actual folder path
          const mapping = await storage.getOneDriveMapping(project.code);
          if (mapping) {
            // Use the complete folder path from the mapping (contains the correct root path + folder name)
            const folderPathToMove = mapping.oneDriveFolderPath;

            // Usa la configurazione salvata o il default
            const archiveConfig = await storage.getSystemConfig('onedrive_archive_folder');
            const archivePath = (archiveConfig?.value as any)?.folderPath || ONEDRIVE_DEFAULT_FOLDERS.ARCHIVE_FOLDER;
            const archiveFolderId = (archiveConfig?.value as any)?.folderId || undefined;

            const moveResult = await serverOneDriveService.moveProjectToArchive(
              folderPathToMove,
              archivePath,
              mapping.oneDriveFolderId || undefined,
              archiveFolderId
            );
            if (moveResult.success && moveResult.newPath) {
              await storage.updateOneDriveMapping(project.code, {
                oneDriveFolderPath: moveResult.newPath
              });
            }
          }
        } catch (archiveError: any) {
          // Archive move error (non-critical) - project update still succeeded
        }
      }

      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error('❌ Error updating project:', error);
      console.error('📋 Project ID:', req.params.id);
      console.error('📋 Request body:', JSON.stringify(req.body, null, 2));
      res.status(500).json({ message: "Errore nell'aggiornamento della commessa" });
    }
  };

  app.put("/api/projects/:id", updateProjectHandler);
  app.patch("/api/projects/:id", updateProjectHandler);

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      // First get project details before deletion
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // Step 1: Delete any file routings associated with the project (must be done first due to FK constraint)
      try {
        await storage.deleteFileRoutingsByProject(req.params.id);
      } catch (routingError) {
        // Continue with other deletions even if file routing deletion fails
        // Continue with other deletions even if file routing deletion fails
      }

      // Step 2: Delete any associated OneDrive mapping (must be done before project deletion due to FK constraint)
      try {
        await storage.deleteOneDriveMapping(project.code);
      } catch (mappingError) {
        // Continue with project deletion even if mapping deletion fails
        // Continue with project deletion even if mapping deletion fails
      }

      // Step 3: Now delete the project (safe after dependencies are removed)
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      res.json({ message: "Commessa eliminata con successo" });
    } catch (error) {
      console.error(`❌ Error deleting project ${req.params.id}:`, error);
      res.status(500).json({ message: "Errore nell'eliminazione della commessa" });
    }
  });

  // Project prestazioni endpoint (metadata update)
  app.put("/api/projects/:id/prestazioni", async (req, res) => {
    try {

      // Validate prestazioni data
      const validatedPrestazioni = prestazioniSchema.parse(req.body);

      // Get existing project first
      const existingProject = await storage.getProject(req.params.id);
      if (!existingProject) {
        return res.status(404).json({ message: "Commessa non trovata" });
      }

      // Sincronizza campi deprecati da classificazioniDM2016 per retrocompatibilità
      let importoOpereCalcolato: number | undefined;
      let classeDM2016Principale: string | undefined;

      if (validatedPrestazioni.classificazioniDM2016 && validatedPrestazioni.classificazioniDM2016.length > 0) {
        // Calcola la somma totale degli importi opere
        importoOpereCalcolato = validatedPrestazioni.classificazioniDM2016.reduce(
          (sum, c) => sum + (c.importo || 0), 0
        );
        // Usa la prima classificazione come classeDM2016 principale (retrocompatibilità)
        classeDM2016Principale = validatedPrestazioni.classificazioniDM2016[0].codice;
      }

      // Merge prestazioni into existing metadata
      const currentMetadata = existingProject.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        ...validatedPrestazioni,
        // Sincronizza campi deprecati per retrocompatibilità con dashboard
        ...(importoOpereCalcolato !== undefined && { importoOpere: importoOpereCalcolato }),
        ...(classeDM2016Principale && { classeDM2016: classeDM2016Principale }),
      };

      // Update project with new metadata
      const updatedProject = await storage.updateProject(req.params.id, {
        metadata: updatedMetadata
      });

      if (!updatedProject) {
        return res.status(404).json({ message: "Errore nell'aggiornamento delle prestazioni" });
      }

      // BILLING AUTOMATION: Sync prestazioni table from metadata (blocking — table is source of truth)
      await billingAutomationService.syncPrestazioniFromMetadata(
        req.params.id,
        updatedMetadata
      );

      // Restituisci il progetto aggiornato (con eventuali date aggiornate)
      const finalProject = await storage.getProject(req.params.id);
      res.json(finalProject || updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`❌ Validation error for prestazioni:`, error.errors);
        return res.status(400).json({
          message: "Dati prestazioni non validi",
          errors: error.errors
        });
      }
      console.error(`❌ Error updating prestazioni for project ${req.params.id}:`, error);
      res.status(500).json({ message: "Errore nell'aggiornamento delle prestazioni" });
    }
  });
}
