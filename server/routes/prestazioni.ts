import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertProjectPrestazioneSchema, PRESTAZIONE_TIPI, PRESTAZIONE_STATI } from "@shared/schema";
import { parsePaginationParams } from "@shared/pagination";
import { billingAutomationService } from "../lib/billing-automation";

export function registerPrestazioniRoutes(app: Express): void {
  // Get all prestazioni (with optional filters)
  app.get("/api/prestazioni", async (req, res) => {
    try {
      const { stato, projectId } = req.query;

      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getPrestazioniPaginated({
          ...pagination,
          projectId: projectId as string | undefined,
          stato: stato as string | undefined,
        });
        return res.json(result);
      }

      let prestazioni;
      if (projectId && typeof projectId === 'string') {
        prestazioni = await storage.getPrestazioniByProject(projectId);
      } else if (stato && typeof stato === 'string') {
        prestazioni = await storage.getPrestazioniByStato(stato);
      } else {
        prestazioni = await storage.getAllPrestazioni();
      }

      res.json(prestazioni);
    } catch (error) {
      console.error('Error fetching prestazioni:', error);
      res.status(500).json({ message: "Errore nel caricamento delle prestazioni" });
    }
  });

  // Get prestazioni stats for dashboard
  app.get("/api/prestazioni/stats", async (req, res) => {
    try {
      const stats = await storage.getPrestazioniStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching prestazioni stats:', error);
      res.status(500).json({ message: "Errore nel caricamento delle statistiche" });
    }
  });

  // Get available prestazione types and stati (useful for frontend dropdowns)
  app.get("/api/prestazioni/config/options", async (_req, res) => {
    res.json({
      tipi: PRESTAZIONE_TIPI,
      stati: PRESTAZIONE_STATI,
    });
  });

  // Get prestazioni for a specific project
  app.get("/api/projects/:projectId/prestazioni", async (req, res) => {
    try {
      const prestazioni = await storage.getPrestazioniByProject(req.params.projectId);
      res.json(prestazioni);
    } catch (error) {
      console.error('Error fetching project prestazioni:', error);
      res.status(500).json({ message: "Errore nel caricamento delle prestazioni del progetto" });
    }
  });

  // NOTE: Date derivation and metadata sync are handled by:
  // - billingAutomationService.updateProjectDatesFromPrestazioni() — derives project dates from prestazioni
  // - storage.syncMetadataFromPrestazioni() — syncs metadata.prestazioni from table (called by createPrestazione/deletePrestazione)
  // - billingAutomationService.syncPrestazioniFromMetadata() — syncs table from metadata (called on edit-project-form save)
  // The projectPrestazioni TABLE is the single source of truth.

  // Create a new prestazione
  app.post("/api/projects/:projectId/prestazioni", async (req, res) => {
    try {
      const data = insertProjectPrestazioneSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
      // createPrestazione auto-syncs metadata via storage.syncMetadataFromPrestazioni
      const prestazione = await storage.createPrestazione(data);

      // Update project dates from prestazioni (single source: billingAutomationService)
      await billingAutomationService.updateProjectDatesFromPrestazioni(req.params.projectId);

      res.status(201).json(prestazione);
    } catch (error) {
      console.error('Error creating prestazione:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati prestazione non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione della prestazione" });
    }
  });

  // Get a single prestazione
  app.get("/api/prestazioni/:id", async (req, res) => {
    try {
      const prestazione = await storage.getPrestazione(req.params.id);
      if (!prestazione) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }
      res.json(prestazione);
    } catch (error) {
      console.error('Error fetching prestazione:', error);
      res.status(500).json({ message: "Errore nel caricamento della prestazione" });
    }
  });

  // Update a prestazione
  app.patch("/api/prestazioni/:id", async (req, res) => {
    try {
      // Convert date strings to Date objects for Drizzle
      const updateData = { ...req.body };
      const dateFields = ['dataInizio', 'dataCompletamento', 'dataFatturazione', 'dataPagamento'];
      for (const field of dateFields) {
        if (updateData[field] !== undefined && updateData[field] !== null) {
          updateData[field] = new Date(updateData[field]);
        }
      }

      const updated = await storage.updatePrestazione(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      // Sync project dates and metadata (single source: billingAutomationService + storage)
      await billingAutomationService.updateProjectDatesFromPrestazioni(updated.projectId);

      res.json(updated);
    } catch (error) {
      console.error('Error updating prestazione:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento della prestazione" });
    }
  });

  // Update prestazione stato (specific endpoint for status changes with automatic date handling)
  app.patch("/api/prestazioni/:id/stato", async (req, res) => {
    try {
      const { stato, data } = req.body;

      // Validate stato
      if (!PRESTAZIONE_STATI.includes(stato)) {
        return res.status(400).json({ message: "Stato non valido" });
      }

      // Get current prestazione to preserve data
      const currentPrestazione = await storage.getPrestazione(req.params.id);
      if (!currentPrestazione) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      // Prepare update data with date handling (use provided date or current date)
      const updateData: any = { stato };
      const dateToUse = data ? new Date(data) : new Date();

      switch (stato) {
        case 'in_corso':
          updateData.dataInizio = dateToUse;
          break;
        case 'completata':
          updateData.dataCompletamento = dateToUse;
          break;
        case 'fatturata':
          updateData.dataFatturazione = dateToUse;
          // Copy importoPrevisto to importoFatturato if not already set
          if (!updateData.importoFatturato && currentPrestazione.importoPrevisto) {
            updateData.importoFatturato = currentPrestazione.importoPrevisto;
          }
          break;
        case 'pagata':
          updateData.dataPagamento = dateToUse;
          // Copy importoFatturato to importoPagato if not already set
          if (!updateData.importoPagato && currentPrestazione.importoFatturato) {
            updateData.importoPagato = currentPrestazione.importoFatturato;
          }
          break;
      }

      const updated = await storage.updatePrestazione(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      // Sync project dates and metadata (single source: billingAutomationService + storage)
      await billingAutomationService.updateProjectDatesFromPrestazioni(updated.projectId);

      // Trigger billing automation when prestazione is completed
      if (stato === 'completata') {
        try {
          await billingAutomationService.onPrestazioneCompletata(req.params.id);
        } catch (billingError) {
          // Non-blocking: log but don't fail the status update
          console.error('Error in onPrestazioneCompletata:', billingError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating prestazione stato:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento dello stato" });
    }
  });

  // Get invoices linked to a prestazione
  app.get("/api/prestazioni/:id/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByPrestazione(req.params.id);
      res.json(invoices);
    } catch (error) {
      console.error('Error getting invoices for prestazione:', error);
      res.status(500).json({ message: "Errore nel recupero delle fatture" });
    }
  });

  // Recalculate prestazione amounts from linked invoices
  app.post("/api/prestazioni/:id/recalculate", async (req, res) => {
    try {
      const updated = await storage.recalculatePrestazioneImporti(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error recalculating prestazione:', error);
      res.status(500).json({ message: "Errore nel ricalcolo degli importi" });
    }
  });

  // Delete a prestazione
  app.delete("/api/prestazioni/:id", async (req, res) => {
    try {
      // Get prestazione first to retrieve projectId before deletion
      const prestazione = await storage.getPrestazione(req.params.id);
      if (!prestazione) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      const projectId = prestazione.projectId;
      const deleted = await storage.deletePrestazione(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      // Update project dates automatically (metadata already synced by storage.deletePrestazione)
      await billingAutomationService.updateProjectDatesFromPrestazioni(projectId);

      res.json({ message: "Prestazione eliminata con successo" });
    } catch (error) {
      console.error('Error deleting prestazione:', error);
      res.status(500).json({ message: "Errore nell'eliminazione della prestazione" });
    }
  });

  // Sync prestazioni from metadata for ALL projects that have metadata.prestazioni but missing table records
  app.post("/api/prestazioni/sync-all-from-metadata", async (_req, res) => {
    try {
      const projects = await storage.getAllProjects();
      let synced = 0;
      let skipped = 0;
      let errors = 0;

      for (const project of projects) {
        try {
          const metadata = (project.metadata || {}) as Record<string, unknown>;
          const metaPrestazioni = metadata.prestazioni;
          if (!metaPrestazioni || !Array.isArray(metaPrestazioni) || metaPrestazioni.length === 0) {
            skipped++;
            continue;
          }

          // Check if project already has prestazioni records
          const existing = await storage.getPrestazioniByProject(project.id);
          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Sync from metadata
          await billingAutomationService.syncPrestazioniFromMetadata(project.id, metadata);
          synced++;
        } catch {
          errors++;
        }
      }

      res.json({
        message: `Sync completato: ${synced} commesse sincronizzate, ${skipped} saltate, ${errors} errori`,
        synced,
        skipped,
        errors,
      });
    } catch (error) {
      console.error('Error syncing all prestazioni from metadata:', error);
      res.status(500).json({ message: "Errore nella sincronizzazione massiva" });
    }
  });

  // Fix prestazioni amounts - repairs data where importoFatturato or importoPagato are missing
  app.post("/api/prestazioni/fix-amounts", async (_req, res) => {
    try {
      const result = await storage.fixPrestazioniAmounts();
      res.json({
        message: `Corretti ${result.fixed} record, ${result.errors} errori`,
        fixed: result.fixed,
        errors: result.errors,
        status: "success"
      });
    } catch (error) {
      console.error('Error fixing prestazioni amounts:', error);
      res.status(500).json({
        message: "Errore nella correzione degli importi",
        status: "error"
      });
    }
  });
}
