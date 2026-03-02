import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { parsePaginationParams } from "@shared/pagination";
import { billingAutomationService } from "../lib/billing-automation";

// Funzione per calcolare e trasformare i dati della fattura
const transformInvoiceData = (data: any) => {
  // Trasforma dataPagamento a Date se è stringa
  let dataPagamento = data.dataPagamento;
  if (dataPagamento && typeof dataPagamento === 'string') {
    dataPagamento = new Date(dataPagamento);
  }

  // Trasforma scadenzaPagamento a Date se è stringa
  let scadenzaPagamento = data.scadenzaPagamento;
  if (scadenzaPagamento && typeof scadenzaPagamento === 'string') {
    scadenzaPagamento = new Date(scadenzaPagamento);
  }

  // Trasforma dataEmissione
  let dataEmissione = data.dataEmissione;
  if (dataEmissione && typeof dataEmissione === 'string') {
    dataEmissione = new Date(dataEmissione);
  }

  // Calcoli automatici se importoNetto è presente
  let cassaPrevidenziale = 0;
  let importoIVA = 0;
  let importoTotale = 0;

  if (data.importoNetto !== undefined) {
    const nettoInCentesimi = Math.round(data.importoNetto * 100);
    const cassaPercentuale = data.cassaPercentuale ?? 4; // Default 4% Inarcassa
    cassaPrevidenziale = Math.round(nettoInCentesimi * (cassaPercentuale / 100));
    const aliquota = data.aliquotaIVA || 22;
    importoIVA = Math.round((nettoInCentesimi + cassaPrevidenziale) * (aliquota / 100)); // IVA su netto+cassa
    importoTotale = nettoInCentesimi + cassaPrevidenziale + importoIVA;
  }

  return {
    numeroFattura: data.numeroFattura || undefined,
    dataEmissione: dataEmissione || undefined,
    importoNetto: data.importoNetto !== undefined ? Math.round(data.importoNetto * 100) : undefined,
    importoParcella: data.importoParcella !== undefined ? Math.round(data.importoParcella * 100) : undefined,
    stato: data.stato || "emessa",
    aliquotaIVA: data.aliquotaIVA || 22,
    dataPagamento: dataPagamento || null,
    note: data.note || null,
    salId: data.salId || null,
    prestazioneId: data.prestazioneId || null, // Collegamento a prestazione (1:N)
    tipoFattura: data.tipoFattura || 'unica', // Tipo fattura (acconto, sal, saldo, unica)
    ritenuta: data.ritenuta !== undefined ? Math.round(data.ritenuta * 100) : 0,
    scadenzaPagamento: scadenzaPagamento || null,
    attachmentPath: data.attachmentPath || null,
    cassaPrevidenziale: cassaPrevidenziale,
    importoIVA: importoIVA,
    importoTotale: importoTotale,
  };
};

// Schema per trasformare i dati delle fatture dal frontend (decimali) al database (centesimi)
// Base schema without transform (used for PATCH with .partial())
const invoiceInputSchemaBase = z.object({
  numeroFattura: z.string().optional(),
  dataEmissione: z.any().optional(),
  importoNetto: z.number().optional(),
  importoParcella: z.number().optional(),
  stato: z.string().optional(),
  aliquotaIVA: z.number().optional(),
  dataPagamento: z.any().optional().nullable(),
  note: z.any().optional().nullable(),
  salId: z.string().optional().nullable(),
  prestazioneId: z.string().optional().nullable(), // Collegamento a prestazione (1:N)
  tipoFattura: z.enum(['acconto', 'sal', 'saldo', 'unica']).optional().default('unica'),
  ritenuta: z.number().optional(),
  scadenzaPagamento: z.any().optional().nullable(),
  attachmentPath: z.string().optional().nullable(),
});

// Schema with transform (used for POST)
const invoiceInputSchema = invoiceInputSchemaBase.transform(transformInvoiceData);

export function registerBillingRoutes(app: Express): void {
  // Project Invoices endpoints
  app.get("/api/projects/:projectId/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByProject(req.params.projectId);
      res.json(invoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ message: "Errore nel recupero delle fatture" });
    }
  });

  app.post("/api/projects/:projectId/invoices", async (req, res) => {
    try {
      const validatedData = invoiceInputSchema.parse(req.body);
      const invoice = await storage.createInvoice({
        ...validatedData,
        projectId: req.params.projectId,
      } as any);

      // Se la fattura è collegata a una prestazione, ricalcola gli importi
      if (validatedData.prestazioneId) {
        await storage.recalculatePrestazioneImporti(validatedData.prestazioneId);
      }

      // BILLING AUTOMATION: Trigger quando fattura viene creata
      try {
        await billingAutomationService.onInvoiceCreated(invoice);
      } catch (billingError) {
        console.error('⚠️ Billing automation error (non-blocking):', billingError);
      }

      res.status(201).json(invoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati fattura non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nella creazione della fattura" });
    }
  });

  app.patch("/api/projects/:projectId/invoices/:invoiceId", async (req, res) => {
    try {
      // Get existing invoice to check prestazioneId
      const existingInvoice = await storage.getInvoice(req.params.invoiceId);

      // Use base schema with partial() then apply transform
      const validatedData = invoiceInputSchemaBase.partial().transform(transformInvoiceData).parse(req.body);
      const updated = await storage.updateInvoice(req.params.invoiceId, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Fattura non trovata" });
      }

      // Ricalcola importi per la prestazione (sia vecchia che nuova se cambiata)
      const prestazioneIds = new Set<string>();
      if (existingInvoice?.prestazioneId) prestazioneIds.add(existingInvoice.prestazioneId);
      if (updated.prestazioneId) prestazioneIds.add(updated.prestazioneId);

      for (const prestazioneId of Array.from(prestazioneIds)) {
        await storage.recalculatePrestazioneImporti(prestazioneId);
      }

      // BILLING AUTOMATION: Trigger quando fattura diventa "pagata"
      try {
        if (existingInvoice?.stato !== 'pagata' && updated.stato === 'pagata') {
          await billingAutomationService.onInvoicePaid(req.params.invoiceId);
        }
      } catch (billingError) {
        console.error('⚠️ Billing automation error (non-blocking):', billingError);
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating invoice:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dati fattura non validi", errors: error.errors });
      }
      res.status(500).json({ message: "Errore nell'aggiornamento della fattura" });
    }
  });

  app.delete("/api/projects/:projectId/invoices/:invoiceId", async (req, res) => {
    try {
      // Get invoice before deletion to know which prestazione to recalculate
      const invoice = await storage.getInvoice(req.params.invoiceId);
      const prestazioneId = invoice?.prestazioneId;

      const deleted = await storage.deleteInvoice(req.params.invoiceId);
      if (!deleted) {
        return res.status(404).json({ message: "Fattura non trovata" });
      }

      // Ricalcola importi per la prestazione se era collegata
      if (prestazioneId) {
        await storage.recalculatePrestazioneImporti(prestazioneId);
      }

      res.json({ message: "Fattura eliminata con successo" });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ message: "Errore nell'eliminazione della fattura" });
    }
  });

  // ============================================
  // BILLING ALERTS API
  // ============================================

  // Get all billing alerts (optionally filtered by projectId)
  app.get("/api/billing-alerts", async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const activeOnly = req.query.active === 'true';

      let alerts;
      if (activeOnly) {
        alerts = await storage.getActiveBillingAlerts();
        if (projectId) {
          alerts = alerts.filter(a => a.projectId === projectId);
        }
      } else {
        alerts = await storage.getBillingAlerts(projectId);
      }

      // Batch-load related entities to avoid N+1 queries
      const projectIds = Array.from(new Set(alerts.map(a => a.projectId)));
      const prestazioneIds = Array.from(new Set(alerts.filter(a => a.prestazioneId).map(a => a.prestazioneId!)));
      const invoiceIds = Array.from(new Set(alerts.filter(a => a.invoiceId).map(a => a.invoiceId!)));

      const [allProjects, allPrestazioni, allInvoices] = await Promise.all([
        Promise.all(projectIds.map(id => storage.getProject(id))),
        Promise.all(prestazioneIds.map(id => storage.getPrestazione(id))),
        Promise.all(invoiceIds.map(id => storage.getInvoice(id))),
      ]);

      const projectMap = new Map(allProjects.filter(Boolean).map(p => [p!.id, p!]));
      const prestazioneMap = new Map(allPrestazioni.filter(Boolean).map(p => [p!.id, p!]));
      const invoiceMap = new Map(allInvoices.filter(Boolean).map(i => [i!.id, i!]));

      const enrichedAlerts = alerts.map((alert) => {
        const project = projectMap.get(alert.projectId);
        const prestazione = alert.prestazioneId ? prestazioneMap.get(alert.prestazioneId) : null;
        const invoice = alert.invoiceId ? invoiceMap.get(alert.invoiceId) : null;

        return {
          ...alert,
          project: project ? {
            id: project.id,
            code: project.code,
            client: project.client,
            object: project.object,
          } : null,
          prestazione: prestazione ? {
            id: prestazione.id,
            tipo: prestazione.tipo,
            livelloProgettazione: prestazione.livelloProgettazione,
            stato: prestazione.stato,
          } : null,
          invoice: invoice ? {
            id: invoice.id,
            numeroFattura: invoice.numeroFattura,
            importoTotale: invoice.importoTotale,
            stato: invoice.stato,
          } : null,
        };
      });

      res.json(enrichedAlerts);
    } catch (error) {
      console.error('Error fetching billing alerts:', error);
      res.status(500).json({ message: "Errore nel recupero degli alert di fatturazione" });
    }
  });

  // Get billing alert stats
  app.get("/api/billing-alerts/stats", async (req, res) => {
    try {
      const stats = await billingAutomationService.getAlertStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching billing alert stats:', error);
      res.status(500).json({ message: "Errore nel recupero delle statistiche alert" });
    }
  });

  // Dismiss a billing alert
  app.post("/api/billing-alerts/:id/dismiss", async (req, res) => {
    try {
      const userId = req.body.userId || 'admin'; // TODO: use authenticated user
      await storage.dismissBillingAlert(req.params.id, userId);
      res.json({ message: "Alert ignorato con successo" });
    } catch (error) {
      console.error('Error dismissing billing alert:', error);
      res.status(500).json({ message: "Errore nell'ignorare l'alert" });
    }
  });

  // Resolve a billing alert (usually called automatically)
  app.post("/api/billing-alerts/:id/resolve", async (req, res) => {
    try {
      await storage.resolveBillingAlert(req.params.id);
      res.json({ message: "Alert risolto con successo" });
    } catch (error) {
      console.error('Error resolving billing alert:', error);
      res.status(500).json({ message: "Errore nella risoluzione dell'alert" });
    }
  });

  // Delete a billing alert
  app.delete("/api/billing-alerts/:id", async (req, res) => {
    try {
      await storage.deleteBillingAlert(req.params.id);
      res.json({ message: "Alert eliminato con successo" });
    } catch (error) {
      console.error('Error deleting billing alert:', error);
      res.status(500).json({ message: "Errore nell'eliminazione dell'alert" });
    }
  });

  // Get billing config
  app.get("/api/billing-config", async (req, res) => {
    try {
      const config = await storage.getBillingConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching billing config:', error);
      res.status(500).json({ message: "Errore nel recupero della configurazione" });
    }
  });

  // Update billing config
  app.put("/api/billing-config/:key", async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== 'number') {
        return res.status(400).json({ message: "Il valore deve essere un numero" });
      }
      await storage.setBillingConfig(req.params.key, value);
      res.json({ message: "Configurazione aggiornata con successo" });
    } catch (error) {
      console.error('Error updating billing config:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento della configurazione" });
    }
  });

  // Trigger manual check of billing alerts
  app.post("/api/billing-alerts/check", async (req, res) => {
    try {
      await billingAutomationService.checkAllAlerts();
      res.json({ message: "Controllo alert eseguito con successo" });
    } catch (error) {
      console.error('Error checking billing alerts:', error);
      res.status(500).json({ message: "Errore nel controllo degli alert" });
    }
  });

  // Batch sync all prestazioni from metadata to table
  app.post("/api/billing/sync-prestazioni", async (req, res) => {
    try {
      const result = await billingAutomationService.syncAllProjectsPrestazioni();
      res.json({
        message: "Sincronizzazione completata",
        ...result
      });
    } catch (error) {
      console.error('Error in batch sync prestazioni:', error);
      res.status(500).json({ message: "Errore nella sincronizzazione" });
    }
  });

  // ============================================
  // ALL INVOICES API (for cost analysis)
  // ============================================

  // Get all invoices across all projects
  app.get("/api/invoices", async (req, res) => {
    try {
      const pagination = parsePaginationParams(req.query);
      if (pagination) {
        const result = await storage.getInvoicesPaginated({
          ...pagination,
          projectId: req.query.projectId as string | undefined,
        });
        return res.json(result);
      }

      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Errore nel recupero delle fatture" });
    }
  });
}
