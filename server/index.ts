import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./middleware/error-handler";
import { logger, requestLogger } from "./lib/logger";

const app = express();

// Configure trust proxy for Replit's reverse proxy
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
// In development, disable CSP to allow Replit Preview to work
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https://api.anthropic.com", "https://api.deepseek.com", "https://graph.microsoft.com"],
        frameSrc: ["'none'"],
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
  // Development: minimal helmet config to allow Replit Preview
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP in development
    hsts: false, // Disable HSTS in development
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
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' // Less restrictive in dev for Replit Preview
  },
  rolling: true // Extend session on each request
}));

// Security: Sensitive endpoints that should not be logged in detail
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
  const server = await registerRoutes(app);

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
    // Use Replit domain if available, otherwise fallback to localhost
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `http://localhost:${port}`;
    
    logger.info(`Server started successfully on port ${port}`, {
      url: baseUrl,
      nodeEnv: process.env.NODE_ENV,
    });
    console.log(`\n🚀 G2 Ingegneria avviato con successo!`);
    console.log(`📱 Apri: ${baseUrl}`);
    console.log(`⏹️  Premi Ctrl+C per fermare\n`);
  });
})();
