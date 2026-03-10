import type { Express } from "express";
import { storage, storagePromise } from "../storage";
import { emailService } from "../lib/email-service";
import { emailPoller } from "../lib/email-poller";
import { logger } from "../lib/logger";

/**
 * Register the email webhook endpoint.
 * This MUST be called BEFORE requireAuth middleware is applied,
 * as it's called by external services (SendGrid).
 */
export function registerEmailWebhook(app: Express): void {
  app.post("/api/email/webhook", async (req, res) => {
    try {
      // Parse email from SendGrid webhook
      const parsedEmail = emailService.parseSendGridWebhook(req.body);

      // Get all projects for AI matching
      const projects = await storage.getAllProjects();

      // Get AI config for analysis (includes API key from server-side storage)
      const aiConfigResult = await storage.getSystemConfig('ai_config');
      const storedConfig = aiConfigResult?.value;

      const finalConfig: any = storedConfig || process.env.ANTHROPIC_API_KEY;

      // Analyze email with AI
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

      const bestMatchCode = analysis.projectMatches?.[0]?.projectCode || 'No match';

      // Store email for manual review (no auto-import)
      const communication = await storage.createCommunication({
        projectId: null, // Will be assigned during manual review
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


      res.json({
        success: true,
        imported: false,
        communicationId: communication.id,
        reason: 'Stored for manual review',
        suggestions: {
          matchesCount: analysis.projectMatches?.length || 0,
          bestMatch: analysis.projectMatches?.[0],
          confidence: analysis.confidence,
          extractedData: analysis.extractedData,
        },
      });
    } catch (error) {
      console.error('❌ Email webhook error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Register authenticated email endpoints (send, test, check-now).
 * These require authentication.
 */
export function registerEmailRoutes(app: Express): void {
  /**
   * Send email from the application
   */
  app.post("/api/email/send", async (req, res) => {
    try {
      const { to, subject, text, html, communicationId, projectId } = req.body;

      if (!to || !subject || !text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, text'
        });
      }

      // Send email
      const result = await emailService.sendEmail({
        to,
        subject,
        text,
        html,
        from: process.env.EMAIL_FROM,
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      // If this is linked to a communication, update it with sent info
      if (communicationId) {
        await storage.updateCommunication(communicationId, {
          emailMessageId: result.messageId,
        });
      }

      // If projectId provided, create a new outgoing communication record
      if (projectId && !communicationId) {
        await storage.createCommunication({
          projectId,
          type: 'email',
          direction: 'outgoing',
          subject,
          body: text,
          recipient: Array.isArray(to) ? to.join(', ') : to,
          sender: process.env.EMAIL_FROM || 'G2 Ingegneria',
          emailMessageId: result.messageId,
          emailText: text,
          emailHtml: html,
          communicationDate: new Date(),
        });
      }

      res.json({
        success: true,
        messageId: result.messageId,
      });
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Test SMTP connection and configuration
   */
  app.post("/api/email/test", async (req, res) => {
    try {
      emailService.initialize();
      const isConnected = await emailService.verifyConnection();

      if (isConnected) {
        res.json({
          success: true,
          message: 'SMTP connection successful',
        });
      } else {
        res.json({
          success: false,
          message: 'SMTP connection failed. Check your configuration.',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Manual email check endpoint (replaces automatic polling)
  app.post("/api/emails/check-now", async (req, res) => {
    try {
      // Ensure email poller has storage (may be lost on Vercel cold starts)
      if (!emailPoller.hasStorage()) {
        logger.info('Re-initializing email poller with storage');
        const resolvedStorage = await storagePromise;
        emailPoller.initialize(resolvedStorage);
      }
      logger.info('Manual email check triggered by user');
      const result = await emailPoller.checkEmails();
      let message: string;
      if (result.found === 0) {
        message = "Nessuna nuova email trovata";
      } else {
        const parts: string[] = [`Trovate ${result.found} email`];
        if (result.processed > 0) parts.push(`${result.processed} elaborate`);
        if (result.filtered > 0) parts.push(`${result.filtered} filtrate (spam/duplicati)`);
        if (result.errors.length > 0) parts.push(`${result.errors.length} errori`);
        message = parts.join(', ');
      }
      res.json({ message, status: "success", ...result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore nel controllo delle email";
      logger.error('Error during manual email check:', { error, message: errorMessage });
      res.status(500).json({ message: errorMessage, status: "error" });
    }
  });
}
