import { AIConfig } from "@shared/schema";
import { logger } from "./logger";

export interface ParsedEmail {
  subject: string;
  from: { email: string; name?: string };
  bodyText: string;
  bodyHtml?: string;
}

export interface ProjectInfo {
  id: string;
  code: string;
  client: string;
  object: string;
}

export interface AIEmailAnalysis {
  projectCode?: string;
  projectId?: string;
  confidence: number;
  projectMatches: Array<{
    projectId: string;
    projectCode: string;
    confidence: number;
    reasoning: string;
    matchedFields: string[];
  }>;
  extractedData: {
    deadlines?: string[];
    amounts?: string[];
    actionItems?: string[];
    keyPoints?: string[];
  };
  suggestedTags: string[];
  isImportant: boolean;
  summary?: string;
  suggestedTasks?: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dueDate: string | null;
    reasoning: string;
  }>;
  suggestedDeadlines?: Array<{
    title: string;
    description: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    type: 'deposito' | 'collaudo' | 'scadenza_assicurazione' | 'milestone' | 'general';
    dueDate: string;
    notifyDaysBefore: number;
    reasoning: string;
  }>;
}

interface EmailAnalysisRequest {
  email: ParsedEmail;
  projects: ProjectInfo[];
  config: AIConfig;
}

type Provider = 'anthropic' | 'deepseek';

interface ProviderAdapter {
  analyze(prompt: string, config: AIConfig): Promise<any>;
}

const ANALYSIS_TIMEOUT_MS = 25000;
const REASONER_TIMEOUT_MS = 120000; // 2 minutes for reasoning models

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      const isRetryable = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('5'));
      
      if (!isRetryable || i === maxRetries) {
        break;
      }
      
      const backoffMs = Math.min(1000 * Math.pow(2, i), 5000);
      logger.warn(`Retry ${i + 1}/${maxRetries} after ${backoffMs}ms`, { error: error instanceof Error ? error.message : 'Unknown' });
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  throw lastError!;
}

const anthropicAdapter: ProviderAdapter = {
  async analyze(prompt: string, config: AIConfig): Promise<any> {
    return retryWithBackoff(async () => {
      const response = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        },
        ANALYSIS_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Anthropic API error', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid Anthropic API response format');
      }

      return data.content[0].text;
    });
  },
};

const deepseekAdapter: ProviderAdapter = {
  async analyze(prompt: string, config: AIConfig): Promise<any> {
    return retryWithBackoff(async () => {
      const systemMessage = "You are an expert Italian structural engineer analyzing emails for G2 Ingegneria. Always respond with valid JSON only.";
      
      const isThinkingModel = config.model.includes('reasoner') || config.model.includes('v3.2');
      const timeout = isThinkingModel ? REASONER_TIMEOUT_MS : ANALYSIS_TIMEOUT_MS;
      
      const requestBody: any = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      };
      
      const response = await fetchWithTimeout(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
        timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('DeepSeek API error', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error('Invalid DeepSeek API response format');
      }

      return data.choices[0].message.content;
    });
  },
};

const providers: Record<Provider, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
};

export function buildPrompt(email: ParsedEmail, projects: ProjectInfo[]): string {
  const fromEmail = email.from?.email || 'unknown';
  const fromName = email.from?.name ? ` (${email.from.name})` : '';
  const subject = email.subject || '(Nessun oggetto)';
  const bodyText = email.bodyText || '(Nessun contenuto)';
  
  return `Analizza questa email e trova i progetti più pertinenti confrontando TUTTI i dati disponibili.

EMAIL RICEVUTA:
Da: ${fromEmail}${fromName}
Oggetto: ${subject}
Contenuto: ${bodyText.substring(0, 2000)}

PROGETTI DISPONIBILI:
${projects.map(p => `ID: ${p.id} | Codice: ${p.code} | Cliente: ${p.client} | Oggetto: ${p.object}`).join('\n')}

ISTRUZIONI MATCHING INTELLIGENTE:
1. NON limitarti a cercare il codice progetto nell'email
2. Analizza il CONTENUTO dell'email e confrontalo con:
   - Nome del cliente/committente
   - Descrizione/oggetto del progetto
   - Città/località menzionate
   - Contesto e dettagli tecnici
3. Identifica TUTTI i progetti potenzialmente rilevanti (massimo 5)
4. Per ogni match, calcola confidence (0.0-1.0) basata su:
   - Codice esatto nell'email → 1.0
   - Cliente + oggetto + contesto → 0.8-0.95
   - Cliente + contesto → 0.6-0.8
   - Solo cliente o solo oggetto → 0.3-0.6
   - Nessun match chiaro → 0.1-0.3
5. Spiega il PERCHÉ di ogni match (reasoning)
6. Lista i campi che hanno fatto match

COMPITI AGGIUNTIVI:
- Estrai scadenze, importi, azioni da fare, punti chiave
- Genera 3-5 tag rilevanti
- Determina importanza/urgenza
- Crea riassunto di 2-3 righe
- IMPORTANTE: Suggerisci task/azioni specifiche derivate dall'email

ESTRAZIONE TASK SUGGERITI:
Analizza l'email e suggerisci task specifici che dovrebbero essere creati:
1. Identifica azioni concrete richieste o necessarie (max 5 task)
2. Per ogni task specifica:
   - title: Titolo breve e chiaro (max 60 caratteri)
   - description: Descrizione dettagliata dell'azione richiesta
   - priority: 'high' se urgente/importante, 'medium' se normale, 'low' se opzionale
   - dueDate: Data scadenza in formato ISO (YYYY-MM-DD) se menzionata, altrimenti null
   - reasoning: Perché questo task è necessario (citare fonte nell'email)

Esempi di task da suggerire:
- "Inviare documentazione richiesta" se il cliente chiede documenti
- "Programmare sopralluogo" se si menziona necessità di verifica in loco
- "Rispondere a richiesta informazioni" se c'è una domanda
- "Aggiornare progetto con modifiche" se si richiedono varianti
- "Preparare preventivo" se si chiede un'offerta

ESTRAZIONE SCADENZE SUGGERITE:
Analizza l'email e suggerisci scadenze/milestone che dovrebbero essere registrate:
1. Identifica date importanti, scadenze formali, milestone del progetto (max 5 scadenze)
2. Per ogni scadenza specifica:
   - title: Titolo breve della scadenza (max 60 caratteri)
   - description: Descrizione dettagliata
   - priority: 'urgent' se critica, 'high' se importante, 'medium' se normale, 'low' se informativa
   - type: 'deposito' se riguarda depositi ufficiali, 'collaudo' se test/collaudo, 'scadenza_assicurazione' se assicurazioni, 'milestone' se traguardo progetto, 'general' per altre
   - dueDate: Data scadenza in formato ISO (YYYY-MM-DD) - OBBLIGATORIO
   - notifyDaysBefore: Quanti giorni prima notificare (default 7, urgente 3, importante 7, normale 14)
   - reasoning: Perché questa scadenza è importante (citare fonte nell'email)

Esempi di scadenze da suggerire:
- "Deposito progetto al Genio Civile" type: 'deposito' se si menziona depositi ufficiali
- "Collaudo impianti elettrici" type: 'collaudo' se si parla di test/collaudi
- "Scadenza polizza assicurativa cantiere" type: 'scadenza_assicurazione' se si menzionano assicurazioni
- "Completamento Fase 1 - Fondazioni" type: 'milestone' se si parla di fasi/traguardi progetto
- "Consegna elaborati al committente" type: 'general' se non rientra in altre categorie

IMPORTANTE: Suggerisci solo scadenze con date esplicite o deducibili dal contesto. Non inventare date!

RISPOSTA IN JSON (esempio):
{
  "projectMatches": [
    {
      "projectId": "123",
      "projectCode": "25G2MI01",
      "confidence": 0.95,
      "reasoning": "Email menziona esplicitamente 'Villa Rossi' che corrisponde all'oggetto del progetto. Il cliente 'Rossi SpA' è citato nell'email.",
      "matchedFields": ["client", "object", "code"]
    },
    {
      "projectId": "456",
      "projectCode": "25G2MI03",
      "confidence": 0.60,
      "reasoning": "Email parla di Milano e il progetto è a Milano, ma non ci sono altri match chiari.",
      "matchedFields": ["city"]
    }
  ],
  "projectCode": "25G2MI01",
  "confidence": 0.95,
  "extractedData": {
    "deadlines": ["15/12/2024"],
    "amounts": ["€50.000"],
    "actionItems": ["Inviare progetto esecutivo", "Programmare sopralluogo"],
    "keyPoints": ["Cliente urgente", "Budget approvato"]
  },
  "suggestedTags": ["urgente", "villa-rossi", "progetto-esecutivo", "sopralluogo", "budget"],
  "isImportant": true,
  "summary": "Il cliente Rossi SpA richiede urgentemente l'invio del progetto esecutivo per Villa Rossi entro il 15/12/2024. Budget di €50.000 approvato. Necessario programmare sopralluogo.",
  "suggestedTasks": [
    {
      "title": "Inviare progetto esecutivo Villa Rossi",
      "description": "Predisporre e inviare al cliente Rossi SpA il progetto esecutivo completo comprensivo di tutti gli elaborati grafici e relazioni tecniche",
      "priority": "high",
      "dueDate": "2024-12-15",
      "reasoning": "Cliente richiede esplicitamente l'invio del progetto esecutivo nell'email con scadenza 15/12/2024"
    },
    {
      "title": "Programmare sopralluogo Villa Rossi",
      "description": "Coordinare con il cliente per fissare data e ora del sopralluogo tecnico preliminare",
      "priority": "medium",
      "dueDate": null,
      "reasoning": "Email menziona necessità di sopralluogo per valutazione preliminare"
    }
  ],
  "suggestedDeadlines": [
    {
      "title": "Consegna progetto esecutivo Villa Rossi",
      "description": "Scadenza per la consegna del progetto esecutivo completo al cliente Rossi SpA",
      "priority": "urgent",
      "type": "general",
      "dueDate": "2024-12-15",
      "notifyDaysBefore": 3,
      "reasoning": "Scadenza esplicita menzionata nell'email del cliente per la consegna del progetto"
    }
  ]
}

CRITICAL: Respond ONLY with valid JSON. No additional text before or after the JSON object.`;
}

export function normalizeAnalysis(rawResponse: string, provider: Provider): AIEmailAnalysis {
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in ${provider} response`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const projectMatches = parsed.projectMatches || [];
    const bestMatch = projectMatches[0];

    return {
      projectCode: bestMatch?.projectCode || parsed.projectCode,
      projectId: bestMatch?.projectId || parsed.projectId,
      confidence: bestMatch?.confidence || parsed.confidence || 0,
      projectMatches: projectMatches.map((match: any) => ({
        projectId: match.projectId || '',
        projectCode: match.projectCode || '',
        confidence: Math.min(Math.max(match.confidence || 0, 0), 1),
        reasoning: match.reasoning || '',
        matchedFields: match.matchedFields || [],
      })),
      extractedData: {
        deadlines: parsed.extractedData?.deadlines || [],
        amounts: parsed.extractedData?.amounts || [],
        actionItems: parsed.extractedData?.actionItems || [],
        keyPoints: parsed.extractedData?.keyPoints || [],
      },
      suggestedTags: parsed.suggestedTags || [],
      isImportant: parsed.isImportant || false,
      summary: parsed.summary || '',
      suggestedTasks: (parsed.suggestedTasks || []).map((task: any) => ({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
        reasoning: task.reasoning || '',
      })),
      suggestedDeadlines: (parsed.suggestedDeadlines || []).map((deadline: any) => ({
        title: deadline.title || '',
        description: deadline.description || '',
        priority: deadline.priority || 'medium',
        type: deadline.type || 'general',
        dueDate: deadline.dueDate || '',
        notifyDaysBefore: deadline.notifyDaysBefore || 7,
        reasoning: deadline.reasoning || '',
      })),
    };
  } catch (error) {
    logger.error(`Failed to normalize ${provider} response`, {
      error: error instanceof Error ? error.message : 'Unknown',
      rawResponse: rawResponse.substring(0, 200),
    });
    
    return {
      confidence: 0,
      projectMatches: [],
      extractedData: {},
      suggestedTags: [],
      isImportant: false,
      summary: '',
    };
  }
}

export async function dispatchToProvider(
  prompt: string,
  config: AIConfig
): Promise<string> {
  const adapter = providers[config.provider];
  
  if (!adapter) {
    throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  logger.info(`Dispatching to ${config.provider} with model ${config.model}`);
  
  try {
    const rawResponse = await adapter.analyze(prompt, config);
    return rawResponse;
  } catch (error) {
    logger.error(`Provider ${config.provider} failed`, {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

export async function analyzeEmail(request: EmailAnalysisRequest): Promise<AIEmailAnalysis> {
  const { email, projects, config } = request;

  logger.info('Starting email analysis', {
    provider: config.provider,
    model: config.model,
    projectCount: projects.length,
  });

  const prompt = buildPrompt(email, projects);
  const rawResponse = await dispatchToProvider(prompt, config);
  const analysis = normalizeAnalysis(rawResponse, config.provider);

  logger.info('Email analysis completed', {
    provider: config.provider,
    matchesCount: analysis.projectMatches.length,
    bestConfidence: analysis.confidence,
  });

  return analysis;
}
