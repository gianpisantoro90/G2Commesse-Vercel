/**
 * AI Chat Assistant - Conversational AI with full system context
 *
 * Provides a chatbot that can query all project management data
 * (projects, clients, billing, communications, tasks, deadlines)
 * and answer questions in Italian about the engineering company's operations.
 */

import { AIConfig, AIFeatureConfig, AiChatMessage } from "@shared/schema";
import { aiComplete, AIMessage } from "./ai-provider";
import { logger } from "./logger";
import type { IStorage } from "../storage";

interface SystemContext {
  projectsSummary: string;
  billingOverview: string;
  upcomingDeadlines: string;
  recentCommunications: string;
  pendingTasks: string;
  activeAlerts: string;
}

/**
 * Build a snapshot of system data for the AI context window.
 * Kept concise to minimize token usage while providing key data.
 */
async function buildSystemContext(storage: IStorage): Promise<SystemContext> {
  try {
    const [projects, clients, deadlines, tasks, communications, prestazioni, invoices, billingAlerts] = await Promise.all([
      storage.getAllProjects(),
      storage.getAllClients(),
      storage.getAllDeadlines(),
      storage.getAllTasks(),
      storage.getAllCommunications(),
      storage.getAllPrestazioni(),
      storage.getAllInvoices(),
      storage.getActiveBillingAlerts(),
    ]);

    // Active projects summary
    const activeProjects = projects.filter(p => p.status === 'in corso');
    const projectsSummary = activeProjects.length > 0
      ? activeProjects.map(p => {
          const client = clients.find(c => c.id === p.clientId);
          const projectPrestazioni = prestazioni.filter(pr => pr.projectId === p.id);
          const prestazioniStatus = projectPrestazioni.map(pr =>
            `${pr.tipo}${pr.livelloProgettazione ? ` (${pr.livelloProgettazione})` : ''}: ${pr.stato}`
          ).join(', ');
          return `- ${p.code} | ${client?.name || p.client} | ${p.city} | ${p.object} | Prestazioni: [${prestazioniStatus || 'nessuna'}]`;
        }).join('\n')
      : 'Nessun progetto attivo.';

    // Billing overview
    const completateNonFatturate = prestazioni.filter(p => p.stato === 'completata');
    const fattureScadute = invoices.filter(i => i.stato === 'scaduta' || (i.stato === 'emessa' && i.scadenzaPagamento && new Date(i.scadenzaPagamento) < new Date()));
    const totaleCompletateNonFatturate = completateNonFatturate.reduce((sum, p) => sum + (p.importoPrevisto || 0), 0);
    const totaleFattureScadute = fattureScadute.reduce((sum, i) => sum + (i.importoTotale || 0), 0);

    const billingOverview = [
      `Prestazioni completate non fatturate: ${completateNonFatturate.length} (€${totaleCompletateNonFatturate.toFixed(2)})`,
      `Fatture scadute: ${fattureScadute.length} (€${totaleFattureScadute.toFixed(2)})`,
      `Totale progetti attivi: ${activeProjects.length}`,
      `Totale clienti: ${clients.length}`,
    ].join('\n');

    // Upcoming deadlines (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = deadlines
      .filter(d => d.status === 'pending' && d.dueDate && new Date(d.dueDate) <= thirtyDaysFromNow)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 15);

    const upcomingDeadlines = upcoming.length > 0
      ? upcoming.map(d => {
          const project = projects.find(p => p.id === d.projectId);
          const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return `- ${project?.code || '?'}: ${d.title} (${d.type}) - scade tra ${daysLeft} giorni [${d.priority}]`;
        }).join('\n')
      : 'Nessuna scadenza nei prossimi 30 giorni.';

    // Recent communications (last 10)
    const recentComms = [...communications]
      .sort((a, b) => new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime())
      .slice(0, 10);

    const recentCommunications = recentComms.length > 0
      ? recentComms.map(c => {
          const project = projects.find(p => p.id === c.projectId);
          return `- [${c.communicationDate ? new Date(c.communicationDate).toLocaleDateString('it-IT') : '?'}] ${project?.code || 'Non assegnata'}: ${c.subject} (${c.direction}, ${c.type})`;
        }).join('\n')
      : 'Nessuna comunicazione recente.';

    // Pending tasks
    const pendingTasksList = tasks
      .filter(t => t.status === 'pending' || t.status === 'in_progress')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      })
      .slice(0, 15);

    const pendingTasks = pendingTasksList.length > 0
      ? pendingTasksList.map(t => {
          const project = projects.find(p => p.id === t.projectId);
          return `- [${t.priority}] ${t.title} ${project ? `(${project.code})` : ''} - ${t.status}${t.dueDate ? ` | scadenza: ${new Date(t.dueDate).toLocaleDateString('it-IT')}` : ''}`;
        }).join('\n')
      : 'Nessun task pendente.';

    // Active alerts
    const activeAlerts = billingAlerts.length > 0
      ? billingAlerts.slice(0, 10).map(a => {
          const project = projects.find(p => p.id === a.projectId);
          return `- [${a.priority}] ${project?.code || '?'}: ${a.message || a.alertType}`;
        }).join('\n')
      : 'Nessun alert attivo.';

    return { projectsSummary, billingOverview, upcomingDeadlines, recentCommunications, pendingTasks, activeAlerts };
  } catch (error) {
    logger.error('Failed to build system context for AI assistant', { error });
    return {
      projectsSummary: 'Errore nel caricamento dati.',
      billingOverview: 'Errore nel caricamento dati.',
      upcomingDeadlines: 'Errore nel caricamento dati.',
      recentCommunications: 'Errore nel caricamento dati.',
      pendingTasks: 'Errore nel caricamento dati.',
      activeAlerts: 'Errore nel caricamento dati.',
    };
  }
}

const SYSTEM_PROMPT = `Sei l'assistente AI di G2 Ingegneria, una società di ingegneria strutturale italiana. Il tuo ruolo è aiutare i project manager a gestire commesse, fatturazione, comunicazioni e scadenze.

REGOLE:
- Rispondi SEMPRE in italiano
- Sii conciso e pratico
- Usa i dati reali del sistema forniti nel contesto
- Se non hai dati sufficienti per rispondere, dillo chiaramente
- Formatta le risposte con markdown per leggibilità
- Per importi monetari, usa il formato €X.XXX,XX
- Riferisciti ai progetti usando il codice commessa (es. 25G2MI01)
- Non inventare dati: usa solo quelli forniti nel contesto

CAPACITÀ:
- Riepilogo stato progetti e prestazioni
- Analisi fatturazione (prestazioni non fatturate, fatture scadute, cash flow)
- Scadenze imminenti e priorità
- Suggerimenti operativi basati sui dati
- Analisi comunicazioni recenti
- Riepilogo task e priorità
- Confronti tra progetti e clienti`;

/**
 * Process a chat message from the user, including conversation history.
 */
export async function processChat(
  userMessage: string,
  conversationHistory: AiChatMessage[],
  storage: IStorage,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<string> {
  const context = await buildSystemContext(storage);

  const contextBlock = `
DATI SISTEMA AGGIORNATI:

## Progetti Attivi
${context.projectsSummary}

## Panoramica Fatturazione
${context.billingOverview}

## Scadenze Prossime (30 giorni)
${context.upcomingDeadlines}

## Comunicazioni Recenti
${context.recentCommunications}

## Task Pendenti
${context.pendingTasks}

## Alert Attivi
${context.activeAlerts}
`;

  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextBlock },
  ];

  // Add conversation history (last 10 messages to stay within token limits)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  const result = await aiComplete('chat_assistant', {
    messages,
    maxTokens: 2048,
    temperature: 0.3,
  }, globalConfig, featureConfigs);

  logger.info('AI assistant response generated', {
    provider: result.provider,
    model: result.model,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
  });

  return result.content;
}

/**
 * Generate a conversation title from the first user message.
 */
export async function generateConversationTitle(
  firstMessage: string,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<string> {
  try {
    const result = await aiComplete('chat_assistant', {
      messages: [
        { role: 'system', content: 'Genera un titolo breve (max 50 caratteri) in italiano per questa conversazione. Rispondi SOLO con il titolo, niente altro.' },
        { role: 'user', content: firstMessage },
      ],
      maxTokens: 60,
      temperature: 0.5,
    }, globalConfig, featureConfigs);
    return result.content.trim().replace(/^["']|["']$/g, '');
  } catch {
    return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
  }
}
