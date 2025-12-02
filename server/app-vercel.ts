/**
 * Express App for Vercel Serverless Deployment
 * Configured for zero-cost Turso + Vercel deployment
 */

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { logger, requestLogger } from "./lib/logger";

// Determine which storage to use based on environment
const usesTurso = !!process.env.TURSO_DATABASE_URL;

export function createApp() {
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
          "wss:",
          "ws:",
          "https:",
          "https://api.anthropic.com",
          "https://api.deepseek.com",
          "https://graph.microsoft.com",
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

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  // Request logging
  app.use(requestLogger);

  // Session configuration for Vercel (stateless - using cookies only)
  const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

  app.use(session({
    secret: sessionSecret,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 30, // 30 minutes
      sameSite: 'lax'
    },
    rolling: true
  }));

  // Apply rate limiting to API routes
  app.use('/api', apiLimiter);

  // API logging middleware
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/get-env-api-key',
    '/api/test-claude'
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
        console.log(logLine);
      }
    });

    next();
  });

  // Register API routes
  registerRoutes(app);

  // Error handler
  app.use(errorHandler);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: usesTurso ? 'turso' : 'memory',
      env: process.env.NODE_ENV
    });
  });

  // Debug endpoint (temporary - remove after fixing)
  app.get('/api/debug', async (req, res) => {
    try {
      // Direct libsql query - bypass storage layer
      const { createClient } = await import('@libsql/client');

      const url = process.env.TURSO_DATABASE_URL || '';
      const authToken = process.env.TURSO_AUTH_TOKEN || '';

      const client = createClient({ url, authToken });
      const result = await client.execute('SELECT username, email, role, active FROM users');

      res.json({
        method: 'direct_libsql',
        turso_url: url.substring(0, 60) + '...',
        token_length: authToken.length,
        users_count: result.rows.length,
        users: result.rows
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
        turso_url: process.env.TURSO_DATABASE_URL?.substring(0, 60),
        token_set: !!process.env.TURSO_AUTH_TOKEN,
      });
    }
  });

  return app;
}

// For local development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const app = createApp();
  const port = parseInt(process.env.PORT || '5000', 10);

  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📦 Storage: ${usesTurso ? 'Turso' : 'Memory/File'}`);
  });
}
