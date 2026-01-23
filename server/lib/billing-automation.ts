/**
 * BILLING AUTOMATION SERVICE
 *
 * Gestisce l'automazione della fatturazione:
 * 1. Sincronizzazione bidirezionale prestazioni (metadata ↔ tabella)
 * 2. Automazione data inizio commessa
 * 3. Automazione transizioni stato (completata → fatturata → pagata)
 * 4. Sistema alert (prestazioni da fatturare, fatture scadute, pagamenti in ritardo)
 * 5. Sincronizzazione billing status progetto
 */

import { logger } from './logger';
import { notificationService } from './notification-service';
import type {
  ProjectPrestazione,
  ProjectInvoice,
  Project,
  BillingAlert,
  InsertBillingAlert,
  BillingStatus,
  PrestazioneTipo,
  LivelloProgettazione,
  ProjectMetadata
} from '@shared/schema';

// Labels per le prestazioni
const PRESTAZIONE_LABELS: Record<PrestazioneTipo, string> = {
  progettazione: 'Progettazione',
  dl: 'Direzione Lavori',
  csp: 'Coordinamento Sicurezza Progettazione',
  cse: 'Coordinamento Sicurezza Esecuzione',
  contabilita: 'Contabilità',
  collaudo: 'Collaudo',
  perizia: 'Perizia',
  pratiche: 'Pratiche Edilizie'
};

const LIVELLI_LABELS: Record<LivelloProgettazione, string> = {
  pfte: 'PFTE',
  definitivo: 'Definitivo',
  esecutivo: 'Esecutivo',
  variante: 'Variante'
};

// Interfaccia per lo storage (metodi necessari)
interface BillingStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;

  // Prestazioni
  getPrestazioniByProject(projectId: string): Promise<ProjectPrestazione[]>;
  getPrestazione(id: string): Promise<ProjectPrestazione | undefined>;
  createPrestazione(data: any): Promise<ProjectPrestazione>;
  updatePrestazione(id: string, updates: any): Promise<ProjectPrestazione | undefined>;
  deletePrestazione(id: string): Promise<boolean>;

  // Invoices
  getInvoicesByProject(projectId: string): Promise<ProjectInvoice[]>;
  getInvoice(id: string): Promise<ProjectInvoice | undefined>;
  updateInvoice(id: string, updates: any): Promise<ProjectInvoice | undefined>;
  getAllInvoices(): Promise<ProjectInvoice[]>;

  // Billing Alerts
  getBillingAlerts(projectId?: string): Promise<BillingAlert[]>;
  getActiveBillingAlerts(): Promise<BillingAlert[]>;
  createBillingAlert(alert: InsertBillingAlert): Promise<BillingAlert>;
  updateBillingAlert(id: string, updates: Partial<BillingAlert>): Promise<BillingAlert | undefined>;
  resolveBillingAlert(id: string): Promise<void>;
  dismissBillingAlert(id: string, userId: string): Promise<void>;

  // Billing Config
  getBillingConfig(): Promise<Record<string, number>>;
}

class BillingAutomationService {
  private storage: BillingStorage | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 ora

  /**
   * Inizializza il servizio con lo storage
   */
  initialize(storage: BillingStorage) {
    this.storage = storage;
    logger.info('[BillingAutomation] Service initialized');

    // Avvia controllo periodico degli alert
    this.startPeriodicCheck();
  }

  /**
   * Avvia il controllo periodico degli alert
   */
  private startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Esegui subito un controllo
    this.checkAllAlerts().catch(err =>
      logger.error('[BillingAutomation] Error in initial alert check', { error: err })
    );

    // Poi ogni ora
    this.checkInterval = setInterval(() => {
      this.checkAllAlerts().catch(err =>
        logger.error('[BillingAutomation] Error in periodic alert check', { error: err })
      );
    }, this.CHECK_INTERVAL_MS);

    logger.info('[BillingAutomation] Periodic alert check started (every 1 hour)');
  }

  /**
   * SYNC ENGINE: Sincronizza prestazioni da metadata verso tabella project_prestazioni
   * Chiamato quando si aggiorna metadata via PrestazioniModal
   */
  async syncPrestazioniFromMetadata(projectId: string, newMetadata: ProjectMetadata): Promise<{
    created: number;
    removed: number;
    errors: string[];
  }> {
    if (!this.storage) throw new Error('Storage not initialized');

    const result = { created: 0, removed: 0, errors: [] as string[] };

    try {
      const project = await this.storage.getProject(projectId);
      if (!project) {
        result.errors.push(`Progetto ${projectId} non trovato`);
        return result;
      }

      const existingPrestazioni = await this.storage.getPrestazioniByProject(projectId);
      const metadataPrestazioni = newMetadata.prestazioni || [];
      const metadataLivelli = newMetadata.livelloProgettazione || [];

      logger.info('[BillingAutomation] Syncing prestazioni from metadata', {
        projectId,
        projectCode: project.code,
        metadataPrestazioni,
        metadataLivelli,
        existingCount: existingPrestazioni.length
      });

      // 1. CREA prestazioni mancanti (in metadata ma non in tabella)
      for (const tipo of metadataPrestazioni) {
        if (tipo === 'progettazione') {
          // Per progettazione, crea un record per ogni livello
          for (const livello of metadataLivelli) {
            const exists = existingPrestazioni.some(
              p => p.tipo === 'progettazione' && p.livelloProgettazione === livello
            );

            if (!exists) {
              try {
                await this.storage.createPrestazione({
                  projectId,
                  tipo: 'progettazione',
                  livelloProgettazione: livello,
                  stato: 'da_iniziare',
                  dataInizio: new Date(),
                  descrizione: `Progettazione ${LIVELLI_LABELS[livello as LivelloProgettazione] || livello}`,
                });
                result.created++;
                logger.info(`[BillingAutomation] Created prestazione: progettazione/${livello} for ${project.code}`);
              } catch (err) {
                result.errors.push(`Errore creazione progettazione/${livello}: ${err}`);
              }
            }
          }
        } else {
          // Per altri tipi, crea un singolo record
          const exists = existingPrestazioni.some(p => p.tipo === tipo);

          if (!exists) {
            try {
              await this.storage.createPrestazione({
                projectId,
                tipo,
                stato: 'da_iniziare',
                dataInizio: new Date(),
                descrizione: PRESTAZIONE_LABELS[tipo as PrestazioneTipo] || tipo,
              });
              result.created++;
              logger.info(`[BillingAutomation] Created prestazione: ${tipo} for ${project.code}`);
            } catch (err) {
              result.errors.push(`Errore creazione ${tipo}: ${err}`);
            }
          }
        }
      }

      // 2. RIMUOVI prestazioni non più in metadata (solo se non iniziate)
      for (const prestazione of existingPrestazioni) {
        const tipoInMetadata = metadataPrestazioni.includes(prestazione.tipo as any);

        // Caso: tipo completamente rimosso da metadata
        if (!tipoInMetadata) {
          if (prestazione.stato === 'da_iniziare') {
            try {
              await this.storage.deletePrestazione(prestazione.id);
              result.removed++;
              logger.info(`[BillingAutomation] Removed prestazione: ${prestazione.tipo} for ${project.code}`);
            } catch (err) {
              result.errors.push(`Errore rimozione ${prestazione.tipo}: ${err}`);
            }
          } else {
            logger.warn(`[BillingAutomation] Prestazione ${prestazione.tipo} removed from metadata but already started - keeping in table`);
          }
        }

        // Caso speciale: progettazione con livello rimosso
        if (prestazione.tipo === 'progettazione' && prestazione.livelloProgettazione) {
          const livelloInMetadata = metadataLivelli.includes(prestazione.livelloProgettazione as any);

          if (!livelloInMetadata && prestazione.stato === 'da_iniziare') {
            try {
              await this.storage.deletePrestazione(prestazione.id);
              result.removed++;
              logger.info(`[BillingAutomation] Removed progettazione/${prestazione.livelloProgettazione} for ${project.code}`);
            } catch (err) {
              result.errors.push(`Errore rimozione progettazione/${prestazione.livelloProgettazione}: ${err}`);
            }
          }
        }
      }

      // 3. Aggiorna date progetto
      await this.updateProjectDatesFromPrestazioni(projectId);

      // 4. Aggiorna billing status
      await this.updateProjectBillingStatus(projectId);

      logger.info('[BillingAutomation] Sync completed', {
        projectId,
        created: result.created,
        removed: result.removed,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logger.error('[BillingAutomation] Error syncing prestazioni from metadata', { error, projectId });
      result.errors.push(`Errore generale: ${error}`);
      return result;
    }
  }

  /**
   * Aggiorna le date del progetto basandosi sulle prestazioni
   */
  async updateProjectDatesFromPrestazioni(projectId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const prestazioni = await this.storage.getPrestazioniByProject(projectId);

      if (prestazioni.length === 0) return;

      // Calcola date
      const dateInizio = prestazioni
        .map(p => p.dataInizio)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      const dateCompletamento = prestazioni
        .map(p => p.dataCompletamento)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime());

      const updates: Partial<Project> = {};

      if (dateInizio.length > 0) {
        updates.dataInizioCommessa = dateInizio[0]; // MIN
      }

      if (dateCompletamento.length > 0 &&
          prestazioni.every(p => p.stato === 'completata' || p.stato === 'fatturata' || p.stato === 'pagata')) {
        updates.dataFineCommessa = dateCompletamento[0]; // MAX (ultimo completamento)
      }

      if (Object.keys(updates).length > 0) {
        await this.storage.updateProject(projectId, updates);
        logger.debug('[BillingAutomation] Updated project dates', { projectId, updates });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error updating project dates', { error, projectId });
    }
  }

  /**
   * Aggiorna il billing status del progetto basandosi sulle prestazioni e fatture
   */
  async updateProjectBillingStatus(projectId: string): Promise<BillingStatus> {
    if (!this.storage) return 'da_fatturare';

    try {
      const prestazioni = await this.storage.getPrestazioniByProject(projectId);
      const invoices = await this.storage.getInvoicesByProject(projectId);

      if (prestazioni.length === 0) {
        // Nessuna prestazione, controlla i vecchi campi
        const project = await this.storage.getProject(projectId);
        if (project?.pagato) return 'pagato';
        if (project?.fatturato) return 'fatturato';
        return 'da_fatturare';
      }

      // Calcola statistiche
      const totale = prestazioni.length;
      const completateOPiu = prestazioni.filter(p =>
        ['completata', 'fatturata', 'pagata'].includes(p.stato)
      ).length;
      const fatturateOPiu = prestazioni.filter(p =>
        ['fatturata', 'pagata'].includes(p.stato)
      ).length;
      const pagate = prestazioni.filter(p => p.stato === 'pagata').length;

      // Determina status
      let billingStatus: BillingStatus = 'da_fatturare';

      if (pagate === totale && totale > 0) {
        billingStatus = 'pagato';
      } else if (pagate > 0) {
        billingStatus = 'parzialmente_pagato';
      } else if (fatturateOPiu === totale && totale > 0) {
        billingStatus = 'fatturato';
      } else if (fatturateOPiu > 0) {
        billingStatus = 'parzialmente_fatturato';
      }

      // Aggiorna progetto
      await this.storage.updateProject(projectId, {
        billingStatus,
        // Sincronizza anche i vecchi campi per retro-compatibilità
        fatturato: fatturateOPiu > 0 || invoices.length > 0,
        pagato: billingStatus === 'pagato',
      });

      logger.debug('[BillingAutomation] Updated billing status', { projectId, billingStatus });

      return billingStatus;
    } catch (error) {
      logger.error('[BillingAutomation] Error updating billing status', { error, projectId });
      return 'da_fatturare';
    }
  }

  /**
   * Handler: Quando una prestazione viene completata
   */
  async onPrestazioneCompletata(prestazioneId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const prestazione = await this.storage.getPrestazione(prestazioneId);
      if (!prestazione) return;

      const project = await this.storage.getProject(prestazione.projectId);
      if (!project) return;

      logger.info('[BillingAutomation] Prestazione completata', {
        prestazioneId,
        tipo: prestazione.tipo,
        projectCode: project.code
      });

      // Aggiorna date progetto
      await this.updateProjectDatesFromPrestazioni(prestazione.projectId);

      // Aggiorna billing status
      await this.updateProjectBillingStatus(prestazione.projectId);

      // L'alert verrà creato dal check periodico quando passerà il tempo configurato
    } catch (error) {
      logger.error('[BillingAutomation] Error handling prestazione completata', { error, prestazioneId });
    }
  }

  /**
   * Handler: Quando viene creata una fattura
   */
  async onInvoiceCreated(invoice: ProjectInvoice): Promise<void> {
    if (!this.storage) return;

    try {
      logger.info('[BillingAutomation] Invoice created', {
        invoiceId: invoice.id,
        numeroFattura: invoice.numeroFattura,
        projectId: invoice.projectId,
        prestazioneId: invoice.prestazioneId
      });

      // Se collegata a una prestazione, aggiorna stato
      if (invoice.prestazioneId) {
        const prestazione = await this.storage.getPrestazione(invoice.prestazioneId);
        if (prestazione && prestazione.stato === 'completata') {
          await this.storage.updatePrestazione(invoice.prestazioneId, {
            stato: 'fatturata',
            dataFatturazione: new Date(),
          });
          logger.info('[BillingAutomation] Prestazione stato updated to fatturata', {
            prestazioneId: invoice.prestazioneId
          });
        }
      }

      // Aggiorna billing status
      await this.updateProjectBillingStatus(invoice.projectId);

      // Risolvi eventuali alert "completata_non_fatturata" per questa prestazione
      if (invoice.prestazioneId) {
        await this.resolveAlertsByPrestazione(invoice.prestazioneId, 'completata_non_fatturata');
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error handling invoice created', { error, invoiceId: invoice.id });
    }
  }

  /**
   * Handler: Quando una fattura viene pagata
   */
  async onInvoicePaid(invoiceId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice) return;

      logger.info('[BillingAutomation] Invoice paid', {
        invoiceId,
        numeroFattura: invoice.numeroFattura,
        projectId: invoice.projectId
      });

      // Se collegata a una prestazione, aggiorna stato
      if (invoice.prestazioneId) {
        const prestazione = await this.storage.getPrestazione(invoice.prestazioneId);
        if (prestazione) {
          // Verifica se tutte le fatture della prestazione sono pagate
          const invoices = await this.storage.getInvoicesByProject(invoice.projectId);
          const prestazioneInvoices = invoices.filter(i => i.prestazioneId === invoice.prestazioneId);
          const allPaid = prestazioneInvoices.every(i => i.stato === 'pagata');

          if (allPaid) {
            await this.storage.updatePrestazione(invoice.prestazioneId, {
              stato: 'pagata',
              dataPagamento: new Date(),
            });
            logger.info('[BillingAutomation] Prestazione stato updated to pagata', {
              prestazioneId: invoice.prestazioneId
            });
          }
        }
      }

      // Aggiorna billing status
      await this.updateProjectBillingStatus(invoice.projectId);

      // Risolvi alert relativi a questa fattura
      await this.resolveAlertsByInvoice(invoiceId, 'fattura_scaduta');
      await this.resolveAlertsByInvoice(invoiceId, 'pagamento_ritardo');
    } catch (error) {
      logger.error('[BillingAutomation] Error handling invoice paid', { error, invoiceId });
    }
  }

  /**
   * Controlla tutti gli alert e crea/aggiorna quelli necessari
   */
  async checkAllAlerts(): Promise<void> {
    if (!this.storage) return;

    try {
      const config = await this.storage.getBillingConfig();
      const alertCompletataGiorni = config['alert_completata_giorni'] || 15;
      const alertPagamentoGiorni = config['alert_pagamento_giorni'] || 60;

      logger.info('[BillingAutomation] Running alert check', { alertCompletataGiorni, alertPagamentoGiorni });

      // 1. Alert prestazioni completate non fatturate
      await this.checkPrestazioniDaFatturare(alertCompletataGiorni);

      // 2. Alert fatture scadute
      await this.checkFattureScadute();

      // 3. Alert pagamenti in ritardo
      await this.checkPagamentiInRitardo(alertPagamentoGiorni);

      logger.info('[BillingAutomation] Alert check completed');
    } catch (error) {
      logger.error('[BillingAutomation] Error in checkAllAlerts', { error });
    }
  }

  /**
   * Check: Prestazioni completate da troppo tempo senza fattura
   */
  private async checkPrestazioniDaFatturare(giorniSoglia: number): Promise<void> {
    if (!this.storage) return;

    try {
      const projects = await this.storage.getAllProjects();
      const now = new Date();
      let alertsCreated = 0;

      for (const project of projects) {
        const prestazioni = await this.storage.getPrestazioniByProject(project.id);
        const completate = prestazioni.filter(p => p.stato === 'completata' && p.dataCompletamento);

        for (const p of completate) {
          const dataCompletamento = new Date(p.dataCompletamento!);
          const giorniPassati = Math.floor((now.getTime() - dataCompletamento.getTime()) / (1000 * 60 * 60 * 24));

          if (giorniPassati >= giorniSoglia) {
            // Verifica se esiste già un alert attivo
            const existingAlerts = await this.storage.getBillingAlerts(project.id);
            const existingAlert = existingAlerts.find(a =>
              a.prestazioneId === p.id &&
              a.alertType === 'completata_non_fatturata' &&
              !a.resolvedAt && !a.dismissedAt
            );

            if (!existingAlert) {
              // Crea nuovo alert
              const tipoLabel = PRESTAZIONE_LABELS[p.tipo as PrestazioneTipo] || p.tipo;
              const livelloLabel = p.livelloProgettazione
                ? ` (${LIVELLI_LABELS[p.livelloProgettazione as LivelloProgettazione] || p.livelloProgettazione})`
                : '';

              await this.storage.createBillingAlert({
                projectId: project.id,
                prestazioneId: p.id,
                alertType: 'completata_non_fatturata',
                daysOverdue: giorniPassati,
                priority: giorniPassati > 30 ? 'urgent' : giorniPassati > 20 ? 'high' : 'medium',
                message: `${tipoLabel}${livelloLabel} completata da ${giorniPassati} giorni senza fattura`,
              });

              alertsCreated++;

              // Invia notifica
              notificationService.sendNotification({
                userId: 'admin', // TODO: determinare utente corretto
                type: 'invoice',
                title: `Prestazione da fatturare`,
                message: `${project.code} - ${tipoLabel}${livelloLabel} completata da ${giorniPassati} giorni`,
                priority: giorniPassati > 30 ? 'urgent' : 'high',
                actionUrl: `/progetti/${project.id}?tab=fatturazione`,
              });
            } else {
              // Aggiorna giorni nell'alert esistente
              await this.storage.updateBillingAlert(existingAlert.id, {
                daysOverdue: giorniPassati,
                priority: giorniPassati > 30 ? 'urgent' : giorniPassati > 20 ? 'high' : 'medium',
              });
            }
          }
        }
      }

      if (alertsCreated > 0) {
        logger.info('[BillingAutomation] Created alerts for prestazioni da fatturare', { count: alertsCreated });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error checking prestazioni da fatturare', { error });
    }
  }

  /**
   * Check: Fatture scadute
   */
  private async checkFattureScadute(): Promise<void> {
    if (!this.storage) return;

    try {
      const invoices = await this.storage.getAllInvoices();
      const now = new Date();
      let alertsCreated = 0;

      for (const invoice of invoices) {
        if (invoice.stato === 'pagata' || !invoice.scadenzaPagamento) continue;

        const scadenza = new Date(invoice.scadenzaPagamento);
        const giorniScaduti = Math.floor((now.getTime() - scadenza.getTime()) / (1000 * 60 * 60 * 24));

        if (giorniScaduti > 0) {
          // Aggiorna stato fattura a "scaduta"
          if (invoice.stato !== 'scaduta') {
            await this.storage.updateInvoice(invoice.id, { stato: 'scaduta' });
          }

          // Verifica se esiste già un alert attivo
          const existingAlerts = await this.storage.getBillingAlerts(invoice.projectId);
          const existingAlert = existingAlerts.find(a =>
            a.invoiceId === invoice.id &&
            a.alertType === 'fattura_scaduta' &&
            !a.resolvedAt && !a.dismissedAt
          );

          if (!existingAlert) {
            const project = await this.storage.getProject(invoice.projectId);

            await this.storage.createBillingAlert({
              projectId: invoice.projectId,
              invoiceId: invoice.id,
              alertType: 'fattura_scaduta',
              daysOverdue: giorniScaduti,
              priority: 'urgent',
              message: `Fattura ${invoice.numeroFattura} scaduta da ${giorniScaduti} giorni - €${(invoice.importoTotale / 100).toFixed(2)}`,
            });

            alertsCreated++;

            // Invia notifica
            notificationService.sendNotification({
              userId: 'admin',
              type: 'invoice',
              title: `Fattura scaduta`,
              message: `${project?.code || 'N/A'} - Fattura ${invoice.numeroFattura} scaduta da ${giorniScaduti} giorni`,
              priority: 'urgent',
              actionUrl: `/progetti/${invoice.projectId}?tab=fatturazione`,
            });
          } else {
            await this.storage.updateBillingAlert(existingAlert.id, { daysOverdue: giorniScaduti });
          }
        }
      }

      if (alertsCreated > 0) {
        logger.info('[BillingAutomation] Created alerts for fatture scadute', { count: alertsCreated });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error checking fatture scadute', { error });
    }
  }

  /**
   * Check: Pagamenti in ritardo (fatture senza scadenza emesse da troppo tempo)
   */
  private async checkPagamentiInRitardo(giorniSoglia: number): Promise<void> {
    if (!this.storage) return;

    try {
      const invoices = await this.storage.getAllInvoices();
      const now = new Date();
      let alertsCreated = 0;

      for (const invoice of invoices) {
        if (invoice.stato === 'pagata' || invoice.scadenzaPagamento) continue;

        const dataEmissione = new Date(invoice.dataEmissione);
        const giorniPassati = Math.floor((now.getTime() - dataEmissione.getTime()) / (1000 * 60 * 60 * 24));

        if (giorniPassati >= giorniSoglia) {
          const existingAlerts = await this.storage.getBillingAlerts(invoice.projectId);
          const existingAlert = existingAlerts.find(a =>
            a.invoiceId === invoice.id &&
            a.alertType === 'pagamento_ritardo' &&
            !a.resolvedAt && !a.dismissedAt
          );

          if (!existingAlert) {
            const project = await this.storage.getProject(invoice.projectId);

            await this.storage.createBillingAlert({
              projectId: invoice.projectId,
              invoiceId: invoice.id,
              alertType: 'pagamento_ritardo',
              daysOverdue: giorniPassati,
              priority: 'high',
              message: `Fattura ${invoice.numeroFattura} emessa da ${giorniPassati} giorni - €${(invoice.importoTotale / 100).toFixed(2)}`,
            });

            alertsCreated++;

            notificationService.sendNotification({
              userId: 'admin',
              type: 'invoice',
              title: `Pagamento in ritardo`,
              message: `${project?.code || 'N/A'} - Fattura ${invoice.numeroFattura} emessa da ${giorniPassati} giorni`,
              priority: 'high',
              actionUrl: `/progetti/${invoice.projectId}?tab=fatturazione`,
            });
          } else {
            await this.storage.updateBillingAlert(existingAlert.id, { daysOverdue: giorniPassati });
          }
        }
      }

      if (alertsCreated > 0) {
        logger.info('[BillingAutomation] Created alerts for pagamenti in ritardo', { count: alertsCreated });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error checking pagamenti in ritardo', { error });
    }
  }

  /**
   * Risolvi alert per prestazione
   */
  private async resolveAlertsByPrestazione(prestazioneId: string, alertType: string): Promise<void> {
    if (!this.storage) return;

    try {
      const prestazione = await this.storage.getPrestazione(prestazioneId);
      if (!prestazione) return;

      const alerts = await this.storage.getBillingAlerts(prestazione.projectId);
      const toResolve = alerts.filter(a =>
        a.prestazioneId === prestazioneId &&
        a.alertType === alertType &&
        !a.resolvedAt
      );

      for (const alert of toResolve) {
        await this.storage.resolveBillingAlert(alert.id);
        logger.info('[BillingAutomation] Resolved alert', { alertId: alert.id, alertType });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error resolving alerts by prestazione', { error, prestazioneId });
    }
  }

  /**
   * Risolvi alert per fattura
   */
  private async resolveAlertsByInvoice(invoiceId: string, alertType: string): Promise<void> {
    if (!this.storage) return;

    try {
      const invoice = await this.storage.getInvoice(invoiceId);
      if (!invoice) return;

      const alerts = await this.storage.getBillingAlerts(invoice.projectId);
      const toResolve = alerts.filter(a =>
        a.invoiceId === invoiceId &&
        a.alertType === alertType &&
        !a.resolvedAt
      );

      for (const alert of toResolve) {
        await this.storage.resolveBillingAlert(alert.id);
        logger.info('[BillingAutomation] Resolved alert', { alertId: alert.id, alertType });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error resolving alerts by invoice', { error, invoiceId });
    }
  }

  /**
   * Imposta automaticamente la data inizio commessa alla creazione
   */
  async setAutoDataInizio(projectId: string): Promise<void> {
    if (!this.storage) return;

    try {
      const project = await this.storage.getProject(projectId);
      if (!project) return;

      if (!project.dataInizioCommessa) {
        await this.storage.updateProject(projectId, {
          dataInizioCommessa: new Date(),
        });
        logger.info('[BillingAutomation] Auto-set data inizio commessa', { projectId, projectCode: project.code });
      }
    } catch (error) {
      logger.error('[BillingAutomation] Error setting auto data inizio', { error, projectId });
    }
  }

  /**
   * Ottieni statistiche alert attivi
   */
  async getAlertStats(): Promise<{
    totale: number;
    completateNonFatturate: number;
    fattureScadute: number;
    pagamentiInRitardo: number;
  }> {
    if (!this.storage) {
      return { totale: 0, completateNonFatturate: 0, fattureScadute: 0, pagamentiInRitardo: 0 };
    }

    try {
      const alerts = await this.storage.getActiveBillingAlerts();

      return {
        totale: alerts.length,
        completateNonFatturate: alerts.filter(a => a.alertType === 'completata_non_fatturata').length,
        fattureScadute: alerts.filter(a => a.alertType === 'fattura_scaduta').length,
        pagamentiInRitardo: alerts.filter(a => a.alertType === 'pagamento_ritardo').length,
      };
    } catch (error) {
      logger.error('[BillingAutomation] Error getting alert stats', { error });
      return { totale: 0, completateNonFatturate: 0, fattureScadute: 0, pagamentiInRitardo: 0 };
    }
  }
}

// Singleton instance
export const billingAutomationService = new BillingAutomationService();
