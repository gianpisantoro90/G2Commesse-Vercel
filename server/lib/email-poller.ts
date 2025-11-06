import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { logger } from './logger';
import { emailService } from './email-service';
import type { Storage } from '../storage';

interface EmailPollerConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  checkInterval: number; // milliseconds
}

class EmailPoller {
  private config: EmailPollerConfig | null = null;
  private imap: Imap | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private storage: Storage | null = null;

  /**
   * Initialize email poller with configuration
   */
  initialize(storage: Storage) {
    this.storage = storage;

    // Read config from environment
    const host = process.env.EMAIL_IMAP_HOST;
    const port = parseInt(process.env.EMAIL_IMAP_PORT || '993');
    const user = process.env.EMAIL_IMAP_USER;
    const password = process.env.EMAIL_IMAP_PASSWORD;
    const checkInterval = parseInt(process.env.EMAIL_CHECK_INTERVAL || '60000'); // default 1 minute

    if (!host || !user || !password) {
      logger.warn('Email polling not configured - missing IMAP credentials');
      logger.info('Set EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASSWORD to enable');
      return;
    }

    this.config = {
      host,
      port,
      user,
      password,
      tls: true,
      checkInterval,
    };

    logger.info('Email poller initialized', {
      host: this.config.host,
      user: this.config.user,
      interval: `${this.config.checkInterval / 1000}s`,
    });

    // Start polling
    this.startPolling();
  }

  /**
   * Start polling for new emails
   */
  private startPolling() {
    if (!this.config) return;

    // Check immediately on start
    this.checkEmails();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkEmails();
    }, this.config.checkInterval);

    logger.info('Email polling started');
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Email polling stopped');
    }

    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }

  /**
   * Check for new emails
   */
  private async checkEmails() {
    if (this.isProcessing) {
      logger.debug('Email check already in progress, skipping');
      return;
    }

    if (!this.config) {
      return;
    }

    this.isProcessing = true;

    try {
      logger.debug('Checking for new emails...');

      const emails = await this.fetchUnreadEmails();

      if (emails.length === 0) {
        logger.debug('No new emails found');
        this.isProcessing = false;
        return;
      }

      logger.info(`Found ${emails.length} new email(s)`);

      // Process each email
      for (const emailData of emails) {
        try {
          await this.processEmail(emailData);
        } catch (error) {
          logger.error('Failed to process email', { error, subject: emailData.parsed.subject });
        }
      }
    } catch (error) {
      logger.error('Email check failed', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fetch unread emails from IMAP server
   */
  private fetchUnreadEmails(): Promise<Array<{ uid: number; parsed: ParsedMail }>> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Email poller not configured'));
        return;
      }

      const imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: Array<{ uid: number; parsed: ParsedMail }> = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          // Search for unseen messages
          imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              imap.end();
              reject(err);
              return;
            }

            if (results.length === 0) {
              imap.end();
              resolve([]);
              return;
            }

            logger.debug(`Found ${results.length} unseen message(s)`);

            const fetch = imap.fetch(results, { bodies: '' });

            fetch.on('message', (msg, seqno) => {
              let uid = 0;

              msg.on('attributes', (attrs) => {
                uid = attrs.uid;
              });

              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (err) {
                    logger.error('Failed to parse email', { error: err });
                    return;
                  }

                  if (parsed) {
                    emails.push({ uid, parsed });
                  }
                });
              });
            });

            fetch.once('error', (err) => {
              logger.error('Fetch error', { error: err });
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              logger.debug('Done fetching emails');
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err) => {
        logger.error('IMAP connection error', { error: err });
        reject(err);
      });

      imap.once('end', () => {
        logger.debug('IMAP connection ended');
        resolve(emails);
      });

      imap.connect();
    });
  }

  /**
   * Decide if email should be auto-imported based on AI analysis
   *
   * Rules:
   * - Single match with confidence > 0.9 → Auto-import
   * - Multiple matches: auto-import only if best match > 0.9 AND gap to 2nd > 0.2
   * - Otherwise → Manual review required
   */
  private shouldAutoImportEmail(analysis: any): boolean {
    const matches = analysis.projectMatches || [];

    // No matches at all
    if (matches.length === 0) {
      return false;
    }

    // Single match
    if (matches.length === 1) {
      return matches[0].confidence > 0.9;
    }

    // Multiple matches: require very high confidence AND clear winner
    const bestMatch = matches[0]; // Already sorted by confidence
    const secondBest = matches[1];

    const isHighConfidence = bestMatch.confidence > 0.9;
    const hasClearGap = (bestMatch.confidence - secondBest.confidence) > 0.2;

    if (isHighConfidence && hasClearGap) {
      logger.info('Auto-import decision: Clear winner among multiple matches', {
        bestConfidence: bestMatch.confidence,
        secondConfidence: secondBest.confidence,
        gap: (bestMatch.confidence - secondBest.confidence).toFixed(2),
      });
      return true;
    }

    logger.info('Manual review required: Multiple plausible matches', {
      matchesCount: matches.length,
      bestConfidence: bestMatch.confidence,
      secondConfidence: secondBest.confidence,
    });

    return false;
  }

  /**
   * Process a single email
   */
  private async processEmail(emailData: { uid: number; parsed: ParsedMail }) {
    const { parsed } = emailData;

    logger.info('Processing email', {
      from: parsed.from?.text,
      subject: parsed.subject,
      date: parsed.date,
    });

    // Convert to SendGrid webhook format for compatibility with existing email service
    const webhookPayload = {
      from: parsed.from?.text || '',
      to: parsed.to?.text || '',
      subject: parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || '',
      headers: JSON.stringify(parsed.headers),
      attachments: (parsed.attachments || []).length.toString(),
      date: parsed.date?.toISOString() || new Date().toISOString(),
    };

    // Add attachment data
    (parsed.attachments || []).forEach((att, index) => {
      const key = `attachment${index + 1}`;
      webhookPayload[key] = att.content.toString('base64');
      webhookPayload[`${key}-filename`] = att.filename || `attachment${index + 1}`;
      webhookPayload[`${key}-type`] = att.contentType;
    });

    try {
      // Use existing email service to parse and analyze
      const parsedEmail = emailService.parseSendGridWebhook(webhookPayload);

      if (!this.storage) {
        throw new Error('Storage not initialized');
      }

      // Get all projects for AI matching
      const projects = await this.storage.getAllProjects();

      // Get AI config
      const aiConfigResult = await this.storage.getSystemConfig('ai_config');
      const aiApiKey = aiConfigResult?.value?.apiKey || process.env.ANTHROPIC_API_KEY;

      // Analyze with AI
      const analysis = await emailService.analyzeEmailWithAI(
        parsedEmail,
        projects.map(p => ({
          id: p.id,
          code: p.code,
          client: p.client,
          object: p.object,
        })),
        aiApiKey
      );

      logger.info('AI analysis complete', {
        projectCode: analysis.projectCode || 'No match',
        confidence: analysis.confidence,
        matchesCount: analysis.projectMatches?.length || 0,
      });

      // Intelligent auto-import decision based on matches
      const shouldAutoImport = this.shouldAutoImportEmail(analysis);

      if (shouldAutoImport && analysis.projectId) {
        // Auto-import with high confidence
        const communication = await this.storage.createCommunication({
          projectId: analysis.projectId,
          type: parsedEmail.from.email.includes('@pec.') ? 'pec' : 'email',
          direction: 'incoming',
          subject: parsedEmail.subject,
          body: parsedEmail.bodyText,
          sender: `${parsedEmail.from.name || ''} <${parsedEmail.from.email}>`.trim(),
          recipient: parsedEmail.to.map(t => t.email).join(', '),
          isImportant: analysis.isImportant,
          tags: analysis.suggestedTags,
          attachments: parsedEmail.attachments.map(a => ({
            name: a.filename,
            size: a.size,
          })),
          communicationDate: parsedEmail.date,
          emailMessageId: parsedEmail.messageId,
          emailHeaders: parsedEmail.headers,
          emailHtml: parsedEmail.bodyHtml,
          emailText: parsedEmail.bodyText,
          autoImported: true,
          aiSuggestions: analysis,
          importedAt: new Date(),
        });

        logger.info('Communication auto-imported', {
          communicationId: communication.id,
          projectCode: analysis.projectCode,
          confidence: analysis.confidence,
          reasoning: analysis.projectMatches?.[0]?.reasoning,
        });

        // Mark email as read
        await this.markAsRead(emailData.uid);
      } else {
        // Multiple matches or low confidence - requires manual review
        const matchesInfo = analysis.projectMatches?.map(m => ({
          code: m.projectCode,
          confidence: m.confidence,
          reasoning: m.reasoning.substring(0, 100),
        })) || [];

        logger.warn('Email requires manual review', {
          reason: !analysis.projectId ? 'No project match' : 'Multiple plausible matches or low confidence',
          confidence: analysis.confidence,
          matchesCount: analysis.projectMatches?.length || 0,
          matches: matchesInfo,
        });

        // Store email for manual review (no projectId assigned yet)
        const communication = await this.storage.createCommunication({
          projectId: null, // Will be assigned when user selects from suggestions
          type: parsedEmail.from.email.includes('@pec.') ? 'pec' : 'email',
          direction: 'incoming',
          subject: parsedEmail.subject,
          body: parsedEmail.bodyText,
          sender: `${parsedEmail.from.name || ''} <${parsedEmail.from.email}>`.trim(),
          recipient: parsedEmail.to.map(t => t.email).join(', '),
          isImportant: analysis.isImportant,
          tags: analysis.suggestedTags,
          attachments: parsedEmail.attachments.map(a => ({
            name: a.filename,
            size: a.size,
          })),
          communicationDate: parsedEmail.date,
          emailMessageId: parsedEmail.messageId,
          emailHeaders: parsedEmail.headers,
          emailHtml: parsedEmail.bodyHtml,
          emailText: parsedEmail.bodyText,
          autoImported: false, // Requires manual review
          aiSuggestions: analysis, // Contains all projectMatches for UI
          importedAt: new Date(),
        });

        logger.info('Communication saved for manual review', {
          communicationId: communication.id,
          matchesCount: analysis.projectMatches?.length || 0,
          bestMatch: analysis.projectMatches?.[0]?.projectCode,
          bestConfidence: analysis.projectMatches?.[0]?.confidence,
        });

        // Mark email as read to avoid reprocessing
        await this.markAsRead(emailData.uid);
      }
    } catch (error) {
      logger.error('Failed to process email', { error });
      throw error;
    }
  }

  /**
   * Mark email as read on IMAP server
   */
  private async markAsRead(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error('Email poller not configured'));
        return;
      }

      const imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) {
            imap.end();
            reject(err);
            return;
          }

          imap.addFlags([uid], ['\\Seen'], (err) => {
            imap.end();
            if (err) {
              reject(err);
            } else {
              logger.debug('Email marked as read', { uid });
              resolve();
            }
          });
        });
      });

      imap.once('error', (err) => {
        logger.error('IMAP error while marking as read', { error: err });
        reject(err);
      });

      imap.connect();
    });
  }
}

// Export singleton instance
export const emailPoller = new EmailPoller();
