import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { logger } from './logger';
import { emailService } from './email-service';
import type { IStorage } from '../storage';

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
  private storage: IStorage | null = null;

  /**
   * Initialize email poller with configuration
   */
  initialize(storage: IStorage) {
    this.storage = storage;

    // Read config from environment
    const host = process.env.EMAIL_IMAP_HOST;
    const port = parseInt(process.env.EMAIL_IMAP_PORT || '993');
    const user = process.env.EMAIL_IMAP_USER;
    const password = process.env.EMAIL_IMAP_PASSWORD;
    // OPTIMIZED: Changed from 3600000ms (1 hour) to 14400000ms (4 hours) to reduce compute units
    const checkInterval = parseInt(process.env.EMAIL_CHECK_INTERVAL || '14400000'); // default 4 hours

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
   * Start polling for new emails (DISABLED - manual checking only)
   */
  private startPolling() {
    if (!this.config) return;

    // OPTIMIZED: Email polling is now manual only - triggered via API endpoint
    // This was changed to reduce compute unit consumption significantly
    logger.info('Email polling disabled - use manual checking via API endpoint /api/emails/check-now');
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
   * Check for new emails (can be called manually)
   */
  async checkEmails() {
    if (this.isProcessing) {
      logger.debug('Email check already in progress, skipping');
      return;
    }

    if (!this.config) {
      return;
    }

    this.isProcessing = true;

    try {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Checking for new emails...');
      }

      const emails = await this.fetchUnreadEmails();

      if (emails.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          logger.debug('No new emails found');
        }
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

            if (process.env.NODE_ENV !== 'production') {
              logger.debug(`Found ${results.length} unseen message(s)`);
            }

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
              if (process.env.NODE_ENV !== 'production') {
                logger.debug('Done fetching emails');
              }
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
   * Extract original sender from forwarded email
   * Looks for "From:" or "Da:" patterns in the email body
   */
  private extractOriginalSender(parsed: ParsedMail): { email: string; name?: string } | null {
    const bodyText = parsed.text || '';
    const bodyHtml = parsed.html || '';

    // Check if email is forwarded (subject starts with Fwd: or I:)
    const isForwarded = /^(Fwd:|FWD:|I:|Inoltro:)/i.test(parsed.subject || '');

    if (!isForwarded) {
      return null; // Not a forwarded email
    }

    // Common forwarded email patterns (English and Italian)
    const patterns = [
      // English patterns
      /From:\s*([^<\n]+?)\s*<([^>\n]+)>/i,           // From: Name <email@example.com>
      /From:\s*<([^>\n]+)>/i,                        // From: <email@example.com>
      /From:\s*([^\n<]+@[^\n\s]+)/i,                 // From: email@example.com

      // Italian patterns
      /Da:\s*([^<\n]+?)\s*<([^>\n]+)>/i,             // Da: Nome <email@example.com>
      /Da:\s*<([^>\n]+)>/i,                          // Da: <email@example.com>
      /Da:\s*([^\n<]+@[^\n\s]+)/i,                   // Da: email@example.com

      // Alternative patterns (sometimes in headers)
      /Sender:\s*([^<\n]+?)\s*<([^>\n]+)>/i,
      /Mittente:\s*([^<\n]+?)\s*<([^>\n]+)>/i,
    ];

    // Try to extract from body text first
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) {
        if (match[2]) {
          // Pattern with name and email
          return {
            name: match[1].trim(),
            email: match[2].trim(),
          };
        } else if (match[1]) {
          // Pattern with email only
          return {
            email: match[1].trim(),
          };
        }
      }
    }

    // Try HTML body if text didn't work
    if (bodyHtml) {
      // Strip HTML tags for easier matching
      const strippedHtml = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');

      for (const pattern of patterns) {
        const match = strippedHtml.match(pattern);
        if (match) {
          if (match[2]) {
            return {
              name: match[1].trim(),
              email: match[2].trim(),
            };
          } else if (match[1]) {
            return {
              email: match[1].trim(),
            };
          }
        }
      }
    }

    logger.debug('Could not extract original sender from forwarded email', {
      subject: parsed.subject,
      bodyPreview: bodyText.substring(0, 200),
    });

    return null; // Could not extract original sender
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
   * Check if email already exists in database (anti-duplicate logic)
   */
  private async isDuplicateEmail(messageId: string, subject: string, sender: string, date: Date): Promise<boolean> {
    if (!this.storage) {
      return false;
    }

    try {
      // Fetch once and reuse (avoid N+1 query)
      const allComms = await this.storage.getAllCommunications();

      // Strategy 1: Check by emailMessageId (most reliable)
      if (messageId) {
        const existsByMessageId = allComms.some(comm => comm.emailMessageId === messageId);

        if (existsByMessageId) {
          logger.info('Duplicate email detected by messageId', { messageId });
          return true;
        }
      }

      // Strategy 2: Check by subject + sender + similar date (within 1 hour)
      // This catches forwards/re-sends that might have different message IDs
      const oneHourMs = 60 * 60 * 1000;

      const existsBySimilarity = allComms.some(comm => {
        if (!comm.subject || !comm.sender || !comm.communicationDate) {
          return false;
        }

        const isSameSubject = comm.subject.trim() === subject.trim();
        const isSameSender = comm.sender.toLowerCase().includes(sender.toLowerCase()) ||
                             sender.toLowerCase().includes(comm.sender.toLowerCase());

        const timeDiff = Math.abs(new Date(comm.communicationDate).getTime() - date.getTime());
        const isSimilarTime = timeDiff < oneHourMs;

        return isSameSubject && isSameSender && isSimilarTime;
      });

      if (existsBySimilarity) {
        logger.info('Duplicate email detected by similarity', {
          subject: subject.substring(0, 50),
          sender
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking for duplicate email', { error });
      // In case of error, allow the email through (better to have duplicates than lose emails)
      return false;
    }
  }

  /**
   * Process a single email
   */
  private async processEmail(emailData: { uid: number; parsed: ParsedMail }) {
    const { parsed } = emailData;

    // Try to extract original sender from forwarded email
    const originalSender = this.extractOriginalSender(parsed);

    // Use original sender if found, otherwise use email header sender
    const defaultFrom = parsed.from?.value?.[0];
    const effectiveFrom = originalSender || {
      email: defaultFrom?.address || '',
      name: defaultFrom?.name,
    };

    logger.info('Processing email', {
      from: parsed.from?.text,
      originalSender: originalSender ? `${originalSender.name || ''} <${originalSender.email}>` : null,
      effectiveFrom: `${effectiveFrom.name || ''} <${effectiveFrom.email}>`,
      subject: parsed.subject,
      date: parsed.date,
    });

    // Convert to SendGrid webhook format for compatibility with existing email service
    // Use effective sender (original if forwarded, otherwise header sender)
    const fromText = effectiveFrom.name
      ? `${effectiveFrom.name} <${effectiveFrom.email}>`
      : effectiveFrom.email;

    // Get 'to' text - handle both single AddressObject and array
    const toText = Array.isArray(parsed.to)
      ? parsed.to.map((t: any) => t.text).join(', ')
      : parsed.to?.text || '';

    const webhookPayload: any = {
      from: fromText,
      to: toText,
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

      // Get AI config (includes API key from server-side storage)
      const aiConfigResult = await this.storage.getSystemConfig('ai_config');
      const storedConfig = aiConfigResult?.value;
      const finalConfig = storedConfig || process.env.ANTHROPIC_API_KEY;

      // FILTER: AI spam/newsletter check - skip if advertising or bulk content
      logger.info('Checking email for spam/newsletter content...');
      const { isSpamOrNewsletter } = await import('./ai-email-analyzer');
      const isSpamOrNews = await isSpamOrNewsletter(
        {
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          bodyText: parsedEmail.bodyText,
          bodyHtml: parsedEmail.bodyHtml,
        },
        finalConfig
      );

      if (isSpamOrNews) {
        logger.info('Email filtered: Spam or newsletter detected', {
          subject: parsedEmail.subject,
          from: parsedEmail.from.email,
        });
        // Mark as read and skip processing
        await this.markAsRead(emailData.uid);
        return;
      }

      // Get all projects for AI matching
      const projects = await this.storage.getAllProjects();

      // Analyze with AI
      const analysis = await emailService.analyzeEmailWithAI(
        parsedEmail,
        projects.map(p => ({
          id: p.id,
          code: p.code,
          client: p.client,
          object: p.object,
        })),
        finalConfig
      );

      logger.info('AI analysis complete', {
        bestMatchCode: analysis.projectMatches?.[0]?.projectCode || 'No match',
        confidence: analysis.confidence,
        matchesCount: analysis.projectMatches?.length || 0,
      });

      // Check for duplicates before importing
      const isDuplicate = await this.isDuplicateEmail(
        parsedEmail.messageId,
        parsedEmail.subject,
        `${parsedEmail.from.name || ''} <${parsedEmail.from.email}>`.trim(),
        parsedEmail.date
      );

      if (isDuplicate) {
        logger.warn('Skipping duplicate email', {
          subject: parsedEmail.subject,
          from: parsedEmail.from.email,
          messageId: parsedEmail.messageId
        });

        // Mark as read to avoid re-processing
        await this.markAsRead(emailData.uid);
        return;
      }

      // ALL emails go to manual review - no auto-import
      // AI suggestions are stored in aiSuggestions for user to review
      const matchesInfo = analysis.projectMatches?.map(m => ({
        code: m.projectCode,
        confidence: m.confidence,
        reasoning: m.reasoning.substring(0, 100),
      })) || [];

      logger.info('Email saved for manual review', {
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

      // Validate UID before attempting to mark as read
      if (!uid || uid <= 0) {
        logger.warn('Invalid UID for marking as read, skipping', { uid });
        resolve(); // Don't reject, just skip marking
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
              if (process.env.NODE_ENV !== 'production') {
                logger.debug('Email marked as read', { uid });
              }
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
