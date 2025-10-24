import { logger } from './logger';
// TODO: Install nodemailer package first
// import nodemailer from 'nodemailer';
// import type { Transporter } from 'nodemailer';
type Transporter = any;

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

export interface AIEmailAnalysis {
  projectCode?: string;
  projectId?: string;
  confidence: number;
  extractedData: {
    deadlines?: string[];
    amounts?: string[];
    actionItems?: string[];
    keyPoints?: string[];
  };
  suggestedTags: string[];
  isImportant: boolean;
  summary?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private initialized = false;

  /**
   * Initialize SMTP transporter for sending emails
   */
  initialize() {
    if (this.initialized) return;

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'apikey', // SendGrid uses 'apikey' as username
        pass: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY || '',
      },
    };

    if (!smtpConfig.auth.pass) {
      logger.warn('SMTP not configured - email sending will not work');
      logger.info('Set SENDGRID_API_KEY or SMTP_PASSWORD environment variable');
      return;
    }

    try {
      // TODO: Uncomment when nodemailer is installed
      // this.transporter = nodemailer.createTransporter(smtpConfig);
      // this.initialized = true;
      logger.info('Email service temporarily disabled - nodemailer not installed');
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
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
    anthropicApiKey?: string
  ): Promise<AIEmailAnalysis> {
    try {
      // Try to extract project code from subject using regex
      const codeMatch = email.subject.match(/\[?(\d{2}[A-Z]{3,6}\d{2,3})\]?/i);
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

      // Use AI if API key is available and no high-confidence match yet
      if (anthropicApiKey && confidence < 0.8) {
        try {
          const aiResult = await this.callClaudeForEmailAnalysis(email, projects, anthropicApiKey);
          if (aiResult.confidence > confidence) {
            projectCode = aiResult.projectCode;
            projectId = aiResult.projectId;
            confidence = aiResult.confidence;
          }

          return aiResult;
        } catch (aiError) {
          logger.warn('AI analysis failed, using fallback', { error: aiError });
        }
      }

      // Fallback: Basic keyword matching
      const extractedData = this.extractBasicData(email);
      const suggestedTags = this.generateBasicTags(email);

      return {
        projectCode,
        projectId,
        confidence,
        extractedData,
        suggestedTags,
        isImportant: this.detectImportance(email),
        summary: this.generateBasicSummary(email),
      };
    } catch (error) {
      logger.error('Error analyzing email', { error });
      return {
        confidence: 0,
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
    const prompt = `Analizza questa email e abbinala al progetto corretto.

EMAIL:
Da: ${email.from.email}${email.from.name ? ` (${email.from.name})` : ''}
Oggetto: ${email.subject}
Contenuto: ${email.bodyText.substring(0, 2000)}

PROGETTI DISPONIBILI:
${projects.map(p => `- ${p.code}: ${p.client} - ${p.object}`).join('\n')}

COMPITI:
1. Identifica il codice progetto più probabile (formato: YYSIGLACITTA##, es: 25G2MI01)
2. Estrai informazioni chiave: scadenze, importi, richieste
3. Genera 3-5 tag rilevanti
4. Determina se l'email è importante/urgente
5. Crea un riassunto di 2-3 righe

RISPOSTA IN JSON:
{
  "projectCode": "25G2MI01",
  "confidence": 0.95,
  "extractedData": {
    "deadlines": ["data1", "data2"],
    "amounts": ["€1000", "€2000"],
    "actionItems": ["azione1", "azione2"],
    "keyPoints": ["punto1", "punto2"]
  },
  "suggestedTags": ["tag1", "tag2"],
  "isImportant": true,
  "summary": "Riassunto breve"
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

      // Find projectId from projectCode
      if (analysis.projectCode) {
        const matchedProject = projects.find(p => p.code.toUpperCase() === analysis.projectCode.toUpperCase());
        if (matchedProject) {
          analysis.projectId = matchedProject.id;
        }
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
