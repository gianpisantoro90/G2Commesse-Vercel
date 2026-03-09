/**
 * Express App for Vercel Serverless Deployment
 * Configured for Neon PostgreSQL + Vercel deployment
 */

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
// @ts-expect-error no types available
import pgSimple from "connect-pg-simple";
import pg from "pg";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { logger, requestLogger } from "./lib/logger";
import { emailPoller } from "./lib/email-poller";

export async function createApp() {
  const app = express();

  // Trust proxy for Vercel
  app.set('trust proxy', 1);

  // CORS for Vercel
  app.use(cors({
    origin: process.env.VERCEL_URL
      ? [`https://${process.env.VERCEL_URL}`, 'http://localhost:3000', 'http://localhost:5000']
      : true,
    credentials: true,
  }));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https:",
          "https://api.anthropic.com",
          "https://api.deepseek.com",
          "https://graph.microsoft.com",
          "https://login.microsoftonline.com",
          "https://fonts.googleapis.com",
        ],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Troppe richieste da questo IP. Riprova tra un minuto.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Decompress gzip requests (used by import to stay under Vercel's 4.5MB limit)
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-encoding'] === 'gzip') {
      try {
        const { createGunzip } = await import('zlib');
        const chunks: Buffer[] = [];
        const gunzip = createGunzip();

        req.pipe(gunzip);
        gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
        gunzip.on('end', () => {
          const decompressed = Buffer.concat(chunks).toString('utf-8');
          try {
            req.body = JSON.parse(decompressed);
          } catch {
            req.body = decompressed;
          }
          delete req.headers['content-encoding'];
          next();
        });
        gunzip.on('error', (err: Error) => {
          console.error('Gzip decompression error:', err);
          res.status(400).json({ error: 'Invalid gzip data' });
        });
        return;
      } catch (err) {
        console.error('Gzip setup error:', err);
      }
    }
    next();
  });

  // Parse JSON body (skip if Vercel's bodyParser already parsed it)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      return next();
    }
    express.json({ limit: '50mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  // Request logging
  app.use(requestLogger);

  // Session configuration for Vercel (persistent store in Neon PostgreSQL)
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET environment variable must be set and at least 32 characters long');
  }
  const sessionSecret = process.env.SESSION_SECRET;

  // PostgreSQL session store (uses standard pg Pool over TCP, not WebSocket)
  const PgStore = pgSimple(session);
  const sessionPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  // Ensure sessions table exists before starting the store
  try {
    const client = await sessionPool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
    `);
    client.release();
    // Session table ready
  } catch (err) {
    console.error('⚠️ Could not ensure session table:', err);
  }

  app.use(session({
    store: new PgStore({
      pool: sessionPool,
      tableName: 'user_sessions',
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 min
    }),
    secret: sessionSecret,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours (longer for serverless)
      sameSite: 'lax', // 'lax' needed for cross-domain Vercel preview URLs
    },
    rolling: true,
  }));

  // Apply rate limiting to API routes
  app.use('/api', apiLimiter);

  // API logging middleware
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/ai/key-status',
    '/api/ai/test-connection',
    '/api/ai/config'
  ];

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        const isSensitive = sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
        if (capturedJsonResponse && !isSensitive) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        logger.info(logLine);
      }
    });

    next();
  });

  // Vercel Cron Job endpoints (protected by CRON_SECRET)
  function verifyCronSecret(authHeader: string | undefined): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret || !authHeader) return false;
    return authHeader === `Bearer ${secret}`;
  }

  app.get('/api/cron/notifications', async (req, res) => {
    if (!verifyCronSecret(req.headers['authorization'] as string | undefined)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { notificationService } = await import('./lib/notification-service');
      const { storage, storagePromise } = await import('./storage');
      await storagePromise;

      await notificationService.checkDeadlines(storage);
      await notificationService.checkInvoices(storage);
      await notificationService.checkBudgets(storage);
      notificationService.clearOldNotifications();

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Cron notification check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/cron/billing', async (req, res) => {
    if (!verifyCronSecret(req.headers['authorization'] as string | undefined)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { billingAutomationService } = await import('./lib/billing-automation');
      const { storage, storagePromise } = await import('./storage');
      await storagePromise;

      billingAutomationService.initialize(storage as any);
      await billingAutomationService.checkAllAlerts();

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Cron billing check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check endpoint (before auth middleware in registerRoutes)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: 'neon',
      env: process.env.NODE_ENV
    });
  });

  // Initialize email poller for manual check-now endpoint
  const { storage: emailStorage, storagePromise: emailStoragePromise } = await import('./storage');
  await emailStoragePromise;
  emailPoller.initialize(emailStorage);

  // Register API routes
  await registerRoutes(app);

  // Error handler
  app.use(errorHandler);

  return app;
}
