import type { Express } from "express";
import { storage } from "../storage";
import { insertPrestazioneClassificazioneSchema } from "@shared/schema";

export function registerClassificazioniRoutes(app: Express): void {

  // Get classificazioni for a prestazione
  app.get("/api/prestazioni/:id/classificazioni", async (req, res) => {
    try {
      const classificazioni = await storage.getClassificazioniByPrestazione(req.params.id);
      res.json(classificazioni);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all classificazioni for a project
  app.get("/api/projects/:projectId/classificazioni", async (req, res) => {
    try {
      const classificazioni = await storage.getClassificazioniByProject(req.params.projectId);
      res.json(classificazioni);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add classificazione to a prestazione
  app.post("/api/prestazioni/:id/classificazioni", async (req, res) => {
    try {
      const prestazione = await storage.getPrestazione(req.params.id);
      if (!prestazione) {
        return res.status(404).json({ message: "Prestazione non trovata" });
      }

      const data = insertPrestazioneClassificazioneSchema.parse({
        ...req.body,
        prestazioneId: req.params.id,
        projectId: prestazione.projectId,
      });

      const classificazione = await storage.createClassificazione(data);
      res.status(201).json(classificazione);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      if (error.code === '23505') {
        return res.status(409).json({ message: "Questa classificazione DM è già presente per questa prestazione" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update classificazione
  app.patch("/api/prestazioni/:prestazioneId/classificazioni/:classId", async (req, res) => {
    try {
      const updated = await storage.updateClassificazione(req.params.classId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Classificazione non trovata" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ message: "Questa classificazione DM è già presente per questa prestazione" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Delete classificazione
  app.delete("/api/prestazioni/:prestazioneId/classificazioni/:classId", async (req, res) => {
    try {
      const deleted = await storage.deleteClassificazione(req.params.classId);
      if (!deleted) {
        return res.status(404).json({ message: "Classificazione non trovata" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Migration: copy metadata classificazioni to new table
  app.post("/api/prestazioni/migrate-classificazioni", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      let migrated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const project of projects) {
        const metadata = (project.metadata as any) || {};
        const classificazioni = metadata.classificazioniDM2016 as Array<{
          codice: string; importo?: number; importoOpere?: number; importoServizio?: number;
        }> | undefined;

        if (!classificazioni || classificazioni.length === 0) {
          skipped++;
          continue;
        }

        const prestazioni = await storage.getPrestazioniByProject(project.id);
        if (prestazioni.length === 0) {
          skipped++;
          continue;
        }

        // Sort: progettazione first
        const sorted = [...prestazioni].sort((a, b) => {
          if (a.tipo === 'progettazione') return -1;
          if (b.tipo === 'progettazione') return 1;
          return 0;
        });

        for (let pi = 0; pi < sorted.length; pi++) {
          const p = sorted[pi];
          for (const c of classificazioni) {
            try {
              await storage.createClassificazione({
                prestazioneId: p.id,
                projectId: project.id,
                codiceDM: c.codice,
                importoOpere: c.importo || c.importoOpere || 0,
                importoServizio: pi === 0 ? (c.importoServizio || 0) : 0,
              });
              migrated++;
            } catch (err: any) {
              if (err.code === '23505') continue; // Skip duplicates
              errors.push(`Project ${project.code}: ${err.message}`);
            }
          }
        }
      }

      res.json({ migrated, skipped, errors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
