import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// Extend session interface to include user data
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    userId?: string;
    username?: string;
    fullName?: string;
    role?: 'admin' | 'user';
  }
}

// Authentication middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.authenticated) {
    return next();
  }

  // Allow only auth-related endpoints without authentication
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  return res.status(401).json({ message: "Authentication required" });
};

// Admin-only middleware
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.authenticated && req.session.role === 'admin') {
    return next();
  }

  return res.status(403).json({ message: "Admin access required" });
};

// Security: Rate limiter for login endpoint
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts
  message: 'Troppi tentativi di login da questo IP. Riprova tra 15 minuti.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});
