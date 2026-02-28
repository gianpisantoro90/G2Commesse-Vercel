/**
 * AI Email Draft Generator
 *
 * Generates professional email drafts based on context:
 * - Project data (codice, cliente, oggetto)
 * - Communication history
 * - Purpose/intent (sollecito pagamento, richiesta info, aggiornamento, etc.)
 *
 * Uses the AI provider system for per-feature routing.
 */

import { AIConfig, AIFeatureConfig } from "@shared/schema";
import { aiPrompt } from "./ai-provider";
import { logger } from "./logger";
import type { IStorage } from "../storage";

export type EmailPurpose =
  | 'sollecito_pagamento'
  | 'richiesta_informazioni'
  | 'aggiornamento_stato'
  | 'invio_documenti'
  | 'conferma_ricezione'
  | 'richiesta_approvazione'
  | 'comunicazione_ritardo'
  | 'custom';

const PURPOSE_DESCRIPTIONS: Record<EmailPurpose, string> = {
  sollecito_pagamento: 'Sollecito di pagamento per fattura scaduta o in scadenza',
  richiesta_informazioni: 'Richiesta di informazioni o documentazione al cliente',
  aggiornamento_stato: 'Aggiornamento sullo stato di avanzamento del progetto',
  invio_documenti: 'Invio di documenti, elaborati o certificati al cliente',
  conferma_ricezione: 'Conferma di ricezione di documentazione o comunicazione',
  richiesta_approvazione: 'Richiesta di approvazione o validazione di elaborati',
  comunicazione_ritardo: 'Comunicazione di ritardo o variazione delle tempistiche',
  custom: 'Email personalizzata',
};

export interface EmailDraftRequest {
  projectId: string;
  purpose: EmailPurpose;
  customContext?: string; // Additional context from user
  recipientName?: string;
  recipientEmail?: string;
  tone?: 'formale' | 'cordiale' | 'urgente';
  language?: 'it' | 'en';
  replyToSubject?: string; // When replying to an existing email
  replyToBody?: string;
}

export interface EmailDraftResult {
  subject: string;
  body: string;
  recipientSuggestion?: string;
  tone: string;
  purpose: string;
  generatedAt: string;
}

/**
 * Generate an AI-powered email draft with project context.
 */
export async function generateEmailDraft(
  request: EmailDraftRequest,
  storage: IStorage,
  globalConfig?: AIConfig,
  featureConfigs?: AIFeatureConfig[],
): Promise<EmailDraftResult> {
  const project = await storage.getProject(request.projectId);
  if (!project) throw new Error(`Progetto ${request.projectId} non trovato`);

  // Gather context
  const [prestazioni, invoices, communications, deadlines] = await Promise.all([
    storage.getPrestazioniByProject(request.projectId),
    storage.getInvoicesByProject(request.projectId),
    storage.getCommunicationsByProject(request.projectId),
    storage.getDeadlinesByProject(request.projectId),
  ]);

  // Recent communications for context
  const recentComms = communications
    .sort((a, b) => new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime())
    .slice(0, 5);

  // Build context for AI
  const contextParts: string[] = [
    `PROGETTO: ${project.code} - ${project.object}`,
    `CLIENTE: ${project.client}`,
    `CITTA': ${project.city}`,
    `STATO: ${project.status}`,
  ];

  if (project.committenteFinale && project.tipoRapporto !== 'diretto') {
    contextParts.push(`COMMITTENTE FINALE: ${project.committenteFinale}`);
    contextParts.push(`TIPO RAPPORTO: ${project.tipoRapporto}`);
  }

  // Billing context for payment-related emails
  if (request.purpose === 'sollecito_pagamento' || request.purpose === 'invio_documenti') {
    const fattureScadute = invoices.filter(i =>
      (i.stato === 'emessa' || i.stato === 'scaduta') &&
      i.scadenzaPagamento && new Date(i.scadenzaPagamento) < new Date()
    );
    if (fattureScadute.length > 0) {
      contextParts.push('\nFATTURE SCADUTE:');
      for (const f of fattureScadute) {
        const days = Math.ceil((Date.now() - new Date(f.scadenzaPagamento!).getTime()) / 86400000);
        contextParts.push(`- N.${f.numeroFattura}: €${(f.importoTotale / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} (scaduta da ${days} giorni)`);
      }
    }
    const totaleFatturato = prestazioni.reduce((s, p) => s + (p.importoFatturato || 0), 0);
    const totalePagato = prestazioni.reduce((s, p) => s + (p.importoPagato || 0), 0);
    if (totaleFatturato > 0) {
      contextParts.push(`FATTURATO: €${(totaleFatturato / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} | PAGATO: €${(totalePagato / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);
    }
  }

  // Deadlines context
  const pendingDeadlines = deadlines.filter(d => d.status === 'pending');
  if (pendingDeadlines.length > 0 && (request.purpose === 'aggiornamento_stato' || request.purpose === 'comunicazione_ritardo')) {
    contextParts.push('\nSCADENZE PENDENTI:');
    for (const d of pendingDeadlines.slice(0, 3)) {
      contextParts.push(`- ${d.title}: ${d.dueDate ? new Date(d.dueDate).toLocaleDateString('it-IT') : 'senza data'}`);
    }
  }

  // Recent communications for thread context
  if (recentComms.length > 0) {
    contextParts.push('\nULTIME COMUNICAZIONI:');
    for (const c of recentComms.slice(0, 3)) {
      contextParts.push(`- ${new Date(c.communicationDate).toLocaleDateString('it-IT')} [${c.direction}] ${c.subject || '(senza oggetto)'}`);
    }
  }

  // Reply context
  if (request.replyToSubject || request.replyToBody) {
    contextParts.push('\nEMAIL A CUI RISPONDERE:');
    if (request.replyToSubject) contextParts.push(`Oggetto: ${request.replyToSubject}`);
    if (request.replyToBody) contextParts.push(`Corpo: ${request.replyToBody.substring(0, 500)}`);
  }

  const tone = request.tone || 'formale';
  const lang = request.language || 'it';

  const systemPrompt = `Sei un ingegnere strutturista di G2 Ingegneria, uno studio di ingegneria strutturale italiano.
Scrivi email professionali per conto dello studio.
Lo studio si occupa di progettazione strutturale, direzione lavori, collaudo, coordinamento sicurezza.

REGOLE:
- Usa un tono ${tone}
- Scrivi in ${lang === 'it' ? 'italiano' : 'inglese'}
- Inizia con un saluto appropriato (${tone === 'formale' ? '"Gentile/Spettabile"' : '"Buongiorno"'})
- Chiudi con "Cordiali saluti" o equivalente
- Non inventare dati non presenti nel contesto
- Sii conciso ma completo
- Se il tipo e' "sollecito_pagamento", sii diplomatico ma fermo
- Firma: "G2 Ingegneria"

FORMATO RISPOSTA (JSON):
{"subject": "oggetto della mail", "body": "corpo della mail completo"}`;

  const userPrompt = `Genera una bozza email per: ${PURPOSE_DESCRIPTIONS[request.purpose]}

${request.customContext ? `INDICAZIONI AGGIUNTIVE: ${request.customContext}\n` : ''}${request.recipientName ? `DESTINATARIO: ${request.recipientName}${request.recipientEmail ? ` <${request.recipientEmail}>` : ''}\n` : ''}
CONTESTO:
${contextParts.join('\n')}`;

  const response = await aiPrompt(
    'email_drafting',
    systemPrompt,
    userPrompt,
    globalConfig,
    featureConfigs,
  );

  // Parse JSON response
  let parsed: { subject: string; body: string };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || response);
  } catch {
    // Fallback: use response as body, generate subject
    parsed = {
      subject: `${project.code} - ${PURPOSE_DESCRIPTIONS[request.purpose]}`,
      body: response,
    };
  }

  return {
    subject: parsed.subject,
    body: parsed.body,
    recipientSuggestion: request.recipientName || project.client,
    tone,
    purpose: PURPOSE_DESCRIPTIONS[request.purpose],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Quick email templates that don't require AI (fallback).
 */
export function getEmailTemplates(purpose: EmailPurpose): { subject: string; body: string } {
  const templates: Record<EmailPurpose, { subject: string; body: string }> = {
    sollecito_pagamento: {
      subject: 'Sollecito di pagamento',
      body: 'Gentile Cliente,\n\ncon la presente desideriamo sollecitare cortesemente il pagamento della/e fattura/e sotto indicate.\n\nRimaniamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nG2 Ingegneria',
    },
    richiesta_informazioni: {
      subject: 'Richiesta informazioni',
      body: 'Gentile Cliente,\n\nin riferimento all\'incarico in oggetto, necessiteremmo delle seguenti informazioni/documentazione:\n\n- \n\nRestiamo in attesa di cortese riscontro.\n\nCordiali saluti,\nG2 Ingegneria',
    },
    aggiornamento_stato: {
      subject: 'Aggiornamento stato lavori',
      body: 'Gentile Cliente,\n\ndesideriamo aggiornarLa sullo stato di avanzamento delle attività relative all\'incarico in oggetto.\n\n\n\nRimaniamo a disposizione.\n\nCordiali saluti,\nG2 Ingegneria',
    },
    invio_documenti: {
      subject: 'Trasmissione documenti',
      body: 'Gentile Cliente,\n\ncon la presente trasmettiamo in allegato la documentazione relativa all\'incarico in oggetto.\n\n\n\nCordiali saluti,\nG2 Ingegneria',
    },
    conferma_ricezione: {
      subject: 'Conferma ricezione',
      body: 'Gentile Cliente,\n\nconfirmiamo la ricezione della documentazione trasmessa.\n\nProvvederemo ad analizzarla e Le daremo riscontro nel più breve tempo possibile.\n\nCordiali saluti,\nG2 Ingegneria',
    },
    richiesta_approvazione: {
      subject: 'Richiesta approvazione elaborati',
      body: 'Gentile Cliente,\n\ntrasmettiamo in allegato gli elaborati per la Sua approvazione.\n\nLa preghiamo di volerci dare riscontro entro .\n\nCordiali saluti,\nG2 Ingegneria',
    },
    comunicazione_ritardo: {
      subject: 'Comunicazione variazione tempistiche',
      body: 'Gentile Cliente,\n\ndesideriamo informarLa che, per le ragioni sotto indicate, si è resa necessaria una variazione delle tempistiche previste.\n\n\n\nCi scusiamo per il disagio e rimaniamo a disposizione.\n\nCordiali saluti,\nG2 Ingegneria',
    },
    custom: {
      subject: '',
      body: 'Gentile ,\n\n\n\nCordiali saluti,\nG2 Ingegneria',
    },
  };
  return templates[purpose] || templates.custom;
}
