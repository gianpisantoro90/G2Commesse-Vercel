/**
 * AI Proactive Alerts Service
 *
 * Generates intelligent insights by analyzing all project data.
 * Designed to run as a periodic cron job (daily) or on-demand.
 * Stores insights in system config for frontend consumption.
 */

import { logger } from "./logger";
import type { IStorage } from "../storage";

export interface ProactiveInsight {
  id: string;
  type: 'billing' | 'deadline' | 'communication' | 'project_health' | 'financial';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  projectId?: string;
  projectCode?: string;
  client?: string;
  actionSuggestion: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Generate all proactive insights by scanning project data.
 * Pure data analysis - no AI API calls needed.
 */
export async function generateProactiveInsights(storage: IStorage): Promise<ProactiveInsight[]> {
  const insights: ProactiveInsight[] = [];
  const now = new Date();

  const [projects, prestazioni, invoices, deadlines, communications, tasks] = await Promise.all([
    storage.getAllProjects(),
    storage.getAllPrestazioni(),
    storage.getAllInvoices(),
    storage.getAllDeadlines(),
    storage.getAllCommunications(),
    storage.getAllTasks(),
  ]);

  const activeProjects = projects.filter(p => p.status === 'in corso');

  for (const project of activeProjects) {
    const projectPrestazioni = prestazioni.filter(p => p.projectId === project.id);
    const projectInvoices = invoices.filter(i => i.projectId === project.id);
    const projectDeadlines = deadlines.filter(d => d.projectId === project.id);
    const projectComms = communications.filter(c => c.projectId === project.id);
    const projectTasks = tasks.filter(t => t.projectId === project.id);

    // 1. Prestazioni completate non fatturate
    const completateNonFatt = projectPrestazioni.filter(p => p.stato === 'completata');
    if (completateNonFatt.length > 0) {
      const totale = completateNonFatt.reduce((s, p) => s + (p.importoPrevisto || 0), 0);
      insights.push({
        id: `billing_${project.id}_${now.getTime()}`,
        type: 'billing',
        priority: totale > 500000 ? 'urgent' : totale > 100000 ? 'high' : 'medium',
        title: `${completateNonFatt.length} prestazion${completateNonFatt.length === 1 ? 'e' : 'i'} da fatturare`,
        description: `Progetto ${project.code} (${project.client}): ${completateNonFatt.map(p => p.tipo).join(', ')} completat${completateNonFatt.length === 1 ? 'a' : 'e'} per un totale di €${(totale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: 'Emettere fattura per le prestazioni completate',
        data: { importo: totale, prestazioni: completateNonFatt.map(p => p.tipo) },
        createdAt: now.toISOString(),
      });
    }

    // 2. Fatture scadute
    const fattureScadute = projectInvoices.filter(i =>
      (i.stato === 'emessa' || i.stato === 'scaduta') &&
      i.scadenzaPagamento && new Date(i.scadenzaPagamento) < now
    );
    for (const fattura of fattureScadute) {
      const giorniRitardo = Math.ceil(
        (now.getTime() - new Date(fattura.scadenzaPagamento!).getTime()) / (1000 * 60 * 60 * 24)
      );
      insights.push({
        id: `invoice_${fattura.id}_${now.getTime()}`,
        type: 'billing',
        priority: giorniRitardo > 90 ? 'urgent' : giorniRitardo > 60 ? 'high' : 'medium',
        title: `Fattura ${fattura.numeroFattura} scaduta da ${giorniRitardo} giorni`,
        description: `Progetto ${project.code}: fattura di €${(fattura.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} scaduta il ${new Date(fattura.scadenzaPagamento!).toLocaleDateString('it-IT')}`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: `Sollecitare pagamento a ${project.client}`,
        data: { importo: fattura.importoTotale, giorniRitardo, numeroFattura: fattura.numeroFattura },
        createdAt: now.toISOString(),
      });
    }

    // 3. Scadenze imminenti (prossimi 7 giorni)
    const scadenzeImminenti = projectDeadlines.filter(d => {
      if (d.status !== 'pending' || !d.dueDate) return false;
      const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7;
    });
    for (const scadenza of scadenzeImminenti) {
      const daysLeft = Math.ceil(
        (new Date(scadenza.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      insights.push({
        id: `deadline_${scadenza.id}_${now.getTime()}`,
        type: 'deadline',
        priority: daysLeft <= 2 ? 'urgent' : 'high',
        title: `Scadenza "${scadenza.title}" tra ${daysLeft} giorn${daysLeft === 1 ? 'o' : 'i'}`,
        description: `Progetto ${project.code}: ${scadenza.description || scadenza.title} (${scadenza.type}) - scade il ${new Date(scadenza.dueDate).toLocaleDateString('it-IT')}`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: `Verificare stato e completare entro il ${new Date(scadenza.dueDate).toLocaleDateString('it-IT')}`,
        data: { daysLeft, type: scadenza.type, priority: scadenza.priority },
        createdAt: now.toISOString(),
      });
    }

    // 4. Scadenze scadute
    const scadenzeScadute = projectDeadlines.filter(d =>
      d.status === 'pending' && d.dueDate && new Date(d.dueDate) < now
    );
    for (const scadenza of scadenzeScadute) {
      const daysOverdue = Math.ceil(
        (now.getTime() - new Date(scadenza.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      insights.push({
        id: `overdue_${scadenza.id}_${now.getTime()}`,
        type: 'deadline',
        priority: 'urgent',
        title: `Scadenza "${scadenza.title}" superata da ${daysOverdue} giorni`,
        description: `Progetto ${project.code}: scadenza del ${new Date(scadenza.dueDate).toLocaleDateString('it-IT')} non completata`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: 'Completare urgentemente o aggiornare la scadenza',
        data: { daysOverdue, type: scadenza.type },
        createdAt: now.toISOString(),
      });
    }

    // 5. Progetti senza comunicazioni recenti (>60 giorni)
    const lastCommDate = projectComms.length > 0
      ? Math.max(...projectComms.map(c => new Date(c.communicationDate).getTime()))
      : 0;
    const daysSinceComm = lastCommDate > 0
      ? Math.ceil((now.getTime() - lastCommDate) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceComm > 60 && daysSinceComm < 999) {
      insights.push({
        id: `comm_${project.id}_${now.getTime()}`,
        type: 'communication',
        priority: daysSinceComm > 90 ? 'high' : 'medium',
        title: `Nessuna comunicazione da ${daysSinceComm} giorni`,
        description: `Progetto ${project.code} (${project.client}): l'ultima comunicazione risale a ${daysSinceComm} giorni fa`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: 'Contattare il cliente per aggiornamento sullo stato del progetto',
        data: { daysSinceComm },
        createdAt: now.toISOString(),
      });
    }

    // 6. Task scaduti
    const overdueTasks = projectTasks.filter(t =>
      (t.status === 'pending' || t.status === 'in_progress') &&
      t.dueDate && new Date(t.dueDate) < now
    );
    if (overdueTasks.length > 0) {
      insights.push({
        id: `tasks_${project.id}_${now.getTime()}`,
        type: 'project_health',
        priority: overdueTasks.length >= 3 ? 'high' : 'medium',
        title: `${overdueTasks.length} task scadut${overdueTasks.length === 1 ? 'o' : 'i'}`,
        description: `Progetto ${project.code}: ${overdueTasks.map(t => t.title).slice(0, 3).join(', ')}${overdueTasks.length > 3 ? ` e altri ${overdueTasks.length - 3}` : ''}`,
        projectId: project.id,
        projectCode: project.code,
        client: project.client,
        actionSuggestion: 'Rivedere priorità e completare o ripianificare i task scaduti',
        data: { count: overdueTasks.length, tasks: overdueTasks.map(t => t.title).slice(0, 5) },
        createdAt: now.toISOString(),
      });
    }
  }

  // Sort by priority (urgent first) then by date
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  insights.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  logger.info(`Generated ${insights.length} proactive insights for ${activeProjects.length} active projects`);

  return insights;
}

/**
 * Generate and store insights. Called by cron job or on-demand.
 */
export async function refreshInsights(storage: IStorage): Promise<ProactiveInsight[]> {
  const insights = await generateProactiveInsights(storage);

  // Store in system config for frontend access
  await storage.setSystemConfig('ai_proactive_insights', {
    insights: insights.slice(0, 50), // Keep max 50
    generatedAt: new Date().toISOString(),
    totalActive: insights.length,
  });

  return insights;
}
