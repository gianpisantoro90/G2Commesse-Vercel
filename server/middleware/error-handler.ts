import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error types for better categorization
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * Centralized error handling middleware
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error details (excluding sensitive data)
  const logError = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  };

  console.error('❌ Error:', logError);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Dati non validi',
      code: ErrorType.VALIDATION_ERROR,
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: process.env.NODE_ENV !== 'production' ? err.details : undefined,
    });
  }

  // Handle known error types
  if (err.message?.includes('not found')) {
    return res.status(404).json({
      success: false,
      error: 'Risorsa non trovata',
      code: ErrorType.NOT_FOUND,
    });
  }

  if (err.message?.includes('unauthorized') || err.message?.includes('authentication')) {
    return res.status(401).json({
      success: false,
      error: 'Autenticazione richiesta',
      code: ErrorType.AUTHENTICATION_ERROR,
    });
  }

  if (err.message?.includes('forbidden') || err.message?.includes('permission')) {
    return res.status(403).json({
      success: false,
      error: 'Permesso negato',
      code: ErrorType.AUTHORIZATION_ERROR,
    });
  }

  if (err.message?.includes('conflict') || err.message?.includes('already exists')) {
    return res.status(409).json({
      success: false,
      error: 'Conflitto con risorsa esistente',
      code: ErrorType.CONFLICT,
    });
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    success: false,
    error: 'Errore interno del server',
    code: ErrorType.INTERNAL_SERVER_ERROR,
    details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request validation helper
 */
export function validateRequest(schema: any, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Sanitize error message to remove sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove potential file paths
  message = message.replace(/([A-Z]:\\|\/)[^\s]+/g, '[PATH]');

  // Remove potential API keys
  message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY]');

  // Remove potential passwords
  message = message.replace(/password[:\s=]+[^\s]+/gi, 'password=[REDACTED]');

  return message;
}
