import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/error-handler";
import { logger, requestLogger } from "./lib/logger";
import { emailService } from "./lib/email-service";
import { emailPoller } from "./lib/email-poller";
import { notificationService } from "./lib/notification-service";
import { storage, storagePromise } from "./storage";

const app = express();

// Configure trust proxy for reverse proxy (Vercel/Nginx)
app.set('trust proxy', 1);

// Security: Validate required environment variables
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  logger.error('SESSION_SECRET environment variable must be set and at least 32 characters long');
  logger.info('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

logger.info('Starting G2 Gestione Commesse server', {
  nodeEnv: process.env.NODE_ENV,
  platform: process.platform,
});

// Security: Apply helmet middleware for security headers
// In development, disable CSP for local preview
if (process.env.NODE_ENV === 'production') {
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
          "https://login.microsoftonline.com",
          "https://fonts.googleapis.com"
        ],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
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
} else {
  // Development: minimal helmet config for preview
  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }));
}

// Security: Rate limiting for general API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Troppe richieste da questo IP. Riprova tra un minuto.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Add request logging middleware
app.use(requestLogger);

// Security: Enhanced session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'sessionId', // Don't use default 'connect.sid'
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 30, // 30 minutes
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  rolling: true // Extend session on each request
}));

// Security: Sensitive endpoints that should not be logged in detail
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

      // Don't log response body for sensitive endpoints
      const isSensitive = sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
      if (capturedJsonResponse && !isSensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (isSensitive) {
        logLine += ` :: [sensitive data hidden]`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(app);
  const server = createServer(app);

  // Wait for storage to be ready
  await storagePromise;

  // Auto-fix prestazioni amounts on startup (repairs data where importoFatturato is missing)
  try {
    const fixResult = await storage.fixPrestazioniAmounts();
    if (fixResult.fixed > 0) {
      logger.info(`Auto-fixed ${fixResult.fixed} prestazioni with missing importoFatturato/importoPagato`);
    }
  } catch (err) {
    logger.warn('Failed to auto-fix prestazioni amounts', { error: err });
  }

  // Initialize email service for AI-powered email processing
  emailService.initialize();

  // Initialize email poller for automatic email checking (IMAP)
  emailPoller.initialize(storage);

  // Initialize WebSocket notification service
  notificationService.initialize(server);

  // Schedule periodic notification checks (every 15 minutes)
  setInterval(() => {
    notificationService.checkDeadlines(storage);
    notificationService.checkInvoices(storage);
    notificationService.checkBudgets(storage);
    notificationService.clearOldNotifications();
  }, 15 * 60 * 1000);

  // Run initial notification check after 10 seconds
  setTimeout(() => {
    notificationService.checkDeadlines(storage);
    notificationService.checkInvoices(storage);
    notificationService.checkBudgets(storage);
  }, 10000);

  // Use centralized error handler (must be after routes)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development" || process.env.NODE_ENV === "local") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  
  // Enhanced error handling for server
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' || err.code === 'ENOTSUP') {
      logger.error(`Port ${port} already in use or not supported`, { code: err.code });
      logger.info('Solutions:');
      logger.info('1. Close other processes on the port');
      logger.info(`2. Use a different port: PORT=3001 npm run dev`);
      logger.info('3. On Windows, use: start-windows.bat or start-windows.ps1');
      process.exit(1);
    } else {
      logger.error('Server error', { error: err.message, code: err.code });
      process.exit(1);
    }
  });

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: process.platform !== 'win32', // reusePort not supported on Windows
  }, () => {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${port}`;
    
    logger.info(`Server started successfully on port ${port}`, {
      url: baseUrl,
      nodeEnv: process.env.NODE_ENV,
    });
  });
})();
