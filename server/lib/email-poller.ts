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
   * Check if storage is initialized
   */
  hasStorage(): boolean {
    return this.storage !== null;
  }

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
   * Ensure storage is available, re-importing if needed
   */
  private async ensureStorage(): Promise<IStorage> {
    if (this.storage) return this.storage;
    const { storage: s, storagePromise } = await import('../storage');
    const resolved = await storagePromise;
    this.storage = resolved || s;
    if (!this.storage) {
      throw new Error('Impossibile inizializzare lo storage');
    }
    return this.storage;
  }

  /**
   * Check for new emails (can be called manually)
   */
  async checkEmails(): Promise<{ found: number; processed: number; filtered: number; errors: string[] }> {
    if (this.isProcessing) {
      logger.debug('Email check already in progress, skipping');
      return { found: 0, processed: 0, filtered: 0, errors: [] };
    }

    if (!this.config) {
      logger.error('Email poller not configured - missing IMAP credentials in environment variables');
      throw new Error('Credenziali email non configurate. Contattare l\'amministratore.');
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
        return { found: 0, processed: 0, filtered: 0, errors: [] };
      }

      logger.info(`Found ${emails.length} new email(s)`);

      let processed = 0;
      let filtered = 0;
      const errors: string[] = [];
      // Process each email
      for (const emailData of emails) {
        try {
          const result = await this.processEmail(emailData);
          if (typeof result === 'string' && result.startsWith('filtered:')) {
            filtered++;
          } else {
            processed++;
          }
        } catch (error) {
          const subject = emailData.parsed.subject || '(senza oggetto)';
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`"${subject}": ${errorMsg}`);
          logger.error('Failed to process email', { error, subject });
        }
      }
      return { found: emails.length, processed, filtered, errors };
    } catch (error) {
      logger.error('Email check failed', { error });
      throw error;
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
                simpleParser(stream as any, (err, parsed) => {
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

      imap.once('error', (err: any) => {
        const errorMessage = err?.message || String(err);
        logger.error('IMAP connection error', { error: err, message: errorMessage });
        
        // Provide better error messages for common issues
        if (errorMessage.includes('Authentication failed') || errorMessage.includes('Invalid credentials')) {
          reject(new Error('Errore di autenticazione email: controlla le credenziali IMAP'));
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('EHOSTUNREACH')) {
          reject(new Error('Impossibile connettersi al server email'));
        } else {
          reject(err);
        }
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
   * Decide if email should be auto-assigned based on AI analysis and auto-approval config.
   */
  private shouldAutoAssignEmail(analysis: any, threshold: number): boolean {
    const matches = analysis.projectMatches || [];

    if (matches.length === 0) return false;

    // Single match: check against threshold
    if (matches.length === 1) {
      return matches[0].confidence >= threshold;
    }

    // Multiple matches: require confidence above threshold AND clear gap to 2nd
    const bestMatch = matches[0];
    const secondBest = matches[1];
    const hasClearGap = (bestMatch.confidence - secondBest.confidence) > 0.2;

    if (bestMatch.confidence >= threshold && hasClearGap) {
      logger.info('Auto-assign: Clear winner among multiple matches', {
        bestConfidence: bestMatch.confidence,
        secondConfidence: secondBest.confidence,
        gap: (bestMatch.confidence - secondBest.confidence).toFixed(2),
      });
      return true;
    }

    return false;
  }

  /**
   * Check if email already exists in database (anti-duplicate logic)
   */
  private async isDuplicateEmail(stor: IStorage, messageId: string, subject: string, sender: string, date: Date): Promise<boolean> {
    try {
      // Fetch once and reuse (avoid N+1 query)
      const allComms = await stor.getAllCommunications();

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

      // Ensure storage is available (handles Vercel cold starts)
      const stor = await this.ensureStorage();

      // Get AI config (includes API key from server-side storage)
      const aiConfigResult = await stor.getSystemConfig('ai_config');
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
        finalConfig as any
      );

      if (isSpamOrNews) {
        logger.info('Email filtered: Spam or newsletter detected', {
          subject: parsedEmail.subject,
          from: parsedEmail.from.email,
        });
        // Mark as read and skip processing
        await this.markAsRead(emailData.uid);
        return 'filtered:spam';
      }

      // Get all projects for AI matching
      const projects = await stor.getAllProjects();

      // Analyze with AI
      const analysis = await emailService.analyzeEmailWithAI(
        parsedEmail,
        projects.map(p => ({
          id: p.id,
          code: p.code,
          client: p.client,
          object: p.object,
        })),
        finalConfig as any
      );

      logger.info('AI analysis complete', {
        bestMatchCode: analysis.projectMatches?.[0]?.projectCode || 'No match',
        confidence: analysis.confidence,
        matchesCount: analysis.projectMatches?.length || 0,
      });

      // Check for duplicates before importing
      const isDuplicate = await this.isDuplicateEmail(
        stor,
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
        return 'filtered:duplicate';
      }

      // Check auto-approval configuration
      const autoApprovalConfig = await stor.getSystemConfig('ai_auto_approval');
      const autoApproval = autoApprovalConfig?.value as any || { enabled: false };

      // Determine if email should be auto-assigned to a project
      let assignedProjectId: string | null = null;
      let autoImported = false;

      if (autoApproval.enabled) {
        const threshold = autoApproval.emailAssignmentThreshold || 0.95;
        if (this.shouldAutoAssignEmail(analysis, threshold)) {
          const bestMatch = analysis.projectMatches[0];
          const matchedProject = projects.find(p => p.id === bestMatch.projectId);
          if (matchedProject) {
            assignedProjectId = matchedProject.id;
            autoImported = true;
            logger.info('Auto-approved: Email assigned to project', {
              projectCode: matchedProject.code,
              confidence: bestMatch.confidence,
              threshold,
            });
          }
        }
      }

      // Store email (auto-assigned or for manual review)
      const communication = await stor.createCommunication({
        projectId: assignedProjectId,
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
        autoImported,
        aiSuggestions: analysis,
        importedAt: new Date(),
      });

      logger.info(autoImported ? 'Communication auto-assigned to project' : 'Communication saved for manual review', {
        communicationId: communication.id,
        autoImported,
        matchesCount: analysis.projectMatches?.length || 0,
        bestMatch: analysis.projectMatches?.[0]?.projectCode,
        bestConfidence: analysis.projectMatches?.[0]?.confidence,
      });

      // Auto-create tasks if enabled and project is assigned
      if (autoApproval.enabled && assignedProjectId && analysis.suggestedTasks && analysis.suggestedTasks.length > 0) {
        const taskThreshold = autoApproval.taskCreationThreshold || 0.90;
        if (analysis.confidence >= taskThreshold) {
          const aiTasksStatus: Record<string, any> = {};

          for (let i = 0; i < analysis.suggestedTasks.length; i++) {
            const suggestedTask = analysis.suggestedTasks[i];
            try {
              const newTask = await stor.createTask({
                title: suggestedTask.title,
                description: suggestedTask.description || null,
                projectId: assignedProjectId,
                assignedToId: null,
                createdById: "system",
                priority: suggestedTask.priority,
                status: 'pending',
                dueDate: suggestedTask.dueDate ? new Date(suggestedTask.dueDate) : null,
                notes: `Task auto-creato dall'AI dalla comunicazione: ${parsedEmail.subject}\n\nRagionamento: ${suggestedTask.reasoning}`,
              });

              aiTasksStatus[i] = {
                action: 'approved',
                taskId: newTask.id,
                approvedAt: new Date().toISOString(),
                approvedBy: 'auto-approval',
              };

              logger.info('Auto-approved: Task created', {
                taskTitle: suggestedTask.title,
                confidence: analysis.confidence,
              });
            } catch (error) {
              logger.error('Failed to auto-create task', { error, taskTitle: suggestedTask.title });
            }
          }

          if (Object.keys(aiTasksStatus).length > 0) {
            await stor.updateCommunication(communication.id, { aiTasksStatus });
          }
        }
      }

      // Auto-create deadlines if enabled and project is assigned
      if (autoApproval.enabled && assignedProjectId && analysis.suggestedDeadlines && analysis.suggestedDeadlines.length > 0) {
        const deadlineThreshold = autoApproval.deadlineCreationThreshold || 0.90;
        if (analysis.confidence >= deadlineThreshold) {
          const aiDeadlinesStatus: Record<string, any> = {};

          for (let i = 0; i < analysis.suggestedDeadlines.length; i++) {
            const suggestedDeadline = analysis.suggestedDeadlines[i];
            try {
              const newDeadline = await stor.createDeadline({
                projectId: assignedProjectId,
                title: suggestedDeadline.title,
                description: suggestedDeadline.description || null,
                dueDate: new Date(suggestedDeadline.dueDate),
                priority: suggestedDeadline.priority,
                type: suggestedDeadline.type,
                status: 'pending',
                notifyDaysBefore: suggestedDeadline.notifyDaysBefore || 7,
              });

              aiDeadlinesStatus[i] = {
                action: 'approved',
                deadlineId: newDeadline.id,
                approvedAt: new Date().toISOString(),
                approvedBy: 'auto-approval',
              };

              logger.info('Auto-approved: Deadline created', {
                deadlineTitle: suggestedDeadline.title,
                confidence: analysis.confidence,
              });
            } catch (error) {
              logger.error('Failed to auto-create deadline', { error, deadlineTitle: suggestedDeadline.title });
            }
          }

          if (Object.keys(aiDeadlinesStatus).length > 0) {
            await stor.updateCommunication(communication.id, { aiDeadlinesStatus });
          }
        }
      }

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

      imap.once('error', (err: any) => {
        logger.error('IMAP error while marking as read', { error: err });
        reject(err);
      });

      imap.connect();
    });
  }
}

// Export singleton instance
export const emailPoller = new EmailPoller();
