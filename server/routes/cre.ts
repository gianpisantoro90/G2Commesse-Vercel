import type { Express } from "express";
import { storage } from "../storage";

export function registerCRERoutes(app: Express): void {
  // Generate CRE document preview (without generating the document)
  app.get("/api/projects/:projectId/cre/preview", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Progetto non trovato" });
      }

      // Get client data
      let client = null;
      if (project.clientId) {
        client = await storage.getClient(project.clientId);
      }

      if (!client) {
        // Fallback: create minimal client from project.client name
        client = {
          id: "",
          sigla: "",
          name: project.client,
          partitaIva: null,
          codiceFiscale: null,
          formaGiuridica: null,
          indirizzo: null,
          cap: null,
          city: project.city,
          provincia: null,
          email: null,
          telefono: null,
          pec: null,
          codiceDestinatario: null,
          nomeReferente: null,
          ruoloReferente: null,
          emailReferente: null,
          telefonoReferente: null,
          note: null,
          projectsCount: 0,
          createdAt: new Date(),
        };
      }

      const metadata = (project.metadata || {}) as any;

      // Fetch prestazioni to derive dates automatically
      const prestazioni = await storage.getPrestazioniByProject(req.params.projectId);

      // ALWAYS derive dates from prestazioni (ignore manual values)
      let derivedDataInizio = null;
      let derivedDataFine = null;

      if (prestazioni.length > 0) {
        // Get MIN(dataInizio) from prestazioni with valid dates
        const prestazioniConDataInizio = prestazioni.filter(p => p.dataInizio);
        if (prestazioniConDataInizio.length > 0) {
          const minDate = prestazioniConDataInizio.reduce((min, p) => {
            const pDate = new Date(p.dataInizio!);
            return pDate < min ? pDate : min;
          }, new Date(prestazioniConDataInizio[0].dataInizio!));
          derivedDataInizio = minDate;
        }

        // Get MAX(dataCompletamento) from prestazioni with valid dates
        const prestazioniConDataFine = prestazioni.filter(p => p.dataCompletamento);
        if (prestazioniConDataFine.length > 0) {
          const maxDate = prestazioniConDataFine.reduce((max, p) => {
            const pDate = new Date(p.dataCompletamento!);
            return pDate > max ? pDate : max;
          }, new Date(prestazioniConDataFine[0].dataCompletamento!));
          derivedDataFine = maxDate;
        }
      }

      // Create project copy with derived dates
      const projectWithDates = {
        ...project,
        dataInizioCommessa: derivedDataInizio,
        dataFineCommessa: derivedDataFine,
      };

      // Import CRE generator
      const { generateCREPreview } = await import("../lib/cre-generator");
      const preview = generateCREPreview({ project: projectWithDates, client, metadata });

      res.json(preview);
    } catch (error) {
      console.error('Error generating CRE preview:', error);
      res.status(500).json({ message: "Errore nella generazione dell'anteprima CRE" });
    }
  });

  // Generate CRE document (Word file)
  app.get("/api/projects/:projectId/cre/generate", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Progetto non trovato" });
      }

      // Get client data
      let client = null;
      if (project.clientId) {
        client = await storage.getClient(project.clientId);
      }

      if (!client) {
        // Fallback: create minimal client from project.client name
        client = {
          id: "",
          sigla: "",
          name: project.client,
          partitaIva: null,
          codiceFiscale: null,
          formaGiuridica: null,
          indirizzo: null,
          cap: null,
          city: project.city,
          provincia: null,
          email: null,
          telefono: null,
          pec: null,
          codiceDestinatario: null,
          nomeReferente: null,
          ruoloReferente: null,
          emailReferente: null,
          telefonoReferente: null,
          note: null,
          projectsCount: 0,
          createdAt: new Date(),
        };
      }

      const metadata = (project.metadata || {}) as any;

      // Fetch prestazioni to derive dates automatically
      const prestazioni = await storage.getPrestazioniByProject(req.params.projectId);

      // ALWAYS derive dates from prestazioni (ignore manual values)
      let derivedDataInizio = null;
      let derivedDataFine = null;

      if (prestazioni.length > 0) {
        // Get MIN(dataInizio) from prestazioni with valid dates
        const prestazioniConDataInizio = prestazioni.filter(p => p.dataInizio);
        if (prestazioniConDataInizio.length > 0) {
          const minDate = prestazioniConDataInizio.reduce((min, p) => {
            const pDate = new Date(p.dataInizio!);
            return pDate < min ? pDate : min;
          }, new Date(prestazioniConDataInizio[0].dataInizio!));
          derivedDataInizio = minDate;
        }

        // Get MAX(dataCompletamento) from prestazioni with valid dates
        const prestazioniConDataFine = prestazioni.filter(p => p.dataCompletamento);
        if (prestazioniConDataFine.length > 0) {
          const maxDate = prestazioniConDataFine.reduce((max, p) => {
            const pDate = new Date(p.dataCompletamento!);
            return pDate > max ? pDate : max;
          }, new Date(prestazioniConDataFine[0].dataCompletamento!));
          derivedDataFine = maxDate;
        }
      }

      // Create project copy with derived dates
      const projectWithDates = {
        ...project,
        dataInizioCommessa: derivedDataInizio,
        dataFineCommessa: derivedDataFine,
      };

      // Import CRE generator
      const { generateCREDocument } = await import("../lib/cre-generator");
      const buffer = await generateCREDocument({ project: projectWithDates, client, metadata });

      // Generate filename
      const filename = `CRE_${project.code}_${new Date().toISOString().split('T')[0]}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Error generating CRE document:', error);
      res.status(500).json({ message: "Errore nella generazione del documento CRE" });
    }
  });

  // Check CRE completeness
  app.get("/api/projects/:projectId/cre/check", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Progetto non trovato" });
      }

      // Get client data
      let client = null;
      if (project.clientId) {
        client = await storage.getClient(project.clientId);
      }

      if (!client) {
        client = {
          id: "",
          sigla: "",
          name: project.client,
          partitaIva: null,
          codiceFiscale: null,
          formaGiuridica: null,
          indirizzo: null,
          cap: null,
          city: project.city,
          provincia: null,
          email: null,
          telefono: null,
          pec: null,
          codiceDestinatario: null,
          nomeReferente: null,
          ruoloReferente: null,
          emailReferente: null,
          telefonoReferente: null,
          note: null,
          projectsCount: 0,
          createdAt: new Date(),
        };
      }

      const metadata = (project.metadata || {}) as any;

      // Import CRE generator
      const { checkCRECompleteness } = await import("../lib/cre-generator");
      const result = checkCRECompleteness({ project, client, metadata });

      res.json(result);
    } catch (error) {
      console.error('Error checking CRE completeness:', error);
      res.status(500).json({ message: "Errore nel controllo completezza CRE" });
    }
  });

  // Toggle CRE archival status
  app.patch("/api/projects/:projectId/cre/archiviato", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Progetto non trovato" });
      }

      const { archiviato } = req.body;
      const isArchiviato = archiviato === true || archiviato === 'true';

      // Update project with CRE archival status
      const updatedProject = await storage.updateProject(req.params.projectId, {
        creArchiviato: isArchiviato,
        creDataArchiviazione: isArchiviato ? new Date() : null,
      });

      if (!updatedProject) {
        return res.status(500).json({ message: "Errore nell'aggiornamento" });
      }

      res.json({
        success: true,
        creArchiviato: updatedProject.creArchiviato,
        creDataArchiviazione: updatedProject.creDataArchiviazione,
      });
    } catch (error) {
      console.error('Error updating CRE archival status:', error);
      res.status(500).json({ message: "Errore nell'aggiornamento stato CRE" });
    }
  });
}
