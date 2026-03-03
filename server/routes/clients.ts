import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertClientSchema } from "@shared/schema";
import { parsePaginationParams } from "@shared/pagination";

export function registerClientRoutes(app: Express): void {
  app.get("/api/clients", async (req, res) => {
    try {
      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getClientsPaginated(pagination);
        return res.json(result);
      }

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

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const validatedData = insertClientSchema.partial().parse(req.body);
      const updatedClient = await storage.updateClient(req.params.id, validatedData);
      if (!updatedClient) {
        return res.status(404).json({ message: "Cliente non trovato" });
      }
      res.json(updatedClient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati non validi", errors: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Errore nell'aggiornamento del cliente" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Cliente non trovato" });
      }
      res.json({ message: "Cliente eliminato con successo" });
    } catch (error: any) {
      console.error("Error deleting client:", error);
      // FK violation: projects reference this client
      if (error?.code === '23503') {
        return res.status(409).json({
          message: "Impossibile eliminare il cliente: ci sono commesse associate. Rimuovi prima le commesse collegate."
        });
      }
      res.status(500).json({ message: "Errore nell'eliminazione del cliente" });
    }
  });

  // Diagnostic: check actual project linkage for a specific client
  app.get("/api/clients/:id/diagnostic", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Cliente non trovato" });
      }

      const allProjects = await storage.getAllProjects();

      // Projects linked by FK (clientId)
      const byFK = allProjects.filter(p => p.clientId === client.id);

      // Projects matched by name (case-insensitive)
      const clientNameLower = client.name.trim().toLowerCase();
      const byName = allProjects.filter(p =>
        p.client?.trim().toLowerCase() === clientNameLower
      );

      // Projects matched by sigla
      const clientSiglaLower = client.sigla.trim().toLowerCase();
      const bySigla = allProjects.filter(p => {
        const generated = (p.client || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
        return generated.toLowerCase() === clientSiglaLower;
      });

      res.json({
        client: { id: client.id, sigla: client.sigla, name: client.name, projectsCount: client.projectsCount },
        projectsByFK: byFK.map(p => ({ id: p.id, code: p.code, client: p.client, clientId: p.clientId, status: p.status })),
        projectsByName: byName.map(p => ({ id: p.id, code: p.code, client: p.client, clientId: p.clientId, status: p.status })),
        projectsBySigla: bySigla.map(p => ({ id: p.id, code: p.code, client: p.client, clientId: p.clientId, status: p.status })),
        counts: {
          storedCount: client.projectsCount || 0,
          byFK: byFK.length,
          byName: byName.length,
          bySigla: bySigla.length,
        }
      });
    } catch (error) {
      console.error("Error in client diagnostic:", error);
      res.status(500).json({ message: "Errore nella diagnostica" });
    }
  });

  // Recalculate clients projects count
  app.post("/api/clients/sync-counts", async (req, res) => {
    try {
      await storage.recalculateClientsProjectsCount();
      res.json({ message: "Conteggi commesse clienti sincronizzati con successo" });
    } catch (error) {
      console.error("Error recalculating clients projects count:", error);
      res.status(500).json({ message: "Errore nella sincronizzazione dei conteggi" });
    }
  });
}
