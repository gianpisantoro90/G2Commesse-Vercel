import { logger } from './logger';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { analyzeEmail as analyzeEmailWithRouter } from './ai-email-analyzer';
import type { AIConfig } from '@shared/schema';
import type { AIEmailAnalysis, ProjectInfo, ParsedEmail as AIParserEmail } from './ai-email-analyzer';

export interface ParsedEmail {
  messageId: string;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  date: Date;
}

// AIEmailAnalysis and related types are now imported from ai-email-analyzer.ts

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  /**
   * Initialize SMTP transporter for sending emails
   */
  initialize() {
    if (this.initialized) return;

    const smtpConfig: any = {
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'apikey', // SendGrid uses 'apikey' as username
        pass: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY || '',
      },
    };

    // Gmail-specific configuration
    if (smtpConfig.host === 'smtp.gmail.com') {
      smtpConfig.secure = false; // Use STARTTLS on port 587
      smtpConfig.requireTLS = true;
      smtpConfig.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      };
    }

    if (!smtpConfig.auth.pass) {
      logger.warn('SMTP not configured - email sending will not work');
      logger.info('Set SENDGRID_API_KEY or SMTP_PASSWORD environment variable');
      return;
    }

    try {
      logger.info('Initializing email service', { 
        host: smtpConfig.host, 
        port: smtpConfig.port,
        user: smtpConfig.auth.user,
        secure: smtpConfig.secure 
      });
      this.transporter = createTransport(smtpConfig);
      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to initialize email service', { 
        message: errorMessage,
        stack: errorStack,
        error: JSON.stringify(error)
      });
    }
  }

  /**
   * Parse SendGrid Inbound Parse webhook payload
   */
  parseSendGridWebhook(payload: any): ParsedEmail {
    try {
      logger.info('Parsing SendGrid webhook payload');

      // SendGrid provides parsed email data
      const from = this.parseEmailAddress(payload.from);
      const to = payload.to ? payload.to.split(',').map((email: string) => this.parseEmailAddress(email.trim())) : [];

      const attachments: ParsedEmail['attachments'] = [];

      // Parse attachments if present
      if (payload.attachments) {
        const attachmentCount = parseInt(payload.attachments);
        for (let i = 1; i <= attachmentCount; i++) {
          const attachmentKey = `attachment${i}`;
          if (payload[attachmentKey]) {
            attachments.push({
              filename: payload[`attachment${i}-filename`] || `attachment${i}`,
              content: Buffer.from(payload[attachmentKey], 'base64'),
              contentType: payload[`attachment${i}-type`] || 'application/octet-stream',
              size: payload[attachmentKey].length,
            });
          }
        }
      }

      return {
        messageId: payload.headers?.['Message-ID'] || `msg_${Date.now()}`,
        from,
        to,
        subject: payload.subject || '(No subject)',
        bodyText: payload.text || '',
        bodyHtml: payload.html || undefined,
        headers: payload.headers || {},
        attachments,
        date: payload.date ? new Date(payload.date) : new Date(),
      };
    } catch (error) {
      logger.error('Error parsing SendGrid webhook', { error });
      throw new Error('Failed to parse email');
    }
  }

  /**
   * Parse email address with optional name
   */
  private parseEmailAddress(emailString: string): { email: string; name?: string } {
    const match = emailString.match(/(.*?)\s*<(.+?)>|(.+)/);
    if (match) {
      if (match[2]) {
        return {
          name: match[1]?.trim(),
          email: match[2].trim(),
        };
      }
      return { email: match[3].trim() };
    }
    return { email: emailString.trim() };
  }

  /**
   * Analyze email with AI to extract insights and match to projects
   */
  async analyzeEmailWithAI(
    email: ParsedEmail,
    projects: Array<{ id: string; code: string; client: string; object: string }>,
    aiConfig?: AIConfig | string
  ): Promise<AIEmailAnalysis> {
    try {
      // Try to extract project code from subject using regex
      const codeMatch = email.subject?.match(/\[?(\d{2}[A-Z]{3,6}\d{2,3})\]?/i);
      let projectCode = codeMatch ? codeMatch[1].toUpperCase() : undefined;
      let confidence = projectCode ? 0.95 : 0;

      // Find project by code if extracted
      let projectId: string | undefined;
      if (projectCode) {
        const matchedProject = projects.find(p => p.code.toUpperCase() === projectCode);
        if (matchedProject) {
          projectId = matchedProject.id;
        }
      }

      // ALWAYS use AI if available to do intelligent matching on all fields
      if (aiConfig) {
        try {
          let config: AIConfig;
          
          if (typeof aiConfig === 'string') {
            config = {
              provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
              apiKey: aiConfig,
              autoRouting: true,
              contentAnalysis: true,
              learningMode: true,
            };
          } else {
            config = {
              ...aiConfig,
              apiKey: aiConfig.apiKey || process.env.ANTHROPIC_API_KEY || '',
            };
          }
          
          if (!config.apiKey) {
            throw new Error('AI API key not configured');
          }

          logger.info('Calling AI for intelligent project matching', {
            provider: config.provider,
            model: config.model,
            hasRegexMatch: !!projectCode,
            regexConfidence: confidence,
            totalProjects: projects.length
          });

          const aiResult = await analyzeEmailWithRouter({
            email,
            projects,
            config,
          });

          // AI result is always better than regex because it analyzes all fields
          logger.info('AI analysis returned', {
            provider: config.provider,
            bestMatchCode: aiResult.projectMatches?.[0]?.projectCode || 'No match',
            confidence: aiResult.confidence,
            matchesCount: aiResult.projectMatches?.length || 0
          });

          return aiResult;
        } catch (aiError) {
          logger.warn('AI analysis failed, using fallback', { error: aiError });
        }
      }

      // Fallback: Basic keyword matching
      const extractedData = this.extractBasicData(email);
      const suggestedTags = this.generateBasicTags(email);

      // Populate projectMatches if we have a match from regex
      const projectMatches: AIEmailAnalysis['projectMatches'] = [];
      if (projectCode && projectId) {
        const matchedProject = projects.find(p => p.id === projectId);
        if (matchedProject) {
          projectMatches.push({
            projectId: matchedProject.id,
            projectCode: matchedProject.code,
            confidence: confidence,
            reasoning: `Codice progetto "${matchedProject.code}" trovato nell'oggetto dell'email (regex match)`,
            matchedFields: ['code']
          });
          logger.info('Regex-based project match converted to projectMatches format', {
            projectCode: matchedProject.code,
            confidence
          });
        }
      }

      return {
        confidence,
        projectMatches,
        extractedData,
        suggestedTags,
        isImportant: this.detectImportance(email),
        summary: this.generateBasicSummary(email),
      };
    } catch (error) {
      logger.error('Error analyzing email', { error });
      return {
        confidence: 0,
        projectMatches: [],
        extractedData: {},
        suggestedTags: [],
        isImportant: false,
      };
    }
  }

  /**
   * Call Claude API for advanced email analysis
   */
  private async callClaudeForEmailAnalysis(
    email: ParsedEmail,
    projects: Array<{ id: string; code: string; client: string; object: string }>,
    apiKey: string
  ): Promise<AIEmailAnalysis> {
    const prompt = `Analizza questa email e trova i progetti più pertinenti confrontando TUTTI i dati disponibili.

EMAIL RICEVUTA:
Da: ${email.from.email}${email.from.name ? ` (${email.from.name})` : ''}
Oggetto: ${email.subject}
Contenuto: ${email.bodyText.substring(0, 2000)}

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
  "suggestedTasks": [
    {
      "title": "Inviare progetto esecutivo Villa Rossi",
      "description": "Il cliente ha richiesto l'invio del progetto esecutivo aggiornato entro il 15/12/2024",
      "priority": "high",
      "dueDate": "2024-12-15",
      "reasoning": "Email richiede esplicitamente: 'Potete inviarci il progetto esecutivo entro il 15/12?'"
    },
    {
      "title": "Programmare sopralluogo a Milano",
      "description": "Organizzare sopralluogo presso Villa Rossi per verifica stato avanzamento lavori",
      "priority": "medium",
      "dueDate": null,
      "reasoning": "Email suggerisce: 'Sarebbe utile fare un sopralluogo per verificare'"
    }
  ],
  "suggestedDeadlines": [
    {
      "title": "Deposito progetto al Genio Civile",
      "description": "Scadenza per il deposito del progetto esecutivo presso il Genio Civile",
      "priority": "urgent",
      "type": "deposito",
      "dueDate": "2024-12-15",
      "notifyDaysBefore": 3,
      "reasoning": "Email menziona: 'Il deposito deve essere fatto entro il 15 dicembre'"
    },
    {
      "title": "Completamento Fase 1 - Fondazioni",
      "description": "Milestone per completamento lavori di fondazione",
      "priority": "high",
      "type": "milestone",
      "dueDate": "2024-12-31",
      "notifyDaysBefore": 7,
      "reasoning": "Email indica: 'Le fondazioni devono essere completate entro fine anno'"
    }
  ],
  "suggestedTags": ["urgente", "villa", "milano"],
  "isImportant": true,
  "summary": "Cliente Rossi richiede progetto esecutivo per Villa a Milano entro 15/12. Budget 50k approvato."
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Ensure projectMatches array exists
      if (!analysis.projectMatches) {
        analysis.projectMatches = [];
      }

      // Sort projectMatches by confidence descending
      if (analysis.projectMatches.length > 0) {
        analysis.projectMatches.sort((a, b) => b.confidence - a.confidence);

        const bestMatch = analysis.projectMatches[0];
        analysis.confidence = bestMatch.confidence;

        logger.info('Project matches found', {
          count: analysis.projectMatches.length,
          bestMatch: {
            code: bestMatch.projectCode,
            confidence: bestMatch.confidence,
            reasoning: bestMatch.reasoning
          }
        });
      } else {
        // No matches found
        analysis.confidence = 0;
        logger.info('No project matches found in AI analysis');
      }

      return analysis;
    } catch (error) {
      logger.error('Claude API call failed', { error });
      throw error;
    }
  }

  /**
   * Extract basic data from email without AI
   */
  private extractBasicData(email: ParsedEmail): AIEmailAnalysis['extractedData'] {
    const text = email.bodyText;

    // Extract dates (basic regex)
    const dateRegex = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g;
    const deadlines = text.match(dateRegex) || [];

    // Extract amounts (Euro)
    const amountRegex = /€\s*\d+[\.,]?\d*/g;
    const amounts = text.match(amountRegex) || [];

    return {
      deadlines: [...new Set(deadlines)].slice(0, 5),
      amounts: [...new Set(amounts)].slice(0, 5),
      actionItems: [],
      keyPoints: [],
    };
  }

  /**
   * Generate basic tags from email
   */
  private generateBasicTags(email: ParsedEmail): string[] {
    const tags: string[] = [];
    const text = (email.subject + ' ' + email.bodyText).toLowerCase();

    const tagKeywords = {
      urgente: ['urgente', 'immediat', 'asap', 'subito'],
      integrazione: ['integrazione', 'integrare', 'documentazione aggiuntiva'],
      variante: ['variante', 'modifica', 'cambio'],
      autorizzazione: ['autorizzazione', 'permesso', 'approvazione'],
      fattura: ['fattura', 'pagamento', 'saldo'],
      sopralluogo: ['sopralluogo', 'visita'],
      riunione: ['riunione', 'meeting', 'incontro'],
    };

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Detect if email is important
   */
  private detectImportance(email: ParsedEmail): boolean {
    const text = (email.subject + ' ' + email.bodyText).toLowerCase();
    const importantKeywords = [
      'urgente',
      'immediat',
      'asap',
      'scadenza',
      'sollecito',
      'diffida',
      'decreto',
      'intimazione',
    ];

    return importantKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Generate basic summary
   */
  private generateBasicSummary(email: ParsedEmail): string {
    const text = email.bodyText.trim();
    const firstLines = text.split('\n').slice(0, 3).join(' ');
    return firstLines.substring(0, 200) + (firstLines.length > 200 ? '...' : '');
  }

  /**
   * Send email from the application
   */
  async sendEmail(options: {
    from?: string;
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
    replyTo?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not configured. Set SENDGRID_API_KEY environment variable.',
      };
    }

    try {
      const fromEmail = options.from || process.env.EMAIL_FROM || 'noreply@g2ingegneria.it';

      const info = await this.transporter.sendMail({
        from: fromEmail,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        replyTo: options.replyTo,
      });

      logger.info('Email sent successfully', { messageId: info.messageId, to: options.to });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email', { error, to: options.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify SMTP configuration
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', { error });
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
