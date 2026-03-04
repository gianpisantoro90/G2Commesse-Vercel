import type { Express } from "express";
import { storagePromise } from "../storage";
import { billingAutomationService } from "../lib/billing-automation";
import { storage } from "../storage";
import { requireAuth } from "./middleware";

// Domain route registrations
import { registerAuthRoutes } from "./auth";
import { registerEmailWebhook, registerEmailRoutes } from "./email";
import { registerUserRoutes } from "./users";
import { registerTaskRoutes } from "./tasks";
import { registerClientRoutes } from "./clients";
import { registerProjectRoutes } from "./projects";
import { registerCommunicationRoutes } from "./communications";
import { registerNotificationRoutes } from "./notifications";
import { registerSystemRoutes } from "./system";
import { registerOneDriveRoutes } from "./onedrive";
import { registerBillingRoutes } from "./billing";
import { registerPrestazioniRoutes } from "./prestazioni";
import { registerClassificazioniRoutes } from "./classificazioni";
import { registerCRERoutes } from "./cre";
import { registerProjectFinancialRoutes } from "./project-financials";
import { registerAIRoutes } from "./ai";

export async function registerRoutes(app: Express): Promise<void> {
  // Wait for storage to be fully initialized before registering routes
  await storagePromise;

  // Initialize Billing Automation Service
  billingAutomationService.initialize(storage as any);

  // ============================================
  // PUBLIC API ENDPOINTS (No authentication required)
  // ============================================

  // Auth routes (login/logout/status) - must be before requireAuth
  registerAuthRoutes(app);

  // Email webhook - MUST be registered BEFORE requireAuth middleware
  // as it's called by external services (SendGrid)
  registerEmailWebhook(app);

  // ============================================
  // Apply authentication middleware to all API routes
  // ============================================
  app.use("/api", requireAuth);

  // ============================================
  // AUTHENTICATED API ENDPOINTS
  // ============================================

  registerUserRoutes(app);
  registerTaskRoutes(app);
  registerClientRoutes(app);
  registerProjectRoutes(app);
  registerCommunicationRoutes(app);
  registerNotificationRoutes(app);
  registerEmailRoutes(app);
  registerSystemRoutes(app);
  registerOneDriveRoutes(app);
  registerBillingRoutes(app);
  registerPrestazioniRoutes(app);
  registerClassificazioniRoutes(app);
  registerCRERoutes(app);
  registerProjectFinancialRoutes(app);
  registerAIRoutes(app);
}
