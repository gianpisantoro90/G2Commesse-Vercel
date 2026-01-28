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
  isSpam?: boolean;
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
      
      const isThinkingModel = config.model.includes('reasoner') || config.model.includes('v3.2') || config.model.includes('r1');
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
        'https://api.deepseek.com/chat/completions',
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
      
      // Debug logging: log the entire response structure
      logger.debug('DeepSeek raw API response', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        firstChoice: data.choices?.[0] ? {
          hasMessage: !!data.choices[0].message,
          messageContentType: typeof data.choices[0].message?.content,
          messageReasoningContentType: typeof data.choices[0].message?.reasoning_content,
          contentLength: data.choices[0].message?.content?.length || 0,
          reasoningContentLength: data.choices[0].message?.reasoning_content?.length || 0
        } : null
      });
      
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid DeepSeek API response format - no choices');
      }
      
      const choice = data.choices[0];
      let content: any;
      
      // DeepSeek Reasoner returns reasoning_content (Chain-of-Thought) + content (final answer)
      // We need to combine both to get the complete response with JSON
      const message = choice.message || {};
      const reasoningContent = message.reasoning_content || '';
      const finalContent = message.content || '';
      
      // For reasoner models, combine reasoning + final content
      // The JSON response is usually at the end of reasoning_content or in content
      if (isThinkingModel && reasoningContent) {
        content = reasoningContent + (finalContent ? '\n' + finalContent : '');
        logger.debug('Using reasoning_content + content from DeepSeek Reasoner', {
          reasoningLength: reasoningContent.length,
          contentLength: finalContent.length
        });
      } else if (finalContent) {
        content = finalContent;
        logger.debug('Using message.content from DeepSeek response');
      } else if (reasoningContent) {
        content = reasoningContent;
        logger.debug('Using reasoning_content fallback from DeepSeek response');
      } else {
        throw new Error('Invalid DeepSeek API response format - no content or reasoning_content found');
      }
      
      // DeepSeek Reasoner returns array with reasoning + final response
      // We need to extract only the JSON part, ignoring the <think>...</think> reasoning
      if (Array.isArray(content)) {
        // Filter out reasoning segments and join text segments
        content = content
          .filter((segment: any) => segment.type !== 'reasoning')
          .map((segment: any) => segment.text || segment.content || '')
          .join('\n');
      }
      
      // Log sanitized response for debugging (first 500 chars to avoid PII leakage)
      logger.debug('DeepSeek response (sanitized)', {
        responsePreview: typeof content === 'string' ? content.substring(0, 500) : 'non-string content',
        isThinkingModel: isThinkingModel
      });

      return content;
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
  
  return `Analizza questa email e trova i progetti più pertinenti confrontando TUTTI i dati disponibili. FILTRO SPAM/NEWSLETTER CRITICO: identifica e scarta pubblicità, newsletter, email automatiche.

EMAIL RICEVUTA:
Da: ${fromEmail}${fromName}
Oggetto: ${subject}
Contenuto: ${bodyText.substring(0, 2000)}

PROGETTI DISPONIBILI:
${projects.map(p => `ID: ${p.id} | Codice: ${p.code} | Cliente: ${p.client} | Oggetto: ${p.object}`).join('\n')}

FILTRO SPAM/NEWSLETTER (PRIORITARIO):
CONTESTO: Applicazione per studio di ingegneria/architettura. Solo email professionali rilevanti.

SCARTA IMMEDIATAMENTE email se:
1. Newsletter/digest: contiene "unsubscribe", "newsletter", "digest", "disiscrivi", "cancella iscrizione"
2. Marketing platforms: mailchimp, sendgrid, brevo, sendinblue, hubspot, constantcontact, klaviyo
3. E-commerce: Amazon, eBay, Aliexpress, Alibaba, Wish, Shein, Temu, Zalando, ordini, spedizioni
4. Social media: LinkedIn notifiche, Facebook, Instagram, Twitter/X, TikTok (non messaggi diretti personali)
5. Streaming/entertainment: Netflix, Spotify, Disney+, Apple Music, YouTube, Twitch
6. Travel/booking non professionale: Booking.com, Expedia, Ryanair, easyJet, Hotels.com, Airbnb (offerte/promo)
7. Promozioni/offerte: sconti, coupon, "offerta speciale", "promo", "% off", "gratis", "flash sale"
8. Notifiche automatiche: "this is an automated message", "noreply", "do not reply"
9. Finance bulk: PayPal promo, crypto news, investimenti, trading signals
10. News/media generica: substack, medium, giornali, blog non tecnici

EMAIL LEGITTIME (NON scartare):
- Clienti, committenti, enti pubblici (Comune, Regione, Genio Civile, ASL, VVF)
- Colleghi professionisti, studi associati, consulenti tecnici
- Fornitori materiali/servizi per cantiere
- Imprese edili, ditte, artigiani
- Pratiche edilizie, depositi, autorizzazioni, permessi
- Sopralluoghi, collaudi, verifiche tecniche
- Fatture, preventivi, offerte professionali

SE EMAIL È SPAM/NEWSLETTER:
- projectMatches: []
- confidence: 0
- summary: "Email non rilevante - publicità/newsletter"
- isSpam: true
- SMETTI DI ELABORARE, RISPONDI SOLO IL JSON

ISTRUZIONI MATCHING INTELLIGENTE (solo se NON spam):
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

CRITICAL: You MUST respond ONLY with a valid JSON object. No explanation, no markdown code blocks, no text before or after. Output EXACTLY this structure:
{
  "projectMatches": [...],
  "projectCode": "...",
  "confidence": 0.0,
  "extractedData": {...},
  "suggestedTags": [...],
  "isImportant": false,
  "summary": "...",
  "suggestedTasks": [...],
  "suggestedDeadlines": [...],
  "isSpam": false
}`;
}

// Extract JSON by finding balanced braces (handles nested objects)
function extractBalancedJson(text: string): string | null {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;
  
  let depth = 0;
  let inString = false;
  let escape = false;
  
  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (inString) continue;
    
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(firstBrace, i + 1);
      }
    }
  }
  
  return null;
}

export function normalizeAnalysis(rawResponse: string, provider: Provider): AIEmailAnalysis {
  try {
    
    // Find the LAST valid JSON object (for DeepSeek reasoner responses with reasoning + JSON)
    let parsed: any = null;
    let lastValidJson: string | null = null;
    
    // Try to find last JSON by searching from end
    let searchText = rawResponse;
    while (searchText.length > 0) {
      const json = extractBalancedJson(searchText);
      if (!json) break;
      
      try {
        const testParse = JSON.parse(json);
        // Validate it has expected structure
        if (testParse && (testParse.projectMatches || testParse.confidence !== undefined)) {
          parsed = testParse;
          lastValidJson = json;
          // Found valid JSON, but keep searching for last one
          const jsonEnd = searchText.indexOf(json) + json.length;
          searchText = searchText.substring(jsonEnd);
        } else {
          // Skip this JSON and look for next
          const jsonEnd = searchText.indexOf(json) + json.length;
          searchText = searchText.substring(jsonEnd);
        }
      } catch {
        // Invalid JSON, skip and continue
        const jsonEnd = searchText.indexOf(json) + json.length;
        searchText = searchText.substring(jsonEnd);
      }
    }
    
    // If no valid JSON found, return default empty analysis
    if (!parsed) {
      logger.warn('No valid JSON found in response, returning empty analysis', {
        provider,
        responseLength: rawResponse.length,
        preview: rawResponse.substring(0, 200)
      });
      
      // Return empty analysis for manual review
      return {
        confidence: 0,
        projectMatches: [],
        isSpam: false,
        extractedData: {
          deadlines: [],
          amounts: [],
          actionItems: [],
          keyPoints: [],
        },
        suggestedTags: [],
        isImportant: false,
        summary: 'Email ricevuta per revisione manuale',
        suggestedTasks: [],
        suggestedDeadlines: [],
      };
    }
    
    logger.debug('JSON parsing successful', {
      provider,
      hasProjectMatches: !!parsed.projectMatches,
      matchCount: parsed.projectMatches?.length || 0,
      jsonPreview: lastValidJson ? lastValidJson.substring(0, 200) : 'fallback'
    });

    const projectMatches = parsed.projectMatches || [];
    const bestMatch = projectMatches[0];

    return {
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
      isSpam: parsed.isSpam || false,
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
      isSpam: false,
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

/**
 * Pattern-based spam/newsletter pre-filter - checks common spam patterns without using AI
 * Returns true if email matches known spam/newsletter patterns
 */
function isSpamByPattern(email: ParsedEmail): { isSpam: boolean; reason?: string } {
  const senderEmail = email.from.email.toLowerCase();
  const senderName = (email.from.name || '').toLowerCase();
  const subject = email.subject.toLowerCase();
  const body = email.bodyText.toLowerCase();

  // Known spam/newsletter sender domains
  const spamDomains = [
    // Marketing platforms
    'mailchimp.com', 'sendgrid.net', 'brevo.com', 'sendinblue.com', 'hubspot.com',
    'mailgun.com', 'campaign-archive.com', 'list-manage.com', 'constantcontact.com',
    'klaviyo.com', 'mailerlite.com', 'getresponse.com', 'activecampaign.com',
    // E-commerce & retail
    'amazon.com', 'amazon.it', 'amazon.de', 'amazon.fr', 'amazon.es',
    'ebay.com', 'ebay.it', 'aliexpress.com', 'alibaba.com', 'wish.com',
    'shein.com', 'temu.com', 'zalando.it', 'asos.com', 'hm.com',
    // Social media
    'facebookmail.com', 'linkedin.com', 'twitter.com', 'x.com', 'instagram.com',
    'tiktok.com', 'pinterest.com', 'reddit.com', 'quora.com',
    // Streaming & entertainment
    'netflix.com', 'spotify.com', 'disneyplus.com', 'primevideo.com',
    'apple.com', 'itunes.com', 'youtube.com', 'twitch.tv',
    // Travel & booking
    'booking.com', 'expedia.com', 'trivago.com', 'hotels.com', 'airbnb.com',
    'ryanair.com', 'easyjet.com', 'vueling.com', 'trenitalia.it', 'italotreno.it',
    'edreams.it', 'skyscanner.com', 'kayak.com',
    // Finance promotions
    'paypal-communication.com', 'intl.paypal.com',
    // News & media
    'substack.com', 'medium.com', 'ghost.io',
    // Coupon & deals
    'groupon.com', 'groupon.it', 'dfrdi.it', 'sconti.com'
  ];

  // Check sender domain
  for (const domain of spamDomains) {
    if (senderEmail.includes(domain)) {
      return { isSpam: true, reason: `Sender domain: ${domain}` };
    }
  }

  // Known spam sender patterns in email
  const spamSenderPatterns = [
    /noreply@/, /no-reply@/, /donotreply@/, /newsletter@/, /news@/,
    /marketing@/, /promo@/, /promotions@/, /offers@/, /deals@/,
    /notifications?@/, /alerts?@/, /info@.*shop/, /shop@/,
    /support@amazon/, /auto-confirm@amazon/, /store-news@/,
    /updates@/, /digest@/
  ];

  for (const pattern of spamSenderPatterns) {
    if (pattern.test(senderEmail)) {
      return { isSpam: true, reason: `Sender pattern: ${pattern}` };
    }
  }

  // Subject line spam patterns
  const spamSubjectPatterns = [
    // Newsletter/digest patterns
    /newsletter/i, /weekly digest/i, /daily digest/i, /monthly digest/i,
    /la tua newsletter/i, /your weekly/i, /weekly update/i,
    // Promotional patterns
    /\bpromo\b/i, /\bpromozione\b/i, /promotional/i, /special offer/i,
    /offerta speciale/i, /sconto/i, /discount/i, /\bsale\b/i, /\bsaldi\b/i,
    /\bcoupon\b/i, /codice sconto/i, /% off/i, /% di sconto/i,
    /black friday/i, /cyber monday/i, /flash sale/i,
    /gratis/i, /free shipping/i, /spedizione gratuita/i,
    // Amazon specific
    /il tuo ordine amazon/i, /your amazon order/i, /amazon prime/i,
    /consegna.*amazon/i, /amazon.*delivery/i, /kindle/i,
    /amazon.*wishlist/i, /lista desideri/i,
    // Social/notification patterns
    /hai .* nuov[oi] (messaggi?|notifiche?|follower|connession)/i,
    /you have .* new (message|notification|follower|connection)/i,
    /someone (viewed|liked|commented|shared)/i,
    /qualcuno (ha visto|ha messo|ha commentato|ha condiviso)/i,
    /new comment on/i, /nuovo commento/i,
    /linkedin.*invit/i, /facebook.*notif/i,
    // Subscription/account patterns
    /unsubscribe/i, /disiscrivi/i, /cancella iscrizione/i,
    /manage.*subscription/i, /gestisci.*iscrizione/i,
    /conferma.*email/i, /verify.*email/i, /email verification/i,
    // Travel/booking patterns
    /prenota (ora|adesso|subito)/i, /book now/i, /last minute/i,
    /volo.*€/i, /hotel.*€/i, /flight.*\$/i,
    // Generic promotional
    /limited time/i, /tempo limitato/i, /solo per te/i, /just for you/i,
    /non perder/i, /don't miss/i, /act now/i, /agisci ora/i,
    /exclusive/i, /esclusiv/i, /vip/i, /premium offer/i
  ];

  for (const pattern of spamSubjectPatterns) {
    if (pattern.test(subject)) {
      return { isSpam: true, reason: `Subject pattern: ${pattern}` };
    }
  }

  // Body content spam patterns
  const spamBodyPatterns = [
    /unsubscribe|disiscrivi|cancella.*iscrizione/i,
    /click here to unsubscribe/i, /clicca qui per disiscriverti/i,
    /you.*receiving this.*subscribed/i, /ricevi questa.*iscritto/i,
    /this is an automated message/i, /messaggio automatico/i,
    /do not reply to this email/i, /non rispondere a questa email/i,
    /view.*browser|visualizza.*browser/i,
    /add us to your address book/i, /aggiungici alla rubrica/i,
    /update your preferences/i, /aggiorna le tue preferenze/i,
    /privacy policy.*terms/i,
    /sent to .* because you (signed up|subscribed|registered)/i,
    /inviato a .* perch[eé] (ti sei iscritto|hai sottoscritto|sei registrato)/i
  ];

  let spamBodyCount = 0;
  for (const pattern of spamBodyPatterns) {
    if (pattern.test(body)) {
      spamBodyCount++;
    }
  }

  // If 2+ body spam patterns match, it's likely spam
  if (spamBodyCount >= 2) {
    return { isSpam: true, reason: `Multiple body patterns matched: ${spamBodyCount}` };
  }

  // Check sender name for spam indicators
  const spamSenderNames = [
    /newsletter/i, /noreply/i, /no-reply/i, /marketing/i,
    /promotions?/i, /offers?/i, /deals?/i, /notifications?/i,
    /amazon/i, /ebay/i, /aliexpress/i, /linkedin/i, /facebook/i,
    /instagram/i, /twitter/i, /spotify/i, /netflix/i, /booking/i
  ];

  for (const pattern of spamSenderNames) {
    if (pattern.test(senderName)) {
      return { isSpam: true, reason: `Sender name pattern: ${pattern}` };
    }
  }

  return { isSpam: false };
}

/**
 * Quick spam/newsletter filter - uses pattern matching first, then AI for uncertain cases
 * Returns true if email should be skipped
 */
export async function isSpamOrNewsletter(
  email: ParsedEmail,
  config: AIConfig
): Promise<boolean> {
  try {
    // First, try pattern-based detection (faster, no API call)
    const patternResult = isSpamByPattern(email);
    if (patternResult.isSpam) {
      logger.info('Email filtered by pattern', {
        subject: email.subject.substring(0, 50),
        from: email.from.email,
        reason: patternResult.reason,
      });
      return true;
    }

    // If patterns don't match, use AI for more nuanced classification
    const spamCheckPrompt = `Analizza BREVEMENTE questa email e rispondi SOLO con "SPAM", "NEWSLETTER", o "LEGITTIMA".

CONTESTO: Questa è un'applicazione per uno studio di ingegneria/architettura. Le email legittime sono:
- Comunicazioni da clienti, enti pubblici, committenti
- Email relative a progetti tecnici, cantieri, pratiche edilizie
- Corrispondenza professionale con colleghi, fornitori, consulenti

Soggetto: ${email.subject}
Mittente: ${email.from.name || email.from.email} <${email.from.email}>
Corpo (primi 500 caratteri): ${email.bodyText.substring(0, 500)}

SCARTA (SPAM/NEWSLETTER) se:
- Pubblicità, promozioni, offerte commerciali generiche
- Newsletter, digest, notifiche automatiche di servizi
- Social media notifications (LinkedIn, Facebook, ecc.)
- E-commerce (Amazon, eBay, ordini, spedizioni)
- Servizi streaming, viaggi, prenotazioni non professionali
- Email massive/bulk, marketing automation
- Notifiche di app/servizi non professionali

LEGITTIMA se:
- Riguarda progetti tecnici, lavori, cantieri
- Da clienti, enti, PA, professionisti del settore
- Contiene riferimenti a pratiche, commesse, sopralluoghi
- Comunicazioni su scadenze, depositi, permessi
- Email personali/dirette da persone reali su lavoro

Rispondi SOLO con una parola: SPAM, NEWSLETTER, o LEGITTIMA`;

    const response = await dispatchToProvider(spamCheckPrompt, config);
    const classification = response.trim().toUpperCase();

    logger.info('Email spam classification by AI', {
      subject: email.subject.substring(0, 50),
      classification,
      from: email.from.email,
    });

    return classification === 'SPAM' || classification === 'NEWSLETTER';
  } catch (error) {
    logger.error('Error in spam classification', { error });
    // On error, allow email through (better to review than discard)
    return false;
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
