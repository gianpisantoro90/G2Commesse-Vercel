/**
 * AI Project Health Analyzer
 *
 * Calculates a health score (0-100) for each project based on:
 * - Billing status (prestazioni completate non fatturate, fatture scadute)
 * - Deadline proximity and overdue status
 * - Communication recency (stale projects)
 * - Task completion rate
 * - Budget variance (costs vs revenue)
 *
 * Can optionally use AI for natural-language insights and recommendations.
 */

import { AIConfig, AIFeatureConfig } from "@shared/schema";
import { aiPrompt } from "./ai-provider";
import { logger } from "./logger";
import type { IStorage } from "../storage";

export interface HealthComponent {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  details: string;
  severity: 'ok' | 'warning' | 'critical';
}

export interface ProjectHealthResult {
  projectId: string;
  projectCode: string;
  client: string;
  overallScore: number; // 0-100
  riskLevel: 'basso' | 'medio' | 'alto' | 'critico';
  components: HealthComponent[];
  recommendations: string[];
  lastUpdated: string;
}

export interface HealthSummary {
  totalActive: number;
  averageScore: number;
  criticalProjects: number;
  highRiskProjects: number;
  topIssues: Array<{ issue: string; count: number; severity: string }>;
  projectScores: ProjectHealthResult[];
}

function getRiskLevel(score: number): ProjectHealthResult['riskLevel'] {
  if (score >= 80) return 'basso';
  if (score >= 60) return 'medio';
  if (score >= 40) return 'alto';
  return 'critico';
}

function componentSeverity(score: number): HealthComponent['severity'] {
  if (score >= 70) return 'ok';
  if (score >= 40) return 'warning';
  return 'critical';
}

/**
 * Calculate health score for a single project using only data (no AI call).
 */
export async function calculateProjectHealth(
  projectId: string,
  storage: IStorage,
): Promise<ProjectHealthResult> {
  const [project, prestazioni, invoices, deadlines, communications, tasks, costs, budgets] = await Promise.all([
    storage.getProject(projectId),
    storage.getPrestazioniByProject(projectId),
    storage.getInvoicesByProject(projectId),
    storage.getDeadlinesByProject(projectId),
    storage.getCommunicationsByProject(projectId),
    storage.getTasksByProject(projectId),
    storage.getAllProjectCosts(),
    storage.getAllProjectBudgets(),
  ]);

  if (!project) {
    throw new Error(`Progetto ${projectId} non trovato`);
  }

  const now = new Date();
  const components: HealthComponent[] = [];
  const recommendations: string[] = [];

  // 1. BILLING HEALTH (weight: 0.30)
  const completateNonFatturate = prestazioni.filter(p => p.stato === 'completata');
  const totalePrevisto = prestazioni.reduce((s, p) => s + (p.importoPrevisto || 0), 0);
  const totaleFatturato = prestazioni.reduce((s, p) => s + (p.importoFatturato || 0), 0);
  const totalePagato = prestazioni.reduce((s, p) => s + (p.importoPagato || 0), 0);

  const fattureScadute = invoices.filter(i =>
    (i.stato === 'emessa' || i.stato === 'scaduta') &&
    i.scadenzaPagamento && new Date(i.scadenzaPagamento) < now
  );

  let billingScore = 100;
  if (completateNonFatturate.length > 0) {
    billingScore -= 20 * Math.min(completateNonFatturate.length, 3);
    recommendations.push(
      `Fatturare ${completateNonFatturate.length} prestazion${completateNonFatturate.length === 1 ? 'e' : 'i'} completat${completateNonFatturate.length === 1 ? 'a' : 'e'} (€${(completateNonFatturate.reduce((s, p) => s + (p.importoPrevisto || 0), 0) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })})`
    );
  }
  if (fattureScadute.length > 0) {
    const maxDays = Math.max(...fattureScadute.map(f => {
      const d = f.scadenzaPagamento ? Math.ceil((now.getTime() - new Date(f.scadenzaPagamento).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return d;
    }));
    billingScore -= Math.min(30, 10 * fattureScadute.length);
    recommendations.push(
      `Sollecitare ${fattureScadute.length} fattur${fattureScadute.length === 1 ? 'a scaduta' : 'e scadute'} (max ${maxDays} giorni di ritardo)`
    );
  }
  billingScore = Math.max(0, billingScore);

  components.push({
    name: 'Fatturazione',
    score: billingScore,
    weight: 0.30,
    details: `Previsto: €${(totalePrevisto / 100).toLocaleString('it-IT')} | Fatturato: €${(totaleFatturato / 100).toLocaleString('it-IT')} | Pagato: €${(totalePagato / 100).toLocaleString('it-IT')}`,
    severity: componentSeverity(billingScore),
  });

  // 2. DEADLINES HEALTH (weight: 0.25)
  const pendingDeadlines = deadlines.filter(d => d.status === 'pending');
  const overdueDeadlines = pendingDeadlines.filter(d => d.dueDate && new Date(d.dueDate) < now);
  const urgentDeadlines = pendingDeadlines.filter(d => {
    if (!d.dueDate) return false;
    const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 14;
  });

  let deadlineScore = 100;
  if (overdueDeadlines.length > 0) {
    deadlineScore -= 30 * Math.min(overdueDeadlines.length, 2);
    recommendations.push(
      `${overdueDeadlines.length} scadenz${overdueDeadlines.length === 1 ? 'a scaduta' : 'e scadute'}: ${overdueDeadlines.map(d => d.title).join(', ')}`
    );
  }
  if (urgentDeadlines.length > 0) {
    deadlineScore -= 10 * Math.min(urgentDeadlines.length, 3);
    if (overdueDeadlines.length === 0) {
      recommendations.push(
        `${urgentDeadlines.length} scadenz${urgentDeadlines.length === 1 ? 'a' : 'e'} nei prossimi 14 giorni`
      );
    }
  }
  deadlineScore = Math.max(0, deadlineScore);

  components.push({
    name: 'Scadenze',
    score: deadlineScore,
    weight: 0.25,
    details: `Pendenti: ${pendingDeadlines.length} | Scadute: ${overdueDeadlines.length} | Urgenti: ${urgentDeadlines.length}`,
    severity: componentSeverity(deadlineScore),
  });

  // 3. COMMUNICATION RECENCY (weight: 0.15)
  const projectComms = communications.filter(c => c.projectId === projectId);
  const lastCommDate = projectComms.length > 0
    ? Math.max(...projectComms.map(c => new Date(c.communicationDate).getTime()))
    : 0;
  const daysSinceLastComm = lastCommDate > 0
    ? Math.ceil((now.getTime() - lastCommDate) / (1000 * 60 * 60 * 24))
    : 999;

  let commScore = 100;
  if (daysSinceLastComm > 90) {
    commScore = 20;
    recommendations.push(`Nessuna comunicazione da ${daysSinceLastComm} giorni - verificare stato progetto`);
  } else if (daysSinceLastComm > 60) {
    commScore = 50;
    recommendations.push(`Ultima comunicazione ${daysSinceLastComm} giorni fa`);
  } else if (daysSinceLastComm > 30) {
    commScore = 75;
  }

  components.push({
    name: 'Comunicazioni',
    score: commScore,
    weight: 0.15,
    details: daysSinceLastComm < 999
      ? `Ultima comunicazione: ${daysSinceLastComm} giorni fa | Totale: ${projectComms.length}`
      : 'Nessuna comunicazione registrata',
    severity: componentSeverity(commScore),
  });

  // 4. TASK PROGRESS (weight: 0.15)
  const projectTasks = tasks.filter(t => t.projectId === projectId);
  const completedTasks = projectTasks.filter(t => t.status === 'completed');
  const overdueTasks = projectTasks.filter(t =>
    (t.status === 'pending' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < now
  );

  let taskScore = 100;
  if (projectTasks.length > 0) {
    const completionRate = completedTasks.length / projectTasks.length;
    taskScore = Math.round(completionRate * 70 + 30); // Base 30 + up to 70 for completion
  }
  if (overdueTasks.length > 0) {
    taskScore -= 15 * Math.min(overdueTasks.length, 3);
    recommendations.push(
      `${overdueTasks.length} task scadut${overdueTasks.length === 1 ? 'o' : 'i'}`
    );
  }
  taskScore = Math.max(0, taskScore);

  components.push({
    name: 'Task',
    score: taskScore,
    weight: 0.15,
    details: `Completati: ${completedTasks.length}/${projectTasks.length} | Scaduti: ${overdueTasks.length}`,
    severity: componentSeverity(taskScore),
  });

  // 5. PRESTAZIONI PROGRESS (weight: 0.15)
  const totalPrestazioniCount = prestazioni.length;
  const activeOrDone = prestazioni.filter(p => p.stato !== 'da_iniziare').length;
  const fullyDone = prestazioni.filter(p => ['fatturata', 'pagata'].includes(p.stato)).length;

  let prestazioniScore = 100;
  if (totalPrestazioniCount === 0) {
    prestazioniScore = 50; // No prestazioni defined yet
    recommendations.push('Definire le prestazioni professionali per il progetto');
  } else {
    const progressRate = activeOrDone / totalPrestazioniCount;
    prestazioniScore = Math.round(progressRate * 50 + fullyDone / totalPrestazioniCount * 50);
  }

  components.push({
    name: 'Prestazioni',
    score: prestazioniScore,
    weight: 0.15,
    details: `Totali: ${totalPrestazioniCount} | Attive: ${activeOrDone} | Chiuse: ${fullyDone}`,
    severity: componentSeverity(prestazioniScore),
  });

  // Calculate weighted overall score
  const overallScore = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  return {
    projectId: project.id,
    projectCode: project.code,
    client: project.client,
    overallScore,
    riskLevel: getRiskLevel(overallScore),
    components,
    recommendations: recommendations.slice(0, 5), // Max 5 recommendations
    lastUpdated: now.toISOString(),
  };
}

/**
 * Calculate health for all active projects.
 */
export async function calculateAllProjectsHealth(
  storage: IStorage,
): Promise<HealthSummary> {
  const projects = await storage.getAllProjects();
  const activeProjects = projects.filter(p => p.status === 'in corso');

  const projectScores: ProjectHealthResult[] = [];
  for (const project of activeProjects) {
    try {
      const health = await calculateProjectHealth(project.id, storage);
      projectScores.push(health);
    } catch (error) {
      logger.error(`Failed to calculate health for project ${project.code}`, { error });
    }
  }

  // Sort by score ascending (worst first)
  projectScores.sort((a, b) => a.overallScore - b.overallScore);

  const averageScore = projectScores.length > 0
    ? Math.round(projectScores.reduce((s, p) => s + p.overallScore, 0) / projectScores.length)
    : 0;

  // Aggregate top issues
  const issueMap = new Map<string, { count: number; severity: string }>();
  for (const score of projectScores) {
    for (const comp of score.components) {
      if (comp.severity !== 'ok') {
        const key = `${comp.name} - ${comp.severity}`;
        const existing = issueMap.get(key) || { count: 0, severity: comp.severity };
        issueMap.set(key, { count: existing.count + 1, severity: comp.severity });
      }
    }
  }
  const topIssues = Array.from(issueMap.entries())
    .map(([issue, data]) => ({ issue, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalActive: activeProjects.length,
    averageScore,
    criticalProjects: projectScores.filter(p => p.riskLevel === 'critico').length,
    highRiskProjects: projectScores.filter(p => p.riskLevel === 'alto').length,
    topIssues,
    projectScores,
  };
}

/**
 * Generate AI-powered insights for the health summary.
 * This is optional and used when the user requests detailed AI analysis.
 */
export async function generateHealthInsights(
  summary: HealthSummary,
  storage: IStorage,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<string> {
  const topProblems = summary.projectScores
    .filter(p => p.riskLevel === 'critico' || p.riskLevel === 'alto')
    .slice(0, 5)
    .map(p => `${p.projectCode} (${p.client}): score ${p.overallScore}/100 - ${p.recommendations.join('; ')}`);

  const prompt = `Analizza lo stato di salute dei progetti di G2 Ingegneria e fornisci un riepilogo conciso con azioni prioritarie.

DATI:
- Progetti attivi: ${summary.totalActive}
- Score medio: ${summary.averageScore}/100
- Progetti critici: ${summary.criticalProjects}
- Progetti alto rischio: ${summary.highRiskProjects}

PROGETTI PIU' A RISCHIO:
${topProblems.length > 0 ? topProblems.join('\n') : 'Nessun progetto critico.'}

PROBLEMI RICORRENTI:
${summary.topIssues.map(i => `- ${i.issue}: ${i.count} progetti`).join('\n')}

Fornisci:
1. Un riepilogo di 2-3 frasi dello stato generale
2. Le 3 azioni più urgenti da intraprendere
3. Un suggerimento per migliorare la gestione

Rispondi in italiano, in formato markdown conciso.`;

  return aiPrompt(
    'project_health',
    'Sei un consulente di project management per una società di ingegneria strutturale italiana. Analizza i dati e fornisci consigli pratici e azionabili.',
    prompt,
    globalConfig,
    featureConfigs,
  );
}
